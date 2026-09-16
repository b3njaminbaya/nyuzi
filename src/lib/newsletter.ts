import { supabase } from "@/lib/supabase";

export type NewsletterSignup = {
  id: string;
  email: string;
  created_at: string;
};

export async function listNewsletterSignups() {
  const { data, error } = await supabase
    .from("newsletter_signups")
    .select("id, email, created_at")
    .order("created_at", { ascending: false });
  return { data: (data as NewsletterSignup[] | null) ?? [], error: error?.message ?? null };
}
