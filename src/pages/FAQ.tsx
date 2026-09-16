import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqEntry = { q: string; a: React.ReactNode };
type FaqSection = { heading: string; items: FaqEntry[] };

const sections: FaqSection[] = [
  {
    heading: "Donating",
    items: [
      {
        q: "What can I donate?",
        a: "Clothing, shoes, and accessories in any condition — even worn items can be upcycled into new products rather than thrown away. You'll describe the item's category and condition when you submit it.",
      },
      {
        q: "Do I need to create an account to donate?",
        a: "No — you can submit a donation as a guest. Creating an account lets you track your donation's status and see your cumulative impact over time.",
      },
      {
        q: "How does pickup work?",
        a: "When you submit a donation, you can request a pickup and give us a preferred date and address. It's a request, not a confirmed slot — our team contacts you directly (by phone) to confirm timing.",
      },
      {
        q: "What happens to my donation after I submit it?",
        a: "It's reviewed, and either redistributed as-is or passed to an upcycling partner who turns it into a new product. If a marketplace product was made from your donation (or others like it), that story is shown on the product's page.",
      },
    ],
  },
  {
    heading: "Shopping & payment",
    items: [
      {
        q: "How do I pay?",
        a: "Checkout is via M-Pesa. If M-Pesa isn't available for your order for any reason, checkout automatically falls back to a manual-payment flow and our team follows up directly — your order is never lost.",
      },
      {
        q: "Do I need an account to buy something?",
        a: "No, guest checkout is supported. Creating an account additionally lets you track order history, save a referral link, and build up store credit.",
      },
      {
        q: "Where does 'made from this donation' come from on a product page?",
        a: "Where a product was built from one or more specific donations, we show which donations, their category, and roughly when they came in. It's real traceability, not a general sustainability label.",
      },
    ],
  },
  {
    heading: "Impact & rewards",
    items: [
      {
        q: "How is impact (CO₂, water, landfill) calculated?",
        a: "Estimates are based on the category and condition of donations that have actually been collected and processed — not just submitted — so the numbers on the Impact page reflect real, completed outcomes rather than pledges.",
      },
      {
        q: "How does the referral program work?",
        a: "Every account gets a unique referral link. When someone signs up through your link and their first order is paid, you both receive Nyuzi store credit automatically, usable at checkout on a future order.",
      },
    ],
  },
  {
    heading: "Partnering with Nyuzi",
    items: [
      {
        q: "Who can apply to partner?",
        a: "Upcycling studios, recyclers, logistics providers, and environmental NGOs. Use the Partner With Us form to tell us about your organization — our team reviews every application.",
      },
      {
        q: "I'm a business with textiles to dispose of responsibly — can Nyuzi help?",
        a: (
          <>
            Yes — reach out through the{" "}
            <Link to="/partnerwithus" className="text-primary hover:underline">
              Partner With Us
            </Link>{" "}
            page and tell us about your organization and volume; we'll follow up directly.
          </>
        ),
      },
    ],
  },
];

const FAQ = () => {
  return (
    <div className="bg-background text-foreground">
      <Seo
        title="FAQ — Nyuzi"
        description="Answers to common questions about donating, shopping, payment, impact, and partnering with Nyuzi."
        canonical="/faq"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: sections.flatMap((s) =>
            s.items.map((i) => ({
              "@type": "Question",
              name: i.q,
              acceptedAnswer: { "@type": "Answer", text: typeof i.a === "string" ? i.a : i.q },
            }))
          ),
        }}
      />

      <section className="bg-primary-dark text-primary-foreground py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold text-gold">Frequently Asked Questions</h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-primary-foreground/80">
          Everything you need to know about donating, shopping, and partnering with Nyuzi.
        </p>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {sections.map((section) => (
          <div key={section.heading} className="mb-10">
            <h2 className="text-2xl font-semibold text-primary mb-2">{section.heading}</h2>
            <Accordion type="single" collapsible>
              {section.items.map((item, index) => (
                <AccordionItem key={item.q} value={`${section.heading}-${index}`}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        <div className="mt-12 rounded-lg border border-border bg-card p-6 text-center">
          <h3 className="font-semibold text-lg">Still have a question?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Email us at <a href="mailto:nyuzi@gmail.com" className="text-primary hover:underline">nyuzi@gmail.com</a> and we'll get back to you.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
