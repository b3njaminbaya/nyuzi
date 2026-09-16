import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import denimTote from "@/assets/products/denim-tote.jpg";
import patchworkJacket from "@/assets/products/patchwork-jacket.jpg";
import reclaimedTee from "@/assets/products/reclaimed-tee.jpg";
import { getImpactTotals } from "@/lib/impact";
import { formatWater } from "@/lib/format-impact";

const HeroSection: React.FC = () => {
  const [waterSaved, setWaterSaved] = useState<number | null>(null);

  useEffect(() => {
    getImpactTotals().then(({ totals }) => setWaterSaved(totals?.water_l ?? 0));
  }, []);

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="container mx-auto grid items-center gap-16 px-6 py-20 md:grid-cols-2 lg:py-28">
        {/* Left Content */}
        <div className="relative z-10 text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
            Nyuzi — Swahili for "thread"
          </span>
          <h1 className="mt-5 text-4xl leading-[1.1] font-semibold sm:text-5xl lg:text-6xl">
            Circular fashion,{" "}
            <span className="text-gold">rewoven</span> for the everyday
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-lg mx-auto md:mx-0">
            Donate items, fuel upcycling, and shop reclaimed designs — while
            tracking your CO₂, water, and landfill impact.
          </p>

          <div className="mt-9 flex flex-wrap justify-center md:justify-start gap-4">
            <Button asChild size="lg" className="bg-primary hover:bg-primary-dark text-primary-foreground font-semibold">
              <Link to="/donate">Start a Donation</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
            >
              <Link to="/marketplace">Explore Marketplace</Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Secure. Community-driven. Planet-positive.
          </p>
        </div>

        {/* Right: product collage instead of a generic diagram */}
        <div className="relative h-[420px] hidden md:block" aria-hidden>
          <img
            src={patchworkJacket}
            alt=""
            className="absolute left-0 top-0 h-64 w-52 rotate-[-6deg] rounded-lg border-4 border-card object-cover shadow-elegant"
          />
          <img
            src={denimTote}
            alt=""
            className="absolute right-4 top-10 h-56 w-52 rotate-[4deg] rounded-lg border-4 border-card object-cover shadow-elegant"
          />
          <img
            src={reclaimedTee}
            alt=""
            className="absolute bottom-0 left-20 h-52 w-48 rotate-[3deg] rounded-lg border-4 border-card object-cover shadow-elegant"
          />
          {waterSaved !== null && waterSaved > 0 && (
            <span className="absolute right-10 bottom-6 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-elegant">
              {formatWater(waterSaved)} water saved so far
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
