import { PageContainer, SectionHeader, StatusPill, EmptyState, KpiCard } from "@/components/verification/kit";
import { useVerificationWorkers } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServerCog, Activity, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function WorkersPage() {
  const { data: workers = [], isLoading } = useVerificationWorkers();
  const online = workers.filter((w: any) => w.status === "online" || w.status === "idle").length;
  const inFlight = workers.reduce((acc: number, w: any) => acc + (w.in_flight_count || 0), 0);
  const avgLatency = workers.length
    ? Math.round(workers.reduce((acc: number, w: any) => acc + (Number(w.avg_latency_ms) || 0), 0) / workers.length)
    : 0;

  return (
    <PageContainer>
      <SectionHeader title="Worker infrastructure" subtitle="External verification workers connected via the worker API" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Online workers" value={`${online}/${workers.length}`} icon={ServerCog} accent={online > 0 ? "emerald" : "rose"} />
        <KpiCard label="In flight" value={inFlight} icon={Activity} accent="sky" />
        <KpiCard label="Avg latency" value={`${avgLatency}ms`} icon={Zap} accent="violet" />
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : workers.length === 0 ? (
          <EmptyState icon={ServerCog} title="No workers connected" description="Connect a self-hosted verification worker to the verification-worker-api endpoint. It will appear here after its first heartbeat." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker ID</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">In flight</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Avg latency</TableHead>
                <TableHead>Last heartbeat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.worker_id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{w.host || "—"}</TableCell>
                  <TableCell className="text-xs">{w.version || "—"}</TableCell>
                  <TableCell><StatusPill status={w.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{w.in_flight_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(w.total_processed).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.avg_latency_ms ? `${Math.round(Number(w.avg_latency_ms))}ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.last_heartbeat_at ? formatDistanceToNow(new Date(w.last_heartbeat_at), { addSuffix: true }) : "—"}
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
