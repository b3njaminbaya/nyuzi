import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";
import { formatKES } from "@/lib/currency";

const CartSheet = () => {
  const { items, removeItem, updateQty, totalCount, totalPrice } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Open cart">
          <ShoppingCart size={20} />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
              {totalCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Your cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Your cart is empty. Browse the marketplace to find something.
          </p>
        ) : (
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 border-b pb-4">
                <img
                  src={item.img}
                  alt={item.title}
                  className="h-16 w-16 rounded-md object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.category}</span>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        aria-label={`Decrease quantity of ${item.title}`}
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-4 text-center text-sm">{item.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        disabled={item.stock > 0 && item.qty >= item.stock}
                        aria-label={`Increase quantity of ${item.title}`}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatKES(item.price * item.qty)}
                    </span>
                  </div>
                  {item.stock > 0 && item.qty >= item.stock && (
                    <p className="mt-1 text-xs text-muted-foreground">Max available in stock</p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.title} from cart`}
                  className="self-start text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Subtotal</span>
              <span>{formatKES(totalPrice)}</span>
            </div>
            <Button onClick={handleCheckout} className="mt-4 w-full bg-primary hover:bg-primary-dark">
              Checkout
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSheet;
