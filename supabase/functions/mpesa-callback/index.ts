// Public webhook Safaricom calls after an STK push is completed (or fails).
// Must always respond 200 with ResultCode 0 quickly, per Daraja's contract,
// regardless of whether the payment itself succeeded.
//
// SECURITY: Daraja does not sign its callbacks, and mpesa-initiate hands the
// CheckoutRequestID straight to the browser that started the STK push (it
// has to, to poll for the result) -- so that id alone can never be treated
// as proof the request came from Safaricom. Anyone who knows an order's
// CheckoutRequestID could otherwise POST a fabricated ResultCode: 0 payload
// directly to this URL and mark their own unpaid order "paid" for free.
//
// Mitigated two ways: (1) MPESA_CALLBACK_SECRET must be embedded as a query
// param on the MPESA_CALLBACK_URL configured in mpesa-initiate (e.g.
// `.../mpesa-callback?token=<secret>`) -- Safaricom echoes the full URL back
// verbatim on every callback, so only someone who already knows the secret
// (or is actually Safaricom) can produce a request that passes. Requests
// without a matching token are rejected outright: fail closed, not open.
// (2) Even with a valid token, the update only ever applies to an order
// that is still `pending_payment` with a matching CheckoutRequestID -- so a
// replayed or late callback can never resurrect an order that was already
// cancelled/failed (and had its stock returned) back to "paid".
import { createClient } from "npm:@supabase/supabase-js@2";

const CALLBACK_SECRET = Deno.env.get("MPESA_CALLBACK_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

Deno.serve(async (req) => {
  try {
    // Fail closed: if the secret isn't configured, refuse everything rather
    // than silently accepting unauthenticated payment confirmations.
    const token = new URL(req.url).searchParams.get("token");
    if (!CALLBACK_SECRET || token !== CALLBACK_SECRET) {
      return new Response(JSON.stringify(ACK), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const payload = await req.json();
    const stkCallback = payload?.Body?.stkCallback;

    if (!stkCallback?.CheckoutRequestID) {
      return new Response(JSON.stringify(ACK), { headers: { "Content-Type": "application/json" } });
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    if (ResultCode === 0) {
      const items: Array<{ Name: string; Value: string | number }> = CallbackMetadata?.Item ?? [];
      const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

      await supabase
        .from("orders")
        .update({ status: "paid", mpesa_receipt_number: receipt ? String(receipt) : null })
        .eq("mpesa_checkout_request_id", CheckoutRequestID)
        .eq("status", "pending_payment");
    } else {
      await supabase
        .from("orders")
        .update({ status: "payment_failed" })
        .eq("mpesa_checkout_request_id", CheckoutRequestID)
        .eq("status", "pending_payment");
    }

    return new Response(JSON.stringify(ACK), { headers: { "Content-Type": "application/json" } });
  } catch {
    // Still acknowledge — Daraja retries aggressively on non-200s and we
    // don't want a malformed payload to trigger a retry storm.
    return new Response(JSON.stringify(ACK), { headers: { "Content-Type": "application/json" } });
  }
});
