import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  MinusCircle, Eye, ChevronLeft, ChevronRight, GitMerge, Shield,
  RotateCcw, Loader2, Tag, Clock, Activity, Zap, ExternalLink, Sparkles,
  Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ImportReviewPanel } from "@/components/import/ImportReviewPanel";
import { ImportQuarantineTab } from "@/components/imports/ImportQuarantineTab";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  skipped: "bg-muted text-muted-foreground",
  duplicate: "bg-amber-500/10 text-amber-600 border-amber-200",
  review: "bg-primary/10 text-primary border-primary/20",
};

const JOB_STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  mapping: "bg-blue-500/10 text-blue-600 border-blue-200",
  validating: "bg-amber-500/10 text-amber-600 border-amber-200",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 50;

export default function ImportJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enabled: v2Enabled } = useIntelligenceV2();
  const [rowStatusFilter, setRowStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [reviewRow, setReviewRow] = useState<any | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [resuming, setResuming] = useState(false);

  const handleRetryFailed = useCallback(async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const { error, count } = await (supabase.from("import_job_rows") as any)
        .update({ status: "pending", error_message: null, action_taken: null })
        .eq("import_job_id", id)
        .eq("status", "error")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      toast.success(`${count ?? 0} failed row(s) reset for re-processing`);
      await (supabase.from("import_jobs") as any).update({ status: "processing" }).eq("id", id);

      // Re-invoke the backend processor
      void supabase.functions.invoke("run-import-job", { body: { job_id: id } }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["import-job", id] });
      queryClient.invalidateQueries({ queryKey: ["import-job-rows"] });
    } catch {
      toast.error("Failed to retry rows");
    } finally {
      setRetrying(false);
    }
  }, [id, queryClient]);

  const handleResume = useCallback(async () => {
    if (!id) return;
    setResuming(true);
    try {
      await (supabase.from("import_jobs") as any).update({ status: "processing" }).eq("id", id);
      const { error } = await supabase.functions.invoke("run-import-job", { body: { job_id: id } });
      if (error) throw error;
      toast.success("Import resumed — processing remaining rows");
      queryClient.invalidateQueries({ queryKey: ["import-job", id] });
      queryClient.invalidateQueries({ queryKey: ["import-job-rows"] });
    } catch (e: any) {
      const message = String(e?.message ?? "unknown error");
      const isIncompleteStaging = message.includes("non-2xx") || message.includes("incomplete_staging");
      toast.error(
        isIncompleteStaging
          ? "Cannot resume yet: this batch is missing staged CSV rows. Open the parent import and use Repair missing staged rows."
          : `Failed to resume: ${message}`,
      );
    } finally {
      setResuming(false);
    }
  }, [id, queryClient]);

  const isActive = (status: string) => status === "processing" || status === "pending";

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["import-job", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("import_jobs") as any).select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return isActive(status) ? 3000 : false;
    },
  });

  const effectiveStatusFilter = activeTab === "review" ? "review" : rowStatusFilter;
  const effectiveReviewFilter = activeTab === "review" ? "yes" : reviewFilter;

  const { data: rowsData, isLoading: rowsLoading } = useQuery({
    queryKey: ["import-job-rows", id, effectiveStatusFilter, effectiveReviewFilter, page],
    queryFn: async () => {
      let query = (supabase.from("import_job_rows") as any)
        .select("*", { count: "exact" })
        .eq("import_job_id", id!)
        .order("row_number", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (effectiveStatusFilter !== "all") query = query.eq("status", effectiveStatusFilter);
      if (effectiveReviewFilter === "yes") query = query.eq("review_required", true);
      if (effectiveReviewFilter === "no") query = query.eq("review_required", false);
      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as any[], total: (count ?? 0) as number };
    },
    enabled: !!id,
    refetchInterval: job && isActive(job.status) ? 5000 : false,
  });

  const { data: reviewCount } = useQuery({
    queryKey: ["import-job-review-count", id],
    queryFn: async () => {
      const { count, error } = await (supabase.from("import_job_rows") as any)
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", id!)
        .eq("review_required", true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });

  // ─── Child batches (Apollo-style batching) ────────────────────────────────
  const { data: childJobs } = useQuery({
    queryKey: ["import-job-children", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("import_jobs") as any)
        .select("id,file_name,status,total_rows,processed_rows,inserted_rows,duplicate_rows,error_rows,review_rows,batch_index,batch_total,batch_row_start,batch_row_end,completed_at,error_summary")
        .eq("parent_job_id", id!)
        .order("batch_index", { ascending: true });
      if (error) throw error;
      const children = (data ?? []) as any[];
      // Pull per-child staged-row counts so we can show planned/staged/missing
      // and decide which children need a Repair pass.
      if (children.length > 0) {
        const counts = await Promise.all(children.map(async (c) => {
          const { count } = await (supabase.from("import_job_rows") as any)
            .select("id", { count: "exact", head: true })
            .eq("import_job_id", c.id);
          return { id: c.id, staged: count ?? 0 };
        }));
        const map = new Map(counts.map((c) => [c.id, c.staged]));
        for (const c of children) {
          c.staged_rows = map.get(c.id) ?? 0;
          c.missing_staged_rows = Math.max(0, (c.total_rows ?? 0) - c.staged_rows);
          c.incomplete_staging =
            c.missing_staged_rows > 0 || !!(c.error_summary?.incomplete_staging);
        }
      }
      return children;
    },
    enabled: !!id,
    refetchInterval: job && isActive(job.status) ? 5000 : false,
  });

  const isParent = (childJobs?.length ?? 0) > 0;

  const handleResumeChild = useCallback(async (childId: string) => {
    try {
      const child = (childJobs ?? []).find((c) => c.id === childId);
      if (child && (child.incomplete_staging || (child.missing_staged_rows ?? 0) > 0)) {
        toast.error(
          `Batch is missing ${(child.missing_staged_rows ?? 0).toLocaleString()} staged rows. Use "Repair missing staged rows" on the parent import first.`,
        );
        return;
      }
      await (supabase.from("import_jobs") as any).update({ status: "processing" }).eq("id", childId);
      const { error } = await supabase.functions.invoke("run-import-job", { body: { job_id: childId } });
      if (error) throw error;
      toast.success("Batch resumed");
      queryClient.invalidateQueries({ queryKey: ["import-job-children", id] });
    } catch (e: any) {
      const message = String(e?.message ?? "unknown");
      const isIncompleteStaging = message.includes("non-2xx") || message.includes("incomplete_staging");
      toast.error(
        isIncompleteStaging
          ? 'Cannot resume: batch is missing staged CSV rows. Use "Repair missing staged rows" on the parent import.'
          : `Resume failed: ${message}`,
      );
    }
  }, [id, queryClient, childJobs]);

  const totalPages = Math.ceil((rowsData?.total ?? 0) / PAGE_SIZE);
  const settingsObj = (job?.settings ?? {}) as Record<string, unknown>;

  const handleReviewResolved = () => {
    queryClient.invalidateQueries({ queryKey: ["import-job-rows"] });
    queryClient.invalidateQueries({ queryKey: ["import-job-review-count"] });
    queryClient.invalidateQueries({ queryKey: ["import-job", id] });
  };

  if (jobLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-[300px]" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[80px]" />)}</div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }
  // Extract diagnostics (must be before early returns to avoid hook issues)
  const errorSummary = job ? (job.error_summary && typeof job.error_summary === "object" ? job.error_summary : {}) : {};
  const diagnostics = errorSummary.diagnostics ?? {};
  const timings = diagnostics.timings ?? {};
  const recentBatches = diagnostics.recent_batches ?? [];
  const verifiedDbCount = diagnostics.verified_db_count;
  const totalBatches = diagnostics.total_batches;
  const currentPhase = diagnostics.phase ?? "";
  const verificationWarning = errorSummary.verification_warning;
  const failReason = errorSummary.reason;

  if (!job) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/imports")} className="gap-2 mb-4"><ArrowLeft className="h-4 w-4" /> Back</Button>
        <p className="text-muted-foreground">Import job not found.</p>
      </div>
    );
  }

  // Aggregate child stats when this job is a batched parent
  const childAgg = isParent && childJobs
    ? childJobs.reduce(
        (acc, c) => ({
          processed_rows: acc.processed_rows + (c.processed_rows ?? 0),
          inserted_rows: acc.inserted_rows + (c.inserted_rows ?? 0),
          duplicate_rows: acc.duplicate_rows + (c.duplicate_rows ?? 0),
          error_rows: acc.error_rows + (c.error_rows ?? 0),
          review_rows: acc.review_rows + (c.review_rows ?? 0),
          success_rows: acc.success_rows + (c.success_rows ?? 0),
        }),
        { processed_rows: 0, inserted_rows: 0, duplicate_rows: 0, error_rows: 0, review_rows: 0, success_rows: 0 }
      )
    : null;
  const displayJob = childAgg ? { ...job, ...childAgg } : job;

  // For parent jobs, denominator must come from child total_rows (parent itself has no staged rows).
  const childTotalSum = isParent && childJobs
    ? childJobs.reduce((acc, c) => acc + (c.total_rows ?? 0), 0)
    : 0;
  const totalStaged = isParent
    ? (childTotalSum > 0 ? childTotalSum : (job.total_rows ?? 0))
    : (diagnostics.total_staged_rows ?? job.total_rows ?? 0);
  const progressPct = totalStaged > 0 ? Math.min(100, Math.round((displayJob.processed_rows / totalStaged) * 100)) : 0;
  const hasErrors = (displayJob.error_rows ?? 0) > 0;
  const importTag = settingsObj.import_tag as string | undefined;
  const importSource = settingsObj.source as string | undefined;
  const fieldReport = errorSummary.field_report as Record<string, { inserted: number; blank: number; target: string }> | undefined;

  // Integrity check
  const counterSum = (displayJob.success_rows ?? 0) + (displayJob.error_rows ?? 0) + (displayJob.duplicate_rows ?? 0) + (displayJob.review_rows ?? 0);
  const integrityOk = (displayJob.processed_rows ?? 0) <= totalStaged && counterSum <= totalStaged;
  // Only warn when we actually have a meaningful denominator AND processed clearly exceeds it.
  // Suppress on parent jobs while children are still loading (totalStaged could be 0 momentarily).
  const countersInflated = totalStaged > 0 && (displayJob.processed_rows ?? 0) > totalStaged * 1.1;

  // Detect a parent whose child shells were never fully created (e.g. browser closed mid-upload).
  const expectedBatches = job.batch_total ?? 0;
  const actualChildCount = childJobs?.length ?? 0;
  const missingChildBatches = isParent && expectedBatches > 0 ? Math.max(0, expectedBatches - actualChildCount) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/imports")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{job.file_name}</h1>
            <Badge variant="outline" className={`capitalize text-xs ${JOB_STATUS_STYLES[job.status] ?? ""}`}>{job.status}</Badge>
            {importTag && <Badge variant="secondary" className="text-xs gap-1"><Tag className="h-3 w-3" /> {importTag}</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>Created {format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            {job.completed_at && <span>· Completed {format(new Date(job.completed_at), "MMM d, yyyy 'at' h:mm a")}</span>}
            {importSource && <span>· Source: {importSource}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.status === "completed" && (job.inserted_rows ?? 0) > 0 && (
            <Button
              variant="default" size="sm" className="gap-2"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("source_file", job.file_name);
                if (job.settings?.import_tag) params.set("import_tag", job.settings.import_tag);
                if (job.settings?.list_id) params.set("list_id", job.settings.list_id);
                navigate(`/search/prospects?${params.toString()}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              View Imported Contacts
            </Button>
          )}
          {hasErrors && (job.status === "completed" || job.status === "failed") && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRetryFailed} disabled={retrying}>
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Retry Failed ({job.error_rows})
            </Button>
          )}
          {(job.status === "processing" || job.status === "pending" || job.status === "failed") && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleResume} disabled={resuming}>
              {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Resume Import
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isActive(job.status) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {currentPhase === "uploading_rows" ? "Uploading rows…" :
               currentPhase === "loading_existing_records" ? "Loading existing records…" :
               currentPhase === "processing_batch" ? `Processing batch ${totalBatches || recentBatches.length}…` :
               currentPhase === "queued_server_processing" ? "Queued for processing…" :
               "Processing…"}
            </span>
            <span className="font-medium">{progressPct}% ({Math.min(job.processed_rows ?? 0, totalStaged).toLocaleString()}/{totalStaged.toLocaleString()})</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      )}

      {/* Integrity warning */}
      {countersInflated && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <Shield className="h-4 w-4 flex-shrink-0" />
          <span><strong>Integrity Issue:</strong> Processed count ({(displayJob.processed_rows ?? 0).toLocaleString()}) exceeds expected total ({totalStaged.toLocaleString()}).</span>
        </div>
      )}

      {/* Missing child batches warning (parent only) */}
      {missingChildBatches > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-300/40 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Incomplete batch creation:</strong> Expected {expectedBatches} child batches, only {actualChildCount} were created.
            The browser-side upload aborted before all batches were staged. Re-upload the remaining rows on the same list
            (with <em>Skip exact duplicates</em> enabled) to complete the import — the dedupe will skip rows already inserted.
          </div>
        </div>
      )}

      {/* Failure reason */}
      {job.status === "failed" && failReason && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span><strong>Failed:</strong> {failReason}</span>
        </div>
      )}

      {/* Verification warnings */}
      {verificationWarning && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{verificationWarning}</span>
        </div>
      )}

      {/* Parent post-processing status (Apollo-style batching) */}
      {isParent && (
        <ParentPostProcessingCard
          job={job}
          childJobs={childJobs ?? []}
          onResume={() => {
            queryClient.invalidateQueries({ queryKey: ["import-job", id] });
          }}
        />
      )}

      {/* Child batches table (Apollo-style batching) */}
      {isParent && childJobs && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <GitMerge className="h-3.5 w-3.5" /> Batches ({childJobs.length})
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {childJobs.filter((c) => c.status === "completed" && !c.incomplete_staging).length} completed ·{" "}
                  {childJobs.filter((c) => c.status === "processing" || c.status === "pending").length} in progress ·{" "}
                  {childJobs.filter((c) => c.incomplete_staging).length} incomplete staging ·{" "}
                  {childJobs.filter((c) => c.status === "failed" && !c.incomplete_staging).length} failed
                </span>
                <RepairStagingButton
                  parentJob={job}
                  childJobs={childJobs}
                  onDone={() => {
                    queryClient.invalidateQueries({ queryKey: ["import-job", id] });
                    queryClient.invalidateQueries({ queryKey: ["import-job-children", id] });
                  }}
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Staged</TableHead>
                  <TableHead className="text-right">Missing</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead className="text-right">Dupes</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {childJobs.map((c) => {
                  const displayStatus = c.incomplete_staging ? "Incomplete staging" : c.status;
                  const statusClass = c.incomplete_staging
                    ? "bg-amber-500/10 text-amber-700 border-amber-300/40"
                    : (JOB_STATUS_STYLES[c.status] ?? "");
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.batch_index}/{c.batch_total}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.batch_row_start?.toLocaleString()}–{c.batch_row_end?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${statusClass}`}>
                          {displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{(c.total_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className={`text-right tabular-nums ${c.incomplete_staging ? "text-amber-700 font-medium" : ""}`}>
                        {(c.staged_rows ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-700">
                        {(c.missing_staged_rows ?? 0) > 0 ? (c.missing_staged_rows).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{(c.processed_rows ?? 0).toLocaleString()}/{(c.staged_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{(c.inserted_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600">{(c.duplicate_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{(c.error_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate(`/imports/${c.id}`)}>
                            Open
                          </Button>
                          {(c.status === "failed" || c.status === "pending") && !c.incomplete_staging && (
                            <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={() => handleResumeChild(c.id)}>
                              <RotateCcw className="h-3 w-3" /> Resume
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}



      {/* Summary Cards — reconciled */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "File Total", value: job.total_rows, icon: FileSpreadsheet, color: "text-foreground" },
          { label: "Staged", value: totalStaged, icon: FileSpreadsheet, color: "text-foreground" },
          { label: "Processed", value: Math.min(displayJob.processed_rows ?? 0, totalStaged), icon: CheckCircle2, color: "text-foreground" },
          { label: "Inserted", value: displayJob.inserted_rows ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Duplicates", value: displayJob.duplicate_rows, icon: MinusCircle, color: "text-amber-600" },
          { label: "Errors", value: displayJob.error_rows, icon: XCircle, color: "text-destructive" },
          { label: "Review", value: displayJob.review_rows, icon: AlertTriangle, color: "text-primary" },
          { label: "Verified DB", value: verifiedDbCount ?? "—", icon: Shield, color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1"><s.icon className={`h-3.5 w-3.5 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
              <p className={`text-xl font-bold ${s.color}`}>{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Diagnostics Panel */}
      {(Object.keys(timings).length > 0 || recentBatches.length > 0 || verifiedDbCount !== undefined) && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Processing Diagnostics
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {totalBatches != null && (
                <div className="p-2 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground">Total Batches</p><p className="text-sm font-semibold">{totalBatches}</p></div>
              )}
              {verifiedDbCount != null && (
                <div className="p-2 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground">Verified in DB</p><p className="text-sm font-semibold">{verifiedDbCount.toLocaleString()}</p></div>
              )}
              {timings.preload_existing_ms != null && (
                <div className="p-2 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground">Preload Time</p><p className="text-sm font-semibold">{(timings.preload_existing_ms / 1000).toFixed(1)}s</p></div>
              )}
              {currentPhase && (
                <div className="p-2 rounded-md bg-muted/50"><p className="text-xs text-muted-foreground">Current Phase</p><p className="text-sm font-semibold capitalize">{currentPhase.replace(/_/g, " ")}</p></div>
              )}
            </div>

            {/* Timing breakdown */}
            {Object.keys(timings).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Cumulative Timings</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(timings).filter(([k]) => k !== "preload_existing_ms").map(([key, ms]) => (
                    <div key={key} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                      <span className="text-muted-foreground capitalize">{key.replace(/_ms$/, "").replace(/_/g, " ")}</span>
                      <span className="font-mono font-medium">{Number(ms) >= 1000 ? `${(Number(ms) / 1000).toFixed(1)}s` : `${ms}ms`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent batches */}
            {recentBatches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> Recent Batches ({recentBatches.length})</p>
                <div className="max-h-[160px] overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs w-[60px]">#</TableHead>
                        <TableHead className="text-xs">Rows</TableHead>
                        <TableHead className="text-xs">Inserted</TableHead>
                        <TableHead className="text-xs">Errors</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBatches.map((b: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{b.batch ?? i + 1}</TableCell>
                          <TableCell className="text-xs">{b.rows ?? "—"}</TableCell>
                          <TableCell className="text-xs text-emerald-600">{b.inserted ?? b.inserted_rows ?? "—"}</TableCell>
                          <TableCell className="text-xs text-destructive">{b.errors ?? b.error_rows ?? b.failed_retries ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{b.at ? format(new Date(b.at), "HH:mm:ss") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Field Mapping Report — hidden on parent batch jobs (they have no per-row stats) */}
      {!isParent && fieldReport && Object.keys(fieldReport).length > 0 && Object.values(fieldReport).some(v => (v.inserted ?? 0) + (v.blank ?? 0) > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <GitMerge className="h-3.5 w-3.5" /> Field Mapping Verification
            </p>
            <div className="max-h-[200px] overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Field</TableHead>
                    <TableHead className="text-xs">Target Table</TableHead>
                    <TableHead className="text-xs text-right">Populated</TableHead>
                    <TableHead className="text-xs text-right">Blank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(fieldReport).map(([field, info]) => (
                    <TableRow key={field}>
                      <TableCell className="text-xs font-mono">{field}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={`text-[10px] ${info.target === "contacts" ? "border-emerald-200 text-emerald-600" : info.target === "companies" ? "border-blue-200 text-blue-600" : "border-amber-200 text-amber-600"}`}>
                          {info.target}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">{info.inserted.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{info.blank.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Column Mapping</p>
            <div className="space-y-1.5 max-h-[200px] overflow-auto">
              {Object.entries(job.column_mapping ?? {}).length > 0 ? (
                Object.entries(job.column_mapping ?? {}).map(([csv, field]) => (
                  <div key={csv} className="flex items-center text-sm gap-2">
                    <span className="text-muted-foreground truncate w-[120px]">{csv}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{String(field)}</span>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground">No mapping data</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Import Settings</p>
            <div className="space-y-1.5">
              {settingsObj.duplicate_strategy && (
                <div className="flex items-center text-sm gap-2">
                  <span className="text-muted-foreground">Strategy</span>
                  <Badge variant="outline" className="text-xs capitalize">{String(settingsObj.duplicate_strategy).replace(/_/g, " ")}</Badge>
                </div>
              )}
              {settingsObj.skip_exact_duplicates !== undefined && (
                <div className="flex items-center text-sm gap-2">
                  <span className="text-muted-foreground">Skip exact dupes</span>
                  <Badge variant="outline" className={`text-xs ${settingsObj.skip_exact_duplicates ? "bg-emerald-500/10 text-emerald-600" : ""}`}>
                    {settingsObj.skip_exact_duplicates ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
              {settingsObj.review_likely_duplicates !== undefined && (
                <div className="flex items-center text-sm gap-2">
                  <span className="text-muted-foreground">Review likely dupes</span>
                  <Badge variant="outline" className={`text-xs ${settingsObj.review_likely_duplicates ? "bg-primary/10 text-primary" : ""}`}>
                    {settingsObj.review_likely_duplicates ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
              {Array.isArray(settingsObj.unmapped_columns) && (
                <div className="text-sm"><span className="text-muted-foreground">{(settingsObj.unmapped_columns as string[]).length} unmapped columns</span></div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Tabbed Row View */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> All Rows</TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Review Queue
              {(reviewCount ?? 0) > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{reviewCount}</Badge>}
            </TabsTrigger>
            {v2Enabled && <TabsTrigger value="quarantine" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Quarantine</TabsTrigger>}
          </TabsList>
          {activeTab === "all" && (
            <div className="flex items-center gap-3">
              <Select value={rowStatusFilter} onValueChange={(v) => { setRowStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["pending", "success", "error", "skipped", "duplicate", "review"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Review filter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rows</SelectItem>
                  <SelectItem value="yes">Needs Review</SelectItem>
                  <SelectItem value="no">No Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="all" className="mt-4">
          <RowTable rows={rowsData?.rows} loading={rowsLoading} onViewRow={setSelectedRow} onReviewRow={setReviewRow} showReviewButton={false} />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          {(reviewCount ?? 0) === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" /><h3 className="font-medium">All clear</h3>
              <p className="text-sm text-muted-foreground mt-1">No rows require review.</p>
            </CardContent></Card>
          ) : (
            <RowTable rows={rowsData?.rows} loading={rowsLoading} onViewRow={setSelectedRow} onReviewRow={setReviewRow} showReviewButton />
          )}
        </TabsContent>
        {v2Enabled && (
          <TabsContent value="quarantine" className="mt-4">
            <ImportQuarantineTab importJobId={id!} />
          </TabsContent>
        )}
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowsData?.total ?? 0)} of {rowsData?.total?.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {selectedRow && <RowDetailSheet row={selectedRow} open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)} />}
      <ImportReviewPanel open={!!reviewRow} onOpenChange={(open) => !open && setReviewRow(null)} row={reviewRow} importJobId={id!} onResolved={handleReviewResolved} />
    </div>
  );
}

function RowTable({ rows, loading, onViewRow, onReviewRow, showReviewButton }: {
  rows: any[] | undefined; loading: boolean;
  onViewRow: (row: any) => void; onReviewRow: (row: any) => void; showReviewButton: boolean;
}) {
  if (loading) return <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>;
  if (!rows?.length) return <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground"><p className="text-sm">No rows match the current filters.</p></CardContent></Card>;

  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs w-[70px]">Row #</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Match Reason</TableHead>
            <TableHead className="text-xs">Action</TableHead>
            <TableHead className="text-xs">Error</TableHead>
            <TableHead className="text-xs w-[60px]">Review</TableHead>
            <TableHead className="text-xs w-[90px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row: any) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.row_number}</TableCell>
              <TableCell><Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[row.status] ?? ""}`}>{row.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">{row.duplicate_match_reason || "—"}</TableCell>
              <TableCell className="text-xs capitalize">{row.action_taken?.replace(/_/g, " ") || "—"}</TableCell>
              <TableCell className="text-xs text-destructive truncate max-w-[180px]">{row.error_message || "—"}</TableCell>
              <TableCell className="text-center">{row.review_required && <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">!</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewRow(row)}><Eye className="h-3.5 w-3.5" /></Button>
                  {(row.review_required || showReviewButton) && row.status === "review" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => onReviewRow(row)}><GitMerge className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function RowDetailSheet({ row, open, onOpenChange }: { row: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-auto">
        <SheetHeader><SheetTitle>Row #{row.row_number} Details</SheetTitle></SheetHeader>
        <div className="space-y-6 mt-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[row.status] ?? ""}`}>{row.status}</Badge>
            {row.review_required && <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">Needs Review</Badge>}
          </div>
          {row.error_message && <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{row.error_message}</div>}
          {row.duplicate_match_reason && <div className="p-3 rounded-md bg-amber-500/10 text-amber-800 text-sm"><strong>Match:</strong> {row.duplicate_match_reason}</div>}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Data</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">{JSON.stringify(row.raw_data, null, 2)}</pre>
          </div>
          {row.normalized_data && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Normalized Data</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">{JSON.stringify(row.normalized_data, null, 2)}</pre>
            </div>
          )}
          {row.action_taken && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Action</p>
              <p className="text-sm capitalize">{row.action_taken.replace(/_/g, " ")}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Parent Post-Processing Status Card ──────────────────────────────────────
const POST_STAGE_LABEL: Record<string, string> = {
  processing_batches: "Processing batches",
  dedupe_companies: "Dedupe companies",
  final_validation: "Final validation",
  completed: "Completed",
  failed: "Post-processing failed",
};

function ParentPostProcessingCard({ job, childJobs, onResume }: {
  job: any;
  childJobs: any[];
  onResume: () => void;
}) {
  const total = childJobs.length;
  const completed = childJobs.filter((c) => c.status === "completed").length;
  const failed = childJobs.filter((c) => c.status === "failed").length;
  const inFlight = childJobs.filter((c) => c.status === "processing" || c.status === "pending").length;
  const allDone = total > 0 && completed === total;
  const rawStage: string | null = job?.post_processing_stage ?? null;

  // Derive stage: prefer DB column; fall back to client-side computation
  const stage: string =
    rawStage ??
    (allDone ? "final_validation" : "processing_batches");

  const stages: Array<{ key: string; label: string }> = [
    { key: "processing_batches", label: "Processing batches" },
    { key: "dedupe_companies", label: "Dedupe companies" },
    { key: "final_validation", label: "Final validation" },
    { key: "completed", label: "Completed" },
  ];
  const stageIdx = Math.max(0, stages.findIndex((s) => s.key === stage));
  const isFailed = stage === "failed" || failed > 0;
  const isDedupeRunning = stage === "dedupe_companies";

  const handleRetryFinalize = async () => {
    try {
      // Reset stage so the claim helper can pick it up again, then dispatch.
      await (supabase.from("import_jobs") as any)
        .update({ post_processing_stage: null })
        .eq("id", job.id);
      await supabase.functions.invoke("run-company-dedupe", {
        body: { workspace_id: job.workspace_id, parent_job_id: job.id, chunk: 15 },
      });
      toast.success("Post-processing restarted");
      onResume();
    } catch (e: any) {
      toast.error(`Retry failed: ${e?.message ?? "unknown"}`);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Parent Import Post-Processing
          </p>
          <Badge
            variant="outline"
            className={`text-xs ${
              stage === "completed"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                : isFailed
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-primary/10 text-primary border-primary/20"
            }`}
          >
            {POST_STAGE_LABEL[stage] ?? stage}
          </Badge>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {stages.map((s, i) => {
            const reached = i <= stageIdx && !isFailed;
            const active = i === stageIdx && stage !== "completed" && !isFailed;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center gap-2 text-xs ${
                    reached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : reached ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                  )}
                  <span className={active ? "font-medium" : ""}>{s.label}</span>
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`flex-1 h-px ${
                      i < stageIdx ? "bg-emerald-500/40" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Batch counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/40">
            <p className="text-muted-foreground">Total batches</p>
            <p className="font-semibold text-sm">{total}</p>
          </div>
          <div className="p-2 rounded bg-muted/40">
            <p className="text-muted-foreground">Completed</p>
            <p className="font-semibold text-sm text-emerald-600">{completed}</p>
          </div>
          <div className="p-2 rounded bg-muted/40">
            <p className="text-muted-foreground">In progress</p>
            <p className="font-semibold text-sm text-primary">{inFlight}</p>
          </div>
          <div className="p-2 rounded bg-muted/40">
            <p className="text-muted-foreground">Failed</p>
            <p className="font-semibold text-sm text-destructive">{failed}</p>
          </div>
          <div className="p-2 rounded bg-muted/40">
            <p className="text-muted-foreground">Company dedupe</p>
            <p className="font-semibold text-sm">
              {isDedupeRunning ? "Running…" : stage === "completed" ? "Done" : allDone ? "Pending" : "Waits for batches"}
            </p>
          </div>
        </div>

        {isFailed && (
          <div className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <span>
              <strong>Post-processing failed.</strong> Successful child batches will not be reprocessed — only finalization will resume.
            </span>
            <Button size="sm" variant="outline" className="gap-1" onClick={handleRetryFinalize}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry finalize
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Repair Staging Button ───────────────────────────────────────────────────
// Lets the user re-upload the ORIGINAL CSV. The system computes which
// row_numbers are missing per incomplete child batch, stages only those rows,
// then resumes processing. No new contacts are duplicated because dedupe is
// already part of run-import-job.
function RepairStagingButton({
  parentJob,
  childJobs,
  onDone,
}: {
  parentJob: any;
  childJobs: any[];
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const incomplete = (childJobs ?? []).filter((c) => c.incomplete_staging);
  if (incomplete.length === 0) return null;

  const totalMissing = incomplete.reduce((a, c) => a + (c.missing_staged_rows ?? 0), 0);

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress("Uploading original CSV for server-side repair…");
    try {
      if (!parentJob?.id) throw new Error("Missing parent import job id.");
      const workspaceId = parentJob?.workspace_id;
      if (!workspaceId) throw new Error("Missing workspace id for repair upload.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 140);
      const objectPath = `${workspaceId}/import-repairs/${parentJob.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("verification-uploads")
        .upload(objectPath, file, { contentType: "text/csv", upsert: true });
      if (uploadError) throw new Error(`CSV upload failed: ${uploadError.message}`);

      setProgress("Server is staging only missing batch rows…");
      const { data, error } = await supabase.functions.invoke("repair-import-staging", {
        body: {
          parent_job_id: parentJob.id,
          bucket: "verification-uploads",
          file_path: objectPath,
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error ?? "Repair function failed");

      const stagedTotal = Number((data as any)?.staged_inserted ?? 0);
      const repairedChildren = Number((data as any)?.repaired_children ?? 0);
      toast.success(
        `Repair queued: server staged ${stagedTotal.toLocaleString()} missing rows across ${repairedChildren} batch(es) and resumed processing.`,
      );
      onDone();
    } catch (err: any) {
      console.error("Repair staging failed", err);
      toast.error(`Repair failed: ${err?.message ?? "unknown error"}. No completed batches were reprocessed.`);
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const storedPath = (parentJob?.error_summary?.diagnostics?.original_csv_path as string | undefined) || undefined;
  const storedBucket = (parentJob?.error_summary?.diagnostics?.original_csv_bucket as string | undefined) || "verification-uploads";

  const handleRepairFromStored = async () => {
    if (!storedPath) return;
    setBusy(true);
    setProgress("Server is staging only missing batch rows from the stored CSV…");
    try {
      const { data, error } = await supabase.functions.invoke("repair-import-staging", {
        body: { parent_job_id: parentJob.id, bucket: storedBucket, file_path: storedPath },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error ?? "Repair function failed");
      const stagedTotal = Number((data as any)?.staged_inserted ?? 0);
      const repairedChildren = Number((data as any)?.repaired_children ?? 0);
      toast.success(
        `Repair queued: server staged ${stagedTotal.toLocaleString()} missing rows across ${repairedChildren} batch(es) and resumed processing.`,
      );
      onDone();
    } catch (err: any) {
      console.error("Stored-CSV repair failed", err);
      toast.error(`Repair failed: ${err?.message ?? "unknown error"}. No completed batches were reprocessed.`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {storedPath ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1 border-amber-300/50 text-amber-700 hover:bg-amber-500/10"
          disabled={busy}
          onClick={handleRepairFromStored}
          title={`${incomplete.length} batch(es) missing ${totalMissing.toLocaleString()} staged rows — repair from stored original CSV`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
          {busy ? (progress ?? "Repairing…") : `Repair missing staged rows (${totalMissing.toLocaleString()})`}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1 border-amber-300/50 text-amber-700 hover:bg-amber-500/10"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          title={`${incomplete.length} batch(es) missing ${totalMissing.toLocaleString()} staged rows — upload the original CSV to repair`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
          {busy ? (progress ?? "Repairing…") : `Upload original CSV to repair (${totalMissing.toLocaleString()})`}
        </Button>
      )}
    </div>
  );
}
