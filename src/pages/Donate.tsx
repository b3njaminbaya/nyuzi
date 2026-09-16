import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import Seo from "@/components/Seo";
import FormBanner, { type FormBannerState } from "@/components/FormBanner";
import { submitDonation, updateDonationPhotoCount } from "@/lib/submissions";
import { uploadDonationPhotos } from "@/lib/donation-photos";
import { normalizeKenyanPhone } from "@/lib/mpesa";
import {
  FaTshirt,
  FaHandHoldingHeart,
  FaTruck,
  FaRecycle,
  FaLeaf,
} from "react-icons/fa";

const steps = [
  {
    icon: <FaTshirt className="text-3xl text-gold" />,
    title: "List Your Item",
    description: "Upload a few clear photos and tell us what it is.",
  },
  {
    icon: <FaTruck className="text-3xl text-gold" />,
    title: "Schedule a Pickup",
    description: "Request a pickup date — we'll confirm timing with you directly.",
  },
  {
    icon: <FaRecycle className="text-3xl text-gold" />,
    title: "Track Your Impact",
    description: "See the real environmental impact of your donation once it's processed.",
  },
];

const donationSchema = z
  .object({
    title: z.string().trim().min(2, "Give your item a short title"),
    category: z.enum(["clothing", "shoes", "accessories", "other"], {
      required_error: "Choose a category",
    }),
    notes: z.string().trim().optional(),
    contactName: z.string().trim().min(2, "Enter your full name"),
    contactPhone: z
      .string()
      .trim()
      .min(9, "Enter a phone number so we can reach you")
      .refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan number, e.g. 07XXXXXXXX"),
    contactEmail: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
    pickupRequested: z.boolean(),
    pickupDate: z.string().optional(),
    pickupAddress: z.string().trim().optional(),
  })
  .refine((data) => !data.pickupRequested || Boolean(data.pickupDate), {
    message: "Choose a pickup date",
    path: ["pickupDate"],
  })
  .refine((data) => !data.pickupRequested || Boolean(data.pickupAddress?.trim()), {
    message: "Enter a pickup address",
    path: ["pickupAddress"],
  });

type DonationFormValues = z.infer<typeof donationSchema>;

// Conservative, category-level estimates (not item-specific measurements).
// The clothing water figure is anchored to WWF's widely-cited ~2,700 L
// footprint for a single cotton garment; the clothing CO2 figure is a
// conservative fraction of WRAP's "Valuing Our Clothes" finding that
// reusing 1 kg of clothing avoids roughly 25 kg of CO2 versus producing new.
// Shoes/accessories/other are scaled down from the clothing figure to
// reflect smaller average material use -- they aren't independently
// sourced the way the clothing numbers are. See the methodology note on
// the Impact page. Deliberately the same regardless of reported condition:
// the environmental cost of production doesn't change based on how worn an
// item looks, only its category.
const IMPACT_BASE: Record<string, { water: number; co2: number; landfill: number }> = {
  clothing: { water: 3000, co2: 3, landfill: 0.05 },
  shoes: { water: 1500, co2: 2, landfill: 0.03 },
  accessories: { water: 800, co2: 1, landfill: 0.02 },
  other: { water: 500, co2: 0.5, landfill: 0.01 },
};

