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
    const preview = parsed.rows.slice(0, 20).map((row) => normalizeRow(row, columnMapping));
    setNormPreview(preview);
  }, [parsed, columnMapping]);

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
  const unmappedHeaders = parsed?.headers.filter((h) => !columnMapping[h]) ?? [];

  const handleConfirmImport = useCallback(async () => {
    if (!parsed || !file || !user) return;
    setSubmitting(true);

    try {
      // Re-parse the full file (no row limit) for import processing
      const fullText = await file.text();
      const fullParsed = parseCSVText(fullText);
      const allRows = fullParsed.rows;

      // Run duplicate check on all rows
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
        .limit(50000);
      const { data: existingCompanies } = await (supabase.from("companies") as any)
        .select("id, domain, normalized_name, external_account_id, website")
        .limit(50000);
      const contactIdx = buildContactIndex((existingContacts ?? []) as ExistingContact[]);
      const companyIdx = buildCompanyIndex((existingCompanies ?? []) as ExistingCompany[]);
      const normalizedRows = allRows.map((row) => normalizeRow(row, columnMapping).normalized);
      const fullDupResult = checkDuplicatesAdvanced(normalizedRows, contactIdx, companyIdx);

      // 1. Create import job (with workspace_id)
      const settings: Record<string, unknown> = {
        ...importSettings,
        duplicate_strategy: dupStrategy,
        unmapped_columns: unmappedHeaders,
      };

      const { data: job, error: jobErr } = await (supabase
        .from("import_jobs") as any)
        .insert({
          file_name: file.name,
          status: "processing" as const,
          total_rows: allRows.length,
          processed_rows: 0,
          success_rows: 0,
          error_rows: 0,
          duplicate_rows: 0,
          review_rows: 0,
          column_mapping: columnMapping as unknown as Json,
          settings: settings as unknown as Json,
          started_at: new Date().toISOString(),
          created_by: user.id,
          workspace_id: workspaceId || null,
        })
        .select()
        .single();

      if (jobErr || !job) {
        const msg = jobErr?.message || "Unknown error creating import job";
        toast.error(`Failed to create import job: ${msg}`);
        console.error("Import job creation error:", jobErr);
        setSubmitting(false);
        return;
      }

      // 2. Process rows in batches: create job rows AND insert actual contacts/companies
      const BATCH_SIZE = 200;
      let successCount = 0;
      let errorCount = 0;
      let dupCount = 0;
      let reviewCount = 0;
      let skippedCount = 0;
      let totalInserted = 0;

      // Contact field keys we can map
      const CONTACT_FIELDS = new Set([
        "first_name","last_name","email","secondary_email","tertiary_email","personal_email",
        "job_title","seniority_level","department","headline","bio","persona","linkedin_url",
        "twitter_url","facebook_url","github_url","photo_url","years_experience","skills",
        "languages","job_change_date","current_role_start_date","phone","work_direct_phone",
        "mobile_phone","corporate_phone","home_phone","other_phone","country","city","state",
        "address","postal_code","timezone","company_name_raw","source","external_source",
        "external_contact_id",
      ]);

      // Company fields that go into the companies table
      const COMPANY_FIELDS = new Set([
        "domain","website","industry","employee_count","employee_range","revenue_range",
        "annual_revenue","total_funding","latest_funding","latest_funding_amount","funding_stage",
        "founded_year","company_type","headquarters","company_address","company_city",
        "company_state","company_country","company_phone","company_linkedin_url",
        "technologies","keywords","specialties","market_segments","territories",
        "sic_code","naics_code","stock_ticker","headcount_growth_pct",
        "external_account_id",
      ]);

      for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        const batch = allRows.slice(i, i + BATCH_SIZE);
        const jobRows: any[] = [];
        const contactsToInsert: any[] = [];

        for (let idx = 0; idx < batch.length; idx++) {
          const raw = batch[idx];
          const rowIndex = i + idx;
          const norm = normalizeRow(raw, columnMapping);
          const dupDetail = fullDupResult.details[rowIndex];
          const normalized = norm.normalized as Record<string, unknown>;

          let status = "success";
          let duplicateReason: string | null = null;
          let actionTaken: string | null = "create_new";
          let reviewRequired = false;

          if (dupDetail) {
            const rowAction = classifyRowAction(dupDetail.classification, importSettings);
            status = rowAction.status;
            actionTaken = rowAction.action;
            reviewRequired = rowAction.reviewRequired;
            duplicateReason = dupDetail.reason;
          }

          // Build job row record
          jobRows.push({
            import_job_id: job.id,
            row_number: rowIndex + 1,
            raw_data: raw as unknown as Json,
            normalized_data: normalized as unknown as Json,
            status,
            error_message: dupDetail?.classification === "invalid" ? dupDetail.reason : null,
            duplicate_match_reason: duplicateReason,
            action_taken: actionTaken,
            review_required: reviewRequired,
          });

          // Only insert into contacts if status is "success" and action is create_new
          if (status === "success" && actionTaken === "create_new") {
            // Build contact record from normalized data
            const contact: Record<string, unknown> = {
              workspace_id: workspaceId || null,
              created_by: user.id,
              import_tag: importSettings.import_tag || null,
              source: importSettings.source || null,
              source_file: file.name,
            };

            for (const [key, val] of Object.entries(normalized)) {
              if (val === null || val === undefined) continue;
              if (CONTACT_FIELDS.has(key)) {
                contact[key] = val;
              }
            }

            // Only insert if we have at least an email or a name
            if (contact.email || contact.first_name || contact.last_name) {
              contactsToInsert.push(contact);
            }
          }

          // Count statuses
          switch (status) {
            case "error": errorCount++; break;
            case "skipped": skippedCount++; break;
            case "duplicate": dupCount++; break;
            case "review": reviewCount++; break;
            case "success":
            default: successCount++; break;
          }
        }

        // Insert job rows
        await (supabase.from("import_job_rows") as any).insert(jobRows);

        // Insert actual contacts in sub-batches
        if (contactsToInsert.length > 0) {
          const { data: insertedData, error: contactErr } = await supabase
            .from("contacts")
            .insert(contactsToInsert as any)
            .select("id");
          if (contactErr) {
            console.error("Contact insert error for batch:", contactErr);
            const batchSuccesses = contactsToInsert.length;
            successCount -= batchSuccesses;
            errorCount += batchSuccesses;
          } else {
            totalInserted += (insertedData?.length ?? 0);
          }
        }

        // Progress update every batch
        const processed = Math.min(i + BATCH_SIZE, allRows.length);
        await (supabase.from("import_jobs") as any)
          .update({ processed_rows: processed })
          .eq("id", job.id);
      }

      // 3. Post-insert verification: count actual contacts with this import's source_file
      const { count: verifiedCount } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("source_file", file.name)
        .eq("created_by", user.id);

      const actualInserted = verifiedCount ?? totalInserted;
      const totalProcessed = successCount + errorCount + dupCount + reviewCount + skippedCount;

      // If staged success count doesn't match actual inserts, mark discrepancy
      const mismatch = successCount > 0 && actualInserted < successCount;
      const finalStatus = mismatch && actualInserted === 0 ? "failed" : "completed";
      const errorSummary = mismatch
        ? { reason: `Verification mismatch: ${successCount} rows staged as success but only ${actualInserted} contacts were actually inserted into the database.` }
        : null;

      await (supabase.from("import_jobs") as any)
        .update({
          status: finalStatus,
          processed_rows: totalProcessed,
          success_rows: successCount,
          inserted_rows: actualInserted,
          error_rows: errorCount + (mismatch ? successCount - actualInserted : 0),
          duplicate_rows: dupCount + skippedCount,
          review_rows: reviewCount,
          completed_at: new Date().toISOString(),
          ...(errorSummary ? { error_summary: errorSummary } : {}),
        })
        .eq("id", job.id);

      if (mismatch) {
        toast.warning(`Import finished with issues: ${actualInserted.toLocaleString()} of ${successCount.toLocaleString()} contacts actually inserted. Check job details for more info.`);
      } else {
        toast.success(`Import complete: ${actualInserted.toLocaleString()} contacts inserted, ${(dupCount + skippedCount).toLocaleString()} duplicates, ${errorCount.toLocaleString()} errors`);
      }
      navigate(`/imports/${job.id}`);
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      toast.error(`Import failed: ${msg}`);
      console.error("Import error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [parsed, file, user, workspaceId, columnMapping, dupStrategy, importSettings, unmappedHeaders, navigate]);

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
