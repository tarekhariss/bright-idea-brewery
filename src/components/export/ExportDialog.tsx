/**
 * ExportDialog — Reusable export dialog for search, lists, etc.
 * Shows estimated row count after per-company limits.
 */
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Save, Info, AlertTriangle } from "lucide-react";
import {
  useCreateExport, useExportTemplates,
  DEFAULT_CONTACT_EXPORT_COLUMNS, DEFAULT_COMPANY_EXPORT_COLUMNS,
  ALL_CONTACT_EXPORT_COLUMNS, ALL_COMPANY_EXPORT_COLUMNS,
  type CreateExportParams,
} from "@/hooks/use-exports";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FilterDefinition } from "@/lib/advanced-filter-types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "contact" | "company";
  workspaceId: string;
  exportType: CreateExportParams["exportType"];
  selectedIds?: string[];
  filterDefinition?: FilterDefinition | null;
  sourceId?: string;
  defaultFileName?: string;
  totalCount?: number;
}

export function ExportDialog({
  open, onOpenChange, entityType, workspaceId,
  exportType, selectedIds, filterDefinition, sourceId, defaultFileName, totalCount,
}: ExportDialogProps) {
  const allColumns = entityType === "contact" ? ALL_CONTACT_EXPORT_COLUMNS : ALL_COMPANY_EXPORT_COLUMNS;
  const defaultColumns = entityType === "contact" ? DEFAULT_CONTACT_EXPORT_COLUMNS : DEFAULT_COMPANY_EXPORT_COLUMNS;

  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns);
  const [fileName, setFileName] = useState(defaultFileName ?? `${entityType}s-export-${new Date().toISOString().slice(0, 10)}.csv`);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [maxPerCompany, setMaxPerCompany] = useState<string>("0");
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const { createExport, creating } = useCreateExport();
  const { templates, saveTemplate } = useExportTemplates(entityType);
  const { user } = useAuth();

  const baseCount = exportType === "selected" && selectedIds
    ? selectedIds.length
    : totalCount ?? 0;

  const perCompanyLimit = parseInt(maxPerCompany, 10);
  const hasPerCompanyLimit = perCompanyLimit > 0 && entityType === "contact";

  // Estimate row count when per-company limit changes
  useEffect(() => {
    if (!open || !hasPerCompanyLimit || baseCount === 0) {
      setEstimatedCount(null);
      return;
    }

    let cancelled = false;
    const estimate = async () => {
      setEstimating(true);
      try {
        // Fetch company_name_raw for the selection to estimate filtered count
        let query = (supabase.from("contacts") as any)
          .select("company_name_raw")
          .limit(50000);

        if (workspaceId && workspaceId.trim()) {
          query = query.eq("workspace_id", workspaceId);
        } else if (user) {
          query = query.is("workspace_id", null).eq("created_by", user.id);
        }

        if (exportType === "selected" && selectedIds?.length) {
          query = query.in("id", selectedIds);
        }

        const { data } = await query;
        if (cancelled || !data) return;

        const companyCounts: Record<string, number> = {};
        let kept = 0;
        for (const row of data) {
          const key = (row.company_name_raw || "__no_company__").toLowerCase();
          companyCounts[key] = (companyCounts[key] || 0) + 1;
          if (companyCounts[key] <= perCompanyLimit) kept++;
        }
        if (!cancelled) setEstimatedCount(kept);
      } catch {
        if (!cancelled) setEstimatedCount(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    };

    estimate();
    return () => { cancelled = true; };
  }, [open, hasPerCompanyLimit, perCompanyLimit, baseCount, exportType, selectedIds, workspaceId, user]);

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const selectAll = () => setSelectedColumns([...allColumns]);
  const selectNone = () => setSelectedColumns([]);

  const applyTemplate = (tplId: string) => {
    setTemplateId(tplId);
    const tpl = templates?.find((t) => t.id === tplId);
    if (tpl) setSelectedColumns(tpl.columns);
  };

  const handleExport = async () => {
    const limit = parseInt(maxPerCompany, 10);
    await createExport({
      workspaceId,
      entityType,
      exportType,
      fileName,
      selectedColumns,
      filterDefinition,
      selectedIds,
      templateId: templateId ?? undefined,
      sourceId,
      maxPerCompany: limit > 0 ? limit : null,
    });
    onOpenChange(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await saveTemplate(templateName, selectedColumns, workspaceId);
      setTemplateName("");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Group columns for display
  const groupedColumns = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const col of allColumns) {
      let group = "Other";
      if (["first_name", "last_name", "email", "secondary_email", "tertiary_email", "personal_email", "job_title", "seniority_level", "department", "headline", "bio", "persona"].includes(col)) group = "Identity";
      else if (col.includes("phone")) group = "Phone";
      else if (["country", "city", "state", "address", "postal_code", "timezone", "headquarters"].includes(col)) group = "Location";
      else if (["linkedin_url", "twitter_url", "facebook_url", "github_url", "photo_url", "website"].includes(col)) group = "Social";
      else if (["name", "domain", "industry", "employee_count", "employee_range", "revenue_range", "annual_revenue", "total_funding", "latest_funding", "latest_funding_amount", "funding_stage", "founded_year", "company_type", "company_name_raw"].includes(col)) group = "Company";
      else if (["technologies", "keywords", "specialties", "market_segments", "territories", "sic_code", "naics_code", "stock_ticker", "headcount_growth_pct"].includes(col)) group = "Firmographic";
      (groups[group] ??= []).push(col);
    }
    return groups;
  }, [allColumns]);

  // Final count to display
  const finalCount = hasPerCompanyLimit && estimatedCount !== null
    ? estimatedCount
    : baseCount;
  const reducedByLimit = hasPerCompanyLimit && estimatedCount !== null && estimatedCount < baseCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export {entityType === "contact" ? "Contacts" : "Companies"}
          </DialogTitle>
          <DialogDescription>
            {exportType === "selected" && selectedIds
              ? `Exporting ${selectedIds.length.toLocaleString()} selected ${entityType}(s)`
              : `Exporting all ${baseCount.toLocaleString()} matching results across every page`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export summary with final count */}
          <Alert className="bg-muted/50 border-border">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Records to export:</span>
                {estimating ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculating…
                  </span>
                ) : (
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {finalCount.toLocaleString()} rows
                  </Badge>
                )}
              </div>
              {reducedByLimit && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>
                    Reduced from {baseCount.toLocaleString()} to {estimatedCount!.toLocaleString()} by the {perCompanyLimit}-per-company limit
                  </span>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* File name */}
          <div className="space-y-1.5">
            <Label className="text-sm">File Name</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>

          {/* Per-company limit (contacts only) */}
          {entityType === "contact" && (
            <div className="space-y-1.5">
              <Label className="text-sm">Max contacts per company (optional)</Label>
              <Select value={maxPerCompany} onValueChange={setMaxPerCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="No limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No limit</SelectItem>
                  <SelectItem value="1">1 per company</SelectItem>
                  <SelectItem value="2">2 per company</SelectItem>
                  <SelectItem value="3">3 per company</SelectItem>
                  <SelectItem value="5">5 per company</SelectItem>
                  <SelectItem value="10">10 per company</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm">Apply Template</Label>
              <Select value={templateId ?? "__none__"} onValueChange={(v) => v !== "__none__" && applyTemplate(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No template —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.columns.length} cols)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Column picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Columns ({selectedColumns.length} selected)</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectNone}>None</Button>
              </div>
            </div>
            <ScrollArea className="h-[240px] border rounded-md p-3">
              <div className="space-y-4">
                {Object.entries(groupedColumns).map(([group, cols]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {cols.map((col) => (
                        <label key={col} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedColumns.includes(col)}
                            onCheckedChange={() => toggleColumn(col)}
                          />
                          <span className="text-xs capitalize">{col.replace(/_/g, " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Save as template */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Save as template…"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!templateName.trim() || savingTemplate}
              onClick={handleSaveTemplate}
            >
              <Save className="h-3 w-3" /> Save
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={creating || selectedColumns.length === 0} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {creating ? "Exporting…" : `Export ${finalCount.toLocaleString()} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
