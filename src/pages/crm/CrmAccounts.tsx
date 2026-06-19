import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOpportunities } from "@/hooks/use-opportunities";

export default function CrmAccounts() {
  const { opportunities, loading } = useOpportunities({ includeClosed: true });
  const [q, setQ] = useState("");

  const accounts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; open: number; won: number }>();
    opportunities.forEach((o) => {
      if (!o.company?.id) return;
      const a = map.get(o.company.id) ?? { id: o.company.id, name: o.company.name ?? "Unknown", total: 0, open: 0, won: 0 };
      a.total += 1;
      if (["won"].includes(o.status)) a.won += 1;
      else if (!["lost", "not_fit", "bad_timing"].includes(o.status)) a.open += 1;
      map.set(o.company.id, a);
    });
    const s = q.trim().toLowerCase();
    let arr = Array.from(map.values());
    if (s) arr = arr.filter((a) => a.name.toLowerCase().includes(s));
    return arr.sort((a, b) => b.open - a.open || b.total - a.total);
  }, [opportunities, q]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Accounts</h1>
          <p className="text-xs text-muted-foreground">Companies with at least one opportunity in the CRM.</p>
        </div>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts…" className="max-w-sm h-9 text-sm" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr><th className="text-left p-2.5 font-medium">Account</th><th className="text-left p-2.5 font-medium">Open</th><th className="text-left p-2.5 font-medium">Won</th><th className="text-left p-2.5 font-medium">Total</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-xs">No accounts yet. Push contacts or companies to CRM to populate.</td></tr>
            ) : accounts.map((a) => (
              <tr key={a.id} className="border-t hover:bg-muted/30">
                <td className="p-2.5"><Link to={`/companies/${a.id}`} className="font-medium hover:underline">{a.name}</Link></td>
                <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{a.open}</Badge></td>
                <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{a.won}</Badge></td>
                <td className="p-2.5 text-muted-foreground">{a.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
