import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageContainer, SectionHeader, EmptyState, KpiCard, StatusPill } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Upload, FileSpreadsheet, Brain, Sparkles, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const sb = supabase as any;

const CANONICAL: { key: string; label: string; required?: boolean; hints: string[]; group?: "verification" | "prospect" }[] = [
  { key: "email", label: "Email", required: true, hints: ["email", "emailaddress", "email_address", "address", "mail", "recipient", "to"], group: "verification" },
  { key: "status", label: "Verification status", hints: ["status", "verification_status", "verificationstatus", "elv_status", "elv_result", "emaillistverify_result", "emaillistverify_status", "validation_status", "validation_result", "validity", "email_status"], group: "verification" },
  { key: "result", label: "Result (alt)", hints: ["result", "verdict", "outcome", "verification_result", "validation_result"], group: "verification" },
  { key: "confidence", label: "Confidence / score", hints: ["confidence", "confidence_score", "score", "deliverability_score", "deliverability", "quality_score", "verification_score"], group: "verification" },
  { key: "reason", label: "Reason", hints: ["reason", "verification_reason", "sub_status", "substatus", "details", "message", "error", "notes"], group: "verification" },
  { key: "date", label: "Date verified", hints: ["date", "verified_at", "verification_date", "checked_at", "last_verified", "verified_on", "verified_date", "datechecked", "timestamp", "checked"], group: "verification" },
  { key: "provider", label: "Provider / MX provider", hints: ["provider", "provider_detected", "mx_provider", "mailbox_provider", "esp", "email_provider", "host_provider"], group: "verification" },
  { key: "mx", label: "MX record", hints: ["mx", "mx_record", "mx_host", "mxhost", "mx_server"], group: "verification" },
  { key: "domain", label: "Domain", hints: ["domain", "host", "email_domain", "emaildomain"], group: "verification" },
  { key: "disposable", label: "Is disposable", hints: ["disposable", "is_disposable", "disposable_flag", "temp_mail"], group: "verification" },
  { key: "role_based", label: "Is role-based", hints: ["role_based", "rolebased", "is_role", "role_account", "role_based_flag", "is_role_based"], group: "verification" },
  { key: "catch_all", label: "Is catch-all", hints: ["catch_all", "catchall", "accept_all", "catch_all_flag", "is_catch_all", "is_catchall"], group: "verification" },
  { key: "bounce", label: "Bounced", hints: ["bounce", "bounced", "hard_bounce", "bounce_status", "bounce_risk", "is_bounce"], group: "verification" },
  { key: "smtp_response", label: "SMTP response", hints: ["smtp_response", "smtp", "response", "smtp_code", "smtp_message"], group: "verification" },
  { key: "verification_quality", label: "Verification quality", hints: ["verification_quality", "quality", "quality_tier", "grade", "rating"], group: "verification" },
  { key: "source", label: "Source", hints: ["source", "source_file", "origin", "lead_source", "list_source"], group: "verification" },
  // Prospect fields — used to enrich Prospect Search when verification is safe.
  { key: "first_name", label: "First name", hints: ["first_name", "firstname", "fname", "given_name", "givenname"], group: "prospect" },
  { key: "last_name", label: "Last name", hints: ["last_name", "lastname", "lname", "surname", "family_name", "familyname"], group: "prospect" },
  { key: "full_name", label: "Full name", hints: ["full_name", "fullname", "name", "contact_name", "person_name"], group: "prospect" },
  { key: "company", label: "Company", hints: ["company", "company_name", "organization", "organisation", "account", "employer", "business"], group: "prospect" },
  { key: "company_domain", label: "Company domain", hints: ["company_domain", "company_website", "corporate_domain", "company_url"], group: "prospect" },
  { key: "title", label: "Job title", hints: ["title", "job_title", "position", "designation"], group: "prospect" },
  { key: "role", label: "Role", hints: ["role", "function", "job_role", "job_function"], group: "prospect" },
  { key: "linkedin", label: "LinkedIn URL", hints: ["linkedin", "linkedin_url", "linkedin_profile", "li_url", "linkedin_link"], group: "prospect" },
  { key: "phone", label: "Phone", hints: ["phone", "phone_number", "tel", "telephone", "work_phone", "direct_phone"], group: "prospect" },
  { key: "mobile", label: "Mobile", hints: ["mobile", "mobile_phone", "cell_phone", "cell"], group: "prospect" },
  { key: "country", label: "Country", hints: ["country", "country_code", "nation"], group: "prospect" },
  { key: "city", label: "City", hints: ["city", "town", "person_city", "location_city"], group: "prospect" },
  { key: "company_city", label: "Company city", hints: ["company_city", "hq_city", "office_city"], group: "prospect" },
  { key: "state", label: "State / region", hints: ["state", "region", "province", "county"], group: "prospect" },
  { key: "industry", label: "Industry", hints: ["industry", "vertical", "sector", "category"], group: "prospect" },
  { key: "website", label: "Website", hints: ["website", "site", "url", "homepage", "web", "company_site"], group: "prospect" },
  { key: "employee_count", label: "Employee count", hints: ["employee_count", "employees", "company_size", "headcount", "staff_size", "num_employees"], group: "prospect" },
  { key: "revenue", label: "Revenue", hints: ["revenue", "annual_revenue", "company_revenue", "turnover", "sales_revenue"], group: "prospect" },
  { key: "department", label: "Department", hints: ["department", "dept", "division"], group: "prospect" },
  { key: "seniority", label: "Seniority", hints: ["seniority", "seniority_level", "level"], group: "prospect" },
  { key: "headline", label: "Headline", hints: ["headline", "tagline", "bio_headline"], group: "prospect" },
  { key: "technologies", label: "Technologies", hints: ["technologies", "tech_stack", "tech", "tools", "stack"], group: "prospect" },
  { key: "tags", label: "Tags", hints: ["tags", "labels", "categories"], group: "prospect" },
];


