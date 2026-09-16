import { supabase } from "@/lib/supabase";

export type MyRewards = { referralCode: string; creditBalance: number };

export type ReferralRewardAmounts = { referrerReward: number; refereeReward: number };

// Single source of truth lives in the database (migration 0024) -- fetched
// rather than hardcoded so this copy can never drift from what
// grant_referral_reward() actually pays out.
export async function getReferralRewardAmounts() {
  const { data, error } = await supabase.rpc("get_referral_reward_amounts");
  const row = Array.isArray(data) ? (data[0] as { referrer_reward: number; referee_reward: number } | undefined) : null;
  return {
    data: row ? { referrerReward: Number(row.referrer_reward), refereeReward: Number(row.referee_reward) } : null,
    error: error?.message ?? null,
  };
}

// Fetched fresh (not from the cached auth-context profile) since balance
// can change from actions elsewhere -- a referral reward landing while
// browsing, credit spent on an earlier order in another tab, etc.
export async function getMyRewards(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("referral_code, credit_balance")
    .eq("id", userId)
    .single();
  if (error || !data) return { data: null, error: error?.message ?? null };
  return {
    data: { referralCode: data.referral_code, creditBalance: Number(data.credit_balance) } as MyRewards,
    error: null,
  };
}
