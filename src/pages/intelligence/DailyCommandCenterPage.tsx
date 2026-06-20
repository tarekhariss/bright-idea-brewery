import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, ShieldAlert, AlertTriangle, ListFilter, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function DailyCommandCenterPage() {
  const { workspaceId } = useAuth();
  const { enabled: v2, isLoading: flagLoading } = useIntelligenceV2();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["daily-command", workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_daily_command_center", { p_workspace_id: workspaceId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId && v2,
  });

  const runClassifier = async () => {
    const { data: r, error } = await (supabase as any).rpc("classify_unclassified_inbox_threads", { p_workspace_id: workspaceId, p_limit: 200 });
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(r) ? r[0] : r;
    toast.success(`Classified ${row?.classified ?? 0} threads`);
    refetch();
  };

  if (flagLoading) return <div className="p-6"><Skeleton className="h-8 w-64" /></div>;
  if (!v2) return (
    <div className="p-6"><Card><CardContent className="p-8 text-center text-muted-foreground">
      <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p>Daily Command Center is part of Intelligence v2 and is not enabled for this workspace.</p>
    </CardContent></Card></div>
  );

  const pr = data?.positive_replies ?? [];
  const so = data?.stale_opportunities ?? [];
  const lr = data?.low_readiness_lists ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">Real action items only. No fake tasks.</p>
        </div>
        <Button variant="outline" size="sm" onClick={runClassifier} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Re-run reply classifier</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={MessageSquare} label="Positive replies" value={pr.length} />
        <KPI icon={Clock} label="Stale opportunities" value={so.length} />
        <KPI icon={ShieldAlert} label="Quarantine pending" value={data?.quarantine_pending_count ?? 0} />
        <KPI icon={ShieldOff} label="Blocked by verification" value={data?.blocked_contacts_count ?? 0} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Positive replies needing follow-up</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20" /> : pr.length === 0 ? (
            <p className="text-xs text-muted-foreground">No positive replies awaiting follow-up. Run the classifier to detect new ones.</p>
          ) : (
            <ul className="divide-y">
              {pr.map((r: any) => (
                <li key={r.thread_id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/engage/inbox/${r.thread_id}`} className="text-sm font-medium hover:text-primary truncate block">{r.subject || "(no subject)"}</Link>
                    <p className="text-[11px] text-muted-foreground">{r.last_message_at ? formatDistanceToNow(new Date(r.last_message_at), { addSuffix: true }) : "—"}</p>
                  </div>
                  <Badge variant="default" className="text-[10px] capitalize">{r.category}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Stale opportunities (no activity 14d+)</CardTitle></CardHeader>
        <CardContent>
          {so.length === 0 ? (<p className="text-xs text-muted-foreground">No stale opportunities.</p>) : (
            <ul className="divide-y">
              {so.map((o: any) => (
                <li key={o.opportunity_id} className="py-2 flex items-center justify-between gap-3">
                  <Link to={`/crm/opportunities/${o.opportunity_id}`} className="text-sm font-medium hover:text-primary truncate">{o.title || "(untitled)"}</Link>
                  <span className="text-[11px] text-muted-foreground">{o.last_activity_at ? formatDistanceToNow(new Date(o.last_activity_at), { addSuffix: true }) : "no activity"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ListFilter className="h-4 w-4" /> Lists with low readiness</CardTitle></CardHeader>
        <CardContent>
          {lr.length === 0 ? (<p className="text-xs text-muted-foreground">No lists with concerning readiness.</p>) : (
            <ul className="divide-y">
              {lr.map((l: any) => (
                <li key={l.list_id} className="py-2 flex items-center justify-between gap-3">
                  <Link to={`/lists/${l.list_id}`} className="text-sm font-medium hover:text-primary truncate">{l.name}</Link>
                  <span className="text-[11px] text-muted-foreground">{l.contact_count} contacts</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">Computed {data?.computed_at ? new Date(data.computed_at).toLocaleString() : "—"}</p>
    </div>
  );
}

function KPI({ icon: Icon, label, value }: any) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{Number(value ?? 0).toLocaleString()}</p>
    </CardContent></Card>
  );
}
