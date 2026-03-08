import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "range" | "boolean" | "date_range" | "exists";
  options?: { value: string; label: string }[];
  group?: string;
}

export interface FilterValues {
  [key: string]: string | undefined;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  onSaveAsView?: () => void;
}

export function FilterPanel({ filters, values, onChange, onClear, onSaveAsView }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["default"]));

  const activeCount = Object.values(values).filter((v) => v && v !== "" && v !== "all").length;

  const handleChange = (key: string, value: string) => {
    const next = { ...values, [key]: value === "all" ? undefined : value };
    onChange(next);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  // Group filters
  const groups = new Map<string, FilterConfig[]>();
  filters.forEach((f) => {
    const g = f.group || "default";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  });

  const renderFilter = (filter: FilterConfig) => (
    <div key={filter.key} className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{filter.label}</Label>
      {filter.type === "select" && filter.options && (
        <Select value={values[filter.key] || "all"} onValueChange={(v) => handleChange(filter.key, v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filter.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {filter.type === "text" && (
        <Input className="h-8 text-xs" placeholder={`Filter by ${filter.label.toLowerCase()}...`}
          value={values[filter.key] || ""} onChange={(e) => handleChange(filter.key, e.target.value)} />
      )}
      {filter.type === "boolean" && (
        <Select value={values[filter.key] || "all"} onValueChange={(v) => handleChange(filter.key, v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )}
      {filter.type === "exists" && (
        <Select value={values[filter.key] || "all"} onValueChange={(v) => handleChange(filter.key, v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="exists">Has value</SelectItem>
            <SelectItem value="missing">Is empty</SelectItem>
          </SelectContent>
        </Select>
      )}
      {filter.type === "range" && (
        <div className="flex gap-2">
          <Input className="h-8 text-xs" placeholder="Min" type="number"
            value={values[`${filter.key}_min`] || ""} onChange={(e) => handleChange(`${filter.key}_min`, e.target.value)} />
          <Input className="h-8 text-xs" placeholder="Max" type="number"
            value={values[`${filter.key}_max`] || ""} onChange={(e) => handleChange(`${filter.key}_max`, e.target.value)} />
        </div>
      )}
      {filter.type === "date_range" && (
        <div className="flex gap-2">
          <Input className="h-8 text-xs" type="date" value={values[`${filter.key}_from`] || ""}
            onChange={(e) => handleChange(`${filter.key}_from`, e.target.value)} />
          <Input className="h-8 text-xs" type="date" value={values[`${filter.key}_to`] || ""}
            onChange={(e) => handleChange(`${filter.key}_to`, e.target.value)} />
        </div>
      )}
    </div>
  );

  const groupLabels: Record<string, string> = {
    default: "General",
    status: "Status & Lifecycle",
    contact_info: "Contact Information",
    company: "Company",
    enrichment: "Enrichment & Quality",
    dates: "Dates",
    ownership: "Ownership",
    external: "External IDs",
    firmographic: "Firmographic",
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
      <SheetContent className="w-[340px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Filters</SheetTitle>
            <div className="flex items-center gap-1">
              {onSaveAsView && activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onSaveAsView} className="text-xs text-primary h-7">
                  <Save className="h-3 w-3 mr-1" /> Save as View
                </Button>
              )}
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-muted-foreground h-7">
                  <X className="h-3 w-3 mr-1" /> Clear all
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>
        <Separator className="my-3" />

        <div className="space-y-1">
          {Array.from(groups.entries()).map(([group, groupFilters]) => {
            if (groups.size === 1 && group === "default") {
              return <div key={group} className="space-y-4">{groupFilters.map(renderFilter)}</div>;
            }
            const isExpanded = expandedGroups.has(group);
            const groupActive = groupFilters.some((f) => {
              const v = values[f.key];
              if (v && v !== "" && v !== "all") return true;
              if (f.type === "range") return !!(values[`${f.key}_min`] || values[`${f.key}_max`]);
              if (f.type === "date_range") return !!(values[`${f.key}_from`] || values[`${f.key}_to`]);
              return false;
            });

            return (
              <Collapsible key={group} open={isExpanded} onOpenChange={() => toggleGroup(group)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {groupLabels[group] || group}
                  </span>
                  {groupActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pb-3 pl-1">
                  {groupFilters.map(renderFilter)}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        <Separator className="my-4" />
        <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
          Apply Filters {activeCount > 0 && `(${activeCount})`}
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

  const getSuffix = (key: string) => {
    if (key.endsWith("_min")) return " (min)";
    if (key.endsWith("_max")) return " (max)";
    if (key.endsWith("_from")) return " (from)";
    if (key.endsWith("_to")) return " (to)";
    return "";
  };

  const getDisplayValue = (key: string, value: string) => {
    if (value === "exists") return "has value";
    if (value === "missing") return "is empty";
    if (value === "true") return "yes";
    if (value === "false") return "no";
    return value;
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(([key, value]) => (
        <Badge key={key} variant="secondary" className="text-[11px] gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
          onClick={() => onRemove(key)}>
          {getLabel(key)}{getSuffix(key)}: {getDisplayValue(key, value!)}
          <X className="h-2.5 w-2.5" />
        </Badge>
      ))}
      {active.length > 2 && (
        <Badge variant="outline" className="text-[11px] cursor-pointer hover:bg-muted" onClick={() => active.forEach(([k]) => onRemove(k))}>
          Clear all ({active.length})
        </Badge>
      )}
    </div>
  );
}
