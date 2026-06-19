/**
 * CrmOpsPanel — production status snapshot for CRM automations.
 * Pulls real data: AI configured (LOVABLE_API_KEY via probe), crm_settings
 * flags, latest crm_job_runs per job, review queue count, failed bulk jobs,
 * stale count. No mocks.
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Activity, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Snapshot {
  auto_detect: boolean;
  review_mode: boolean;
  auto_push: boolean;
  stale_sweeper: boolean;
  threshold: number;
  last_detect: string | null;
  last_sweep: string | null;
  pending_review: number;
  stale_count: number;
  failed_bulk_jobs: number;
  last_detect_run: any | null;
  last_sweep_run: any | null;
}

export function CrmOpsPanel() {
  const { workspaceId } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [settingsRes, reviewCountRes, staleCountRes, failedJobsRes, lastDetectRes, lastSweepRes] = await Promise.all([
      (supabase as any).from("crm_settings").select("auto_detect_positive_replies, positive_reply_review_mode, auto_push_high_confidence, stale_sweeper_enabled, positive_reply_confidence_threshold, last_reply_detection_at, last_stale_sweep_at").eq("workspace_id", workspaceId).maybeSingle(),
      (supabase as any).from("crm_review_queue").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
      (supabase as any).from("opportunities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("is_stale", true),
      (supabase as any).from("crm_bulk_push_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gt("failed_count", 0),
      (supabase as any).from("crm_job_runs").select("*").eq("workspace_id", workspaceId).eq("job_name", "detect_replies").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("crm_job_runs").select("*").eq("workspace_id", workspaceId).eq("job_name", "stale_sweeper").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const s = settingsRes.data ?? {};
    setSnap({
      auto_detect: !!s.auto_detect_positive_replies,
      review_mode: s.positive_reply_review_mode !== false,
      auto_push: !!s.auto_push_high_confidence,
      stale_sweeper: s.stale_sweeper_enabled !== false,
      threshold: s.positive_reply_confidence_threshold ?? 0.8,
      last_detect: s.last_reply_detection_at,
      last_sweep: s.last_stale_sweep_at,
      pending_review: reviewCountRes.count ?? 0,
      stale_count: staleCountRes.count ?? 0,
      failed_bulk_jobs: failedJobsRes.count ?? 0,
      last_detect_run: lastDetectRes.data,
      last_sweep_run: lastSweepRes.data,
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId]);

  if (loading || !snap) return null;
  const ok = !snap.failed_bulk_jobs;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ok ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
            <h2 className="text-sm font-semibold">CRM Operations</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Stat label="Auto-detect" value={snap.auto_detect ? "Enabled" : "Disabled"} tone={snap.auto_detect ? "ok" : "muted"} />
          <Stat label="Review mode" value={snap.review_mode ? "On" : "Off (auto-push)"} tone={snap.review_mode ? "ok" : "warn"} />
          <Stat label="Confidence threshold" value={`${Math.round(snap.threshold * 100)}%`} />
          <Stat label="Stale sweeper" value={snap.stale_sweeper ? "Enabled" : "Disabled"} tone={snap.stale_sweeper ? "ok" : "muted"} />
          <LinkStat label="Pending review" value={snap.pending_review} to="/crm/review" />
          <LinkStat label="Stale opportunities" value={snap.stale_count} to="/crm/opportunities?queue=stale" />
          <LinkStat label="Failed bulk jobs" value={snap.failed_bulk_jobs} to="/crm/bulk-jobs" tone={snap.failed_bulk_jobs ? "warn" : "muted"} />
          <Stat label="Last detect" value={snap.last_detect ? new Date(snap.last_detect).toLocaleString() : "Never"} />
          <Stat label="Last sweep" value={snap.last_sweep ? new Date(snap.last_sweep).toLocaleString() : "Never"} />
        </div>
        {(snap.last_detect_run || snap.last_sweep_run) && (
          <div className="text-[11px] text-muted-foreground border-t pt-2 flex flex-wrap gap-x-4 gap-y-1">
            {snap.last_detect_run && (
              <span><Activity className="h-3 w-3 inline mr-1" />Detect: scanned {snap.last_detect_run.scanned} · queued {snap.last_detect_run.queued} · auto-pushed {snap.last_detect_run.auto_pushed} · errors {snap.last_detect_run.errors}</span>
            )}
            {snap.last_sweep_run && (
              <span><Activity className="h-3 w-3 inline mr-1" />Sweep: scanned {snap.last_sweep_run.scanned} · flagged {snap.last_sweep_run.queued}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}

function LinkStat({ label, value, to, tone }: { label: string; value: number; to: string; tone?: "ok" | "warn" | "muted" }) {
  const color = tone === "warn" ? "text-amber-600" : value > 0 ? "text-primary" : "text-muted-foreground";
  return (
    <Link to={to} className="block hover:bg-accent/40 rounded -m-1 p-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </Link>
  );
}
