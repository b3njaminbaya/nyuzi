import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Leaf, Droplets, Recycle, Gift } from "lucide-react";
import { getImpactTotals, type ImpactTotals } from "@/lib/impact";
import { formatCO2, formatLandfill, formatWater } from "@/lib/format-impact";

const ImpactStats = () => {
  const [totals, setTotals] = useState<ImpactTotals | null>(null);

  useEffect(() => {
    getImpactTotals().then(({ totals, error }) => {
      if (error) toast.error("Couldn't load impact stats", { description: error });
      setTotals(totals);
    });
  }, []);

  const stats = [
    { label: "CO₂ avoided", value: totals ? formatCO2(totals.co2_kg) : "—", icon: Leaf },
    { label: "Water saved", value: totals ? formatWater(totals.water_l) : "—", icon: Droplets },
    { label: "Landfill reduced", value: totals ? formatLandfill(totals.landfill_m3) : "—", icon: Recycle },
    { label: "Items donated", value: totals ? String(totals.items_count) : "—", icon: Gift },
  ];

  return (
    <section className="py-14 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {s.label}
                  </div>
                </div>
                <div className="mt-3 text-3xl font-display font-semibold text-primary">
                  {s.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ImpactStats;
