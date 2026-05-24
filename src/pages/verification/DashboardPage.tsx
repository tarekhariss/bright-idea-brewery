import { PageContainer, KpiCard, SectionHeader, EmptyState, StatusPill } from "@/components/verification/kit";
import { useVerificationOverview } from "@/hooks/use-verification-platform";
import { useVerificationJobs } from "@/hooks/use-verification";
import { Activity, Database, Gauge, ShieldAlert, Server, Zap, Cpu, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function VerificationDashboardPage() {
  const { data: o = {} as any } = useVerificationOverview();
  const { data: jobs = [] } = useVerificationJobs();
  const recent = jobs.slice(0, 6);

  return (
    <PageContainer>
      <div>
        <h1 className="text-xl font-semibold">Verification Overview</h1>
        <p className="text-xs text-muted-foreground">Live operational view of your deliverability intelligence stack.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Processed (24h)" value={o.processed_24h ?? 0} icon={Activity} accent="sky" hint={`${o.jobs_completed_24h ?? 0} jobs completed`} />
        <KpiCard label="Cache hit rate" value={`${o.cache_hit_rate ?? 0}%`} icon={Database} accent="emerald" hint={`${o.cache_hits_24h ?? 0} cached lookups`} />
        <KpiCard label="Invalid (7d)" value={`${o.invalid_rate_7d ?? 0}%`} icon={ShieldAlert} accent="rose" hint="Across all verifications" />
        <KpiCard label="Avg latency" value={`${Math.round(o.avg_engine_latency_ms ?? 0)}ms`} icon={Zap} accent="violet" hint="Primary engine, last 24h" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="In progress" value={o.jobs_in_progress ?? 0} icon={ListChecks} />
        <KpiCard label="Dead letter" value={o.dead_letter_count ?? 0} icon={Server} accent={o.dead_letter_count > 0 ? "amber" : "default"} />
        <KpiCard label="Bounces (7d)" value={o.bounces_7d ?? 0} icon={ShieldAlert} accent={o.bounces_7d > 50 ? "rose" : "default"} />
        <KpiCard label="Suppression list" value={o.suppression_size ?? 0} icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <SectionHeader title="Recent jobs" subtitle="Last verification jobs across your workspace" action={<Link to="/verification/jobs" className="text-xs text-emerald-500 hover:underline">View all →</Link>} />
          {recent.length === 0 ? (
            <EmptyState icon={ListChecks} title="No verification jobs yet" description="Start by uploading a list of emails or enqueueing from a campaign." />
          ) : (
            <div className="space-y-2">
              {recent.map((j: any) => (
                <Link key={j.id} to={`/verification/jobs/${j.id}`} className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 text-sm transition hover:border-emerald-500/30 hover:bg-card/70">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{j.name || `Job ${j.id.slice(0, 8)}`}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {j.processed_count}/{j.total_count} • created {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {j.list_quality_score != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">Q {Number(j.list_quality_score).toFixed(0)}</span>
                    )}
                    <StatusPill status={j.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader title="Workspace quota" subtitle="Daily & monthly verification budget" />
          {o.quota ? (
            <div className="space-y-4">
              <QuotaBar label="Today" used={o.quota.used_today} max={o.quota.daily_limit} />
              <QuotaBar label="This month" used={o.quota.used_month} max={o.quota.monthly_limit} />
              {o.quota.abuse_flagged && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                  Abuse flag set — contact your workspace admin.
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={Gauge} title="No quota configured" description="Default limits will apply when you start verifying." />
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{used.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
