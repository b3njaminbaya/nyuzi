import { supabase } from "@/lib/supabase";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  reviewerName: string;
  createdAt: string;
};

export type MyReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  rejectionReason: string | null;
};

export type ReviewForModeration = {
  id: string;
  productId: string;
  productTitle: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  rejectionReason: string | null;
  reviewerName: string;
  reviewerEmail: string;
  createdAt: string;
};

export async function listApprovedReviews(productId: string) {
  const { data, error } = await supabase.rpc("list_approved_reviews", { p_product_id: productId });
  type Row = {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    verified_purchase: boolean;
    reviewer_name: string;
    created_at: string;
  };
  const reviews: Review[] = ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verifiedPurchase: r.verified_purchase,
    reviewerName: r.reviewer_name,
    createdAt: r.created_at,
  }));
  return { data: reviews, error: error?.message ?? null };
}

export async function getMyReviewForProduct(productId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, title, body, status, rejection_reason")
    .eq("product_id", productId)
    .maybeSingle();
  const row = data as (Omit<MyReview, "rejectionReason"> & { rejection_reason: string | null }) | null;
  return {
    data: row ? { ...row, rejectionReason: row.rejection_reason } : null,
    error: error?.message ?? null,
  };
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function submitReview(productId: string, rating: number, title: string, body: string) {
  const { error } = await supabase.from("reviews").insert({
    product_id: productId,
    rating,
    title: title.trim() || null,
    body: body.trim() || null,
  });
  if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
    return { error: "You've already reviewed this product." };
  }
  return { error: error?.message ?? null };
}

// Lets a customer fix and resubmit a review that was rejected. The RLS
// policy backing this (migration 0024) only allows a reviewer to move their
// own review from 'rejected' back to 'pending' -- any other status value
// here is rejected at the database level, so this can't be used to
// self-approve.
export async function resubmitReview(id: string, rating: number, title: string, body: string) {
  const { error } = await supabase
    .from("reviews")
    .update({
      rating,
      title: title.trim() || null,
      body: body.trim() || null,
      status: "pending",
      rejection_reason: null,
    })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function listReviewsForModeration() {
  const { data, error } = await supabase.rpc("list_reviews_for_moderation");
  type Row = {
    id: string;
    product_id: string;
    product_title: string;
    rating: number;
    review_title: string | null;
    review_body: string | null;
    verified_purchase: boolean;
    status: ReviewStatus;
    rejection_reason: string | null;
    reviewer_name: string;
    reviewer_email: string;
    created_at: string;
  };
  const reviews: ReviewForModeration[] = ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    productTitle: r.product_title,
    rating: r.rating,
    title: r.review_title,
    body: r.review_body,
    verifiedPurchase: r.verified_purchase,
    status: r.status,
    rejectionReason: r.rejection_reason,
    reviewerName: r.reviewer_name,
    reviewerEmail: r.reviewer_email,
    createdAt: r.created_at,
  }));
  return { data: reviews, error: error?.message ?? null };
}

export async function moderateReview(id: string, status: "approved" | "rejected", rejectionReason?: string) {
  const { error } = await supabase
    .from("reviews")
    .update({ status, rejection_reason: status === "rejected" ? rejectionReason?.trim() || null : null })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteReview(id: string) {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  return { error: error?.message ?? null };
}
