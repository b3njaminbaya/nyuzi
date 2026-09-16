import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Gift, Handshake, Leaf, Package, Receipt, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getImpactTotals, type ImpactTotals } from "@/lib/impact";
import { formatCO2 } from "@/lib/format-impact";
import { formatKES } from "@/lib/currency";
import { Button } from "@/components/ui/button";

type DashboardStats = {
  total_revenue: number;
  paid_orders_count: number;
  total_orders_count: number;
  donations_count: number;
  pending_donations_count: number;
  pending_partner_applications_count: number;
  published_products_count: number;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [impact, setImpact] = useState<ImpactTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([supabase.rpc("get_admin_dashboard_stats"), getImpactTotals()]).then(
      ([statsRes, impactRes]) => {
        if (statsRes.error) {
          setError(statsRes.error.message);
          toast.error("Couldn't load dashboard stats", { description: statsRes.error.message });
        }
        const row = Array.isArray(statsRes.data) ? statsRes.data[0] : null;
        setStats((row as DashboardStats | null) ?? null);
        setImpact(impactRes.totals);
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    load();
  }, []);

  const tiles = stats
    ? [
        {
          label: "Revenue (paid orders)",
          value: formatKES(stats.total_revenue),
          sub: `${stats.paid_orders_count} paid`,
          icon: Wallet,
          to: "/admin/orders",
        },
        {
          label: "Total orders",
          value: String(stats.total_orders_count),
          icon: Receipt,
          to: "/admin/orders",
        },
        {
          label: "Published products",
          value: String(stats.published_products_count),
          icon: Package,
          to: "/admin/products",
        },
        {
          label: "Donations awaiting review",
          value: String(stats.pending_donations_count),
          sub: `${stats.donations_count} total`,
          icon: Gift,
          to: "/admin/donations",
        },
        {
          label: "Partner applications pending",
          value: String(stats.pending_partner_applications_count),
          icon: Handshake,
          to: "/admin/partners",
        },
        {
          label: "CO₂ avoided (collected+processed)",
          value: impact ? formatCO2(impact.co2_kg) : "—",
          sub: impact ? `${impact.items_count} items` : undefined,
          icon: Leaf,
          to: "/impact",
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">A quick look at what's happening across the store.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">Couldn't load dashboard stats: {error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.label}
                to={tile.to}
                className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{tile.label}</span>
                </div>
                <div className="mt-3 text-2xl font-display font-semibold">{tile.value}</div>
                {tile.sub && <div className="text-xs text-muted-foreground mt-1">{tile.sub}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
