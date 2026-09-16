import { Link } from "react-router-dom";
import { FaLeaf, FaRecycle, FaHandsHelping } from "react-icons/fa";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    icon: <FaLeaf className="text-3xl text-gold" />,
    title: "Kept out of landfill",
    description:
      "Every item that comes through Nyuzi is one less item burned, dumped, or shipped abroad as waste.",
  },
  {
    icon: <FaRecycle className="text-3xl text-gold" />,
    title: "Given a real second life",
    description:
      "Donations are redistributed as-is where possible, or handed to upcycling partners who turn them into new, sellable products.",
  },
  {
    icon: <FaHandsHelping className="text-3xl text-gold" />,
    title: "Transparent, end to end",
    description:
      "Where a product was made from a specific donation, we show that story on the product page — not a vague sustainability claim, the actual donation it came from.",
  },
];

const About = () => {
  return (
    <div className="bg-background text-foreground">
      <Seo
        title="About Nyuzi"
        description="Why Nyuzi exists, who's behind it, and how it works — a circular-fashion platform built in Kenya."
        canonical="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Nyuzi",
        }}
      />

      <section className="bg-primary-dark text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold text-gold">About Nyuzi</h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-primary-foreground/80">
          Nyuzi is Swahili for "thread" — the idea that a piece of clothing's
          story doesn't have to end when you're done with it.
        </p>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-primary">Why Nyuzi exists</h2>
        <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Kenya is one of the world's largest importers of secondhand
            clothing — hundreds of thousands of tonnes of it arrive every
            year, and a meaningful share of that is unsellable by the time it
            gets here. What doesn't sell in the mitumba markets often ends up
            burned or dumped, because there's no straightforward way to give
            it a second life instead.
          </p>
          <p>
            Nyuzi is an attempt to build that straightforward way: a place
            where anyone can donate clothing, shoes, or accessories they no
            longer need; where upcycling partners can turn what would
            otherwise be waste into new products; and where buyers can shop
            those products knowing exactly what they're made from and what
            impact they represent.
          </p>
        </div>
      </section>

      <section className="bg-secondary/40 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-primary">What we're building toward</h2>
          <div className="grid gap-8 md:grid-cols-3 mt-10">
            {pillars.map((p) => (
              <div key={p.title} className="p-6 border border-border rounded-lg bg-card text-center shadow-sm">
                <div className="flex justify-center mb-4">{p.icon}</div>
                <h3 className="font-semibold text-lg">{p.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-primary">A note from the founder</h2>
        <p className="mt-6 text-muted-foreground leading-relaxed text-left">
          I started Nyuzi because I kept seeing the same disconnect: people
          who wanted to donate clothes responsibly had no real way to know
          what happened next, and people who cared about buying sustainably
          had no way to verify a "sustainable" claim beyond a label. Nyuzi is
          my attempt to close that loop directly — donation in, traceable
          product out, visible impact the whole way through.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed text-left">
          Nyuzi is a young platform, and I'd rather be upfront about that
          than inflate the numbers: the impact you see on this site is real,
          and it will grow as more donors, partners, and buyers join in.
          If that's a loop you want to be part of from early on, you're
          welcome here.
        </p>
        <p className="mt-6 font-semibold text-foreground text-left">
          — Benjamin Mweri Baya, Founder
        </p>
      </section>

      <section className="bg-primary text-primary-foreground py-14 px-6 text-center">
        <h2 className="text-2xl font-semibold">Be part of the loop</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold-dark">
            <Link to="/donate">Start a Donation</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
            <Link to="/marketplace">Shop the Marketplace</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default About;
