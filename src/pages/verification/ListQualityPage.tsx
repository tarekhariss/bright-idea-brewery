import { PageContainer, SectionHeader, EmptyState, KpiCard } from "@/components/verification/kit";
import { useVerificationJobs, useListHealth } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gauge } from "lucide-react";
import { useState } from "react";

export default function ListQualityPage() {
  const { data: jobs = [] } = useVerificationJobs();
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: health } = useListHealth(jobId);

  const scored = jobs.filter((j: any) => j.list_quality_score != null);
  const avgScore = scored.length
    ? (scored.reduce((s: number, j: any) => s + Number(j.list_quality_score || 0), 0) / scored.length).toFixed(0)
    : "—";

  return (
    <PageContainer>
      <SectionHeader title="List Quality" subtitle="Composite scoring of each verification job — deliverability outlook for your lists." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Jobs scored" value={scored.length} icon={Gauge} />
        <KpiCard label="Avg quality" value={avgScore !== "—" ? `${avgScore}/100` : "—"} accent="emerald" />
        <KpiCard label="Excellent (≥85)" value={scored.filter((j: any) => j.list_quality_score >= 85).length} accent="emerald" />
        <KpiCard label="Poor (<50)" value={scored.filter((j: any) => j.list_quality_score < 50).length} accent="rose" />
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Inspect job:</span>
          <Select value={jobId ?? ""} onValueChange={setJobId}>
            <SelectTrigger className="w-80"><SelectValue placeholder="Pick a job…" /></SelectTrigger>
            <SelectContent>
              {jobs.slice(0, 50).map((j: any) => (
                <SelectItem key={j.id} value={j.id}>{j.name ?? j.id.slice(0, 8)} — {j.total_count} emails</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!jobId ? (
          <EmptyState icon={Gauge} title="Choose a job" description="Pick a verification job to see its list-quality breakdown." />
        ) : health ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(health).map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-card/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace(/_/g, " ")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{typeof v === "number" ? v.toLocaleString() : String(v ?? "—")}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Computing…</div>
        )}
      </Card>
    </PageContainer>
  );
}
