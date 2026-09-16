import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StarRating from "@/components/StarRating";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteReview,
  listReviewsForModeration,
  moderateReview,
  type ReviewForModeration,
  type ReviewStatus,
} from "@/lib/reviews";

const statusVariant = (status: ReviewStatus) => {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
};

const STATUS_FILTERS: Array<ReviewStatus | "all"> = ["all", "pending", "approved", "rejected"];

const AdminReviews = () => {
  const [reviews, setReviews] = useState<ReviewForModeration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = () => {
    listReviewsForModeration().then(({ data, error }) => {
      if (error) toast.error("Couldn't load reviews", { description: error });
      setReviews(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleModerate = async (id: string, status: "approved" | "rejected") => {
    let reason: string | undefined;
    if (status === "rejected") {
      const input = prompt("Reason for rejecting this review (shown to the customer, optional):");
      if (input === null) return; // cancelled
      reason = input;
    }
    const { error } = await moderateReview(id, status, reason);
    if (error) {
      toast.error("Couldn't update review", { description: error });
      return;
    }
    toast.success(status === "approved" ? "Review approved" : "Review rejected");
    refresh();
  };

  const handleDelete = async (review: ReviewForModeration) => {
    if (!confirm(`Delete this review by ${review.reviewerName}? This can't be undone.`)) return;
    const { error } = await deleteReview(review.id);
    if (error) {
      toast.error("Couldn't delete review", { description: error });
      return;
    }
    toast.success("Review deleted");
    refresh();
  };

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!query) return true;
      return r.productTitle.toLowerCase().includes(query) || r.reviewerName.toLowerCase().includes(query);
    });
  }, [reviews, statusFilter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        New reviews start pending and only appear on the product page once approved.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product or reviewer…"
          className="sm:max-w-xs"
          aria-label="Search reviews"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReviewStatus | "all")}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : filteredReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews match your search.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.productTitle}</TableCell>
                  <TableCell className="text-sm">
                    <div>{r.reviewerName}</div>
                    <div className="text-xs text-muted-foreground">{r.reviewerEmail}</div>
                    {r.verifiedPurchase && (
                      <Badge variant="secondary" className="mt-1">
                        Verified purchase
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StarRating value={r.rating} size={14} />
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {r.title && <div className="font-medium">{r.title}</div>}
                    {r.body && <div className="text-muted-foreground line-clamp-2">{r.body}</div>}
                    {r.status === "rejected" && r.rejectionReason && (
                      <div className="mt-1 text-xs text-destructive">Reason: {r.rejectionReason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    {r.status !== "approved" && (
                      <Button size="sm" variant="outline" onClick={() => handleModerate(r.id, "approved")}>
                        Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => handleModerate(r.id, "rejected")}>
                        Reject
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(r)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default AdminReviews;
