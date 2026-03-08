import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "range" | "boolean" | "date_range";
  options?: { value: string; label: string }[];
}

export interface FilterValues {
  [key: string]: string | undefined;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
}

export function FilterPanel({ filters, values, onChange, onClear }: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(values).filter((v) => v && v !== "" && v !== "all").length;

  const handleChange = (key: string, value: string) => {
    const next = { ...values, [key]: value === "all" ? undefined : value };
    onChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs relative">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[380px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Filters</SheetTitle>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-muted-foreground h-7">
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>
        <Separator className="my-3" />
        <div className="space-y-4">
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{filter.label}</Label>
              {filter.type === "select" && filter.options && (
                <Select
                  value={values[filter.key] || "all"}
                  onValueChange={(v) => handleChange(filter.key, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {filter.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filter.type === "text" && (
                <Input
                  className="h-8 text-xs"
                  placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                  value={values[filter.key] || ""}
                  onChange={(e) => handleChange(filter.key, e.target.value)}
                />
              )}
              {filter.type === "boolean" && (
                <Select
                  value={values[filter.key] || "all"}
                  onValueChange={(v) => handleChange(filter.key, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {filter.type === "range" && (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Min"
                    type="number"
                    value={values[`${filter.key}_min`] || ""}
                    onChange={(e) => handleChange(`${filter.key}_min`, e.target.value)}
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Max"
                    type="number"
                    value={values[`${filter.key}_max`] || ""}
                    onChange={(e) => handleChange(`${filter.key}_max`, e.target.value)}
                  />
                </div>
              )}
              {filter.type === "date_range" && (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs"
                    type="date"
                    value={values[`${filter.key}_from`] || ""}
                    onChange={(e) => handleChange(`${filter.key}_from`, e.target.value)}
                  />
                  <Input
                    className="h-8 text-xs"
                    type="date"
                    value={values[`${filter.key}_to`] || ""}
                    onChange={(e) => handleChange(`${filter.key}_to`, e.target.value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
          Apply Filters
        </Button>
      </SheetContent>
    </Sheet>
  );
}

export function ActiveFilters({ values, filters, onRemove }: { values: FilterValues; filters: FilterConfig[]; onRemove: (key: string) => void }) {
  const active = Object.entries(values).filter(([_, v]) => v && v !== "" && v !== "all");
  if (active.length === 0) return null;

  const getLabel = (key: string) => {
    const clean = key.replace(/_min$|_max$|_from$|_to$/, "");
    return filters.find((f) => f.key === clean)?.label || key;
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(([key, value]) => (
        <Badge
          key={key}
          variant="secondary"
          className="text-[11px] gap-1 cursor-pointer hover:bg-secondary/80"
          onClick={() => onRemove(key)}
        >
          {getLabel(key)}: {value}
          <X className="h-2.5 w-2.5" />
        </Badge>
      ))}
    </div>
  );
}
