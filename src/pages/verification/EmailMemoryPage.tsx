import { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, ShieldCheck, AlertTriangle, CheckCircle2, Database, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = Record<string, string>;

const PROVIDERS = [
  { value: "emaillistverify", label: "EmailListVerify" },
  { value: "zerobounce", label: "ZeroBounce" },
  { value: "neverbounce", label: "NeverBounce" },
  { value: "millionverifier", label: "MillionVerifier" },
  { value: "bouncer", label: "Bouncer" },
  { value: "generic", label: "Generic / Other" },
];

const CANONICAL_KEYS = [
  "email","status","verified_at","reason","smtp_code","mx","domain",
  "catch_all","disposable","role_based","free_email",
] as const;

// Heuristic detection of common column aliases.
const ALIASES: Record<string, string[]> = {
  email: ["email","email_address","emailaddress","mail","e-mail","address"],
  status: ["status","result","verdict","state","deliverability","validation","verification_result"],
  verified_at: ["verified_at","verified","verification_date","date","checked_at","timestamp","created_at"],
  reason: ["reason","sub_status","substatus","details","description","note","message"],
  smtp_code: ["smtp_code","smtp","smtp_status","response_code"],
  mx: ["mx","mx_record","mx_host","mx_server"],
  domain: ["domain","domain_name"],
  catch_all: ["catch_all","catchall","accept_all","acceptall","is_catch_all"],
  disposable: ["disposable","is_disposable","temp"],
  role_based: ["role","role_based","rolebased","is_role"],
  free_email: ["free","free_email","is_free","freemail"],
};

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-\.]/g, ""); }

function autoDetect(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CANONICAL_KEYS) {
    const aliases = ALIASES[key].map(norm);
    const found = headers.find(h => aliases.includes(norm(h)));
    if (found) out[key] = found;
  }
  return out;
}

// Simple CSV parser (handles quoted fields). Good enough for verification exports.
function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const lines: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; cur += c; continue; }
    if (c === "\n" && !inQ) { lines.push(cur); cur = ""; continue; }
    if (c === "\r" && !inQ) continue;
    cur += c;
  }
  if (cur.length) lines.push(cur);
  if (!lines.length) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const out: string[] = []; let buf = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { buf += '"'; i++; }
        else q = !q;
      } else if (c === "," && !q) { out.push(buf); buf = ""; }
      else buf += c;
    }
    out.push(buf);
    return out.map(s => s.trim());
  };

  const headers = splitLine(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitLine(lines[i]);
    const r: Row = {};
    headers.forEach((h, idx) => { r[h] = cells[idx] ?? ""; });
    rows.push(r);
  }
  return { headers, rows };
}

const STATUS_TONE: Record<string, string> = {
  valid: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  valid_catch_all: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  risky: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
  invalid: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  bounced: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  suppressed: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  unverified: "bg-muted text-muted-foreground border-border",
};

