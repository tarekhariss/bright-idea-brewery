import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3 } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface ColumnVisibilityProps {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnVisibility({ columns, visibleColumns, onToggle }: ColumnVisibilityProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Toggle columns</p>
        {columns.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
          >
            <Checkbox
              checked={visibleColumns.has(col.key)}
              onCheckedChange={() => onToggle(col.key)}
            />
            {col.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
