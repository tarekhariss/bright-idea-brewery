import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseCSVText,
  autoMapColumns,
  MAPPABLE_FIELDS,
  normalizeRow,
  analyzeColumns,
  classifyCustomFieldScope,
  checkDuplicatesAdvanced,
  buildContactIndex,
  buildCompanyIndex,
  classifyRowAction,
  DEFAULT_IMPORT_SETTINGS,
  type ParsedCSV,
  type DuplicateStrategy,
  type DuplicateCheckResult,
  type NormalizationResult,
  type ColumnAnalysis,
  type ImportSettings,
  type ExistingContact,
  type ExistingCompany,
} from "@/lib/csv-utils";
import type { Json } from "@/integrations/supabase/db-types";


function ListSelector({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { data: lists } = useQuery({
    queryKey: ["lists-for-import"],
    queryFn: async () => {
      const { data } = await (supabase.from("lists") as any).select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  return (
    <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger>
        <SelectValue placeholder="No list" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— No list —</SelectItem>
        {lists?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const STEPS = [
  { id: 1, label: "Upload", icon: Upload },
  { id: 2, label: "Map Columns", icon: FileSpreadsheet },
  { id: 3, label: "Normalize", icon: Sparkles },
  { id: 4, label: "Duplicates", icon: Shield },
  { id: 5, label: "Confirm", icon: Check },
];

export default function ImportWizardPage() {
  const navigate = useNavigate();
  const { user, workspaceId } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const prefillListId = searchParams.get("list_id") ?? undefined;
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2 state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  // Headers the user explicitly marked as "Exclude from import". Empty by default —
  // nothing is ever skipped unless the user intentionally chooses to exclude it.
  const [excludedColumns, setExcludedColumns] = useState<Set<string>>(new Set());


  // Step 3 state
  const [normPreview, setNormPreview] = useState<NormalizationResult[]>([]);
  const [columnAnalysis, setColumnAnalysis] = useState<ColumnAnalysis[]>([]);


  // Step 4 state
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [dupStrategy, setDupStrategy] = useState<DuplicateStrategy>("flag_review");
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    ...DEFAULT_IMPORT_SETTINGS,
    ...(prefillListId ? { list_id: prefillListId } : {}),
  });
  const [dupLoading, setDupLoading] = useState(false);

  // ─── Step 1: Upload ───────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setParseError(null);

    if (!f.name.toLowerCase().endsWith(".csv")) {
      setParseError("Only CSV files are supported.");
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setParseError("File too large. Maximum 100 MB.");
      return;
    }

    setFile(f);
    try {
      const text = await f.text();
      const result = parseCSVText(text, 500); // preview only
      if (result.headers.length === 0) {
        setParseError("Could not detect columns in this file.");
        return;
      }
      setParsed(result);
      // Auto-map
      const autoMap = autoMapColumns(result.headers);
      setColumnMapping(autoMap);
    } catch {
      setParseError("Failed to read this file. It may be corrupted.");
    }
  }, []);

  // ─── Step 3: Normalization ────────────────────────────────────────────────────

  const runNormalization = useCallback(() => {
    if (!parsed) return;
    const preview = parsed.rows.slice(0, 20).map((row) => normalizeRow(row, columnMapping, excludedColumns));
    setNormPreview(preview);
    setColumnAnalysis(analyzeColumns(parsed, columnMapping, 50, excludedColumns));
  }, [parsed, columnMapping, excludedColumns]);



  // ─── Step 4: Duplicate detection ──────────────────────────────────────────────

  const runDuplicateCheck = useCallback(async () => {
    if (!parsed) return;
    setDupLoading(true);
    try {
      // Fetch existing contacts for comparison
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
        .limit(50000);

      // Fetch existing companies
      const { data: existingCompanies } = await (supabase.from("companies") as any)
        .select("id, domain, normalized_name, external_account_id, website")
        .limit(50000);

      const contactIdx = buildContactIndex((existingContacts ?? []) as ExistingContact[]);
      const companyIdx = buildCompanyIndex((existingCompanies ?? []) as ExistingCompany[]);

      const normalizedRows = parsed.rows.map((row) => normalizeRow(row, columnMapping).normalized);
      const result = checkDuplicatesAdvanced(normalizedRows, contactIdx, companyIdx);
      setDupResult(result);
    } catch (err) {
      toast.error("Failed to check duplicates");
    } finally {
      setDupLoading(false);
    }
  }, [parsed, columnMapping]);

  // ─── Step 5: Confirm and create ───────────────────────────────────────────────

  const mappedFieldCount = Object.values(columnMapping).filter(Boolean).length;
  // Headers that aren't mapped to a standard field AND aren't user-excluded.
  // These are preserved as contact/company custom fields — NOT skipped.
  const customFieldHeaders = parsed?.headers.filter(
    (h) => !columnMapping[h] && !excludedColumns.has(h)
  ) ?? [];
  const excludedHeaders = parsed?.headers.filter((h) => excludedColumns.has(h)) ?? [];


  const handleConfirmImport = useCallback(async () => {
    if (!parsed || !file || !user) return;
    setSubmitting(true);

    let createdJobId: string | null = null;

    try {
      const parseStartedAt = performance.now();
      const fullText = await file.text();
      const fullParsed = parseCSVText(fullText);
      const allRows = fullParsed.rows;

      const settings: Record<string, unknown> = {
        ...importSettings,
        duplicate_strategy: dupStrategy,
        // Columns that will be preserved as contact/company custom_fields (not skipped).
        unmapped_columns: customFieldHeaders,
        // Columns the user explicitly told us to drop.
        excluded_columns: excludedHeaders,
      };


      const initialDiagnostics = {
        diagnostics: {
          phase: "uploading_rows",
          uploaded_rows: 0,
          total_rows: allRows.length,
          batch_size: 2000,
          last_progress_at: new Date().toISOString(),
          timings: {
            parse_csv_ms: Math.round(performance.now() - parseStartedAt),
          },
          recent_batches: [],
        },
      };

      const { data: job, error: jobErr } = await (supabase.from("import_jobs") as any)
        .insert({
          file_name: file.name,
          status: "pending" as const,
          total_rows: allRows.length,
          processed_rows: 0,
          success_rows: 0,
          inserted_rows: 0,
          error_rows: 0,
          duplicate_rows: 0,
          review_rows: 0,
          column_mapping: columnMapping as unknown as Json,
          settings: settings as unknown as Json,
          error_summary: initialDiagnostics as unknown as Json,
          started_at: new Date().toISOString(),
          created_by: user.id,
          workspace_id: workspaceId || null,
        })
        .select()
        .single();

      if (jobErr || !job) {
        throw new Error(jobErr?.message || "Unknown error creating import job");
      }

      createdJobId = job.id;

      const UPLOAD_BATCH_SIZE = 2000;
      let uploadedRows = 0;
      for (let i = 0; i < allRows.length; i += UPLOAD_BATCH_SIZE) {
        const batch = allRows.slice(i, i + UPLOAD_BATCH_SIZE);
        const rawBatchRows = batch.map((raw, idx) => ({
          import_job_id: job.id,
          row_number: i + idx + 1,
          raw_data: raw as unknown as Json,
          status: "pending",
          review_required: false,
        }));

        const { error: rowInsertError } = await (supabase.from("import_job_rows") as any).insert(rawBatchRows);
        if (rowInsertError) throw rowInsertError;

        uploadedRows += batch.length;

        if (((i / UPLOAD_BATCH_SIZE) + 1) % 3 === 0 || uploadedRows === allRows.length) {
          await (supabase.from("import_jobs") as any)
            .update({
              error_summary: {
                diagnostics: {
                  phase: "uploading_rows",
                  uploaded_rows: uploadedRows,
                  total_rows: allRows.length,
                  batch_size: UPLOAD_BATCH_SIZE,
                  last_progress_at: new Date().toISOString(),
                  recent_batches: [
                    {
                      phase: "uploading_rows",
                      uploaded_rows: uploadedRows,
                      batch_rows: batch.length,
                      at: new Date().toISOString(),
                    },
                  ],
                },
              },
            })
            .eq("id", job.id);
        }
      }

      await (supabase.from("import_jobs") as any)
        .update({
          status: "processing",
          error_summary: {
            diagnostics: {
              phase: "queued_server_processing",
              uploaded_rows: allRows.length,
              total_rows: allRows.length,
              batch_size: UPLOAD_BATCH_SIZE,
              last_progress_at: new Date().toISOString(),
              recent_batches: [
                {
                  phase: "queued_server_processing",
                  uploaded_rows: allRows.length,
                  at: new Date().toISOString(),
                },
              ],
            },
          },
        })
        .eq("id", job.id);

      void supabase.functions.invoke("run-import-job", {
        body: { job_id: job.id },
      }).catch(async (invokeErr) => {
        await (supabase.from("import_jobs") as any)
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_summary: {
              reason: invokeErr?.message || "Failed to start import processor",
              diagnostics: {
                phase: "failed_to_start_processor",
                uploaded_rows: allRows.length,
                total_rows: allRows.length,
                last_progress_at: new Date().toISOString(),
              },
            },
          })
          .eq("id", job.id);
      });

      toast.success(`Import started for ${allRows.length.toLocaleString()} rows`);
      navigate(`/imports/${job.id}`);
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (createdJobId) {
        await (supabase.from("import_jobs") as any)
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_summary: {
              reason: msg,
              diagnostics: {
                phase: "upload_failed",
                last_progress_at: new Date().toISOString(),
              },
            },
          })
          .eq("id", createdJobId);
      }
      toast.error(`Import failed: ${msg}`);
      console.error("Import error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [parsed, file, user, workspaceId, columnMapping, dupStrategy, importSettings, customFieldHeaders, excludedHeaders, navigate]);

  // ─── Step transitions ─────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 2) runNormalization();
    if (step === 3) runDuplicateCheck();
    setStep((s) => Math.min(s + 1, 5));
  };

  const canProceed = () => {
    if (step === 1) return !!parsed;
    if (step === 2) return mappedFieldCount >= 2;
    if (step === 4) return !!dupResult && !dupLoading;
    return true;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Import</h1>
        <p className="text-sm text-muted-foreground">Follow the steps to safely import your dataset</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                step === s.id
                  ? "bg-primary text-primary-foreground"
                  : step > s.id
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* ─── STEP 1: Upload ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg">Upload CSV File</CardTitle>
                <CardDescription>Select a CSV file containing your contact or company data.</CardDescription>
              </div>

              <label
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors ${
                  parsed ? "border-emerald-300 bg-emerald-50/50" : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                {parsed ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                    <p className="font-medium">{file?.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {parsed.headers.length} columns · {parsed.totalRows.toLocaleString()} rows
                    </p>
                    {parsed.errors.length > 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {parsed.errors.length} parsing warnings
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Click to select a CSV file</p>
                    <p className="text-sm text-muted-foreground mt-1">Supports up to 100 MB</p>
                  </>
                )}
              </label>

              {parseError && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <XCircle className="h-4 w-4 shrink-0" /> {parseError}
                </div>
              )}

              {parsed && parsed.rows.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Preview (first 5 rows)</p>
                  <div className="border rounded-lg overflow-auto max-h-[240px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {parsed.headers.slice(0, 8).map((h) => (
                            <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                          ))}
                          {parsed.headers.length > 8 && <TableHead className="text-xs">+{parsed.headers.length - 8} more</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsed.rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {parsed.headers.slice(0, 8).map((h) => (
                              <TableCell key={h} className="text-xs truncate max-w-[150px]">{row[h]}</TableCell>
                            ))}
                            {parsed.headers.length > 8 && <TableCell className="text-xs text-muted-foreground">…</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 2: Column Mapping ──────────────────────────────────── */}
          {step === 2 && parsed && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Map Columns</CardTitle>
                  <CardDescription>
                    Every column will be imported. {mappedFieldCount} of {parsed.headers.length} were auto-mapped to standard fields;
                    the rest are saved as <strong>contact</strong> or <strong>company custom fields</strong> using the original CSV header.
                    Use "Exclude from import" only if you intentionally want to drop a column.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-200">
                    {mappedFieldCount} standard
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    {customFieldHeaders.length} → custom fields
                  </Badge>
                  {excludedHeaders.length > 0 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {excludedHeaders.length} excluded
                    </Badge>
                  )}
                </div>
              </div>


              <Progress value={((mappedFieldCount + customFieldHeaders.length) / parsed.headers.length) * 100} className="h-2" />

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {parsed.headers.map((header) => {
                    const isExcluded = excludedColumns.has(header);
                    const mappedKey = columnMapping[header];
                    // Resolve the destination chip shown next to each row.
                    let destLabel: string;
                    let destClass: string;
                    if (isExcluded) {
                      destLabel = "Excluded";
                      destClass = "bg-muted text-muted-foreground border-muted-foreground/20";
                    } else if (mappedKey) {
                      const f = MAPPABLE_FIELDS.find((x) => x.key === mappedKey);
                      destLabel = `Standard · ${f?.label ?? mappedKey}`;
                      destClass = "bg-emerald-500/10 text-emerald-700 border-emerald-200";
                    } else if (classifyCustomFieldScope(header) === "company") {
                      destLabel = "Save as Company Custom Field";
                      destClass = "bg-indigo-500/10 text-indigo-700 border-indigo-200";
                    } else {
                      destLabel = "Save as Contact Custom Field";
                      destClass = "bg-primary/10 text-primary border-primary/20";
                    }

                    // Select value encodes all three modes: __custom__ (preserve as custom field),
                    // __excluded__ (intentionally drop), or a standard field key.
                    const selectValue = isExcluded
                      ? "__excluded__"
                      : (mappedKey || "__custom__");

                    return (
                      <div key={header} className="flex items-center gap-4">
                        <div className="w-[200px] shrink-0">
                          <p className="text-sm font-medium truncate" title={header}>{header}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            e.g. {parsed.rows[0]?.[header] || "—"}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={selectValue}
                          onValueChange={(val) => {
                            if (val === "__excluded__") {
                              setExcludedColumns((prev) => {
                                const next = new Set(prev); next.add(header); return next;
                              });
                              setColumnMapping((prev) => {
                                const next = { ...prev }; delete next[header]; return next;
                              });
                              return;
                            }
                            // Clear excluded mark on any other choice
                            setExcludedColumns((prev) => {
                              if (!prev.has(header)) return prev;
                              const next = new Set(prev); next.delete(header); return next;
                            });
                            setColumnMapping((prev) => {
                              const next = { ...prev };
                              if (val === "__custom__") delete next[header];
                              else next[header] = val;
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger className="w-[260px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__custom__">
                              <span>
                                Save as {classifyCustomFieldScope(header) === "company" ? "Company" : "Contact"} Custom Field
                              </span>
                            </SelectItem>
                            <SelectItem value="__excluded__">
                              <span className="text-muted-foreground">Exclude from import</span>
                            </SelectItem>

                            {Object.entries(
                              MAPPABLE_FIELDS.reduce((acc, f) => {
                                (acc[f.group] ??= []).push(f);
                                return acc;
                              }, {} as Record<string, typeof MAPPABLE_FIELDS>)
                            ).map(([group, fields]) => (
                              <div key={group}>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                                {fields.map((f) => {
                                  const usedBy = Object.entries(columnMapping).find(
                                    ([k, v]) => v === f.key && k !== header
                                  );
                                  return (
                                    <SelectItem key={f.key} value={f.key} disabled={!!usedBy}>
                                      {f.label}
                                      {usedBy && <span className="text-muted-foreground ml-1">(used)</span>}
                                    </SelectItem>
                                  );
                                })}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${destClass}`}>
                          {destLabel}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

            </div>
          )}

          {/* ─── STEP 3: Normalization Preview ───────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg">Mapping & Normalization Preview</CardTitle>
                <CardDescription>
                  Per-column review of how each CSV column will be mapped, cleaned, and stored.
                  Sampled from the first 50 rows.
                </CardDescription>
              </div>

              {columnAnalysis.length > 0 ? (() => {
                const standardCount = columnAnalysis.filter((c) => c.storedAs === "standard_field").length;
                const contactCustomCount = columnAnalysis.filter((c) => c.storedAs === "contact_custom").length;
                const companyCustomCount = columnAnalysis.filter((c) => c.storedAs === "company_custom").length;
                const customCount = contactCustomCount + companyCustomCount;
                const warningCount = columnAnalysis.filter((c) => c.warning).length;
                const totalChanged = columnAnalysis.reduce((s, c) => s + c.changedRows, 0);
                const totalInvalid = columnAnalysis.reduce((s, c) => s + c.invalidRows, 0);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card><CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{standardCount}</p>
                        <p className="text-xs text-muted-foreground">Mapped to fields</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{customCount}</p>
                        <p className="text-xs text-muted-foreground">Custom fields ({contactCustomCount} contact · {companyCustomCount} company)</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{totalChanged}</p>
                        <p className="text-xs text-muted-foreground">Values to be cleaned</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3 text-center">
                        <p className={`text-2xl font-bold ${totalInvalid > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{totalInvalid}</p>
                        <p className="text-xs text-muted-foreground">Invalid values skipped</p>
                      </CardContent></Card>
                    </div>

                    {customCount > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{customCount} unmapped {customCount === 1 ? "column" : "columns"} will be preserved as custom fields.</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {contactCustomCount > 0 && <>{contactCustomCount} stored on <code>contacts.custom_fields</code>. </>}
                            {companyCustomCount > 0 && <>{companyCustomCount} stored on <code>companies.custom_fields</code>. </>}
                            Original CSV header is used as the key. Visible on detail pages and included in exports.
                          </p>
                        </div>
                      </div>
                    )}


                    {warningCount > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-200 text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-700">{warningCount} {warningCount === 1 ? "column looks" : "columns look"} mismapped.</p>
                          <p className="text-xs text-amber-700/80 mt-0.5">
                            The sampled values do not match the target field type. Go back to "Map Columns" to fix — invalid values will NOT be written to the standard field.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border rounded-lg overflow-auto max-h-[480px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">CSV Column</TableHead>
                            <TableHead className="text-xs">Detected Field</TableHead>
                            <TableHead className="text-xs">Stored As</TableHead>
                            <TableHead className="text-xs">Sample Values</TableHead>
                            <TableHead className="text-xs text-right">Cleaned</TableHead>
                            <TableHead className="text-xs text-right">Invalid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columnAnalysis.map((c) => (
                            <TableRow key={c.csvColumn} className={c.warning ? "bg-amber-500/5" : ""}>
                              <TableCell className="text-xs font-medium align-top">
                                <div className="truncate max-w-[180px]" title={c.csvColumn}>{c.csvColumn}</div>
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                {c.mappedField ? (
                                  <div>
                                    <Badge variant="outline" className="text-xs">{c.fieldLabel || c.mappedField}</Badge>
                                    {c.confidence != null && (
                                      <p className="text-[10px] text-muted-foreground mt-1">{c.confidence}% confidence</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">unmapped</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                {c.storedAs === "standard_field" && <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-200">Standard field</Badge>}
                                {c.storedAs === "contact_custom" && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Contact custom</Badge>}
                                {c.storedAs === "company_custom" && <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-700 border-indigo-200">Company custom</Badge>}
                                {c.storedAs === "skipped" && <Badge variant="outline" className="text-xs text-muted-foreground">Empty</Badge>}
                              </TableCell>

                              <TableCell className="text-xs align-top">
                                <div className="space-y-1 max-w-[280px]">
                                  {c.sampleOriginal.length === 0 ? (
                                    <span className="text-muted-foreground italic">—</span>
                                  ) : c.sampleOriginal.map((s, i) => (
                                    <div key={i} className="font-mono text-[11px]">
                                      <span className="text-muted-foreground truncate inline-block max-w-[260px] align-middle" title={s}>{s}</span>
                                      {c.sampleNormalized[i] && c.sampleNormalized[i] !== s && (
                                        <div className="text-emerald-700 truncate max-w-[260px]" title={c.sampleNormalized[i]}>
                                          → {c.sampleNormalized[i]}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {c.warning && (
                                    <p className="text-[10px] text-amber-700 mt-1">⚠ {c.warning}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-right align-top tabular-nums">{c.changedRows || "—"}</TableCell>
                              <TableCell className={`text-xs text-right align-top tabular-nums ${c.invalidRows > 0 ? "text-amber-700 font-semibold" : ""}`}>{c.invalidRows || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {customCount === 0 && totalInvalid === 0 && totalChanged === 0 && (
                      <div className="text-center py-4 text-sm text-emerald-600">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-1" /> Data looks clean — no normalization changes needed.
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Running normalization preview…</p>
                </div>
              )}
            </div>
          )}


          {/* ─── STEP 4: Duplicate Handling ──────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg">Duplicate Detection</CardTitle>
                <CardDescription>
                  Preview how your data matches existing records in the database.
                </CardDescription>
              </div>

              {dupLoading ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="text-sm font-medium">Checking for duplicates…</p>
                  <p className="text-xs mt-1">Comparing against existing contacts</p>
                </div>
              ) : dupResult ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                        <p className="text-2xl font-bold text-emerald-600">{dupResult.new.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">New</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                        <p className="text-2xl font-bold text-destructive">{dupResult.exactDuplicate.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Exact Duplicate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <MinusCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                        <p className="text-2xl font-bold text-amber-600">{dupResult.likelyDuplicate.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Likely Duplicate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-2xl font-bold text-primary">{dupResult.reviewRequired.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Needs Review</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <XCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-2xl font-bold text-muted-foreground">{dupResult.invalid.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Invalid</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Primary Strategy</Label>
                    <p className="text-xs text-muted-foreground">Choose the main approach for handling duplicates.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {([
                        { value: "skip", label: "Skip Duplicates", desc: "Ignore rows that match existing records" },
                        { value: "update_missing", label: "Update Missing Fields", desc: "Fill blank fields from import data" },
                        { value: "flag_review", label: "Flag for Review", desc: "Mark duplicates for manual review" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setDupStrategy(opt.value)}
                          className={`text-left p-4 rounded-lg border-2 transition-colors ${
                            dupStrategy === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Advanced Settings</Label>
                    <div className="space-y-2">
                      {([
                        { key: "skip_exact_duplicates" as const, label: "Skip exact duplicates", desc: "Auto-skip rows with 100% confidence match" },
                        { key: "update_missing_fields" as const, label: "Update missing fields on match", desc: "Fill empty fields from import when linking" },
                        { key: "review_likely_duplicates" as const, label: "Review likely duplicates", desc: "Flag rows with partial/fuzzy matches for manual review" },
                        { key: "review_company_conflicts" as const, label: "Review company conflicts", desc: "Flag rows where company data conflicts with existing" },
                        { key: "create_if_no_strong_match" as const, label: "Create if no strong match", desc: "Automatically create new records when no match found" },
                      ]).map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={importSettings[opt.key]}
                            onChange={(e) => setImportSettings((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                            className="mt-0.5 rounded border-input"
                          />
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ─── STEP 5: Confirm ─────────────────────────────────────────── */}
          {step === 5 && parsed && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg">Confirm Import</CardTitle>
                <CardDescription>
                  Review your import settings before processing.
                </CardDescription>
              </div>

              {/* Import Tag & Source */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Import Tag</Label>
                  <Input
                    placeholder="e.g. Q2 2026 Webinar Leads"
                    value={importSettings.import_tag}
                    onChange={(e) => setImportSettings((prev) => ({ ...prev, import_tag: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Tags all imported contacts for easy filtering</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Source</Label>
                  <Input
                    placeholder="e.g. apollo, linkedin, webinar"
                    value={importSettings.source}
                    onChange={(e) => setImportSettings((prev) => ({ ...prev, source: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Tracks where these leads came from</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add to List</Label>
                  <ListSelector
                    value={importSettings.list_id}
                    onChange={(id) => setImportSettings((prev) => ({ ...prev, list_id: id }))}
                  />
                  <p className="text-xs text-muted-foreground">Automatically add imported contacts to a list</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File</p>
                    <p className="font-medium">{file?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {parsed.totalRows.toLocaleString()} rows · {parsed.headers.length} columns
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mapping</p>
                    <p className="font-medium">{mappedFieldCount} fields mapped</p>
                    <p className="text-sm text-muted-foreground">
                      {unmappedHeaders.length} columns will be stored as metadata
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duplicate Strategy</p>
                    <p className="font-medium capitalize">{dupStrategy.replace(/_/g, " ")}</p>
                  </CardContent>
                </Card>
                {dupResult && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detection Summary</p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-600 font-medium">{dupResult.new} new</span>
                        <span className="text-amber-600 font-medium">{dupResult.exactDuplicate + dupResult.likelyDuplicate} dups</span>
                        <span className="text-primary font-medium">{dupResult.reviewRequired} review</span>
                        <span className="text-destructive font-medium">{dupResult.invalid} invalid</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-200 text-sm space-y-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="font-medium text-amber-800">Import Summary</p>
                </div>
                <ul className="ml-8 space-y-1 text-amber-800 list-disc">
                  <li><strong>{(parsed.totalRows + 1).toLocaleString()}</strong> total lines detected in file (including header row)</li>
                  <li><strong>1</strong> header row excluded (used for column mapping)</li>
                  {parsed.errors.length > 0 && (
                    <li><strong>{parsed.errors.length}</strong> rows had parsing warnings (column count mismatch) — they will still be processed</li>
                  )}
                  <li><strong>{parsed.totalRows.toLocaleString()}</strong> usable data rows will be imported</li>
                </ul>
                <p className="ml-8 text-xs text-amber-700">
                  Blank lines were automatically excluded during parsing. Row-level processing will begin immediately after confirmation.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? navigate("/imports") : setStep((s) => s - 1))}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        {step < 5 ? (
          <Button onClick={goNext} disabled={!canProceed()} className="gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleConfirmImport} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitting ? "Processing…" : "Start Import"}
          </Button>
        )}
      </div>
    </div>
  );
}