const SOURCE_OPTIONS = [
  { value: "EmailListVerify", label: "EmailListVerify" },
  { value: "ZeroBounce", label: "ZeroBounce" },
  { value: "MillionVerifier", label: "MillionVerifier" },
  { value: "NeverBounce", label: "NeverBounce" },
  { value: "Bouncer", label: "Bouncer" },
  { value: "Hunter", label: "Hunter.io" },
  { value: "Custom", label: "Custom / other" },
];

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function autoMap(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  const used = new Set<string>();
  const normalized = headers.map(h => ({ raw: h, n: norm(h) }));
  // Pass 1: exact normalized match against key + hints (strongest signal)
  for (const c of CANONICAL) {
    const targets = new Set([c.key, ...c.hints].map(norm));
    const hit = normalized.find(h => !used.has(h.raw) && targets.has(h.n));
    if (hit) { m[c.key] = hit.raw; used.add(hit.raw); }
  }
  // Note: no fuzzy/substring pass — it causes false positives like
  // "Company State" → verification status. Unmapped columns are preserved
  // as custom fields verbatim, so we prefer correctness over coverage here.

  return m;
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { headers, rows };
  }
  if (name.endsWith(".txt")) {
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => ({ email: l.trim() }));
    return { headers: ["email"], rows };
  }
  // CSV
  const text = await file.text();
  const result = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data as any[] };
}

