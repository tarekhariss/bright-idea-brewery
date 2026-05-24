import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useVerificationAuditLog } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AuditLogPage() {
  const { data = [], isLoading } = useVerificationAuditLog(500);

  return (
    <PageContainer>
      <SectionHeader title="Audit Log" subtitle="Every verification-platform action, attributed to user or worker, with full payload." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Events (recent)" value={data.length} icon={ScrollText} />
        <KpiCard label="Unique actions" value={new Set(data.map((d: any) => d.action)).size} accent="sky" />
        <KpiCard label="Unique actors" value={new Set(data.map((d: any) => d.actor_id).filter(Boolean)).size} accent="emerald" />
        <KpiCard label="Anonymous" value={data.filter((d: any) => !d.actor_id).length} />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={ScrollText} title="Audit log empty" description="System and user actions on the verification platform are recorded here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.target_type ? `${row.target_type}:${(row.target_id ?? "").slice(0, 8)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.actor_id ? row.actor_id.slice(0, 8) : "system"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
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
