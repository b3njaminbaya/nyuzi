import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listNewsletterSignups, type NewsletterSignup } from "@/lib/newsletter";

const toCsv = (rows: NewsletterSignup[]) => {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = "email,subscribed_at";
  const lines = rows.map((r) => `${escape(r.email)},${escape(r.created_at)}`);
  return [header, ...lines].join("\n");
};

const AdminNewsletter = () => {
  const [signups, setSignups] = useState<NewsletterSignup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listNewsletterSignups().then(({ data, error }) => {
      if (error) toast.error("Couldn't load newsletter signups", { description: error });
      setSignups(data);
      setLoading(false);
    });
  }, []);

  const handleExport = () => {
    const blob = new Blob([toCsv(signups)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nyuzi-newsletter-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {signups.length} subscriber{signups.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={signups.length === 0} className="gap-2">
          <Download size={16} /> Export CSV
        </Button>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : signups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No newsletter signups yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Subscribed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signups.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
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

export default AdminNewsletter;
