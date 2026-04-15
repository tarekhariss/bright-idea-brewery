import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GitMerge, Users, Building2, AlertTriangle, CheckCircle2,
  XCircle, Eye, Loader2, ScanSearch, SkipForward, Shield,
} from "lucide-react";
import {
  useDuplicateGroups, useDuplicateCandidates, useDuplicateScan,
  useMergeRecords, useMergeHistory,
  type DuplicateGroup,
} from "@/hooks/use-deduplication";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  reviewing: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  dismissed: "bg-muted text-muted-foreground",
};

const MERGE_FIELDS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "secondary_email", label: "Secondary Email" },
  { key: "job_title", label: "Job Title" },
  { key: "department", label: "Department" },
  { key: "seniority_level", label: "Seniority" },
  { key: "company_name_raw", label: "Company" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "phone", label: "Phone" },
  { key: "mobile_phone", label: "Mobile Phone" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "headline", label: "Headline" },
  { key: "persona", label: "Persona" },
];

export default function DuplicateReviewPage() {
  const [entityType, setEntityType] = useState<"contact" | "company">("contact");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);

  const { groups, isLoading } = useDuplicateGroups(entityType, statusFilter);
  const { scanContacts, scanning } = useDuplicateScan();
  const { history } = useMergeHistory();

  const pendingCount = groups?.filter((g) => g.status === "pending").length ?? 0;
  const resolvedCount = groups?.filter((g) => g.status === "resolved").length ?? 0;

  const handleScan = async () => {
    // We need a workspace_id — get from first contact
    const { data } = await supabase.from("contacts").select("workspace_id").limit(1).single();
    if (data?.workspace_id) {
      await scanContacts(data.workspace_id);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplicate Review</h1>
          <p className="text-sm text-muted-foreground">Find and merge duplicate records to keep your database clean</p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-2">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {scanning ? "Scanning…" : "Run Duplicate Scan"}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Groups</p>
            <p className="text-2xl font-bold mt-1">{groups?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Resolved</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{resolvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Merges Performed</p>
            <p className="text-2xl font-bold mt-1 text-primary">{history?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Tabs value={entityType} onValueChange={(v) => setEntityType(v as "contact" | "company")}>
          <TabsList>
            <TabsTrigger value="contact" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Companies
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Groups Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : !groups?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No duplicate groups</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Run a duplicate scan to detect potential duplicates in your database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Match Rules</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Records</TableHead>
                  <TableHead className="font-semibold text-right">Confidence</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.match_rules.map((rule) => (
                          <Badge key={rule} variant="outline" className="text-xs capitalize">
                            {rule.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[group.status] ?? ""}`}>
                        {group.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{group.record_count}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          group.confidence_score >= 90
                            ? "bg-destructive/10 text-destructive"
                            : group.confidence_score >= 70
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {group.confidence_score}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(group.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSelectedGroup(group)}
                      >
                        <Eye className="h-3 w-3" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Merge Sheet */}
      {selectedGroup && (
        <MergeSheet
          group={selectedGroup}
          open={!!selectedGroup}
          onOpenChange={(open) => !open && setSelectedGroup(null)}
        />
      )}
    </div>
  );
}

// ─── Merge Sheet ────────────────────────────────────────────────────────────────

function MergeSheet({ group, open, onOpenChange }: {
  group: DuplicateGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { candidates, isLoading: loadingCandidates } = useDuplicateCandidates(group.id);
  const { mergeContacts, merging } = useMergeRecords();
  const [survivingId, setSurvivingId] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});

  // Load actual contact records for candidates
  const recordIds = candidates?.map((c) => c.record_id) ?? [];
  const { data: records, isLoading: loadingRecords } = useQuery({
    queryKey: ["merge-records", recordIds.join(",")],
    queryFn: async () => {
      if (recordIds.length === 0) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .in("id", recordIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: recordIds.length > 0,
  });

  const effectiveSurviving = survivingId ?? group.primary_record_id ?? recordIds[0];
  const mergedIds = recordIds.filter((id) => id !== effectiveSurviving);

  const handleMerge = async () => {
    if (!effectiveSurviving || mergedIds.length === 0) return;
    await mergeContacts(group.workspace_id, effectiveSurviving, mergedIds, fieldSelections, group.id);
    onOpenChange(false);
  };

  const handleDismiss = async () => {
    await (supabase.from("duplicate_groups") as any)
      .update({ status: "dismissed" })
      .eq("id", group.id);
    onOpenChange(false);
  };

  const isLoading = loadingCandidates || loadingRecords;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Merge Duplicate Group
          </SheetTitle>
          <SheetDescription>
            {group.match_rules.join(", ").replace(/_/g, " ")} · {group.record_count} records · {group.confidence_score}% confidence
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : records && records.length > 0 ? (
            <>
              {/* Primary record selection */}
              <div>
                <p className="text-sm font-semibold mb-2">Choose Surviving Record</p>
                <RadioGroup
                  value={effectiveSurviving}
                  onValueChange={setSurvivingId}
                  className="space-y-2"
                >
                  {records.map((record: any) => (
                    <label
                      key={record.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        effectiveSurviving === record.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <RadioGroupItem value={record.id} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {record.first_name} {record.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.email} · {record.job_title ?? "No title"} · {record.company_name_raw ?? "No company"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Quality: {record.data_quality_score ?? 0}/100 · ID: {record.id.slice(0, 8)}…
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              {/* Field-by-field comparison */}
              <div>
                <p className="text-sm font-semibold mb-3">Field Comparison — choose source for each field</p>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1">
                    <div className={`grid gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground`}
                      style={{ gridTemplateColumns: `140px repeat(${records.length}, 1fr)` }}
                    >
                      <span>Field</span>
                      {records.map((r: any) => (
                        <span key={r.id} className="truncate">
                          {r.first_name} {r.last_name}
                          {r.id === effectiveSurviving && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">Primary</Badge>
                          )}
                        </span>
                      ))}
                    </div>
                    <Separator />
                    {MERGE_FIELDS.map((f) => {
                      const values = records.map((r: any) => ({ id: r.id, val: r[f.key] }));
                      const hasConflict = new Set(values.map((v) => String(v.val ?? "").toLowerCase())).size > 1;

                      return (
                        <div
                          key={f.key}
                          className={`grid gap-2 px-3 py-2 rounded text-sm items-center ${hasConflict ? "bg-amber-500/5" : ""}`}
                          style={{ gridTemplateColumns: `140px repeat(${records.length}, 1fr)` }}
                        >
                          <span className="text-muted-foreground text-xs font-medium">{f.label}</span>
                          {values.map((v) => (
                            <button
                              key={v.id}
                              className={`text-xs text-left truncate px-2 py-1 rounded transition-colors ${
                                (fieldSelections[f.key] ?? effectiveSurviving) === v.id
                                  ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => setFieldSelections((prev) => ({ ...prev, [f.key]: v.id }))}
                            >
                              {v.val || "—"}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleDismiss}>
                  <SkipForward className="h-4 w-4" /> Dismiss
                </Button>
                <Button className="flex-1 gap-2" onClick={handleMerge} disabled={merging}>
                  {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                  {merging ? "Merging…" : `Merge ${mergedIds.length} → 1`}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No records found for this group.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
