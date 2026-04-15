import { useState, useCallback } from "react";
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
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  Shield,
  RotateCcw,
  Loader2,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ImportReviewPanel } from "@/components/import/ImportReviewPanel";

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
  const [rowStatusFilter, setRowStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [reviewRow, setReviewRow] = useState<any | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [retrying, setRetrying] = useState(false);

  const handleRetryFailed = useCallback(async () => {
    if (!id) return;
    setRetrying(true);
    try {
      // Reset all error/failed rows back to pending
      const { error, count } = await (supabase.from("import_job_rows") as any)
        .update({ status: "pending", error_message: null, action_taken: null })
        .eq("import_job_id", id)
        .eq("status", "error")
        .select("id", { count: "exact", head: true });

      if (error) throw error;
      toast.success(`${count ?? 0} failed row(s) reset for re-processing`);

      // Update the job status back to processing
      await (supabase.from("import_jobs") as any)
        .update({ status: "processing" })
        .eq("id", id);

      queryClient.invalidateQueries({ queryKey: ["import-job", id] });
      queryClient.invalidateQueries({ queryKey: ["import-job-rows"] });
    } catch {
      toast.error("Failed to retry rows");
    } finally {
      setRetrying(false);
    }
  }, [id, queryClient]);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["import-job", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("import_jobs") as any)
        .select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
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
  });

  // Review queue count
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

  const totalPages = Math.ceil((rowsData?.total ?? 0) / PAGE_SIZE);
  const mappingObj = (job?.column_mapping ?? {}) as Record<string, string>;
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
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[80px]" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/imports")} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Import job not found.</p>
      </div>
    );
  }

  const progressPct = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;
  const hasErrors = (job.error_rows ?? 0) > 0;
  const importTag = settingsObj.import_tag as string | undefined;
  const importSource = settingsObj.source as string | undefined;
  const importListId = settingsObj.list_id as string | undefined;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/imports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{job.file_name}</h1>
            <Badge variant="outline" className={`capitalize text-xs ${JOB_STATUS_STYLES[job.status] ?? ""}`}>
              {job.status}
            </Badge>
            {importTag && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Tag className="h-3 w-3" /> {importTag}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>Created {format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            {job.completed_at && <span>· Completed {format(new Date(job.completed_at), "MMM d, yyyy 'at' h:mm a")}</span>}
            {importSource && <span>· Source: {importSource}</span>}
          </div>
        </div>
        {hasErrors && job.status === "completed" && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRetryFailed} disabled={retrying}>
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Retry Failed ({job.error_rows})
          </Button>
        )}
      </div>

      {/* Progress Bar for in-progress jobs */}
      {job.status === "processing" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processing rows…</span>
            <span className="font-medium">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total Rows", value: job.total_rows, icon: FileSpreadsheet, color: "text-foreground" },
          { label: "Processed", value: job.processed_rows, icon: CheckCircle2, color: "text-foreground" },
          { label: "Success", value: job.success_rows, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Errors", value: job.error_rows, icon: XCircle, color: "text-destructive" },
          { label: "Duplicates", value: job.duplicate_rows, icon: MinusCircle, color: "text-amber-600" },
          { label: "Review", value: job.review_rows, icon: AlertTriangle, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{(s.value ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mapping & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Column Mapping</p>
            <div className="space-y-1.5 max-h-[200px] overflow-auto">
              {Object.entries(mappingObj).length > 0 ? (
                Object.entries(mappingObj).map(([csv, field]) => (
                  <div key={csv} className="flex items-center text-sm gap-2">
                    <span className="text-muted-foreground truncate w-[120px]">{csv}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{field}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No mapping data</p>
              )}
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
                  <Badge variant="outline" className="text-xs capitalize">
                    {String(settingsObj.duplicate_strategy).replace(/_/g, " ")}
                  </Badge>
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
                <div className="text-sm">
                  <span className="text-muted-foreground">{(settingsObj.unmapped_columns as string[]).length} unmapped columns</span>
                </div>
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
            <TabsTrigger value="all" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> All Rows
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Review Queue
              {(reviewCount ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                  {reviewCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "all" && (
            <div className="flex items-center gap-3">
              <Select value={rowStatusFilter} onValueChange={(v) => { setRowStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["pending", "success", "error", "skipped", "duplicate", "review"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Review filter" />
                </SelectTrigger>
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
          <RowTable
            rows={rowsData?.rows}
            loading={rowsLoading}
            onViewRow={setSelectedRow}
            onReviewRow={setReviewRow}
            showReviewButton={false}
          />
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          {(reviewCount ?? 0) === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                <h3 className="font-medium">All clear</h3>
                <p className="text-sm text-muted-foreground mt-1">No rows require review.</p>
              </CardContent>
            </Card>
          ) : (
            <RowTable
              rows={rowsData?.rows}
              loading={rowsLoading}
              onViewRow={setSelectedRow}
              onReviewRow={setReviewRow}
              showReviewButton
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowsData?.total ?? 0)} of {rowsData?.total?.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Row Detail Sheet (view-only) */}
      {selectedRow && (
        <RowDetailSheet
          row={selectedRow}
          open={!!selectedRow}
          onOpenChange={(open) => !open && setSelectedRow(null)}
        />
      )}

      {/* Review Panel */}
      <ImportReviewPanel
        open={!!reviewRow}
        onOpenChange={(open) => !open && setReviewRow(null)}
        row={reviewRow}
        importJobId={id!}
        onResolved={handleReviewResolved}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function RowTable({
  rows,
  loading,
  onViewRow,
  onReviewRow,
  showReviewButton,
}: {
  rows: any[] | undefined;
  loading: boolean;
  onViewRow: (row: any) => void;
  onReviewRow: (row: any) => void;
  showReviewButton: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!rows?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <p className="text-sm">No rows match the current filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
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
                <TableCell>
                  <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[row.status] ?? ""}`}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {row.duplicate_match_reason || "—"}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {row.action_taken?.replace(/_/g, " ") || "—"}
                </TableCell>
                <TableCell className="text-xs text-destructive truncate max-w-[180px]">
                  {row.error_message || "—"}
                </TableCell>
                <TableCell className="text-center">
                  {row.review_required && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">!</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewRow(row)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {(row.review_required || showReviewButton) && row.status === "review" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => onReviewRow(row)}>
                        <GitMerge className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RowDetailSheet({ row, open, onOpenChange }: { row: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  // Using Sheet components already imported at top level

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-auto">
        <SheetHeader>
          <SheetTitle>Row #{row.row_number} Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[row.status] ?? ""}`}>
              {row.status}
            </Badge>
            {row.review_required && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                Needs Review
              </Badge>
            )}
          </div>

          {row.error_message && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{row.error_message}</div>
          )}

          {row.duplicate_match_reason && (
            <div className="p-3 rounded-md bg-amber-500/10 text-amber-800 text-sm">
              <strong>Match:</strong> {row.duplicate_match_reason}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Data</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">
              {JSON.stringify(row.raw_data, null, 2)}
            </pre>
          </div>

          {row.normalized_data && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Normalized Data</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">
                {JSON.stringify(row.normalized_data, null, 2)}
              </pre>
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
