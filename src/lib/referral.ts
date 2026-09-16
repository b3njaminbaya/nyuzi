const STORAGE_KEY = "nyuzi:referral_code";

// Captures ?ref=CODE from the URL into local storage so it survives
// browsing between landing on a referral link and actually signing up.
export function captureReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.trim()) {
    localStorage.setItem(STORAGE_KEY, ref.trim());
  }
}

export function getStoredReferralCode(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

// Called once a signup has actually used the stored code. Without this, a
// second, unrelated person signing up on the same browser/device (a shared
// or public computer, or the same person signing out and someone else
// signing in right after) would silently be attributed to the first
// referral code too.
export function clearStoredReferralCode() {
  localStorage.removeItem(STORAGE_KEY);
}
