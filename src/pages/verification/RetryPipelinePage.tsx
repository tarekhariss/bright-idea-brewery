import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useRetryPipeline, useRetryNow } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCw, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function RetryPipelinePage() {
  const { data = [], isLoading } = useRetryPipeline();
  const retry = useRetryNow();
  const now = Date.now();
  const due = data.filter((r: any) => new Date(r.next_retry_at).getTime() <= now).length;
  const scheduled = data.length - due;
  const avgAttempts = data.length
    ? (data.reduce((s: number, r: any) => s + (r.attempt_count ?? 0), 0) / data.length).toFixed(1)
    : "—";

  return (
    <PageContainer>
      <SectionHeader title="Retry Pipeline" subtitle="Transient SMTP failures, greylisted recipients, and temporary errors awaiting retry." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="In retry pipeline" value={data.length} icon={RotateCw} accent="sky" />
        <KpiCard label="Due now" value={due} accent="amber" />
        <KpiCard label="Scheduled" value={scheduled} />
        <KpiCard label="Avg attempts" value={avgAttempts} />
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
