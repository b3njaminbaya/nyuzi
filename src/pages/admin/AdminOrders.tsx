import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllOrders, markOrderShipped, updateOrderStatus, type Order, type OrderStatus } from "@/lib/orders";
import { formatKES } from "@/lib/currency";

const STATUSES: OrderStatus[] = [
  "pending_payment",
  "awaiting_manual_payment",
  "paid",
  "payment_failed",
  "shipped",
  "fulfilled",
  "cancelled",
];

const badgeVariant = (status: OrderStatus) => {
  if (status === "paid" || status === "shipped" || status === "fulfilled") return "default" as const;
  if (status === "payment_failed" || status === "cancelled") return "destructive" as const;
  return "secondary" as const;
};

const ShipOrderDialog = ({
  order,
  onClose,
  onShipped,
}: {
  order: Order;
  onClose: () => void;
  onShipped: () => void;
}) => {
  const [carrier, setCarrier] = useState(order.shipping_carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      toast.error("A tracking number is required");
      return;
    }
    setSubmitting(true);
    const { error } = await markOrderShipped(order.id, carrier.trim(), trackingNumber.trim());
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't mark order as shipped", { description: error });
      return;
    }
    toast.success("Order marked as shipped");
    onShipped();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ship order {order.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier (optional)</Label>
            <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. G4S, Wells Fargo Courier" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackingNumber">Tracking number</Label>
            <Input id="trackingNumber" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary hover:bg-primary-dark">
            {submitting ? "Saving…" : "Mark as shipped"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const STATUS_FILTERS: Array<OrderStatus | "all"> = ["all", ...STATUSES];

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await listAllOrders();
    if (error) toast.error("Couldn't load orders", { description: error });
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    if (status === "shipped") {
      setShippingOrder(order);
      return;
    }
    if (!confirm(`Change order ${order.id.slice(0, 8)} from "${order.status.replace("_", " ")}" to "${status.replace("_", " ")}"?`)) {
      return;
    }
    const { error } = await updateOrderStatus(order.id, status);
    if (error) {
      toast.error("Couldn't update order", { description: error });
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    toast.success("Order updated");
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!query) return true;
      return (
        o.customer_name.toLowerCase().includes(query) ||
        o.customer_phone.toLowerCase().includes(query) ||
        o.id.toLowerCase().includes(query)
      );
    });
  }, [orders, statusFilter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Orders</h1>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer, phone, or order id…"
          className="sm:max-w-xs"
          aria-label="Search orders"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : filteredOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders match your search.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                  </TableCell>
                  <TableCell>{formatKES(o.total_amount)}</TableCell>
                  <TableCell className="capitalize">
                    {o.payment_method}
                    {o.mpesa_receipt_number && (
                      <div className="text-xs text-muted-foreground font-mono">{o.mpesa_receipt_number}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.tracking_number ? (
                      <>
                        {o.shipping_carrier && <div>{o.shipping_carrier}</div>}
                        <div className="font-mono">{o.tracking_number}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariant(o.status)}>{o.status.replace("_", " ")}</Badge>
                      <Select value={o.status} onValueChange={(v) => handleStatusChange(o, v as OrderStatus)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {shippingOrder && (
        <ShipOrderDialog
          order={shippingOrder}
          onClose={() => setShippingOrder(null)}
          onShipped={() => {
            setShippingOrder(null);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default AdminOrders;