export default function EmailMemoryPage() {
  const { workspaceId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState("emaillistverify");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any>(null);

  const { data: ws } = useQuery({
    queryKey: ["ws-intel-flag", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("workspaces").select("id, intelligence_v2").eq("id", workspaceId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const flagOn = !!ws?.intelligence_v2;

  // Live preview of canonical mapping using the seeded map (best-effort, client-side fetch)
  const { data: statusMapRows } = useQuery({
    queryKey: ["vsm-preview", provider, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_status_map")
        .select("provider, provider_status, canonical_status, is_role_based, is_disposable, is_free_email, is_catch_all")
        .in("provider", [provider, "generic"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const previewCounts = useMemo(() => {
    const c = {
      total: rows.length, by_status: {} as Record<string, number>,
      role_based: 0, disposable: 0, free_email: 0, catch_all: 0, no_email: 0,
    };
    if (!rows.length || !mapping.email) return c;
    const map = new Map<string, any>();
    (statusMapRows ?? []).forEach((r: any) => {
      const key = `${r.provider}::${String(r.provider_status).toLowerCase()}`;
      if (!map.has(key)) map.set(key, r);
    });
    for (const r of rows) {
      const email = (r[mapping.email] ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) { c.no_email++; continue; }
      const statusRaw = mapping.status ? (r[mapping.status] ?? "").toLowerCase().trim().replace(/\s+/g, "_") : "";
      const hit = map.get(`${provider}::${statusRaw}`) || map.get(`generic::${statusRaw}`);
      const canonical = hit?.canonical_status ?? (statusRaw ? "unknown" : "unverified");
      c.by_status[canonical] = (c.by_status[canonical] ?? 0) + 1;
      const parseB = (v: string | undefined) => v && ["true","1","yes","y","t"].includes(String(v).toLowerCase().trim());
      if (hit?.is_role_based || parseB(mapping.role_based && r[mapping.role_based])) c.role_based++;
      if (hit?.is_disposable || parseB(mapping.disposable && r[mapping.disposable])) c.disposable++;
      if (hit?.is_free_email || parseB(mapping.free_email && r[mapping.free_email])) c.free_email++;
      if (hit?.is_catch_all  || parseB(mapping.catch_all  && r[mapping.catch_all]))  c.catch_all++;
    }
    return c;
  }, [rows, mapping, provider, statusMapRows]);

  const onFile = useCallback(async (file: File) => {
    setReport(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoDetect(parsed.headers));
  }, []);

  const runImport = useCallback(async () => {
    if (!workspaceId) { toast.error("No workspace"); return; }
    if (!mapping.email) { toast.error("Email column required"); return; }
    if (!rows.length) return;
    setRunning(true); setReport(null);
    try {
      const preserveColumns = headers; // preserve all
      const uploadToken = crypto.randomUUID();
      const chunkSize = 2000;
      const totalCounters = {
        total: 0, inserted: 0, skipped_invalid_email: 0, duplicates: 0,
        by_status: {} as Record<string, number>,
        modifiers: { role_based: 0, disposable: 0, free_email: 0, catch_all: 0 },
        matched_existing_contacts: 0, stored_for_future: 0,
      };
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke("ingest-verification-upload", {
          body: {
            workspace_id: workspaceId,
            provider,
            source_label: fileName ?? "manual_upload",
            upload_token: uploadToken,
            rows: slice,
            column_mapping: mapping,
            preserve_columns: preserveColumns,
            is_final_chunk: i + chunkSize >= rows.length,
          },
        });
        if (error) throw error;
        const c = (data as any)?.counters; if (!c) continue;
        totalCounters.total += c.total;
        totalCounters.inserted += c.inserted;
        totalCounters.skipped_invalid_email += c.skipped_invalid_email;
        totalCounters.duplicates += c.duplicates;
        for (const [k, v] of Object.entries(c.by_status as Record<string, number>)) {
          totalCounters.by_status[k] = (totalCounters.by_status[k] ?? 0) + v;
        }
        totalCounters.modifiers.role_based += c.modifiers.role_based;
        totalCounters.modifiers.disposable += c.modifiers.disposable;
        totalCounters.modifiers.free_email += c.modifiers.free_email;
        totalCounters.modifiers.catch_all  += c.modifiers.catch_all;
        totalCounters.matched_existing_contacts = Math.max(totalCounters.matched_existing_contacts, c.matched_existing_contacts);
        totalCounters.stored_for_future = Math.max(totalCounters.stored_for_future, c.stored_for_future);
      }
      setReport(totalCounters);
      toast.success(`Imported ${totalCounters.inserted} verification records`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally { setRunning(false); }
  }, [workspaceId, rows, mapping, headers, provider, fileName]);

  if (!flagOn) {
    return (
      <div className="p-6">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Email Verification Memory is gated</AlertTitle>
          <AlertDescription>
            This workspace does not have <code>intelligence_v2</code> enabled. Enable it on the
            workspace record to access historical verification ingestion. Existing verification
            tools remain unchanged.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Verification Memory</h1>
        <p className="text-sm text-muted-foreground">
          Upload historical verification exports. Statuses map to a canonical model, backward-match existing contacts,
          and forward-match future imports. Never creates or deletes contacts.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>CSV file</Label>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) onFile(f);
              }} />
              {fileName && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />{fileName}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {headers.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Column mapping</h2>
              <p className="text-xs text-muted-foreground">Auto-detected from headers. Adjust if needed. Unmapped columns are preserved in raw metadata.</p>
            </div>
            <Badge variant="outline">{rows.length} rows</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CANONICAL_KEYS.map(key => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {key} {key === "email" && <span className="text-rose-500">*</span>}
                </Label>
                <Select value={mapping[key] ?? "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, [key]: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="(not mapped)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(not mapped)</SelectItem>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length > 0 && mapping.email && (
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Preview — canonical mapping</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {["valid","valid_catch_all","risky","unknown","invalid","bounced","suppressed","unverified"].map(s => (
              <div key={s} className="rounded-lg border p-3">
                <div className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${STATUS_TONE[s]}`}>{s}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.by_status[s] ?? 0}</div>
              </div>
            ))}
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">role-based</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.role_based}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">disposable</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.disposable}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">free-email</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.free_email}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">catch-all</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.catch_all}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">no-email rows</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{previewCounts.no_email}</div>
            </div>
          </div>

          <Separator />
          <div className="rounded-lg border overflow-hidden">
            <ScrollArea className="h-56">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {headers.slice(0, 8).map(h => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((r, i) => (
                    <tr key={i} className="border-t">
                      {headers.slice(0, 8).map(h => <td key={h} className="px-2 py-1.5 truncate max-w-[200px]">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Unknown columns are preserved as raw metadata. Precedence rules prevent older data from overwriting newer verifications.
            </p>
            <Button onClick={runImport} disabled={running || !mapping.email}>
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingesting…</> : <><Upload className="h-4 w-4 mr-2" /> Ingest into memory</>}
            </Button>
          </div>
        </Card>
      )}

      {report && (
        <Card className="p-5 space-y-3 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-semibold">Ingestion complete</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Total rows" value={report.total} />
            <Stat label="Inserted" value={report.inserted} accent="emerald" />
            <Stat label="Duplicates skipped" value={report.duplicates} />
            <Stat label="Invalid email skipped" value={report.skipped_invalid_email} />
            <Stat label="Matched existing contacts" value={report.matched_existing_contacts} accent="emerald" />
            <Stat label="Stored for future imports" value={report.stored_for_future} accent="sky" />
            <Stat label="Role-based" value={report.modifiers.role_based} />
            <Stat label="Disposable" value={report.modifiers.disposable} />
            <Stat label="Free-email" value={report.modifiers.free_email} />
            <Stat label="Catch-all" value={report.modifiers.catch_all} />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.by_status as Record<string, number>).map(([s, n]) => (
              <span key={s} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${STATUS_TONE[s] ?? ""}`}>
                {s} <span className="font-semibold tabular-nums">{n}</span>
              </span>
            ))}
          </div>
          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Backward & forward matching active</AlertTitle>
            <AlertDescription>
              Existing contacts with these emails were updated automatically through the projection function.
              Any future imports of these emails will pick up this verification memory.
            </AlertDescription>
          </Alert>
        </Card>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Safety</AlertTitle>
        <AlertDescription className="text-xs">
          This tool never creates or deletes contacts, never affects Engage sending, and never overwrites
          newer/better verification with older data. The existing verification tool is unaffected.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "sky" }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent === "emerald" ? "text-emerald-500" : accent === "sky" ? "text-sky-500" : ""}`}>{value}</div>
    </div>
  );
}
