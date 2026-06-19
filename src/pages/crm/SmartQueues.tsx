/**
 * SmartQueues — daily-use CRM queues. All counts and lists are derived from
 * real opportunities via crm-rules.ts, never mocked.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { SMART_QUEUES, filterQueue, type SmartQueueKey } from "@/lib/crm-rules";
import { StaleBadge } from "@/components/crm/StaleBadge";

export default function SmartQueues() {
  const { opportunities, loading } = useOpportunities({ includeClosed: true });
  const { staleDays } = useCrmSettings();
  const [active, setActive] = useState<SmartQueueKey>("new_interested");

  const buckets = useMemo(() => {
    const out: Record<string, ReturnType<typeof filterQueue>> = {};
    for (const q of SMART_QUEUES) out[q.key] = filterQueue(q.key, opportunities, staleDays);
    return out;
  }, [opportunities, staleDays]);

  const rows = buckets[active] ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Smart Queues</h1>
          <p className="text-sm text-muted-foreground">Daily-use CRM queues derived from real opportunity data.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {SMART_QUEUES.map((q) => {
          const count = buckets[q.key]?.length ?? 0;
          const isActive = active === q.key;
          return (
            <button
              key={q.key}
              onClick={() => setActive(q.key)}
              className={`text-left rounded-lg border p-3 transition-colors ${isActive ? "bg-primary/5 border-primary/40" : "hover:bg-accent/40"}`}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{q.label}</div>
              <div className="text-xl font-semibold">{loading ? "…" : count}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b text-sm text-muted-foreground">
            {SMART_QUEUES.find((q) => q.key === active)?.description}
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nothing in this queue.</div>
          ) : (
            <ul className="divide-y">
              {rows.map((o) => (
                <li key={o.id}>
                  <Link to={`/crm/opportunities/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {o.title || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || o.company?.name || "Untitled"}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{o.status.replace("_", " ")}</Badge>
                        {o.priority !== "normal" && <Badge variant="secondary" className="text-[10px]">{o.priority}</Badge>}
                        <StaleBadge opportunity={o} staleDays={staleDays} compact />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.company?.name ?? "—"} · {o.contact?.email ?? "—"} · via {o.source_channel}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                      {o.next_action_at && <div className="text-primary">Next {new Date(o.next_action_at).toLocaleDateString()}</div>}
                      {o.last_activity_at && <div>Last {new Date(o.last_activity_at).toLocaleDateString()}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
