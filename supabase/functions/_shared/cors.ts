// A wildcard Access-Control-Allow-Origin lets any third-party page call this
// function from a visitor's browser using our public anon key -- fine for a
// read-only public endpoint, but mpesa-initiate can trigger a real M-Pesa
// STK push (a PIN prompt on someone's phone), so it's scoped to our own
// deployed origin(s) instead. Set ALLOWED_ORIGINS (comma-separated) in the
// edge function's secrets; falls back to "*" only when unset, so this
// doesn't silently break local/preview deployments that haven't set it yet.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeadersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

// Kept for callers that haven't been updated to the per-request variant yet.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
