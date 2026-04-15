/**
 * ExportDialog — Reusable export dialog for search, lists, etc.
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Save } from "lucide-react";
import {
  useCreateExport, useExportTemplates,
  DEFAULT_CONTACT_EXPORT_COLUMNS, DEFAULT_COMPANY_EXPORT_COLUMNS,
  ALL_CONTACT_EXPORT_COLUMNS, ALL_COMPANY_EXPORT_COLUMNS,
  type CreateExportParams,
} from "@/hooks/use-exports";
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
}

export function ExportDialog({
  open, onOpenChange, entityType, workspaceId,
  exportType, selectedIds, filterDefinition, sourceId, defaultFileName,
}: ExportDialogProps) {
  const allColumns = entityType === "contact" ? ALL_CONTACT_EXPORT_COLUMNS : ALL_COMPANY_EXPORT_COLUMNS;
  const defaultColumns = entityType === "contact" ? DEFAULT_CONTACT_EXPORT_COLUMNS : DEFAULT_COMPANY_EXPORT_COLUMNS;

  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns);
  const [fileName, setFileName] = useState(defaultFileName ?? `${entityType}s-export-${new Date().toISOString().slice(0, 10)}.csv`);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const { createExport, creating } = useCreateExport();
  const { templates, saveTemplate } = useExportTemplates(entityType);

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
              ? `Export ${selectedIds.length} selected ${entityType}(s)`
              : `Export ${exportType} results`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File name */}
          <div className="space-y-1.5">
            <Label className="text-sm">File Name</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>

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
            <ScrollArea className="h-[280px] border rounded-md p-3">
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
            {creating ? "Exporting…" : "Export CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