const Donate = () => {
  const [condition, setCondition] = useState(70);
  const [category, setCategory] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [banner, setBanner] = useState<FormBannerState | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photosRef = useRef<HTMLInputElement>(null);
  const [pickupRequested, setPickupRequested] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: { pickupRequested: false },
  });

  // Memoized so a new batch of object URLs is only created when `photos`
  // itself changes -- previously this ran on every render (e.g. typing in
  // the title field), leaking a new blob URL per photo per keystroke since
  // the cleanup effect only revoked URLs when `photos` changed, not on
  // every render that created them.
  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => photoPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviews]);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhotosChange = (files: File[]) => {
    setPhotos(files);
  };

  // No condition factor -- see the comment on IMPACT_BASE above.
  const impact = category ? IMPACT_BASE[category] : null;

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    // Already guaranteed non-null by the schema's refine() above.
    const normalizedPhone = normalizeKenyanPhone(values.contactPhone)!;
    const { donationId, error } = await submitDonation({
      title: values.title,
      category: values.category,
      condition,
      notes: values.notes,
      photoCount: photos.length,
      pickupRequested: values.pickupRequested,
      pickupDate: values.pickupRequested ? values.pickupDate : undefined,
      pickupAddress: values.pickupRequested ? values.pickupAddress : undefined,
      contactName: values.contactName,
      contactPhone: normalizedPhone,
      contactEmail: values.contactEmail || undefined,
    });

    if (error || !donationId) {
      setBanner({ type: "error", title: "Couldn't save your donation", description: error ?? undefined });
      toast.error("Couldn't save your donation", { description: error ?? undefined });
      return;
    }

    let photoNote = "";
    if (photos.length > 0) {
      setUploadingPhotos(true);
      const { uploaded, failed } = await uploadDonationPhotos(donationId, photos);
      setUploadingPhotos(false);
      // photo_count was written provisionally when the donation was created
      // (before we knew whether every upload would succeed) -- reconcile it
      // now so an admin reviewing this donation never sees a photo count
      // higher than what's actually in storage.
      if (uploaded !== photos.length) {
        await updateDonationPhotoCount(donationId, uploaded);
      }
      if (failed > 0) {
        photoNote = ` ${uploaded} of ${photos.length} photo${photos.length === 1 ? "" : "s"} uploaded — the donation itself is saved either way.`;
      }
    }

    const reference = donationId.slice(0, 8);
    setBanner({
      type: "success",
      title: values.pickupRequested ? "Donation saved — pickup requested" : "Donation saved",
      description:
        (values.pickupRequested
          ? `We'll aim to collect it around ${values.pickupDate} — we'll contact you directly on ${normalizedPhone} to confirm timing.`
          : "Thank you — we'll be in touch if we need anything else.") +
        ` Reference: #${reference}.` +
        photoNote,
    });
    toast.success(values.pickupRequested ? "Donation saved — pickup requested" : "Donation saved");

    reset({ pickupRequested: false });
    setCategory("");
    setCondition(70);
    setPickupRequested(false);
    setPhotos([]);
    if (photosRef.current) photosRef.current.value = "";
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-dark text-white">
      <Seo
        title="Donate Clothing — Nyuzi"
        description="List items, request a pickup, and see the real environmental impact of your donation."
      />

      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <h1 className="text-4xl font-extrabold text-center md:text-left">
          Start a Donation
        </h1>
        <p className="mt-2 text-primary-foreground/80 text-center md:text-left max-w-2xl">
          Give your clothes a second life — help keep textiles out of
          landfill and support Kenya's circular fashion economy.
        </p>

        {/* Steps */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="rounded-xl bg-white/10 p-6 backdrop-blur-lg text-center hover:shadow-lg transition"
            >
              <div className="flex justify-center mb-4">{step.icon}</div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-primary-foreground/80">{step.description}</p>
            </div>
          ))}
        </div>

        {banner && (
          <div className="mt-10">
            <FormBanner state={banner} />
          </div>
        )}

        {/* Form */}
        <form className="mt-8 grid gap-8 md:grid-cols-3" onSubmit={onSubmit} noValidate>
          {/* Left Column */}
          <div className="space-y-6 bg-white/10 p-6 rounded-xl backdrop-blur-lg md:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="photos">Photos</Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                ref={photosRef}
                onChange={(e) => handlePhotosChange(Array.from(e.target.files ?? []))}
                className="bg-white text-black"
              />
              <p className="text-xs text-primary-foreground/70">
                Tip: Take clear, well-lit photos from multiple angles.
              </p>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {photoPreviews.map((url, index) => (
                    <div key={url} className="relative">
                      <img
                        src={url}
                        alt={`Selected photo ${index + 1}`}
                        className="h-20 w-20 rounded-md object-cover border-2 border-white/40"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-gold-foreground"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Item Title</Label>
              <Input
                id="title"
                placeholder="e.g., Vintage Denim Jacket"
                className="bg-white text-black"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-gold">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(val) => {
                  setCategory(val);
                  setValue("category", val as DonationFormValues["category"], {
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger className="bg-white text-black">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="shoes">Shoes</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-gold">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <div className="px-2">
                <Slider
                  value={[condition]}
                  max={100}
                  step={1}
                  onValueChange={(val) => setCondition(val[0])}
                />
              </div>
              <p className="text-xs text-primary-foreground/70">
                0% = heavily worn, 100% = brand new
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Brand, size, unique features"
                className="bg-white text-black"
                {...register("notes")}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-white/20 p-4">
              <div>
                <Label className="text-base">Your contact details</Label>
                <p className="text-xs text-primary-foreground/70 mt-1">
                  So we can reach you about this donation — required even if you're not signed in.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Full name</Label>
                <Input id="contactName" className="bg-white text-black" {...register("contactName")} />
                {errors.contactName && <p className="text-xs text-gold">{errors.contactName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone number</Label>
                <Input
                  id="contactPhone"
                  placeholder="07XXXXXXXX"
                  className="bg-white text-black"
                  {...register("contactPhone")}
                />
                {errors.contactPhone && <p className="text-xs text-gold">{errors.contactPhone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email (optional)</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  className="bg-white text-black"
                  {...register("contactEmail")}
                />
                {errors.contactEmail && <p className="text-xs text-gold">{errors.contactEmail.message}</p>}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pickupRequested"
                  checked={pickupRequested}
                  onCheckedChange={(checked) => {
                    const value = checked === true;
                    setPickupRequested(value);
                    setValue("pickupRequested", value, { shouldValidate: true });
                  }}
                  className="border-white/60"
                />
                <Label htmlFor="pickupRequested" className="cursor-pointer">
                  Request a pickup for this item
                </Label>
              </div>

              {pickupRequested && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="pickupDate">Preferred pickup date</Label>
                    <Input
                      id="pickupDate"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      className="bg-white text-black"
                      {...register("pickupDate")}
                    />
                    {errors.pickupDate && <p className="text-xs text-gold">{errors.pickupDate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickupAddress">Pickup address</Label>
                    <Textarea
                      id="pickupAddress"
                      rows={2}
                      placeholder="Where should we collect this from?"
                      className="bg-white text-black"
                      {...register("pickupAddress")}
                    />
                    {errors.pickupAddress && (
                      <p className="text-xs text-gold">{errors.pickupAddress.message}</p>
                    )}
                  </div>
                  <p className="text-xs text-primary-foreground/70">
                    This is a request, not a confirmed slot — our team will contact you directly to confirm timing.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gold text-gold-foreground hover:bg-gold-dark w-full"
              >
                {uploadingPhotos
                  ? "Uploading photos…"
                  : isSubmitting
                    ? "Saving…"
                    : pickupRequested
                      ? "Save donation & request pickup"
                      : "Save donation"}
              </Button>
            </div>
          </div>

          {/* Right Column - Impact Preview */}
          <div className="bg-white/10 p-6 rounded-xl backdrop-blur-lg flex flex-col items-center justify-center text-center">
            <FaLeaf className="text-5xl text-gold mb-4" />
            <h3 className="text-xl font-semibold">Estimated Impact</h3>
            {impact ? (
              <div className="mt-4 space-y-3">
                <p>
                  <span className="font-bold text-gold">
                    {impact.water}
                  </span>{" "}
                  L water saved
                </p>
                <p>
                  <span className="font-bold text-gold">{impact.co2}</span>{" "}
                  kg CO₂ avoided
                </p>
                <p>
                  <span className="font-bold text-gold">
                    {impact.landfill}
                  </span>{" "}
                  m³ landfill reduced
                </p>
                <p className="text-xs text-primary-foreground/60 pt-2">
                  Estimated by category —{" "}
                  <Link to="/impact" className="underline hover:text-gold">
                    see how we calculate this
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p className="text-primary-foreground/70 mt-4 text-sm">
                Select a category to see your estimated impact.
              </p>
            )}
          </div>
        </form>

        {/* Impact CTA */}
        <div className="mt-12 bg-white/10 p-6 rounded-xl backdrop-blur-lg text-center">
          <FaHandHoldingHeart className="text-4xl text-gold mx-auto" />
          <h3 className="mt-4 text-xl font-semibold">
            Every Donation Makes an Impact
          </h3>
          <p className="mt-2 text-sm text-primary-foreground/80 max-w-lg mx-auto">
            By donating, you’re reducing landfill waste, saving water, and
            avoiding CO₂ emissions. Nyuzi tracks your contributions so you
            can see your positive footprint grow.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Donate;
