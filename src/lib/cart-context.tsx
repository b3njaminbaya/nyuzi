import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  img: string;
  category: string;
  qty: number;
  stock: number;
};

type AddableProduct = Omit<CartItem, "qty">;

type CartContextValue = {
  items: CartItem[];
  addItem: (product: AddableProduct) => "added" | "at-max-stock";
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  totalCount: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "nyuzi:cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Stock is only ever authoritatively enforced server-side (see
  // create_order) -- this is a snapshot taken when the item was added or
  // last refreshed, so it can go stale if someone else buys the last units
  // while it sits in a cart. It exists purely so the cart itself can give
  // immediate feedback instead of letting someone build a cart quantity the
  // store can never fulfill and only finding out with a generic error at
  // checkout.
  const addItem = (product: AddableProduct): "added" | "at-max-stock" => {
    let result: "added" | "at-max-stock" = "added";
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (product.stock > 0 && existing.qty >= product.stock) {
          result = "at-max-stock";
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1, stock: product.stock } : item
        );
      }
      if (product.stock <= 0) {
        result = "at-max-stock";
        return prev;
      }
      return [...prev, { ...product, qty: 1 }];
    });
    return result;
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: item.stock > 0 ? Math.min(qty, item.stock) : qty } : item
      )
    );
  };

  const clear = () => setItems([]);

  const totalCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.qty * item.price, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQty, clear, totalCount, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};
