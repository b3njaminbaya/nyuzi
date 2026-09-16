import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { supabase } from "@/lib/supabase";

type PartnerApplication = {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  partnership_type: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const STATUSES: PartnerApplication["status"][] = ["pending", "approved", "rejected"];
const STATUS_FILTERS: Array<PartnerApplication["status"] | "all"> = ["all", ...STATUSES];

const AdminPartners = () => {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PartnerApplication["status"] | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Couldn't load applications", { description: error.message });
    setApplications((data as PartnerApplication[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateStatus = async (id: string, status: PartnerApplication["status"]) => {
    const { error } = await supabase.from("partner_applications").update({ status }).eq("id", id);
    if (error) {
      toast.error("Couldn't update status", { description: error.message });
      return;
    }
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    toast.success("Status updated");
  };

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!query) return true;
      return (
        a.full_name.toLowerCase().includes(query) ||
        a.organization.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query)
      );
    });
  }, [applications, statusFilter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Partner Applications</h1>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, organization, or email…"
          className="sm:max-w-xs"
          aria-label="Search partner applications"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PartnerApplication["status"] | "all")}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
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
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : filteredApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications match your search.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.full_name}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </TableCell>
                  <TableCell>{a.organization}</TableCell>
                  <TableCell>{a.partnership_type}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={a.message}>
                    {a.message}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v as PartnerApplication["status"])}>
                      <SelectTrigger className="w-32">
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
    </div>
  );
};

export default AdminPartners;
