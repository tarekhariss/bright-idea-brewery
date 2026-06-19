import { useMemo } from "react";
import { Link } from "react-router-dom";
import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDeals } from "@/hooks/use-deals";
import { useOpportunities } from "@/hooks/use-opportunities";

export default function CrmDeals() {
  const { deals, loading } = useDeals();
  const { opportunities } = useOpportunities({ includeClosed: true });

  const dealToOpp = useMemo(() => {
    const m = new Map<string, string>();
    opportunities.forEach((o) => { if (o.deal_id) m.set(o.deal_id, o.id); });
    return m;
  }, [opportunities]);

  const linked = useMemo(() => (deals ?? []).filter((d: any) => dealToOpp.has(d.id)), [deals, dealToOpp]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <HandCoins className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">CRM Deals</h1>
          <p className="text-xs text-muted-foreground">Deals attached to a CRM opportunity. Manage all deals on the main Deals page.</p>
        </div>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-left p-2.5 font-medium">Deal</th>
              <th className="text-left p-2.5 font-medium">Status</th>
              <th className="text-right p-2.5 font-medium">Amount</th>
              <th className="text-left p-2.5 font-medium">Company</th>
              <th className="text-left p-2.5 font-medium">Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : linked.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">No deals linked to opportunities yet. Use “Push to CRM” on a deal or check “Create deal” when pushing.</td></tr>
            ) : linked.map((d: any) => (
              <tr key={d.id} className="border-t hover:bg-muted/30">
                <td className="p-2.5"><Link to="/deals" className="font-medium hover:underline">{d.name}</Link></td>
                <td className="p-2.5"><Badge variant="outline" className="text-[10px] capitalize">{d.status}</Badge></td>
                <td className="p-2.5 text-right tabular-nums">{d.amount != null ? `${d.currency ?? ""} ${Number(d.amount).toLocaleString()}` : "—"}</td>
                <td className="p-2.5 text-muted-foreground text-xs">{d.company?.name ?? "—"}</td>
                <td className="p-2.5">
                  <Link to={`/crm/opportunities/${dealToOpp.get(d.id)}`} className="text-primary text-xs hover:underline">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
