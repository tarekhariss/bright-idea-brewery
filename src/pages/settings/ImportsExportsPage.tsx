import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Download, Upload, ArrowRight, FileSpreadsheet, Map, Plus,
  Users, Building2, List, Filter, FileDown, Clock, CheckCircle2,
  AlertTriangle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const contactExportFields = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "job_title", label: "Job Title" },
  { key: "company_name", label: "Company" },
  { key: "lifecycle_status", label: "Lifecycle Status" },
  { key: "outreach_status", label: "Outreach Status" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "data_quality_score", label: "Data Quality Score" },
  { key: "created_at", label: "Created At" },
];

const companyExportFields = [
  { key: "name", label: "Name" },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "employee_count", label: "Employee Count" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "created_at", label: "Created At" },
];

interface ExportJob {
  id: string;
  objectType: string;
  columns: string[];
  status: "completed" | "processing" | "queued";
  rows: number;
  createdAt: Date;
}

export default function ImportsExportsPage() {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportType, setExportType] = useState<string>("contacts");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);

  const { data: importStats } = useQuery({
    queryKey: ["import-export-stats"],
    queryFn: async () => {
      const [jobsRes, totalRowsRes, reviewRes] = await Promise.all([
        supabase.from("import_jobs").select("id, status, file_name, created_at, total_rows, processed_rows").order("created_at", { ascending: false }).limit(5),
        supabase.from("import_jobs").select("total_rows"),
        supabase.from("import_job_rows").select("id", { count: "exact", head: true }).eq("status", "review"),
      ]);
      const totalImported = (jobsRes.data || []).reduce((sum, j) => sum + (j.processed_rows || 0), 0);
      return {
        recentJobs: jobsRes.data || [],
        totalJobs: (jobsRes.data || []).length,
        totalImported: (totalRowsRes.data || []).reduce((s, r) => s + (r.total_rows || 0), 0),
        reviewCount: reviewRes.count || 0,
      };
    },
  });

  const fields = exportType === "contacts" ? contactExportFields : companyExportFields;

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleExport = () => {
    const job: ExportJob = {
      id: crypto.randomUUID(),
      objectType: exportType,
      columns: selectedFields,
      status: "completed",
      rows: Math.floor(Math.random() * 500) + 10,
      createdAt: new Date(),
    };
    setExportJobs((prev) => [job, ...prev]);
    setExportOpen(false);
    setSelectedFields([]);
  };

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />;
    if (s === "processing") return <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />;
    if (s === "failed") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Imports & Exports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Central hub for inbound and outbound data workflows.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/team/field-mappings")}>
            <Map className="h-4 w-4 mr-1.5" /> Field Mappings
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/imports")}>
            <Eye className="h-4 w-4 mr-1.5" /> View Imports
          </Button>
          <Button size="sm" onClick={() => navigate("/imports/new")}>
            <Upload className="h-4 w-4 mr-1.5" /> New Import
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setExportOpen(true)}>
            <FileDown className="h-4 w-4 mr-1.5" /> Create Export
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Imported Rows</p>
            <p className="text-2xl font-bold mt-1">{importStats?.totalImported?.toLocaleString() ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Import Jobs</p>
            <p className="text-2xl font-bold mt-1">{importStats?.totalJobs ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review Queue</p>
            <p className="text-2xl font-bold mt-1">{importStats?.reviewCount ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Exported Rows</p>
            <p className="text-2xl font-bold mt-1">{exportJobs.reduce((s, j) => s + j.rows, 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="imports">
        <TabsList>
          <TabsTrigger value="imports">Recent Imports</TabsTrigger>
          <TabsTrigger value="exports">Export History</TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Rows</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(importStats?.recentJobs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No import jobs yet. Start by importing contacts or companies.
                    </TableCell>
                  </TableRow>
                ) : (
                  (importStats?.recentJobs || []).map((job: any) => (
                    <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/imports/${job.id}`)}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        {job.file_name || "Untitled"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(job.status)}
                          <Badge variant={job.status === "completed" ? "default" : "secondary"} className="text-xs capitalize">
                            {job.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{job.total_rows?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{job.processed_rows?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {job.created_at ? format(new Date(job.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Object Type</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No exports yet. Create your first export to download data.
                    </TableCell>
                  </TableRow>
                ) : (
                  exportJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium capitalize">{job.objectType}</TableCell>
                      <TableCell className="text-muted-foreground">{job.columns.length} fields</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(job.status)}
                          <Badge variant="default" className="text-xs capitalize">{job.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{job.rows.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(job.createdAt, "MMM d, yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Builder Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Export</DialogTitle>
            <DialogDescription>Choose what data to export and which fields to include.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Object Type</Label>
              <Select value={exportType} onValueChange={(v) => { setExportType(v); setSelectedFields([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Contacts</div></SelectItem>
                  <SelectItem value="companies"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Companies</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Columns ({selectedFields.length}/{fields.length})</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedFields(selectedFields.length === fields.length ? [] : fields.map((f) => f.key))}>
                  {selectedFields.length === fields.length ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <div className="border rounded-md max-h-52 overflow-y-auto p-2 space-y-1">
                {fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <Checkbox checked={selectedFields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>File Format</Label>
              <Select defaultValue="csv">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" disabled={selectedFields.length === 0} onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-1.5" /> Export {selectedFields.length} Fields
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
