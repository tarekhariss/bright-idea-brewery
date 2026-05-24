import { PageContainer, KpiCard, SectionHeader, EmptyState } from "@/components/verification/kit";
import { useVerificationQueue } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Activity, Clock, RotateCw, Skull, ShieldAlert, CheckCircle2, AlertOctagon } from "lucide-react";

export default function QueueMonitorPage() {
  const { data, isLoading } = useVerificationQueue();
  const s = data?.summary ?? { pending: 0, processing: 0, completed: 0, invalid: 0, risky: 0, dead_letter: 0, retry_scheduled: 0 };

  return (
    <PageContainer>
      <div>
        <h1 className="text-xl font-semibold">Queue Monitor</h1>
        <p className="text-xs text-muted-foreground">Live state of verification results across the past 7 days. Auto-refreshes every 10s.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="Pending" value={s.pending} icon={Clock} />
        <KpiCard label="Processing" value={s.processing} icon={Activity} accent="sky" />
        <KpiCard label="Retry queued" value={s.retry_scheduled} icon={RotateCw} accent="amber" />
        <KpiCard label="Completed" value={s.completed} icon={CheckCircle2} accent="emerald" />
        <KpiCard label="Invalid" value={s.invalid} icon={AlertOctagon} accent="rose" />
        <KpiCard label="Risky / Catch-all" value={s.risky} icon={ShieldAlert} accent="amber" />
        <KpiCard label="Dead letter" value={s.dead_letter} icon={Skull} accent={s.dead_letter > 0 ? "rose" : "default"} />
      </div>

      <Card className="p-5">
        <SectionHeader title="Throughput notes" subtitle="How to interpret the queue" />
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading queue snapshot…</div>
        ) : (
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>• <strong className="text-foreground">Pending</strong> — emails accepted but not yet picked by a worker.</li>
            <li>• <strong className="text-foreground">Processing</strong> — currently being verified by an active worker.</li>
            <li>• <strong className="text-foreground">Retry queued</strong> — soft-failed, scheduled for retry with exponential backoff.</li>
            <li>• <strong className="text-foreground">Dead letter</strong> — exceeded max retries. Available for manual recovery.</li>
            <li>• Stuck rows are auto-recovered every 5 minutes by the recovery cron.</li>
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
