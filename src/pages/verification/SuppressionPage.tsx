import { useMemo, useState } from "react";
import { PageContainer, SectionHeader, KpiCard, EmptyState } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuppressionList, useAddSuppression, useRemoveSuppression } from "@/hooks/use-verification";
import { ShieldCheck, Plus, Trash2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function SuppressionPage() {
  const { data: list = [], isLoading } = useSuppressionList();
  const add = useAddSuppression();
  const remove = useRemoveSuppression();
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => list.filter((r: any) => !q || r.email_normalized?.includes(q.toLowerCase()) || r.reason?.includes(q.toLowerCase())),
    [list, q]
  );

  const breakdown = useMemo(() => {
    const m: Record<string, number> = {};
    list.forEach((r: any) => { m[r.source || "manual"] = (m[r.source || "manual"] || 0) + 1; });
    return m;
  }, [list]);

  function exportCsv() {
    const header = "email,reason,source,notes,created_at\n";
    const body = filtered
      .map((r: any) => [r.email_normalized, r.reason, r.source, r.notes ?? "", r.created_at]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `suppression-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <SectionHeader title="Suppression Center" subtitle="Emails permanently blocked from outbound sends across all campaigns" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Suppressed total" value={list.length} icon={ShieldCheck} accent="rose" />
        <KpiCard label="From verification" value={breakdown.verification || 0} accent="amber" />
        <KpiCard label="From bounces" value={breakdown.bounce_feedback || 0} accent="amber" />
        <KpiCard label="Manual" value={breakdown.manual || 0} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Add email to suppress…" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
          <Button
            size="sm"
            disabled={!email.includes("@") || add.isPending}
            onClick={() => { add.mutate({ email, reason: "manual" }); setEmail(""); }}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
          <div className="flex-1" />
          <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Suppression list is empty" description="Bounces and invalid verifications will auto-populate this list. You can also add emails manually." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email_normalized}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[11px]">{r.reason}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)} className="h-7 w-7">
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
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
