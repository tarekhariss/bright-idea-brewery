/**
 * SearchBulkActionsBar — Bulk action toolbar for Prospect Search.
 * Supports "select all across pages" and per-company limits.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPlus, ListMinus, Tags, Download, Megaphone, X, CheckCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ExportDialog } from "@/components/export/ExportDialog";

interface SearchBulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  entityType: "contact" | "company";
  workspaceId: string;
  onClear: () => void;
  totalCount?: number;
  selectAllMode?: boolean;
  onSelectAll?: () => void;
}

export function SearchBulkActionsBar({
  selectedCount, selectedIds, entityType, workspaceId, onClear,
  totalCount, selectAllMode, onSelectAll,
}: SearchBulkActionsBarProps) {
  const [exportOpen, setExportOpen] = useState(false);

  if (selectedCount === 0) return null;

  const notify = (action: string) => {
    toast({ title: `${action}`, description: `${selectedCount} ${entityType}(s) selected. Feature coming soon.` });
  };

  const showSelectAllPrompt = !selectAllMode && totalCount && totalCount > selectedCount;

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border rounded-lg animate-fade-in flex-wrap">
        <Badge variant="default" className="text-xs">
          {selectAllMode ? `All ${totalCount?.toLocaleString()}` : selectedCount.toLocaleString()} selected
        </Badge>

        {showSelectAllPrompt && onSelectAll && (
          <Button variant="link" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={onSelectAll}>
            <CheckCheck className="h-3 w-3" /> Select all {totalCount?.toLocaleString()} results
          </Button>
        )}

        <div className="flex items-center gap-1 ml-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => notify("Add to list")}>
            <ListPlus className="h-3 w-3" /> Add to List
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => notify("Remove from list")}>
            <ListMinus className="h-3 w-3" /> Remove
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => notify("Assign tags")}>
            <Tags className="h-3 w-3" /> Tags
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setExportOpen(true)}>
            <Download className="h-3 w-3" /> Export
          </Button>
          {entityType === "contact" && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => notify("Enroll in campaign")}>
              <Megaphone className="h-3 w-3" /> Campaign
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={onClear}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        entityType={entityType}
        workspaceId={workspaceId}
        exportType={selectAllMode ? "filtered" : "selected"}
        selectedIds={selectAllMode ? undefined : selectedIds}
        totalCount={selectAllMode ? totalCount : selectedIds.length}
      />
    </>
  );
}
