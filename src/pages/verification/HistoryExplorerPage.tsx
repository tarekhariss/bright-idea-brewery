import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { useVerificationHistory } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Search } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function HistoryExplorerPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data = [], isLoading } = useVerificationHistory({ q, status });

  return (
    <PageContainer>
      <SectionHeader title="History Explorer" subtitle="Searchable archive of every verification ever performed in this workspace." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Records (visible)" value={data.length} icon={History} />
        <KpiCard label="Valid" value={data.filter((r: any) => r.status === "valid").length} accent="emerald" />
        <KpiCard label="Invalid" value={data.filter((r: any) => r.status === "invalid").length} accent="rose" />
        <KpiCard label="Cache hits" value={data.filter((r: any) => r.from_cache).length} accent="sky" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="risky">Risky</SelectItem>
            <SelectItem value="catch_all">Catch-all</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
            <SelectItem value="disposable">Disposable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : data.length === 0 ? (
          <EmptyState icon={History} title="No history" description="Verification results will accumulate here over time." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell><StatusPill status={r.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{r.confidence ? Number(r.confidence).toFixed(0) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.from_cache ? "cache" : (r.source_engine ?? "—")}</TableCell>
                  <TableCell className="text-right text-xs">{r.engine_latency_ms ? `${r.engine_latency_ms}ms` : "—"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.verified_at ?? r.created_at), { addSuffix: true })}
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
