import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOpportunities } from "@/hooks/use-opportunities";

export default function CrmContacts() {
  const { opportunities, loading } = useOpportunities({ includeClosed: true });
  const [q, setQ] = useState("");

  const contacts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string | null; total: number; open: number }>();
    opportunities.forEach((o) => {
      if (!o.contact?.id) return;
      const name = `${o.contact.first_name ?? ""} ${o.contact.last_name ?? ""}`.trim() || (o.contact.email ?? "Unknown");
      const c = map.get(o.contact.id) ?? { id: o.contact.id, name, email: o.contact.email ?? null, total: 0, open: 0 };
      c.total += 1;
      if (!["won", "lost", "not_fit", "bad_timing"].includes(o.status)) c.open += 1;
      map.set(o.contact.id, c);
    });
    const s = q.trim().toLowerCase();
    let arr = Array.from(map.values());
    if (s) arr = arr.filter((c) => `${c.name} ${c.email ?? ""}`.toLowerCase().includes(s));
    return arr.sort((a, b) => b.open - a.open || b.total - a.total);
  }, [opportunities, q]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Contacts</h1>
          <p className="text-xs text-muted-foreground">Contacts that appear on at least one opportunity.</p>
        </div>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="max-w-sm h-9 text-sm" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr><th className="text-left p-2.5 font-medium">Contact</th><th className="text-left p-2.5 font-medium">Email</th><th className="text-left p-2.5 font-medium">Open</th><th className="text-left p-2.5 font-medium">Total</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">No CRM contacts yet.</td></tr>
            ) : contacts.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-2.5"><Link to={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td className="p-2.5 text-muted-foreground text-xs">{c.email ?? "—"}</td>
                <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{c.open}</Badge></td>
                <td className="p-2.5 text-muted-foreground">{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
