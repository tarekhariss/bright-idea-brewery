/**
 * SearchBulkActionsBar — Bulk action toolbar for Prospect Search.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPlus, ListMinus, Tags, Download, Megaphone, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SearchBulkActionsBarProps {
  selectedCount: number;
  entityType: "contact" | "company";
  onClear: () => void;
}

export function SearchBulkActionsBar({ selectedCount, entityType, onClear }: SearchBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  const notify = (action: string) => {
    toast({ title: `${action}`, description: `${selectedCount} ${entityType}(s) selected. Feature coming soon.` });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border rounded-lg animate-fade-in">
      <Badge variant="default" className="text-xs">{selectedCount} selected</Badge>
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
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => notify("Export")}>
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
  );
}
