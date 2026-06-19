/**
 * CRM Reports — Phase 2A: real-data only. Aggregates the workspace
 * opportunities, status history, linked deals, and tasks into simple charts.
 */
import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useCrmSettings } from "@/hooks/use-crm-settings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { filterQueue, isClosed } from "@/lib/crm-rules";

interface DealRow { id: string; amount: number | null; stage_id: string | null; status: string | null; }

export default function CrmReports() {
  const { workspaceId } = useAuth();
  const { opportunities, stages, loading } = useOpportunities({ includeClosed: true });
  const { staleDays } = useCrmSettings();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [overdueTaskCount, setOverdueTaskCount] = useState<number | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const oppIds = opportunities.map((o) => o.deal_id).filter(Boolean) as string[];
      if (oppIds.length > 0) {
        const { data } = await (supabase as any)
          .from("deals").select("id, amount, stage_id, status")
          .in("id", oppIds).eq("workspace_id", workspaceId);
        setDeals((data ?? []) as DealRow[]);
      } else {
        setDeals([]);
      }
      const { count } = await (supabase as any)
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .neq("status", "completed")
        .lt("due_date", new Date().toISOString());
      setOverdueTaskCount(count ?? 0);
    })();
  }, [workspaceId, opportunities]);

  const bySource = useMemo(() => groupCount(opportunities, (o) => o.source_channel), [opportunities]);
  const byOwner = useMemo(() => groupCount(opportunities, (o) => o.owner?.full_name ?? o.owner?.email ?? "Unassigned"), [opportunities]);
  const byCampaign = useMemo(() => groupCount(opportunities.filter((o) => o.source_campaign_id), (o) => `${o.source_campaign_type ?? "campaign"}:${o.source_campaign_id!.slice(0, 8)}`), [opportunities]);
  const byStage = useMemo(() => {
    const map = new Map<string, number>();
    stages.forEach((s) => map.set(s.stage_name, 0));
    opportunities.forEach((o) => {
      const s = stages.find((x) => x.id === o.stage_id);
      if (s) map.set(s.stage_name, (map.get(s.stage_name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [opportunities, stages]);

  const open = opportunities.filter((o) => !isClosed(o)).length;
  const closed = opportunities.length - open;
  const won = opportunities.filter((o) => o.status === "won").length;
  const lost = opportunities.filter((o) => o.status === "lost").length;
  const notFit = opportunities.filter((o) => o.status === "not_fit").length;
  const badTiming = opportunities.filter((o) => o.status === "bad_timing").length;
  const meetingsBooked = opportunities.filter((o) => o.status === "meeting_booked").length;
  const stale = filterQueue("stale", opportunities, staleDays).length;
  const pipelineValue = deals.reduce((s, d) => s + Number(d.amount ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">CRM Reports</h1>
          <p className="text-sm text-muted-foreground">Real data from your workspace opportunities. {loading ? "Loading…" : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Open" value={open} />
        <Stat label="Closed" value={closed} />
        <Stat label="Won" value={won} />
        <Stat label="Lost" value={lost} />
        <Stat label="Not fit" value={notFit} />
        <Stat label="Bad timing" value={badTiming} />
        <Stat label="Meetings booked" value={meetingsBooked} />
        <Stat label="Stale" value={stale} />
        <Stat label="Overdue tasks" value={overdueTaskCount ?? "…"} />
        <Stat label="Linked deals" value={deals.length} />
        <Stat label="Pipeline value" value={`$${pipelineValue.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Stage conversion (counts)" rows={byStage} />
        <ChartCard title="By source channel" rows={bySource} />
        <ChartCard title="By owner" rows={byOwner} />
        <ChartCard title="By campaign" rows={byCampaign} emptyHint="No campaign-attributed opportunities yet." />
      </div>
    </div>
  );
}

function groupCount<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </CardContent></Card>
  );
}

function ChartCard({ title, rows, emptyHint }: { title: string; rows: { label: string; value: number }[]; emptyHint?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && <div className="text-xs text-muted-foreground">{emptyHint ?? "No data."}</div>}
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <div className="w-44 truncate text-muted-foreground">{r.label}</div>
            <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <div className="w-10 text-right tabular-nums">{r.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
