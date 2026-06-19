import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Table2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { StaleBadge } from "@/components/crm/StaleBadge";
import { filterQueue, type SmartQueueKey, SMART_QUEUES } from "@/lib/crm-rules";

export default function OpportunitiesTable() {
  const [params, setParams] = useSearchParams();
  const queueKey = params.get("queue") as SmartQueueKey | null;
  const [includeClosed, setIncludeClosed] = useState(queueKey === "stale");
  const { opportunities, loading } = useOpportunities({ includeClosed: includeClosed || !!queueKey });
  const { staleDays } = useCrmSettings();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    let list = opportunities;
    if (queueKey) list = filterQueue(queueKey, list, staleDays);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((o) => {
      const name = `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.toLowerCase();
      return [name, o.company?.name ?? "", o.title ?? "", o.contact?.email ?? ""].join(" ").toLowerCase().includes(s);
    });
  }, [opportunities, q, queueKey, staleDays]);

  const queueLabel = queueKey ? SMART_QUEUES.find((q) => q.key === queueKey)?.label : null;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Table2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">All opportunities in your CRM workspace.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-md" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeClosed} onCheckedChange={(v) => setIncludeClosed(!!v)} />
          Include closed
        </label>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Opportunity</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No opportunities found.</td></tr>
              )}
              {rows.map((o) => (
                <tr key={o.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link to={`/crm/opportunities/${o.id}`} className="font-medium hover:underline">
                      {o.title || "(untitled)"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {`${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || o.contact?.email || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{o.company?.name ?? "—"}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1"><Badge variant="outline">{o.status.replace("_", " ")}</Badge><StaleBadge opportunity={o} staleDays={staleDays} compact /></div></td>
                  <td className="px-3 py-2"><Badge variant="secondary">{o.priority}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{o.source_channel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.owner?.full_name ?? o.owner?.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.last_activity_at ? new Date(o.last_activity_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
