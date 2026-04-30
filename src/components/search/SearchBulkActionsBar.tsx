/**
 * SearchBulkActionsBar — Bulk action toolbar for Prospect Search.
 * Now wired to real DB actions via AddToListDialog, BulkTagsDialog, EnrollContactsDialog.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListPlus, Tags, Download, Megaphone, X, CheckCheck, Info } from "lucide-react";
import { ExportDialog } from "@/components/export/ExportDialog";
import { AddToListDialog } from "@/components/lists/AddToListDialog";
import { BulkTagsDialog } from "@/components/contacts/BulkTagsDialog";
import { EnrollContactsDialog } from "@/components/contacts/EnrollContactsDialog";

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
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  if (selectedCount === 0) return null;

  const showSelectAllPrompt = !selectAllMode && totalCount && totalCount > selectedCount;
  // Bulk add-to-list / tags / enroll only operate on materialized IDs (not the
  // virtual select-all-across-pages set, since enrolling 1M leads needs a server job).
  const idActionsDisabled = !!selectAllMode;

  return (
    <>
      <div className="space-y-2">
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
            {entityType === "contact" && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddToListOpen(true)} disabled={idActionsDisabled}>
                <ListPlus className="h-3 w-3" /> Add to List
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setTagsOpen(true)} disabled={idActionsDisabled}>
              <Tags className="h-3 w-3" /> Tags
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setExportOpen(true)}>
              <Download className="h-3 w-3" /> Export
            </Button>
            {entityType === "contact" && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEnrollOpen(true)} disabled={idActionsDisabled}>
                <Megaphone className="h-3 w-3" /> Campaign
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={onClear}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        </div>

        {selectAllMode && totalCount && (
          <Alert className="bg-accent/50 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              You are selecting <strong>all {totalCount.toLocaleString()} results</strong> across every page. Export works on the full set; list/tag/campaign actions require selecting individual rows.
            </AlertDescription>
          </Alert>
        )}
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

      {entityType === "contact" && (
        <AddToListDialog
          open={addToListOpen}
          onOpenChange={setAddToListOpen}
          contactIds={selectedIds}
          onSuccess={onClear}
        />
      )}

      <BulkTagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        entityIds={selectedIds}
        entityType={entityType}
        workspaceId={workspaceId}
        onSuccess={onClear}
      />

      {entityType === "contact" && (
        <EnrollContactsDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          contactIds={selectedIds}
          workspaceId={workspaceId}
          onSuccess={onClear}
        />
      )}
    </>
  );
}
