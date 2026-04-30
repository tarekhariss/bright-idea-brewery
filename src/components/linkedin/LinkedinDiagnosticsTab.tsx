import { useLinkedinWorkerRuns, useLinkedinQueueHealth, triggerLinkedinWorker } from "@/hooks/use-linkedin-worker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Activity, AlertTriangle, CheckCircle2, Clock, Ban, PauseCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_META: Record<string, { label: string; icon: typeof Activity; tone: string }> = {
  pending:   { label: "Waiting",   icon: Clock,        tone: "bg-amber-500/10 text-amber-700 border-amber-200" },
  scheduled: { label: "In flight", icon: Activity,     tone: "bg-sky-500/10 text-sky-700 border-sky-200" },
  completed: { label: "Completed", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  failed:    { label: "Failed",    icon: AlertTriangle,tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
  blocked:   { label: "Blocked",   icon: Ban,          tone: "bg-rose-500/10 text-rose-700 border-rose-200" },
  paused:    { label: "Paused",    icon: PauseCircle,  tone: "bg-slate-500/10 text-slate-700 border-slate-200" },
};

export function LinkedinDiagnosticsTab() {
  const { data: runs, isLoading: runsLoading } = useLinkedinWorkerRuns(20);
  const { data: health, isLoading: healthLoading } = useLinkedinQueueHealth();
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    const res = await triggerLinkedinWorker();
    setRunning(false);
    if (res.ok) toast.success("Worker run triggered");
    else toast.error(res.message ?? "Failed to trigger worker");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Queue health</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Live counts of LinkedIn actions in this workspace.</p>
          </div>
          <Button size="sm" onClick={handleRun} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run worker now
          </Button>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : !health || health.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queued LinkedIn actions yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.keys(STATUS_META).map((s) => {
                const row = health.find((h) => h.status === s);
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                return (
                  <div key={s} className={`rounded-lg border p-3 ${meta.tone}`}>
                    <div className="flex items-center gap-1.5 text-xs font-medium"><Icon className="h-3.5 w-3.5" /> {meta.label}</div>
                    <div className="text-2xl font-semibold mt-1">{row?.count ?? 0}</div>
                    {row?.oldest_scheduled_at && (
                      <div className="text-[10px] mt-1 opacity-80">oldest {formatDistanceToNow(new Date(row.oldest_scheduled_at), { addSuffix: true })}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent worker runs</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">The last 20 background runs of the LinkedIn execution worker. Visible to platform admins.</p>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : !runs || runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No worker runs recorded yet. Either pg_cron has not fired or you don't have admin access to view runs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 pr-3 font-medium">Started</th>
                    <th className="text-left py-2 pr-3 font-medium">Duration</th>
                    <th className="text-right py-2 pr-3 font-medium">Claimed</th>
                    <th className="text-right py-2 pr-3 font-medium">OK</th>
                    <th className="text-right py-2 pr-3 font-medium">Failed</th>
                    <th className="text-right py-2 pr-3 font-medium">Blocked</th>
                    <th className="text-right py-2 pr-3 font-medium">Skipped</th>
                    <th className="text-left py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const dur = r.finished_at ? Math.max(0, new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) : null;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 text-xs">{formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}</td>
                        <td className="py-2 pr-3 text-xs">{dur === null ? <Badge variant="outline" className="text-[10px]">running</Badge> : `${dur}ms`}</td>
                        <td className="py-2 pr-3 text-right">{r.claimed}</td>
                        <td className="py-2 pr-3 text-right text-emerald-600">{r.succeeded}</td>
                        <td className="py-2 pr-3 text-right text-rose-600">{r.failed}</td>
                        <td className="py-2 pr-3 text-right text-rose-600">{r.blocked}</td>
                        <td className="py-2 pr-3 text-right text-amber-600">{r.skipped}</td>
                        <td className="py-2 text-xs text-muted-foreground truncate max-w-[260px]">
                          {r.error ? <span className="text-rose-600">{r.error}</span> : Array.isArray(r.notes) && r.notes.length > 0 ? `${r.notes.length} item${r.notes.length === 1 ? "" : "s"}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
