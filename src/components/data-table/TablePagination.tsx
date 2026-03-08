import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  selectedCount?: number;
}

export function TablePagination({
  page, totalPages, totalRows, pageSize, onPageChange, onPageSizeChange, selectedCount,
}: TablePaginationProps) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalRows);

  return (
    <div className="flex items-center justify-between border-t px-4 py-2.5 bg-card">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {selectedCount && selectedCount > 0 ? (
          <span className="font-medium text-foreground">{selectedCount} selected</span>
        ) : null}
        <span>
          {totalRows > 0 ? `${from.toLocaleString()}–${to.toLocaleString()} of ${totalRows.toLocaleString()}` : "0 results"}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[60px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(0)} disabled={page === 0}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2 tabular-nums">
          {totalPages > 0 ? `${page + 1} / ${totalPages}` : "—"}
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
