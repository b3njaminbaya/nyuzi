import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FaLeaf, FaTint, FaRecycle, FaTshirt } from "react-icons/fa";
import { MdHistory, MdTrendingUp, MdCheckCircle } from "react-icons/md";
import {
  getImpactTotals,
  getImpactTrend,
  getRecentDonationActivity,
  type ImpactTotals,
  type ImpactTrendPoint,
  type RecentDonationActivity,
} from "@/lib/impact";
import { formatCO2, formatLandfill, formatWater } from "@/lib/format-impact";

const GOALS = [
  { label: "Save 25k L of water", target: 25000, metric: "water_l" as const },
  { label: "Avoid 2 t of CO₂ emissions", target: 2000, metric: "co2_kg" as const },
  { label: "Reduce landfill by 6 m³", target: 6, metric: "landfill_m3" as const },
];

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    submitted: "Donation submitted",
    scheduled: "Pickup scheduled",
    collected: "Donation collected",
    processed: "Donation processed",
  };
  return map[status] ?? status;
};

const Impact = () => {
  const [totals, setTotals] = useState<ImpactTotals | null>(null);
  const [trend, setTrend] = useState<ImpactTrendPoint[]>([]);
  const [activity, setActivity] = useState<RecentDonationActivity[]>([]);
  const [activityError, setActivityError] = useState(false);

  useEffect(() => {
    getImpactTotals().then(({ totals, error }) => {
      if (error) toast.error("Couldn't load impact totals", { description: error });
      setTotals(totals);
    });
    getImpactTrend().then(({ data, error }) => {
      if (error) toast.error("Couldn't load the impact trend", { description: error });
      setTrend(data);
    });
    getRecentDonationActivity().then(({ data, error }) => {
      if (error) setActivityError(true);
      setActivity(data);
    });
  }, []);

  const lifetimeData = [
    {
      label: "CO₂ avoided",
      value: totals ? formatCO2(totals.co2_kg) : "—",
      color: "#BF5B3D",
      icon: <FaLeaf className="text-2xl" />,
    },
    {
      label: "Water saved",
      value: totals ? formatWater(totals.water_l) : "—",
      color: "#3E8E8C",
      icon: <FaTint className="text-2xl" />,
    },
    {
      label: "Landfill reduced",
      value: totals ? formatLandfill(totals.landfill_m3) : "—",
      color: "#7A8F5C",
      icon: <FaRecycle className="text-2xl" />,
    },
    {
      label: "Items processed",
      value: totals ? String(totals.items_count) : "—",
      color: "#C08A2E",
      icon: <FaTshirt className="text-2xl" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Impact Dashboard — Nyuzi"
        description="Track CO₂, water, and landfill savings from your donations and purchases."
      />

      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-left"
        >
          <h1 className="text-4xl font-semibold">Impact Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Community-wide totals from every donation that's been collected and processed so far.
          </p>
        </motion.div>

        {/* Lifetime Stats */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {lifetimeData.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="rounded-lg bg-card p-6 shadow-sm flex flex-col items-center text-center border border-border hover:shadow-md transition-all"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${item.color}1F`, color: item.color }}
              >
                {item.icon}
              </div>
              <h3 className="text-2xl font-display font-semibold">{item.value}</h3>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Methodology disclosure */}
        <p className="mt-4 text-xs text-muted-foreground max-w-3xl">
          <strong>How these are calculated:</strong> each donation gets a
          fixed, category-level estimate (clothing, shoes, accessories, or
          other) rather than an item-specific measurement. The clothing
          water figure is anchored to WWF's widely-cited estimate that a
          single cotton garment requires roughly 2,700 liters of water to
          produce; the clothing CO₂ figure is a conservative fraction of
          WRAP's "Valuing Our Clothes" finding that reusing 1&nbsp;kg of
          clothing avoids roughly 25&nbsp;kg of CO₂ compared to producing
          new. Shoes, accessories, and other items are scaled down from the
          clothing figure to reflect smaller average material use, and
          aren't independently sourced the same way. These are deliberately
          conservative, rounded estimates — not device measurements — and
          only count donations that have actually been collected or
          processed, never ones merely submitted.
        </p>

        {/* Goals */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-12 rounded-lg bg-card p-6 border border-border shadow-sm"
        >
          <h2 className="flex items-center gap-2 text-xl font-display font-semibold">
            <MdTrendingUp className="text-primary" /> Community Goals
          </h2>
          <div className="mt-6 space-y-6">
            {GOALS.map((goal, index) => {
              const current = totals ? totals[goal.metric] : 0;
              const progress = Math.min(100, Math.round((current / goal.target) * 100));
              return (
                <div key={goal.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.label}</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                      className="h-3 rounded-full bg-primary"
                    ></motion.div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Impact Trend Chart */}
          <div className="mt-10 h-64 bg-muted/50 rounded-lg p-4 border border-border">
            {trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Not enough collected donations yet to show a trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--primary))", border: "none", color: "hsl(var(--primary-foreground))" }} />
                  <Line type="monotone" dataKey="co2_kg" name="CO₂ (kg)" stroke="#BF5B3D" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="water_l" name="Water (L)" stroke="#3E8E8C" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="landfill_m3" name="Landfill (m³)" stroke="#7A8F5C" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        {/* Activity Feed & Why Impact Matters */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="rounded-lg bg-card p-6 border border-border shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-xl font-display font-semibold">
              <MdHistory className="text-primary" /> Recent Activity
            </h2>
            {activity.length === 0 && activityError ? (
              <p className="mt-4 text-sm text-destructive">Couldn't load recent activity — try refreshing.</p>
            ) : activity.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No donations yet — be the first.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {activity.map((item, index) => (
                  <li
                    key={index}
                    className="p-3 rounded-md bg-muted/50 hover:bg-muted transition flex items-center gap-2 border border-border capitalize"
                  >
                    <MdCheckCircle className="text-primary shrink-0" />
                    {statusLabel(item.status)} · {item.category}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="rounded-lg bg-card p-6 border border-border shadow-sm"
          >
            <h2 className="text-xl font-display font-semibold">Why Your Impact Matters</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Every item you donate or purchase reduces demand for virgin
              materials, saves precious water, and prevents greenhouse gas
              emissions. Together, we are building a truly circular fashion
              economy.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              These totals only include donations that have actually been collected and processed —
              not just submitted — so every number here reflects real, completed impact.
            </p>
          </motion.section>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-12 text-center"
        >
          <h3 className="text-xl font-display font-semibold text-primary">
            Keep up the momentum — every action counts!
          </h3>
          <Link
            to="/donate"
            className="mt-4 inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full hover:bg-primary-dark transition"
          >
            Make Another Contribution
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Impact;
