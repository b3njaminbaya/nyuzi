import { supabase } from "@/lib/supabase";

export type DonationSubmission = {
  title: string;
  category: "clothing" | "shoes" | "accessories" | "other";
  condition: number;
  notes?: string;
  photoCount: number;
  pickupRequested: boolean;
  pickupDate?: string;
  pickupAddress?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
};

export type PartnerApplication = {
  fullName: string;
  email: string;
  organization: string;
  partnershipType: "Upcycling Studio" | "Recycler" | "Logistics Provider" | "NGO";
  message: string;
};

export async function submitDonation(entry: DonationSubmission) {
  // Generated client-side, same reasoning as orders: a guest insert can't
  // rely on `.select()` to read its own row back afterward, and we need
  // the id right away to attach uploaded photos to it.
  const id = crypto.randomUUID();

  const { error } = await supabase.from("donations").insert({
    id,
    title: entry.title,
    category: entry.category,
    condition: entry.condition,
    notes: entry.notes || null,
    // Provisional -- the real count is written back by
    // updateDonationPhotoCount() once uploads actually finish, since some
    // can fail after this row is created.
    photo_count: entry.photoCount,
    pickup_requested: entry.pickupRequested,
    pickup_date: entry.pickupDate || null,
    pickup_address: entry.pickupAddress || null,
    contact_name: entry.contactName,
    contact_phone: entry.contactPhone,
    contact_email: entry.contactEmail || null,
  });

  if (error) return { donationId: null, error: error.message };
  return { donationId: id, error: null };
}

// Photos are uploaded after the donation row is created (see
// uploadDonationPhotos), and some can fail independently of others -- this
// reconciles photo_count with how many actually made it to storage, so
// admins reviewing a donation never see a photo badge that opens to fewer
// images than it claims.
export async function updateDonationPhotoCount(donationId: string, count: number) {
  const { error } = await supabase.from("donations").update({ photo_count: count }).eq("id", donationId);
  return { error: error?.message ?? null };
}

export async function submitPartnerApplication(entry: PartnerApplication) {
  const { error } = await supabase.from("partner_applications").insert({
    full_name: entry.fullName,
    email: entry.email,
    organization: entry.organization,
    partnership_type: entry.partnershipType,
    message: entry.message,
  });
  return { error: error?.message ?? null };
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function submitNewsletterSignup(email: string) {
  const { error } = await supabase.from("newsletter_signups").insert({ email });
  if (error && error.code === POSTGRES_UNIQUE_VIOLATION) {
    // Already subscribed — treat as success rather than surfacing an error.
    return { error: null };
  }
  return { error: error?.message ?? null };
}

export type MyDonation = {
  id: string;
  title: string;
  category: string;
  condition: number;
  status: "submitted" | "scheduled" | "collected" | "processed";
  pickup_requested: boolean;
  pickup_date: string | null;
  pickup_address: string | null;
  photo_count: number;
  created_at: string;
};

export async function listMyDonations(userId: string) {
  const { data, error } = await supabase
    .from("donations")
    .select("id, title, category, condition, status, pickup_requested, pickup_date, pickup_address, photo_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: (data as MyDonation[] | null) ?? [], error: error?.message ?? null };
}
