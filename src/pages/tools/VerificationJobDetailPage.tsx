import { useParams, Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download } from "lucide-react";
import { useVerificationJob, useVerificationResults } from "@/hooks/use-verification";
import { VerificationStatusBadge } from "./VerificationPage";

export default function VerificationJobDetailPage() {
  const { id } = useParams();
  const { data: job } = useVerificationJob(id ?? null);
  const { data: rows = [] } = useVerificationResults(id ?? null);

  function downloadCsv() {
    const headers = ["email","status","confidence","risk_reasons","mx_provider","smtp_code","smtp_response","from_cache","verified_at"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.email, r.status, r.confidence ?? "",
        `"${(r.risk_reasons ?? []).join("|")}"`,
        r.mx_provider ?? "", r.smtp_code ?? "",
        `"${(r.smtp_response ?? "").replace(/"/g, '""')}"`,
        r.from_cache ? "true" : "false",
        r.verified_at ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `verification-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!job) return <PageShell title="Verification job"><div className="text-muted-foreground">Loading…</div></PageShell>;

  return (
    <PageShell
      title={job.name ?? "Verification job"}
      description={`${job.processed_count}/${job.total_count} processed · status: ${job.status}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/tools/verification"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
          <Button variant="outline" onClick={downloadCsv}><Download className="w-4 h-4 mr-1" />Export CSV</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          ["Safe", job.safe_count, "text-emerald-600"],
          ["Valid", job.valid_count, "text-green-600"],
          ["Invalid", job.invalid_count, "text-red-600"],
          ["Risky", job.risky_count, "text-orange-600"],
          ["Catch-all", job.catch_all_count, "text-yellow-600"],
          ["Disposable", job.disposable_count, "text-rose-600"],
          ["Role-based", job.role_based_count, "text-purple-600"],
          ["Unknown", job.unknown_count, "text-gray-500"],
          ["Failed", job.failed_count, "text-gray-500"],
          ["Quality", job.list_quality_score ?? "—", "text-foreground"],
        ].map(([label, value, color]) => (
          <Card key={label as string}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-xl font-semibold tabular-nums ${color}`}>{value as any}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Results</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Conf</TableHead>
              <TableHead>Risk</TableHead><TableHead>MX</TableHead><TableHead>SMTP</TableHead>
              <TableHead>Cache</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell><VerificationStatusBadge s={r.status} /></TableCell>
                  <TableCell className="tabular-nums">{r.confidence ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(r.risk_reasons ?? []).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">{r.mx_provider ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">
                    {r.smtp_code ?? ""} {r.smtp_response ?? ""}
                  </TableCell>
                  <TableCell>{r.from_cache ? <Badge variant="outline" className="text-[11px]">cache</Badge> : ""}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No results.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
