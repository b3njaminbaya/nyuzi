import { useState } from "react";
import { FaLeaf, FaHandshake, FaRecycle, FaTruck, FaTshirt, FaGlobe } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";
import FormBanner, { type FormBannerState } from "@/components/FormBanner";
import { submitPartnerApplication } from "@/lib/submissions";

const partnerSchema = z.object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().email("Enter a valid email address"),
    organization: z.string().trim().min(2, "Enter your organization name"),
    partnershipType: z.enum(
        ["Upcycling Studio", "Recycler", "Logistics Provider", "NGO"],
        { required_error: "Select a partnership type" }
    ),
    message: z.string().trim().min(10, "Tell us a bit more about your work (10+ characters)"),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

const PartnerWithUs = () => {
    const scrollToForm = () => {
        const formSection = document.getElementById("partner-form");
        if (formSection) {
            formSection.scrollIntoView({ behavior: "smooth" });
        }
    };

    const [banner, setBanner] = useState<FormBannerState | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PartnerFormValues>({ resolver: zodResolver(partnerSchema) });

    const onSubmit = handleSubmit(async (values) => {
        setBanner(null);
        const { error } = await submitPartnerApplication({
            fullName: values.fullName,
            email: values.email,
            organization: values.organization,
            partnershipType: values.partnershipType,
            message: values.message,
        });
        if (error) {
            setBanner({ type: "error", title: "Couldn't submit your application", description: error });
            toast.error("Couldn't submit your application", { description: error });
            return;
        }
        setBanner({
            type: "success",
            title: "Application received",
            description: "We'll follow up by email once our team reviews your application.",
        });
        toast.success("Application received");
        reset();
    });

    return (
        <div className="bg-background text-foreground">
            <Seo
                title="Partner With Us — Nyuzi"
                description="Apply to partner with Nyuzi as an upcycling studio, recycler, logistics provider, or environmental NGO."
            />

            {/* Hero Section */}
            <section className="bg-primary-dark text-primary-foreground py-16 px-6 text-center">
                <h1 className="text-4xl md:text-5xl font-semibold text-gold">Partner With Nyuzi</h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-primary-foreground/70">
                    Join us in closing the fashion loop. Together, we can turn waste into opportunity and make sustainable fashion the new normal.
                </p>
                <Button
                    onClick={scrollToForm}
                    className="mt-6 bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-3 rounded-md text-lg"
                >
                    Apply Now
                </Button>
            </section>

            {/* Why Partner */}
            <section className="py-16 px-6 max-w-6xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-primary">Why Partner With Us?</h2>
                <p className="mt-3 text-muted-foreground">
                    We collaborate with like-minded businesses, NGOs, and innovators to accelerate sustainable change in the fashion industry.
                </p>
                <div className="grid gap-8 md:grid-cols-3 mt-10">
                    {[
                        { icon: <FaRecycle size={40} className="text-gold" />, title: "Sustainability First", desc: "Help reduce textile waste and promote eco-friendly practices." },
                        { icon: <FaHandshake size={40} className="text-gold" />, title: "Collaborative Growth", desc: "Access new markets and share knowledge with our network." },
                        { icon: <FaGlobe size={40} className="text-gold" />, title: "Global Impact", desc: "Be part of a movement that inspires communities worldwide." },
                    ].map((item, i) => (
                        <div key={i} className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition">
                            <div className="mb-4 flex justify-center">{item.icon}</div>
                            <h3 className="font-semibold text-lg">{item.title}</h3>
                            <p className="mt-2 text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Partnership Categories */}
            <section className="bg-secondary/40 py-16 px-6">
                <h2 className="text-3xl font-bold text-center text-primary">Partnership Opportunities</h2>
                <div className="grid gap-8 md:grid-cols-4 mt-10 max-w-6xl mx-auto">
                    {[
                        { icon: <FaTshirt size={30} />, label: "Upcycling Studios" },
                        { icon: <FaRecycle size={30} />, label: "Recyclers" },
                        { icon: <FaTruck size={30} />, label: "Logistics Providers" },
                        { icon: <FaLeaf size={30} />, label: "Environmental NGOs" },
                    ].map((cat, i) => (
                        <div key={i} className="bg-card p-6 rounded-lg border border-border text-center shadow-sm hover:shadow-lg transition">
                            <div className="text-primary flex justify-center mb-3">{cat.icon}</div>
                            <h4 className="font-semibold">{cat.label}</h4>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 px-6 max-w-5xl mx-auto">
                <h2 className="text-3xl font-bold text-center text-primary">How It Works</h2>
                <div className="mt-10 grid gap-8 md:grid-cols-3 text-center">
                    {[
                        { step: "1", title: "Apply Online", desc: "Fill out our quick partner application form." },
                        { step: "2", title: "Get Approved", desc: "Our team reviews and confirms your partnership." },
                        { step: "3", title: "Start Collaborating", desc: "Work together to transform waste into wearable art." },
                    ].map((item, i) => (
                        <div key={i} className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition">
                            <div className="text-3xl font-bold text-gold">{item.step}</div>
                            <h4 className="font-semibold mt-4">{item.title}</h4>
                            <p className="mt-2 text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Application Form */}
            <section id="partner-form" className="scroll-mt-20 bg-secondary/40 text-foreground py-16 px-6">
                <h2 className="text-3xl font-bold text-center text-primary">Partner Application Form</h2>
                {banner && (
                    <div className="mt-6 max-w-3xl mx-auto">
                        <FormBanner state={banner} />
                    </div>
                )}
                <form className="mt-8 max-w-3xl mx-auto grid gap-6" onSubmit={onSubmit} noValidate>
                    <div>
                        <label htmlFor="fullName" className="sr-only">Full Name</label>
                        <input id="fullName" type="text" placeholder="Full Name" className="w-full p-3 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" {...register("fullName")} />
                        {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="email" className="sr-only">Email</label>
                        <input id="email" type="email" placeholder="Email" className="w-full p-3 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" {...register("email")} />
                        {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="organization" className="sr-only">Organization Name</label>
                        <input id="organization" type="text" placeholder="Organization Name" className="w-full p-3 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" {...register("organization")} />
                        {errors.organization && <p className="mt-1 text-sm text-destructive">{errors.organization.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="partnershipType" className="sr-only">Partnership Type</label>
                        <select id="partnershipType" className="w-full p-3 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" defaultValue="" {...register("partnershipType")}>
                            <option value="" disabled>Select Partnership Type</option>
                            <option>Upcycling Studio</option>
                            <option>Recycler</option>
                            <option>Logistics Provider</option>
                            <option>NGO</option>
                        </select>
                        {errors.partnershipType && <p className="mt-1 text-sm text-destructive">{errors.partnershipType.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="message" className="sr-only">Tell us about your work</label>
                        <textarea id="message" placeholder="Tell us about your work" rows={4} className="w-full p-3 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" {...register("message")} />
                        {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>}
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-3 rounded-md text-lg">
                        {isSubmitting ? "Submitting…" : "Submit Application"}
                    </Button>
                </form>
            </section>

        </div>
    );
};

export default PartnerWithUs;

