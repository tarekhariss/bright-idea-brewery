/**
 * SmartQueues — daily-use CRM queues. Counts come from server-side
 * crm_smart_queue_counts RPC (efficient at scale). The selected bucket's
 * rows are loaded from the client-side filter helpers for now (Phase 2B
 * keeps lists capped at the workspace size).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { filterQueue, type SmartQueueKey } from "@/lib/crm-rules";
import { StaleBadge } from "@/components/crm/StaleBadge";

interface ExtendedQueue { key: string; label: string; description: string; }
const QUEUES: ExtendedQueue[] = [
  { key: "new_interested",   label: "New Interested",         description: "Interested in last 7 days." },
  { key: "needs_owner",      label: "Needs Owner",            description: "No owner assigned." },
  { key: "no_follow_up",     label: "No Follow-up Scheduled", description: "Open and no next_action_at." },
  { key: "due_today",        label: "Follow-up Due Today",    description: "next_action_at today or earlier." },
  { key: "overdue_tasks",    label: "Overdue Tasks",          description: "Linked tasks past due." },
  { key: "stale",            label: "Stale Opportunities",    description: "is_stale flag set by sweeper." },
  { key: "high_priority",    label: "High Priority",          description: "Priority high/urgent." },
  { key: "meetings_booked",  label: "Meetings Booked",        description: "Status = meeting_booked." },
  { key: "proposal_rfq",     label: "Proposal / RFQ",         description: "Status = proposal_rfq." },
  { key: "recently_updated", label: "Recently Updated",       description: "Activity in last 24h." },
  { key: "review_needed",    label: "Review Needed",          description: "Pending detected replies waiting for approval." },
];

export default function SmartQueues() {
  const { workspaceId } = useAuth();
  const { opportunities, loading } = useOpportunities({ includeClosed: true });
  const { staleDays } = useCrmSettings();
  const [active, setActive] = useState<string>("new_interested");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const { data } = await (supabase as any).rpc("crm_smart_queue_counts", { p_workspace_id: workspaceId });
      if (data) setCounts(data as Record<string, number>);
    })();
  }, [workspaceId, opportunities.length]);

  const rows = useMemo(() => {
    if (active === "review_needed" || active === "overdue_tasks") return [];
    return filterQueue(active as SmartQueueKey, opportunities, staleDays);
  }, [active, opportunities, staleDays]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><ListChecks className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Smart Queues</h1>
          <p className="text-sm text-muted-foreground">Server-side counts; click a queue to inspect.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {QUEUES.map((q) => {
          const count = counts[q.key] ?? 0;
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
            {QUEUES.find((q) => q.key === active)?.description}
          </div>
          {active === "review_needed" ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Open the <Link to="/crm/review" className="text-primary underline">Review Queue</Link> to triage detected replies.
            </div>
          ) : active === "overdue_tasks" ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Open the <Link to="/crm/tasks" className="text-primary underline">Tasks page</Link> to clear overdue items.
            </div>
          ) : rows.length === 0 ? (
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
