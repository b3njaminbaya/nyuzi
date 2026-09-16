// Nyuzi only ever charges Kenyan Shillings (the storefront is Kenya-only and
// the only payment rail is M-Pesa), but prices used to be rendered with a
// literal "$" everywhere -- this is the one place that formats an amount for
// display, so the whole app stays consistent if that ever needs to change.
export function formatKES(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
