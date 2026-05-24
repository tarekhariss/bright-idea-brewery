import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useRetryPipeline, useRetryNow, useRecoveryQueue, useRecoveryMetrics } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCw, Play, ShieldAlert, Layers, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function RetryPipelinePage() {
  const { data = [], isLoading } = useRetryPipeline();
  const { data: recovery = [] } = useRecoveryQueue({ limit: 300 });
  const { data: metrics } = useRecoveryMetrics();
  const retry = useRetryNow();
  const now = Date.now();
  const due = data.filter((r: any) => new Date(r.next_retry_at).getTime() <= now).length;
  const scheduled = data.length - due;
  const avgAttempts = data.length
    ? (data.reduce((s: number, r: any) => s + (r.attempt_count ?? 0), 0) / data.length).toFixed(1)
    : "—";

  const qState = metrics?.queue_state ?? {};
  const grey = metrics?.greylisting ?? { total: 0, success_rate: 0 };
  const reasonRows: any[] = metrics?.reason_breakdown ?? [];
  const providerRows: any[] = metrics?.provider_breakdown ?? [];
  const passRows: any[] = metrics?.pass_breakdown ?? [];
  const codeRows: any[] = metrics?.top_smtp_codes ?? [];

  return (
    <PageContainer>
      <SectionHeader title="Retry & Unknown Recovery Pipeline" subtitle="Transient SMTP failures, greylisted recipients, and multi-pass recovery attempts." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="In retry pipeline" value={data.length} icon={RotateCw} accent="sky" />
        <KpiCard label="Recovery queued" value={qState.queued ?? 0} icon={Layers} accent="amber" />
        <KpiCard label="Recovery in-flight" value={qState.in_flight ?? 0} icon={Clock} accent="sky" />
        <KpiCard label="Recovered" value={qState.done ?? 0} accent="emerald" />
        <KpiCard label="Exhausted" value={qState.exhausted ?? 0} accent="rose" />
        <KpiCard label="Greylist recovery" value={`${grey.success_rate ?? 0}%`} icon={ShieldAlert} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Pass breakdown (7d)</div>
          <Table>
            <TableHeader><TableRow><TableHead>Pass</TableHead><TableHead className="text-right">Queued</TableHead><TableHead className="text-right">Done</TableHead><TableHead className="text-right">Exhausted</TableHead></TableRow></TableHeader>
            <TableBody>
              {passRows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-xs text-muted-foreground">No data yet</TableCell></TableRow> :
                passRows.map((p) => (
                  <TableRow key={p.pass}><TableCell>Pass {p.pass}</TableCell><TableCell className="text-right tabular-nums">{p.queued}</TableCell><TableCell className="text-right tabular-nums">{p.done}</TableCell><TableCell className="text-right tabular-nums">{p.exhausted}</TableCell></TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Unknown reasons (7d)</div>
          <Table>
            <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Recovery</TableHead></TableRow></TableHeader>
            <TableBody>
              {reasonRows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-xs text-muted-foreground">No data yet</TableCell></TableRow> :
                reasonRows.slice(0, 8).map((r) => (
                  <TableRow key={r.reason}><TableCell className="text-xs">{r.reason}</TableCell><TableCell className="text-right tabular-nums">{r.total}</TableCell><TableCell className="text-right tabular-nums">{r.recovery_rate}%</TableCell></TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Provider failures (7d)</div>
          <Table>
            <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Recovery</TableHead></TableRow></TableHeader>
            <TableBody>
              {providerRows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-xs text-muted-foreground">No data yet</TableCell></TableRow> :
                providerRows.slice(0, 8).map((p) => (
                  <TableRow key={p.provider}><TableCell className="text-xs">{p.provider}</TableCell><TableCell className="text-right tabular-nums">{p.total}</TableCell><TableCell className="text-right tabular-nums">{p.recovery_rate}%</TableCell></TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recovery queue (next attempts)</div>
        {recovery.length === 0 ? (
          <div className="text-xs text-muted-foreground">No emails in recovery yet — unknowns from Pass 1 will appear here.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Provider</TableHead><TableHead>Pass</TableHead><TableHead>Reason</TableHead><TableHead>State</TableHead><TableHead className="text-right">Next attempt</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {recovery.slice(0, 150).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell className="text-xs">{r.provider_key}</TableCell>
                  <TableCell className="text-xs">Pass {r.pass_number}</TableCell>
                  <TableCell className="text-xs">{r.reason_code}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.state}</Badge></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.next_attempt_at ? formatDistanceToNow(new Date(r.next_attempt_at), { addSuffix: true }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SectionHeader title="Legacy retry rows" subtitle="Pre-recovery transient failures awaiting standard retry." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Due now" value={due} accent="amber" />
        <KpiCard label="Scheduled" value={scheduled} />
        <KpiCard label="Avg attempts" value={avgAttempts} />
        <KpiCard label="Top SMTP codes" value={codeRows.length ? codeRows.map((c) => c.code).slice(0, 4).join(", ") : "—"} />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={RotateCw} title="Retry queue empty" description="Failed verifications with transient errors will appear here for automatic retry." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="text-right">Next retry</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 200).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.attempt_count ?? r.retry_count ?? 0}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.error_message ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.next_retry_at ? formatDistanceToNow(new Date(r.next_retry_at), { addSuffix: true }) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => retry.mutate(r.id)}>
                      <Play className="h-3 w-3" /> Retry now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
