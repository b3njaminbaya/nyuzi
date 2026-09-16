import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import FormBanner, { type FormBannerState } from "@/components/FormBanner";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { createOrder } from "@/lib/orders";
import { initiateMpesaPayment, normalizeKenyanPhone } from "@/lib/mpesa";
import { getMyRewards } from "@/lib/rewards";
import { formatKES } from "@/lib/currency";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z
    .string()
    .trim()
    .min(9, "Enter the phone number to pay with M-Pesa")
    .refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan number, e.g. 07XXXXXXXX"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  address: z.string().trim().min(5, "Enter a delivery address"),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const Checkout = () => {
  const { items, totalPrice, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [banner, setBanner] = useState<FormBannerState | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [applyCredit, setApplyCredit] = useState(false);

  useEffect(() => {
    if (!user) {
      setCreditBalance(0);
      return;
    }
    getMyRewards(user.id).then(({ data }) => setCreditBalance(data?.creditBalance ?? 0));
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutSchema) });

  const creditToApply = applyCredit ? Math.min(creditBalance, totalPrice) : 0;
  const payableTotal = totalPrice - creditToApply;

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    // Already guaranteed non-null by the schema's refine() above.
    const normalizedPhone = normalizeKenyanPhone(values.phone)!;

    const { order, error } = await createOrder(
      items,
      {
        name: values.name,
        phone: normalizedPhone,
        email: values.email || undefined,
        address: values.address,
      },
      applyCredit
    );

    if (error || !order) {
      setBanner({ type: "error", title: "Couldn't create your order", description: error ?? undefined });
      return;
    }

    const payment = await initiateMpesaPayment(order.id, normalizedPhone);

    if (payment.configured && payment.success === false) {
      // The order itself already failed server-side and its stock was
      // released (see mpesa-initiate and migration 0024), so it's safe to
      // let the customer retry immediately with the same cart rather than
      // sending them to a dead order's status page.
      setBanner({
        type: "error",
        title: "Couldn't start M-Pesa payment",
        description: `${payment.error ?? "Please try again."} Your cart hasn't been touched — you can try again below.`,
      });
      return;
    }

    if (!payment.configured) {
      toast("M-Pesa isn't set up on this store yet", {
        description: "We'll follow up by email to arrange payment for this order.",
      });
    }

    clear();
    navigate(`/order/${order.id}`);
  });

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Seo title="Checkout — Nyuzi" />
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add something from the marketplace first.</p>
        <Button asChild className="mt-6 bg-primary hover:bg-primary-dark">
          <Link to="/marketplace">Browse the marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Seo title="Checkout — Nyuzi" description="Complete your order and pay with M-Pesa." />
      <h1 className="text-3xl font-bold text-primary">Checkout</h1>

      {banner && (
        <div className="mt-6">
          <FormBanner state={banner} />
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">M-Pesa phone number</Label>
            <Input id="phone" placeholder="07XXXXXXXX" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Delivery address</Label>
            <Textarea id="address" rows={3} {...register("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-dark"
          >
            {isSubmitting ? "Placing order…" : "Pay with M-Pesa"}
          </Button>
        </form>

        <div className="rounded-lg border border-border bg-card p-6 h-fit">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.title} × {item.qty}
                </span>
                <span>{formatKES(item.price * item.qty)}</span>
              </div>
            ))}
          </div>

          {creditBalance > 0 && (
            <div className="mt-4 flex items-center gap-2 border-t pt-4">
              <Checkbox id="apply-credit" checked={applyCredit} onCheckedChange={(v) => setApplyCredit(v === true)} />
              <Label htmlFor="apply-credit" className="text-sm font-normal cursor-pointer">
                Use my Nyuzi credit ({formatKES(creditBalance)} available)
              </Label>
            </div>
          )}

          {creditToApply > 0 && (
            <div className="mt-2 flex justify-between text-sm text-primary">
              <span>Credit applied</span>
              <span>-{formatKES(creditToApply)}</span>
            </div>
          )}

          <div className="mt-4 flex justify-between border-t pt-4 font-semibold">
            <span>Total</span>
            <span>{formatKES(payableTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
