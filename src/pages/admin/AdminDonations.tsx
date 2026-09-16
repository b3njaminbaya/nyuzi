import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { getDonationPhotoUrl, listDonationPhotos } from "@/lib/donation-photos";

type Donation = {
  id: string;
  title: string;
  category: string;
  condition: number;
  notes: string | null;
  photo_count: number;
  pickup_requested: boolean;
  pickup_date: string | null;
  pickup_address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: "submitted" | "scheduled" | "collected" | "processed";
  created_at: string;
};

const STATUSES: Donation["status"][] = ["submitted", "scheduled", "collected", "processed"];
const STATUS_FILTERS: Array<Donation["status"] | "all"> = ["all", ...STATUSES];

const PhotoViewerDialog = ({ donation, onClose }: { donation: Donation; onClose: () => void }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await listDonationPhotos(donation.id);
      const resolved = await Promise.all(
        data.map(async (photo) => (await getDonationPhotoUrl(photo.storage_path)).url)
      );
      if (!cancelled) {
        setUrls(resolved.filter((u): u is string => Boolean(u)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [donation.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{donation.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading photos…</p>
        ) : urls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos were uploaded with this donation.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {urls.map((url) => (
              <img key={url} src={url} alt="" className="rounded-md object-cover aspect-square" />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const AdminDonations = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPhotosFor, setViewingPhotosFor] = useState<Donation | null>(null);
  const [statusFilter, setStatusFilter] = useState<Donation["status"] | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Couldn't load donations", { description: error.message });
    setDonations((data as Donation[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateStatus = async (id: string, status: Donation["status"]) => {
    const { error } = await supabase.from("donations").update({ status }).eq("id", id);
    if (error) {
      toast.error("Couldn't update status", { description: error.message });
      return;
    }
    setDonations((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    toast.success("Status updated");
  };

  const filteredDonations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return donations.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!query) return true;
      return (
        d.title.toLowerCase().includes(query) ||
        d.category.toLowerCase().includes(query) ||
        (d.contact_name ?? "").toLowerCase().includes(query) ||
        (d.contact_phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [donations, statusFilter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Donations</h1>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or category…"
          className="sm:max-w-xs"
          aria-label="Search donations"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Donation["status"] | "all")}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : donations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No donations yet.</p>
        ) : filteredDonations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No donations match your search.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead>Pickup?</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.title}</div>
                    {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.contact_name ? (
                      <>
                        <div>{d.contact_name}</div>
                        <div className="text-xs text-muted-foreground">{d.contact_phone}</div>
                        {d.contact_email && <div className="text-xs text-muted-foreground">{d.contact_email}</div>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">— (submitted before this was collected)</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{d.category}</TableCell>
                  <TableCell>{d.condition}%</TableCell>
                  <TableCell>
                    {d.photo_count > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setViewingPhotosFor(d)}
                      >
                        <ImageIcon size={14} /> {d.photo_count}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.pickup_requested ? (
                      <div>
                        <Badge>Requested</Badge>
                        {d.pickup_date && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(`${d.pickup_date}T00:00:00`).toLocaleDateString()}
                          </div>
                        )}
                        {d.pickup_address && (
                          <div className="text-xs text-muted-foreground max-w-[16rem] truncate" title={d.pickup_address}>
                            {d.pickup_address}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select value={d.status} onValueChange={(v) => updateStatus(d.id, v as Donation["status"])}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {viewingPhotosFor && (
        <PhotoViewerDialog donation={viewingPhotosFor} onClose={() => setViewingPhotosFor(null)} />
      )}
    </div>
  );
};

export default AdminDonations;
