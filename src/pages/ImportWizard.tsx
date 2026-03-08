import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  checkDuplicatesAdvanced,
  buildContactIndex,
  buildCompanyIndex,
  classifyRowAction,
  DEFAULT_IMPORT_SETTINGS,
  type ParsedCSV,
  type DuplicateStrategy,
  type DuplicateCheckResult,
  type NormalizationResult,
  type ImportSettings,
  type ExistingContact,
  type ExistingCompany,
} from "@/lib/csv-utils";
import type { Json } from "@/integrations/supabase/db-types";

const STEPS = [
  { id: 1, label: "Upload", icon: Upload },
  { id: 2, label: "Map Columns", icon: FileSpreadsheet },
  { id: 3, label: "Normalize", icon: Sparkles },
  { id: 4, label: "Duplicates", icon: Shield },
  { id: 5, label: "Confirm", icon: Check },
];

export default function ImportWizardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2 state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Step 3 state
  const [normPreview, setNormPreview] = useState<NormalizationResult[]>([]);

  // Step 4 state
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [dupStrategy, setDupStrategy] = useState<DuplicateStrategy>("flag_review");
  const [importSettings, setImportSettings] = useState<ImportSettings>({ ...DEFAULT_IMPORT_SETTINGS });
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
      const result = parseCSVText(text);
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
    const preview = parsed.rows.slice(0, 20).map((row) => normalizeRow(row, columnMapping));
    setNormPreview(preview);
  }, [parsed, columnMapping]);

  // ─── Step 4: Duplicate detection ──────────────────────────────────────────────

  const runDuplicateCheck = useCallback(async () => {
    if (!parsed) return;
    setDupLoading(true);
    try {
      // Fetch existing emails and linkedin URLs for comparison
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("email, linkedin_url, external_contact_id")
        .limit(50000);

      const existingEmails = new Set<string>();
      const existingLinkedins = new Set<string>();
      const existingExtIds = new Set<string>();

      (existingContacts ?? []).forEach((c) => {
        if (c.email) existingEmails.add(c.email.toLowerCase());
        if (c.linkedin_url) existingLinkedins.add(c.linkedin_url.toLowerCase());
        if (c.external_contact_id) existingExtIds.add(c.external_contact_id);
      });

      // Normalize all rows then check
      const normalizedRows = parsed.rows.map((row) => normalizeRow(row, columnMapping).normalized);
      const result = checkDuplicatesLocal(normalizedRows, existingEmails, existingLinkedins, existingExtIds);
      setDupResult(result);
    } catch (err) {
      toast.error("Failed to check duplicates");
    } finally {
      setDupLoading(false);
    }
  }, [parsed, columnMapping]);

  // ─── Step 5: Confirm and create ───────────────────────────────────────────────

  const mappedFieldCount = Object.values(columnMapping).filter(Boolean).length;
  const unmappedHeaders = parsed?.headers.filter((h) => !columnMapping[h]) ?? [];

  const handleConfirmImport = useCallback(async () => {
    if (!parsed || !file || !user) return;
    setSubmitting(true);

    try {
      // 1. Create import job
      const settings: Record<string, unknown> = {
        duplicate_strategy: dupStrategy,
        unmapped_columns: unmappedHeaders,
      };

      const { data: job, error: jobErr } = await (supabase
        .from("import_jobs") as any)
        .insert({
          file_name: file.name,
          status: "processing" as const,
          total_rows: parsed.totalRows,
          processed_rows: 0,
          success_rows: 0,
          error_rows: 0,
          duplicate_rows: 0,
          review_rows: 0,
          column_mapping: columnMapping as unknown as Json,
          settings: settings as unknown as Json,
          started_at: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (jobErr || !job) throw jobErr;

      // 2. Create import job rows in batches
      const BATCH_SIZE = 200;
      let successCount = 0;
      let errorCount = 0;
      let dupCount = 0;
      let reviewCount = 0;

      for (let i = 0; i < parsed.rows.length; i += BATCH_SIZE) {
        const batch = parsed.rows.slice(i, i + BATCH_SIZE);
        const rows = batch.map((raw, idx) => {
          const rowIndex = i + idx;
          const norm = normalizeRow(raw, columnMapping);
          const dupDetail = dupResult?.details[rowIndex];

          let status: string = "pending";
          let duplicateReason: string | null = null;
          let actionTaken: string | null = null;
          let reviewRequired = false;

          if (dupDetail?.status === "invalid") {
            status = "error";
            duplicateReason = dupDetail.reason;
          } else if (dupDetail?.status === "duplicate") {
            if (dupStrategy === "skip") {
              status = "skipped";
              actionTaken = "skipped_duplicate";
            } else if (dupStrategy === "flag_review") {
              status = "review";
              reviewRequired = true;
            } else {
              status = "pending";
              actionTaken = "update_missing";
            }
            duplicateReason = dupDetail.reason;
          }

          return {
            import_job_id: job.id,
            row_number: rowIndex + 1,
            raw_data: raw as unknown as Json,
            normalized_data: norm.normalized as unknown as Json,
            status: status as "pending" | "success" | "error" | "skipped" | "duplicate" | "review",
            error_message: dupDetail?.status === "invalid" ? dupDetail.reason : null,
            duplicate_match_reason: duplicateReason,
            action_taken: actionTaken,
            review_required: reviewRequired,
          };
        });

        const { error: rowErr } = await (supabase.from("import_job_rows") as any).insert(rows);
        if (rowErr) {
          errorCount += batch.length;
        } else {
          rows.forEach((r) => {
            if (r.status === "error") errorCount++;
            else if (r.status === "skipped" || r.status === "duplicate") dupCount++;
            else if (r.status === "review") reviewCount++;
            else successCount++;
          });
        }
      }

      // 3. Update job summary
      await (supabase
        .from("import_jobs") as any)
        .update({
          status: "completed" as const,
          processed_rows: parsed.rows.length,
          success_rows: successCount,
          error_rows: errorCount,
          duplicate_rows: dupCount,
          review_rows: reviewCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      toast.success(`Import created: ${parsed.rows.length} rows processed`);
      navigate(`/imports/${job.id}`);
    } catch (err) {
      toast.error("Failed to create import job");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [parsed, file, user, columnMapping, dupResult, dupStrategy, unmappedHeaders, navigate]);

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Map Columns</CardTitle>
                  <CardDescription>
                    Map your CSV columns to database fields. {mappedFieldCount} of {parsed.headers.length} mapped.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {unmappedHeaders.length} unmapped → stored as metadata
                </Badge>
              </div>

              <Progress value={(mappedFieldCount / parsed.headers.length) * 100} className="h-2" />

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {parsed.headers.map((header) => (
                    <div key={header} className="flex items-center gap-4">
                      <div className="w-[200px] shrink-0">
                        <p className="text-sm font-medium truncate" title={header}>{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          e.g. {parsed.rows[0]?.[header] || "—"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={columnMapping[header] || "__unmapped__"}
                        onValueChange={(val) =>
                          setColumnMapping((prev) => {
                            const next = { ...prev };
                            if (val === "__unmapped__") delete next[header];
                            else next[header] = val;
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Skip column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped__">
                            <span className="text-muted-foreground">— Skip / Unmapped —</span>
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
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ─── STEP 3: Normalization Preview ───────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg">Normalization Preview</CardTitle>
                <CardDescription>
                  Review how your data will be cleaned and standardized before import.
                </CardDescription>
              </div>

              {normPreview.length > 0 ? (
                <>
                  {(() => {
                    const allChanges = normPreview.flatMap((n, i) =>
                      n.changes.map((c) => ({ ...c, row: i + 1 }))
                    );
                    const ruleGroups = allChanges.reduce((acc, c) => {
                      (acc[c.rule] ??= []).push(c);
                      return acc;
                    }, {} as Record<string, typeof allChanges>);

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-2xl font-bold text-foreground">{normPreview.length}</p>
                              <p className="text-xs text-muted-foreground">Rows previewed</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-2xl font-bold text-primary">{allChanges.length}</p>
                              <p className="text-xs text-muted-foreground">Changes applied</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-2xl font-bold text-foreground">{Object.keys(ruleGroups).length}</p>
                              <p className="text-xs text-muted-foreground">Rule types</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-2xl font-bold text-emerald-600">
                                {normPreview.filter((n) => n.changes.length > 0).length}
                              </p>
                              <p className="text-xs text-muted-foreground">Rows modified</p>
                            </CardContent>
                          </Card>
                        </div>

                        {Object.entries(ruleGroups).length > 0 ? (
                          <div className="border rounded-lg overflow-auto max-h-[300px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Rule</TableHead>
                                  <TableHead className="text-xs">Field</TableHead>
                                  <TableHead className="text-xs">Original</TableHead>
                                  <TableHead className="text-xs">Normalized</TableHead>
                                  <TableHead className="text-xs">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(ruleGroups).map(([rule, items]) => (
                                  <TableRow key={rule}>
                                    <TableCell className="text-xs">
                                      <Badge variant="outline" className="text-xs">{rule}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{items[0].field}</TableCell>
                                    <TableCell className="text-xs font-mono truncate max-w-[150px] text-muted-foreground">
                                      {items[0].original}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono truncate max-w-[150px] text-emerald-600">
                                      {items[0].normalized}
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold">{items.length}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                            <p className="text-sm font-medium">Data looks clean — no normalization changes needed.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
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
                        <p className="text-2xl font-bold text-emerald-600">{dupResult.likelyNew.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Likely New</p>
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
                        <p className="text-2xl font-bold text-primary">{dupResult.likelyReview.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Needs Review</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                        <p className="text-2xl font-bold text-destructive">{dupResult.invalid.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Invalid</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Duplicate Strategy</Label>
                    <p className="text-xs text-muted-foreground">Choose how to handle rows that match existing records.</p>
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
                        <span className="text-emerald-600 font-medium">{dupResult.likelyNew} new</span>
                        <span className="text-amber-600 font-medium">{dupResult.likelyDuplicate} dups</span>
                        <span className="text-destructive font-medium">{dupResult.invalid} invalid</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-200 text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-amber-800">
                  This will create an import job with {parsed.totalRows.toLocaleString()} rows.
                  Row-level processing will begin immediately.
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
