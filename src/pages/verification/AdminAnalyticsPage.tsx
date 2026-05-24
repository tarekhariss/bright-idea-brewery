import { PageContainer, SectionHeader, KpiCard } from "@/components/verification/kit";
import { useVerificationOverview, useVerificationWorkers, useVerificationEngines, useDeadLetter } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Activity, ServerCog, Cpu, Skull, ShieldAlert, BarChart3 } from "lucide-react";

export default function AdminAnalyticsPage() {
  const { data: overview } = useVerificationOverview();
  const { data: workers = [] } = useVerificationWorkers();
  const { data: engines = [] } = useVerificationEngines();
  const { data: dlq = [] } = useDeadLetter();

  const onlineWorkers = workers.filter((w: any) => w.status === "online" || w.status === "idle").length;
  const dlqOpen = dlq.filter((d: any) => !d.recovered_at).length;

  return (
    <PageContainer>
      <SectionHeader title="Admin Analytics" subtitle="Platform-wide health of the verification subsystem." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Workers online" value={`${onlineWorkers}/${workers.length}`} icon={ServerCog} accent="emerald" />
        <KpiCard label="Engines active" value={engines.filter((e: any) => e.is_active).length} icon={Cpu} accent="sky" />
        <KpiCard label="Jobs in progress" value={overview?.jobs_in_progress ?? 0} icon={Activity} accent="violet" />
        <KpiCard label="DLQ open" value={dlqOpen} icon={Skull} accent={dlqOpen > 0 ? "rose" : "default"} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Cache hit rate" value={`${overview?.cache_hit_rate ?? 0}%`} accent="emerald" icon={BarChart3} />
        <KpiCard label="Verified (24h)" value={overview?.verified_24h ?? 0} />
        <KpiCard label="Invalid (24h)" value={overview?.invalid_24h ?? 0} accent="rose" />
        <KpiCard label="Quota usage" value={`${overview?.quota?.used_today ?? 0}/${overview?.quota?.daily_limit ?? "—"}`} icon={ShieldAlert} />
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Worker health</h3>
        {workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workers have reported in. Configure the worker secret and deploy the external engine.</p>
        ) : (
          <div className="grid gap-2">
            {workers.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border bg-card/40 p-3 text-sm">
                <div>
                  <div className="font-medium">{w.worker_id}</div>
                  <div className="text-xs text-muted-foreground">{w.host ?? "—"} · v{w.version ?? "?"} · {w.total_processed} processed</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded-md border px-2 py-0.5">{w.status}</span>
                  <span className="tabular-nums text-muted-foreground">{w.avg_latency_ms ? `${Number(w.avg_latency_ms).toFixed(0)}ms` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
