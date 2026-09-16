import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Gift, ShoppingBag, Factory } from "lucide-react";

const roles = [
  {
    title: "Donors",
    desc: "List clothing, shoes, and accessories for donation, request a pickup, and see the real environmental impact of every contribution.",
    icon: Gift,
    cta: { label: "Donate Now", to: "/donate" },
  },
  {
    title: "Buyers",
    desc: "Shop unique, upcycled products with full transparency on your environmental impact. Every purchase supports the circular economy.",
    icon: ShoppingBag,
    cta: { label: "Start Shopping", to: "/marketplace" },
  },
  {
    title: "Partners",
    desc: "Join as an upcycling studio or recycler to process donated items, manage batches, and create products with purpose.",
    icon: Factory,
    cta: { label: "Partner With Us", to: "/partnerwithus" },
  },
];

const RoleGrid = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Heading */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-semibold text-foreground">
            Built for the loop
          </h2>
          <p className="mt-3 text-muted-foreground">
            Donors, buyers, and partners working together to keep fashion
            waste-free. Choose your role and join the movement.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <article
                key={r.title}
                className="group rounded-xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-gold/50"
              >
                {/* Icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
                  <Icon size={24} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-display font-semibold text-primary">
                  {r.title}
                </h3>

                {/* Description */}
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {r.desc}
                </p>

                {/* CTA */}
                <div className="mt-6">
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary-dark text-primary-foreground font-medium"
                  >
                    <Link to={r.cta.to}>{r.cta.label}</Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RoleGrid;
