import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { useVerificationEngines, useToggleEngine } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cpu } from "lucide-react";

export default function EnginesRegistryPage() {
  const { data = [], isLoading } = useVerificationEngines();
  const toggle = useToggleEngine();
  const active = data.filter((e: any) => e.is_active).length;
  const online = data.filter((e: any) => e.status === "online" || e.status === "idle").length;

  return (
    <PageContainer>
      <SectionHeader title="Engines Registry" subtitle="Verification engines available to the routing layer. Toggle to enable/disable per workspace policy." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Engines registered" value={data.length} icon={Cpu} />
        <KpiCard label="Active" value={active} accent="emerald" />
        <KpiCard label="Online" value={online} accent="sky" />
        <KpiCard label="Total runs" value={data.reduce((s: number, e: any) => s + Number(e.total_runs || 0), 0).toLocaleString()} />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={Cpu} title="No engines registered" description="Connect an external verification engine (open-source verifier, SMTP probe, MX-aware service) to start running jobs." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engine</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-right">Avg latency</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-xs">{e.kind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.version ?? "—"}</TableCell>
                  <TableCell><StatusPill status={e.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{e.priority}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.avg_latency_ms ? `${Number(e.avg_latency_ms).toFixed(0)}ms` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.success_rate ? `${Number(e.success_rate).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(e.total_runs).toLocaleString()}</TableCell>
                  <TableCell><Switch checked={e.is_active} onCheckedChange={(c) => toggle.mutate({ id: e.id, is_active: c })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
