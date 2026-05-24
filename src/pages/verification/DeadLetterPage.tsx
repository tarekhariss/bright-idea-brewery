import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useDeadLetter, useRequeueDeadLetter } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skull, RotateCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DeadLetterPage() {
  const { data = [], isLoading } = useDeadLetter();
  const recover = useRequeueDeadLetter();
  const open = data.filter((d: any) => !d.recovered_at);
  const recovered = data.length - open.length;

  return (
    <PageContainer>
      <SectionHeader title="Dead Letter Queue" subtitle="Permanently failed verifications after exhausting retries. Review and requeue manually if needed." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Open" value={open.length} icon={Skull} accent="rose" />
        <KpiCard label="Recovered" value={recovered} accent="emerald" />
        <KpiCard label="Total escalated" value={data.length} />
        <KpiCard label="Avg attempts" value={data.length ? (data.reduce((s: number, d: any) => s + (d.attempt_count ?? 0), 0) / data.length).toFixed(1) : "—"} />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={Skull} title="Dead letter queue is empty" description="Verifications that exceed retry limits will be escalated here for manual review." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Escalated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d: any) => (
                <TableRow key={d.id} className={d.recovered_at ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{d.email}</TableCell>
                  <TableCell className="text-xs">{d.reason}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.attempt_count}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{d.last_error ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(d.escalated_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    {!d.recovered_at && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => recover.mutate(d.id)}>
                        <RotateCw className="h-3 w-3" /> Mark recovered
                      </Button>
                    )}
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