export default function HistoricalImportsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, workspaceId } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sourceLabel, setSourceLabel] = useState("EmailListVerify");
  const [datasetName, setDatasetName] = useState("");
  const [tags, setTags] = useState("");
  const [autoSeedProspects, setAutoSeedProspects] = useState(true);
  const [completedDatasetId, setCompletedDatasetId] = useState<string | null>(null);

  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const { data: datasets = [] } = useQuery({
    queryKey: ["imported_datasets"],
    queryFn: async () => {
      const { data, error } = await sb.from("imported_datasets").select("*").order("uploaded_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 4000,
  });

  const { data: completedDataset } = useQuery({
    queryKey: ["imported_dataset", completedDatasetId],
    enabled: !!completedDatasetId,
    refetchInterval: completedDatasetId ? 2000 : false,
    queryFn: async () => {
      const { data, error } = await sb.from("imported_datasets").select("*").eq("id", completedDatasetId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const reset = () => {
    setStep(1); setFile(null); setHeaders([]); setRows([]); setMapping({});
    setDatasetName(""); setTags(""); setAutoSeedProspects(true); setProgress({ done: 0, total: 0 });
    setCompletedDatasetId(null);
  };

  const onPickFile = async (f: File) => {
    setFile(f);
    setDatasetName(f.name.replace(/\.[^.]+$/, ""));
    try {
      const parsed = await parseFile(f);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers));
      setStep(2);
    } catch (e: any) {
      toast.error(`Could not parse file: ${e.message ?? e}`);
    }
  };

  const stats = useMemo(() => ({
    rowCount: rows.length,
    mappedFields: Object.values(mapping).filter(Boolean).length,
    fileType: file?.name.split(".").pop()?.toLowerCase() ?? "",
  }), [rows, mapping, file]);

  const runImport = useMutation({
    mutationFn: async () => {
      if (!file || !rows.length || !mapping.email) throw new Error("Map at least the email column");
      if (!workspaceId) throw new Error("No workspace");
      const fileType = (file.name.split(".").pop()?.toLowerCase() ?? "csv") as "csv" | "xlsx" | "txt";

      const { data: ds, error: dsErr } = await sb.from("imported_datasets").insert({
        workspace_id: workspaceId,
        source: sourceLabel,
        filename: datasetName || file.name,
        file_type: ["csv","xlsx","txt","zip"].includes(fileType) ? fileType : "csv",
        row_count: rows.length,
        mapping: { ...mapping, _tags: tags.split(",").map(t => t.trim()).filter(Boolean), _historical_only: true },
        stats: {},
        status: "pending",
        auto_seed_prospects: autoSeedProspects,
        uploaded_by: user?.id,

      }).select("id").single();
      if (dsErr) throw dsErr;
      const datasetId = ds.id as string;

      const CHUNK = 1000;
      const total = Math.ceil(rows.length / CHUNK);
      setProgress({ done: 0, total });
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const isFinal = i + CHUNK >= rows.length;
        const { error } = await sb.functions.invoke("import-historical-verifications", {
          body: {
            dataset_id: datasetId,
            workspace_id: workspaceId,
            rows: slice,
            column_mapping: mapping,
            source_label: sourceLabel,
            is_final_chunk: isFinal,
          },
        });
        if (error) throw error;
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
      return datasetId;
    },
    onSuccess: (datasetId: string) => {
      toast.success("Dataset imported — intelligence and learning tables updated.");
      qc.invalidateQueries({ queryKey: ["imported_datasets"] });
      qc.invalidateQueries({ queryKey: ["historical_imports"] });
      setCompletedDatasetId(datasetId);
      setStep(5);
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

  return (
    <PageContainer>
      <SectionHeader
        title="Historical Dataset Importer"
        subtitle="Upload EmailListVerify / ZeroBounce / MillionVerifier exports. Data seeds verification_cache, domain/provider intelligence, and learning tables — never treated as live truth."
        action={
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
            <Upload className="mr-2 h-4 w-4" />New historical import
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Datasets" value={datasets.length} icon={Database} />
        <KpiCard label="Processing" value={datasets.filter((d: any) => d.status === "processing" || d.status === "pending").length} accent="sky" />
        <KpiCard label="Completed" value={datasets.filter((d: any) => d.status === "completed").length} accent="emerald" />
        <KpiCard label="Rows learned" value={datasets.reduce((a: number, d: any) => a + (d.processed_count ?? 0), 0).toLocaleString()} icon={Brain} />
      </div>

      <Card>
        {datasets.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No historical imports yet" description="Upload a legacy verifier export to seed intelligence and freshness scoring." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map((d: any) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/verification/historical-imports/${d.id}`)}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {d.filename ?? "(unnamed)"}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </TableCell>
                  <TableCell className="text-xs"><Badge variant="outline">{d.source}</Badge></TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">{d.file_type ?? "—"}</TableCell>
                  <TableCell><StatusPill status={d.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{(d.row_count ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{(d.processed_count ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{(d.failed_count ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {d.uploaded_at ? formatDistanceToNow(new Date(d.uploaded_at), { addSuffix: true }) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "Upload dataset"}
              {step === 2 && "Map columns"}
              {step === 3 && "Preview & dataset details"}
              {step === 4 && "Importing…"}
              {step === 5 && "Import complete — intelligence updated"}
            </DialogTitle>
            <DialogDescription>
              {step < 5
                ? `Step ${step} of 4 — historical data is marked historical_only=true, scored for freshness, and never overrides live verification.`
                : "Summary of what was learned from this dataset."}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>File (CSV, XLSX, or TXT)</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Large files are parsed in your browser and uploaded in 1,000-row chunks. Original layout is preserved for exports.
                </p>
              </div>
              <div>
                <Label>Source</Label>
                <Select value={sourceLabel} onValueChange={setSourceLabel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{stats.rowCount.toLocaleString()} rows</Badge>
                <Badge variant="outline">{headers.length} columns</Badge>
                <Badge variant="outline">{stats.mappedFields} mapped</Badge>
                <Badge variant="outline" className="uppercase">{stats.fileType}</Badge>
                {mapping.email && <Badge className="bg-emerald-100 text-emerald-700"><Sparkles className="mr-1 h-3 w-3" />Email column detected</Badge>}
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Unmapped columns will be preserved as custom fields automatically — no column is dropped unless you manually choose <b>Skip column entirely</b>.
              </div>
              <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-md border p-3">
                {CANONICAL.map(c => (
                  <div key={c.key} className="grid grid-cols-[180px_1fr] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {c.label}{c.required && <span className="text-red-500"> *</span>}
                    </span>
                    <Select
                      value={mapping[c.key] ?? "__none__"}
                      onValueChange={(v) => setMapping(m => ({ ...m, [c.key]: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="Preserve as custom field" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Preserve as custom field (default)</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {(() => {
                const mapped = new Set(Object.values(mapping).filter(Boolean));
                const unmapped = headers.filter(h => !mapped.has(h));
                if (!unmapped.length) return null;
                return (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs">
                    <div className="mb-1 font-medium text-foreground">
                      {unmapped.length} column{unmapped.length === 1 ? "" : "s"} will be preserved as custom fields
                    </div>
                    <div className="mb-2 text-muted-foreground">
                      These are kept verbatim on every imported row and on seeded prospects (under <code>custom_fields.imported_columns</code>) so they remain available for exports, filtering, and CRM enrichment.
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {unmapped.slice(0, 40).map(h => (
                        <Badge key={h} variant="outline" className="font-mono text-[10px]">{h}</Badge>
                      ))}
                      {unmapped.length > 40 && <Badge variant="outline" className="text-[10px]">+{unmapped.length - 40} more</Badge>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dataset name</Label>
                  <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="e.g. Q3-2024 EmailListVerify export" />
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="campaign-x, vendor-elv, legacy" />
                </div>
              </div>
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                  Preview · first {previewRows.length} rows · status will be normalized, freshness/trust/safety scores will be computed per row.
                </div>
                <div className="max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {CANONICAL.filter(c => mapping[c.key]).map(c => (
                          <TableHead key={c.key} className="text-[11px]">{c.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r, i) => (
                        <TableRow key={i}>
                          {CANONICAL.filter(c => mapping[c.key]).map(c => (
                            <TableCell key={c.key} className="text-[11px] font-mono">{String(r[mapping[c.key]] ?? "")}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-md border bg-card p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={autoSeedProspects}
                  onChange={(e) => setAutoSeedProspects(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Auto-add safe verified emails to Prospect Search.</span>
                  <span className="block text-muted-foreground">
                    Only rows that are <b>valid</b>, not catch-all, trust ≥ 55, bounce risk ≤ 15% are imported.
                    All original CSV columns are preserved on the prospect. Duplicates are merged — stronger data is never overwritten.
                  </span>
                </span>
              </label>
              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                On import we compute per row: <b>freshness_state</b> (fresh / aging / stale / expired), <b>trust_score</b> (0–100),
                <b> safe_to_send_score</b>, <b>estimated_bounce_probability</b>, and <b>campaign_safety_tier</b>.
                Aggregates are added to <code>domain_intelligence</code>, <code>provider_behavior</code>,
                <code>confidence_learning</code>, <code>smtp_learning</code>, and <code>bounce_intelligence</code>.
              </div>

            </div>
          )}

          {step === 5 && (() => {
            const s: any = completedDataset?.stats ?? {};
            const items: { label: string; value: any; tone?: string }[] = [
              { label: "Total rows imported", value: completedDataset?.processed_count ?? 0 },
              { label: "Prospects added", value: s.prospects_created ?? 0, tone: "text-emerald-600" },
              { label: "Duplicates merged", value: s.prospects_merged ?? 0, tone: "text-sky-600" },
              { label: "Skipped duplicates", value: s.skipped_duplicates ?? 0, tone: "text-amber-600" },
              { label: "Safe to send", value: s.safe_to_send ?? 0, tone: "text-emerald-600" },
              { label: "Risky", value: s.risky_total ?? s.risky ?? 0, tone: "text-rose-600" },
              { label: "Catch-all", value: s.catch_all ?? 0 },
              { label: "Unknown", value: s.unknown ?? 0 },
              { label: "Disposable", value: s.disposable ?? s.subtypes?.disposable ?? 0 },
              { label: "Spamtrap", value: s.subtypes?.spamtrap ?? 0 },
              { label: "Dead server", value: s.subtypes?.dead_server ?? 0 },
              { label: "Invalid MX", value: s.subtypes?.invalid_mx ?? 0 },
              { label: "Email disabled", value: s.subtypes?.email_disabled ?? 0 },
              { label: "Provider blocked", value: s.subtypes?.provider_blocked ?? 0 },
              { label: "Greylisted patterns", value: s.greylisted_patterns ?? s.subtypes?.greylisted ?? 0 },
              { label: "Domains learned", value: s.domains_learned ?? 0, tone: "text-violet-600" },
              { label: "Providers learned", value: s.providers_learned ?? 0, tone: "text-violet-600" },
              { label: "Avg confidence", value: s.avg_confidence != null ? Math.round(s.avg_confidence) : "—" },
              { label: "Avg bounce prob", value: s.avg_bounce_probability != null ? `${(s.avg_bounce_probability * 100).toFixed(1)}%` : "—" },
              { label: "Avg safe-to-send", value: s.avg_safe_to_send_score != null ? Math.round(s.avg_safe_to_send_score) : "—" },
            ];
            return (
              <div className="space-y-4">
                <div className="rounded-md border bg-primary/5 px-4 py-3 text-sm">
                  <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
                  Improved intelligence for <b>{(s.domains_learned ?? 0).toLocaleString()}</b> domains,{" "}
                  <b>{(s.providers_learned ?? 0).toLocaleString()}</b> providers, and{" "}
                  <b>{((s.prospects_created ?? 0) + (s.prospects_merged ?? 0)).toLocaleString()}</b> prospects.
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {items.map((it) => (
                    <div key={it.label} className="rounded-md border bg-card p-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
                      <div className={`mt-1 text-xl font-semibold tabular-nums ${it.tone ?? ""}`}>
                        {typeof it.value === "number" ? it.value.toLocaleString() : it.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium text-foreground">Freshness breakdown</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {(["fresh","aging","stale","expired"] as const).map((k) => (
                      <div key={k} className="rounded bg-muted/40 p-2 text-center">
                        <div className="text-muted-foreground capitalize">{k}</div>
                        <div className="text-base font-semibold tabular-nums">{(s.freshness?.[k] ?? 0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            {step > 1 && step < 4 && (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as any)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Back
              </Button>
            )}
            {step === 1 && (
              <Button disabled={!file} onClick={() => setStep(2)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            )}
            {step === 2 && (
              <Button disabled={!mapping.email} onClick={() => setStep(3)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            )}
            {step === 3 && (
              <Button
                disabled={runImport.isPending}
                onClick={() => { setStep(4); runImport.mutate(); }}
              >
                Start import
              </Button>
            )}
            {step === 5 && (
              <>
                <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Close</Button>
                {completedDatasetId && (
                  <Button onClick={() => { const id = completedDatasetId; setOpen(false); reset(); navigate(`/verification/historical-imports/${id}`); }}>
                    Open dataset detail
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
