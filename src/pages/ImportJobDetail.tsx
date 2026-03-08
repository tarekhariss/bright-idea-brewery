import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { format } from "date-fns";
import type { ImportRowStatus, Json } from "@/integrations/supabase/db-types";

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
  const [rowStatusFilter, setRowStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["import-job", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("import_jobs") as any)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: rowsData, isLoading: rowsLoading } = useQuery({
    queryKey: ["import-job-rows", id, rowStatusFilter, reviewFilter, page],
    queryFn: async () => {
      let query = (supabase
        .from("import_job_rows") as any)
        .select("*", { count: "exact" })
        .eq("import_job_id", id!)
        .order("row_number", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (rowStatusFilter !== "all") query = query.eq("status", rowStatusFilter);
      if (reviewFilter === "yes") query = query.eq("review_required", true);
      if (reviewFilter === "no") query = query.eq("review_required", false);

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as any[], total: (count ?? 0) as number };
    },
    enabled: !!id,
  });

  const totalPages = Math.ceil((rowsData?.total ?? 0) / PAGE_SIZE);
  const mappingObj = (job?.column_mapping ?? {}) as Record<string, string>;
  const settingsObj = (job?.settings ?? {}) as Record<string, unknown>;

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
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>Created {format(new Date(job.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            {job.completed_at && <span>· Completed {format(new Date(job.completed_at), "MMM d, yyyy 'at' h:mm a")}</span>}
          </div>
        </div>
      </div>

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
              <p className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
            <div className="space-y-1.5">
              {settingsObj.duplicate_strategy && (
                <div className="flex items-center text-sm gap-2">
                  <span className="text-muted-foreground">Duplicate Strategy</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {String(settingsObj.duplicate_strategy).replace(/_/g, " ")}
                  </Badge>
                </div>
              )}
              {Array.isArray(settingsObj.unmapped_columns) && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{(settingsObj.unmapped_columns as string[]).length} unmapped columns stored as metadata</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Row Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold">Import Rows</h2>
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
                <SelectItem value="no">No Review Needed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {rowsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !rowsData?.rows.length ? (
              <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
                <p className="text-sm">No rows match the current filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs w-[70px]">Row #</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Duplicate Reason</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                    <TableHead className="text-xs w-[60px]">Review</TableHead>
                    <TableHead className="text-xs w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsData.rows.map((row) => (
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
                      <TableCell className="text-xs">{row.action_taken || "—"}</TableCell>
                      <TableCell className="text-xs text-destructive truncate max-w-[180px]">
                        {row.error_message || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.review_required && (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">!</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedRow(row)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
      </div>

      {/* Row Detail Sheet */}
      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent className="sm:max-w-lg overflow-auto">
          <SheetHeader>
            <SheetTitle>Row #{selectedRow?.row_number} Details</SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[selectedRow.status] ?? ""}`}>
                  {selectedRow.status}
                </Badge>
                {selectedRow.review_required && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                    Needs Review
                  </Badge>
                )}
              </div>

              {selectedRow.error_message && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {selectedRow.error_message}
                </div>
              )}

              {selectedRow.duplicate_match_reason && (
                <div className="p-3 rounded-md bg-amber-500/10 text-amber-800 text-sm">
                  <strong>Duplicate:</strong> {selectedRow.duplicate_match_reason}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raw Data</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">
                  {JSON.stringify(selectedRow.raw_data, null, 2)}
                </pre>
              </div>

              {selectedRow.normalized_data && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Normalized Data</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[250px]">
                    {JSON.stringify(selectedRow.normalized_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRow.action_taken && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Action Taken</p>
                  <p className="text-sm">{selectedRow.action_taken}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
