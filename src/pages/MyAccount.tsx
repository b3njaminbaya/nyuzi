import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Gift, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Seo from "@/components/Seo";
import { useAuth } from "@/lib/auth-context";
import { listMyOrders, type Order, type OrderStatus } from "@/lib/orders";
import { listMyDonations, type MyDonation } from "@/lib/submissions";
import { getMyRewards, getReferralRewardAmounts, type MyRewards, type ReferralRewardAmounts } from "@/lib/rewards";
import { getMyDonationProducts, type MyDonationProduct } from "@/lib/traceability";
import { getDonationPhotoUrl, listDonationPhotos } from "@/lib/donation-photos";
import { formatKES } from "@/lib/currency";

const DonationPhotosDialog = ({ donation, onClose }: { donation: MyDonation; onClose: () => void }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await listDonationPhotos(donation.id);
      const resolved = await Promise.all(
        data.map(async (photo) => (await getDonationPhotoUrl(photo.storage_path)).url)
      );
      if (!cancelled) {
        setUrls(resolved.filter((u): u is string => Boolean(u)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [donation.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{donation.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading photos…</p>
        ) : urls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos were uploaded with this donation.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {urls.map((url) => (
              <img key={url} src={url} alt="" className="rounded-md object-cover aspect-square" />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const orderStatusVariant = (status: OrderStatus) => {
  if (status === "paid" || status === "shipped" || status === "fulfilled") return "default" as const;
  if (status === "payment_failed" || status === "cancelled") return "destructive" as const;
  return "secondary" as const;
};

const donationStatusVariant = (status: MyDonation["status"]) => {
  if (status === "processed" || status === "collected") return "default" as const;
  return "secondary" as const;
};

const MyAccount = () => {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [donations, setDonations] = useState<MyDonation[]>([]);
  const [donationProducts, setDonationProducts] = useState<MyDonationProduct[]>([]);
  const [rewards, setRewards] = useState<MyRewards | null>(null);
  const [rewardAmounts, setRewardAmounts] = useState<ReferralRewardAmounts | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewingPhotosFor, setViewingPhotosFor] = useState<MyDonation | null>(null);

  useEffect(() => {
    if (!user) return;
    getReferralRewardAmounts().then(({ data }) => setRewardAmounts(data));
    Promise.all([
      listMyOrders(user.id),
      listMyDonations(user.id),
      getMyRewards(user.id),
      getMyDonationProducts(),
    ]).then(([ordersRes, donationsRes, rewardsRes, donationProductsRes]) => {
      if (ordersRes.error || donationsRes.error || rewardsRes.error) {
        setLoadError(true);
        toast.error("Some account data couldn't be loaded", {
          description: ordersRes.error ?? donationsRes.error ?? rewardsRes.error ?? undefined,
        });
      }
      setOrders(ordersRes.data);
      setDonations(donationsRes.data);
      setRewards(rewardsRes.data);
      setDonationProducts(donationProductsRes.data);
      setDataLoading(false);
    });
  }, [user]);

  const referralLink = rewards ? `${window.location.origin}/?ref=${rewards.referralCode}` : "";

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Seo title="My Account — Nyuzi" />
      <h1 className="text-3xl font-semibold">My Account</h1>
      <p className="mt-2 text-muted-foreground">{user.email}</p>

      {rewards && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Gift className="text-primary" size={20} />
            <h2 className="text-xl font-display font-semibold">Rewards & referrals</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Nyuzi credit: <span className="font-semibold text-foreground">{formatKES(rewards.creditBalance)}</span> — applied at checkout.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {rewardAmounts
              ? `Invite a friend — when they make their first purchase, you get ${formatKES(rewardAmounts.referrerReward)} credit and they get ${formatKES(rewardAmounts.refereeReward)}.`
              : "Invite a friend — when they make their first purchase, you both get Nyuzi credit."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{referralLink}</code>
            <Button size="sm" variant="outline" onClick={copyReferralLink} className="gap-1.5 shrink-0">
              <Copy size={14} /> Copy
            </Button>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-display font-semibold">Orders</h2>
        {dataLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 && loadError ? (
          <p className="mt-3 text-sm text-destructive">Couldn't load your orders — try refreshing the page.</p>
        ) : orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No orders yet. <Link to="/marketplace" className="text-primary hover:underline">Browse the marketplace</Link>.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/order/${order.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:shadow-sm transition"
              >
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatKES(order.total_amount)}</div>
                  <Badge variant={orderStatusVariant(order.status)} className="mt-1">
                    {order.status.replace("_", " ")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-display font-semibold">Donations</h2>
        {dataLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : donations.length === 0 && loadError ? (
          <p className="mt-3 text-sm text-destructive">Couldn't load your donations — try refreshing the page.</p>
        ) : donations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No donations yet. <Link to="/donate" className="text-primary hover:underline">Start a donation</Link>.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {donations.map((donation) => {
              const linkedProduct = donationProducts.find((p) => p.donationId === donation.id);
              return (
                <div key={donation.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{donation.title}</div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {donation.category} · {new Date(donation.created_at).toLocaleDateString()}
                      </div>
                      {donation.pickup_requested && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Pickup requested
                          {donation.pickup_date &&
                            ` for ${new Date(`${donation.pickup_date}T00:00:00`).toLocaleDateString()}`}
                          {donation.pickup_address && ` · ${donation.pickup_address}`}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={donationStatusVariant(donation.status)}>{donation.status}</Badge>
                      {donation.photo_count > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-auto py-1"
                          onClick={() => setViewingPhotosFor(donation)}
                        >
                          <ImageIcon size={14} /> {donation.photo_count}
                        </Button>
                      )}
                    </div>
                  </div>
                  {linkedProduct && (
                    <div className="mt-2 pt-2 border-t border-border text-sm">
                      <Link to={`/product/${linkedProduct.productSlug}`} className="text-primary hover:underline">
                        → Now part of "{linkedProduct.productTitle}"
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {viewingPhotosFor && (
        <DonationPhotosDialog donation={viewingPhotosFor} onClose={() => setViewingPhotosFor(null)} />
      )}
    </div>
  );
};

export default MyAccount;
