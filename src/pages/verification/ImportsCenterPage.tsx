import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { useVerificationJobs } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function ImportsCenterPage() {
  const { data = [], isLoading } = useVerificationJobs({ source: "csv_upload" });

  return (
    <PageContainer>
      <SectionHeader
        title="Imports Center"
        subtitle="Verify CSV files of emails. We dedupe against cache and run them through the engine pool."
        action={<Button asChild size="sm"><Link to="/tools/verification">New import</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total imports" value={data.length} icon={Upload} />
        <KpiCard label="Processing" value={data.filter((j: any) => j.status === "processing").length} accent="sky" />
        <KpiCard label="Completed" value={data.filter((j: any) => j.status === "completed").length} accent="emerald" />
        <KpiCard label="Failed" value={data.filter((j: any) => j.status === "failed").length} accent="rose" />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={Upload} title="No imports yet" description="Upload a CSV of emails to start your first verification job." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((j: any) => (
                <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link to={`/tools/verification/${j.id}`} className="font-medium hover:underline">{j.name ?? `Import ${j.id.slice(0, 8)}`}</Link>
                  </TableCell>
                  <TableCell><StatusPill status={j.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{j.total_count?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.processed_count?.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.list_quality_score ? `${Number(j.list_quality_score).toFixed(0)}%` : "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
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
