import { PageContainer, SectionHeader, StatusPill, EmptyState } from "@/components/verification/kit";
import { useVerificationJobs } from "@/hooks/use-verification";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function JobsPage() {
  const { data: jobs = [], isLoading } = useVerificationJobs();
  return (
    <PageContainer>
      <SectionHeader title="Verification jobs" subtitle="All bulk verification runs across this workspace"
        action={<Link to="/verification/imports"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-500">New job</Button></Link>} />
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : jobs.length === 0 ? (
          <EmptyState icon={ListChecks} title="No jobs" description="Start a verification job from Imports." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Cached</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j: any) => (
                <TableRow key={j.id} className="cursor-pointer" onClick={() => window.location.assign(`/verification/jobs/${j.id}`)}>
                  <TableCell className="font-medium">{j.name || j.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.source}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.total_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.processed_count}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{j.cached_hit_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.list_quality_score != null ? Number(j.list_quality_score).toFixed(0) : "—"}</TableCell>
                  <TableCell><StatusPill status={j.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
