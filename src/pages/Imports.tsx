import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Upload, Search, FileSpreadsheet, Plus, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { ImportStatus } from "@/integrations/supabase/db-types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  mapping: "bg-blue-500/10 text-blue-600 border-blue-200",
  validating: "bg-amber-500/10 text-amber-600 border-amber-200",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ImportsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<"created_at" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["import-jobs", search, statusFilter, sortField, sortDir],
    queryFn: async () => {
      let query = (supabase
        .from("import_jobs") as any)
        .select("*")
        .order(sortField, { ascending: sortDir === "asc" })
        .limit(50);

      if (search) query = query.ilike("file_name", `%${search}%`);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const summary = jobs
    ? {
        total: jobs.length,
        completed: jobs.filter((j) => j.status === "completed").length,
        processing: jobs.filter((j) => ["processing", "validating", "mapping"].includes(j.status)).length,
        failed: jobs.filter((j) => j.status === "failed").length,
      }
    : null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import Center</h1>
          <p className="text-sm text-muted-foreground">Upload, map, and process CSV datasets</p>
        </div>
        <Button onClick={() => navigate("/imports/new")} className="gap-2">
          <Plus className="h-4 w-4" /> New Import
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Jobs", value: summary.total, color: "text-foreground" },
            { label: "Completed", value: summary.completed, color: "text-emerald-600" },
            { label: "In Progress", value: summary.processing, color: "text-primary" },
            { label: "Failed", value: summary.failed, color: "text-destructive" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["pending", "mapping", "validating", "processing", "completed", "failed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-0">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-5 w-[80px] rounded-full" />
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !jobs?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No import jobs yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Start by uploading a CSV file to import contacts into your database.
            </p>
            <Button onClick={() => navigate("/imports/new")} className="mt-6 gap-2">
              <Upload className="h-4 w-4" /> Start First Import
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">File</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">Success</TableHead>
                  <TableHead className="font-semibold text-right">Errors</TableHead>
                  <TableHead className="font-semibold text-right">Duplicates</TableHead>
                  <TableHead className="font-semibold text-right">Review</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/imports/${job.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate max-w-[220px]">{job.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[job.status] ?? ""}`}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{job.total_rows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-600">{job.success_rows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">{job.error_rows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-amber-600">{job.duplicate_rows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">{job.review_rows.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(job.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
