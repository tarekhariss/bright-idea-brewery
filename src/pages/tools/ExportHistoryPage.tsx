import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { useExportJobs } from "@/hooks/use-exports";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

export default function ExportHistoryPage() {
  const { jobs, isLoading } = useExportJobs();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export History</h1>
        <p className="text-sm text-muted-foreground">View past exports and download files</p>
      </div>

      {/* Summary cards */}
      {jobs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Exports", value: jobs.length, color: "text-foreground" },
            { label: "Completed", value: jobs.filter((j) => j.status === "completed").length, color: "text-emerald-600" },
            { label: "Processing", value: jobs.filter((j) => j.status === "processing").length, color: "text-primary" },
            { label: "Failed", value: jobs.filter((j) => j.status === "failed").length, color: "text-destructive" },
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

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : !jobs?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Download className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No exports yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Export contacts or companies from the Prospect Search page or any list.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">File</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Entity</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Rows</TableHead>
                  <TableHead className="font-semibold text-right">Columns</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const Icon = STATUS_ICONS[job.status] ?? Clock;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[200px]">{job.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {job.export_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{job.entity_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs gap-1 ${STATUS_STYLES[job.status] ?? ""}`}>
                          <Icon className={`h-3 w-3 ${job.status === "processing" ? "animate-spin" : ""}`} />
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {job.processed_rows.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {job.selected_columns?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(job.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {job.status === "completed" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
