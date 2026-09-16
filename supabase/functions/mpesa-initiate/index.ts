// Initiates an M-Pesa STK Push (Lipa Na M-Pesa Online) for a given order.
// Deliberately never throws on missing config — returns { configured: false }
// so the frontend can fall back to a manual-payment flow instead of breaking
// checkout for stores that haven't set up Daraja credentials yet.
//
// SECURITY: an STK push is a real PIN prompt sent to a real phone number,
// and this endpoint used to accept any order id + any phone number from
// anyone, with a wildcard CORS header. That made it usable to spam an
// arbitrary Kenyan phone number with unwanted M-Pesa prompts by scripting
// guest checkouts. Two mitigations: (1) if the order belongs to a signed-in
// user, the caller's own JWT must match that user -- a guest order (no
// user_id) can still be paid by whoever has the order id, matching how
// guest checkout already works everywhere else in this app. (2) a simple
// per-IP rate limit (5 attempts / 15 minutes) logged in
// mpesa_initiate_attempts, since ownership alone doesn't stop someone from
// creating many cheap guest orders and initiating STK pushes to a victim's
// number from each one.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY");
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
const SHORTCODE = Deno.env.get("MPESA_SHORTCODE");
const PASSKEY = Deno.env.get("MPESA_PASSKEY");
const CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL");
const ENV = Deno.env.get("MPESA_ENV") ?? "sandbox";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BASE_URL =
  ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

const isConfigured = Boolean(CONSUMER_KEY && CONSUMER_SECRET && SHORTCODE && PASSKEY && CALLBACK_URL);

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  // Hoisted so the outer catch (e.g. a Daraja auth/network failure after the
  // order was already found) can also release the order's reserved stock
  // instead of leaving it stuck at pending_payment with no callback ever
  // coming.
  let currentOrderId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isConfigured) {
    // Trusted, service-role transition — the client is never allowed to set
    // order status directly (that would let anyone mark their own order
    // "paid" via the REST API).
    try {
      const { orderId } = await req.json();
      if (orderId) {
        await supabase
          .from("orders")
          .update({ status: "awaiting_manual_payment" })
          .eq("id", orderId);
      }
    } catch {
      // Malformed body — still report unconfigured below.
    }
    return new Response(JSON.stringify({ configured: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { orderId, phone } = await req.json();
    if (!orderId || !phone) {
      return new Response(JSON.stringify({ error: "orderId and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = clientIp(req);
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabase
      .from("mpesa_initiate_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          configured: true,
          success: false,
          error: "Too many payment attempts from this connection. Please try again later.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ configured: true, success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    currentOrderId = order.id;

    // Guest orders (no owner) can be paid by whoever has the order id, same
    // as the rest of the guest-checkout flow. An order that does belong to
    // an account can only have payment initiated by that same account.
    if (order.user_id) {
      const authHeader = req.headers.get("authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: callerData } = await callerClient.auth.getUser();
      if (!callerData?.user || callerData.user.id !== order.user_id) {
        return new Response(
          JSON.stringify({ configured: true, success: false, error: "You don't have access to this order" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await supabase.from("mpesa_initiate_attempts").insert({ ip, order_id: order.id });

    const accessToken = await getAccessToken();
    const ts = timestamp();
    const password = btoa(`${SHORTCODE}${PASSKEY}${ts}`);
    const amount = Math.max(1, Math.round(Number(order.total_amount)));

    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: CALLBACK_URL,
        AccountReference: order.id.slice(0, 12),
        TransactionDesc: "Nyuzi order",
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      // A synchronous rejection from Daraja means no callback will ever
      // arrive for this order -- leaving it at pending_payment would lock
      // its stock forever (until the 20-minute sweep in create_order).
      // Failing it immediately releases that stock right away via
      // restock_on_order_failure, so the customer can safely retry.
      await supabase
        .from("orders")
        .update({ status: "payment_failed" })
        .eq("id", order.id)
        .eq("status", "pending_payment");

      return new Response(
        JSON.stringify({
          configured: true,
          success: false,
          error: stkData.errorMessage || stkData.ResponseDescription || "STK push failed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("orders")
      .update({ mpesa_checkout_request_id: stkData.CheckoutRequestID })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ configured: true, success: true, checkoutRequestId: stkData.CheckoutRequestID }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (currentOrderId) {
      try {
        await supabase
          .from("orders")
          .update({ status: "payment_failed" })
          .eq("id", currentOrderId)
          .eq("status", "pending_payment");
      } catch {
        // Best-effort -- the original error below is what matters to the caller.
      }
    }
    return new Response(
      JSON.stringify({ configured: true, success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
