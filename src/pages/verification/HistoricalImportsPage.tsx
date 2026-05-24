import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Upload, FileSpreadsheet, Brain } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const sb = supabase as any;
const CANONICAL = [
  "email","status","confidence","result","reason","date","source",
  "disposable","role_based","catch_all","domain","mx","bounce",
  "smtp_response","provider","verification_quality",
];

function parseCsv(text: string): { headers: string[]; rows: Record<string,string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (l: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (q && l[i+1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur); return out;
  };
  const headers = split(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const cells = split(l);
    const o: Record<string,string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? "").trim(); });
    return o;
  });
  return { headers, rows };
}

function autoMap(headers: string[]): Record<string,string> {
  const m: Record<string,string> = {};
  for (const c of CANONICAL) {
    const exact = headers.find(h => h.toLowerCase().replace(/[_\s-]/g,"") === c.replace(/[_\s-]/g,""));
    if (exact) m[c] = exact;
  }
  return m;
}

export default function HistoricalImportsPage() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string,string>[]>([]);
  const [mapping, setMapping] = useState<Record<string,string>>({});
  const [sourceLabel, setSourceLabel] = useState("emaillistverifier");

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["historical_imports"],
    queryFn: async () => {
      const { data, error } = await sb.from("historical_imports").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  const onFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoMap(parsed.headers));
  };

  const runImport = useMutation({
    mutationFn: async () => {
      if (!file || !rows.length || !mapping.email) throw new Error("Map at least the email column");
      const { data: ins, error: insErr } = await sb.from("historical_imports").insert({
        workspace_id: workspaceId, uploaded_by: user!.id,
        file_name: file.name, file_size_bytes: file.size,
        row_count: rows.length, column_mapping: mapping,
        source_label: sourceLabel, status: "pending",
      }).select("id").single();
      if (insErr) throw insErr;
      const importId = ins.id as string;

      const CHUNK = 2000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await sb.functions.invoke("import-historical-verifications", {
          body: { import_id: importId, workspace_id: workspaceId, rows: slice, column_mapping: mapping, source_label: sourceLabel },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Historical dataset imported into intelligence");
      qc.invalidateQueries({ queryKey: ["historical_imports"] });
      setOpen(false); setFile(null); setHeaders([]); setRows([]); setMapping({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <SectionHeader
        title="Historical Dataset Importer"
        subtitle="Upload legacy verifier exports (EmailListVerify, ZeroBounce, MillionVerifier). Data feeds intelligence, decay scoring, and provider behavior — never treated as live truth."
        action={<Button size="sm" onClick={() => setOpen(true)}><Upload className="mr-2 h-4 w-4" />New historical import</Button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total imports" value={imports.length} icon={Database} />
        <KpiCard label="Processing" value={imports.filter((j: any) => j.status === "processing").length} accent="sky" />
        <KpiCard label="Completed" value={imports.filter((j: any) => j.status === "completed").length} accent="emerald" />
        <KpiCard label="Rows learned" value={imports.reduce((a: number, b: any) => a + (b.processed_count ?? 0), 0).toLocaleString()} icon={Brain} />
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : imports.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No historical imports yet" description="Upload a legacy verifier export to seed intelligence and freshness scoring." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((j: any) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.file_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.source_label}</TableCell>
                  <TableCell><StatusPill status={j.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{j.row_count?.toLocaleString() ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.processed_count?.toLocaleString() ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.failed_count?.toLocaleString() ?? 0}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import legacy verifier dataset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV file</Label>
              <Input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              {rows.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{rows.length.toLocaleString()} rows, {headers.length} columns detected.</p>}
            </div>
            <div>
              <Label>Source</Label>
              <Select value={sourceLabel} onValueChange={setSourceLabel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emaillistverifier">EmailListVerify</SelectItem>
                  <SelectItem value="zerobounce">ZeroBounce</SelectItem>
                  <SelectItem value="millionverifier">MillionVerifier</SelectItem>
                  <SelectItem value="neverbounce">NeverBounce</SelectItem>
                  <SelectItem value="custom">Custom / other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {headers.length > 0 && (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Column mapping</div>
                {CANONICAL.map((c) => (
                  <div key={c} className="grid grid-cols-3 items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{c}</span>
                    <Select value={mapping[c] ?? "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, [c]: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="(skip)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(skip)</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => runImport.mutate()} disabled={!file || !mapping.email || runImport.isPending}>
              {runImport.isPending ? "Importing…" : "Import dataset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
