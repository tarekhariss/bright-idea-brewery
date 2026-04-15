/**
 * AdvancedFilterPanel — Apollo-style filter workspace
 *
 * Multi-column category-grouped layout with expandable filter rows,
 * pinned filters, search-within-filters, and dense premium feel.
 */
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, X, Save, ChevronDown, ChevronRight, Pin, GripVertical,
  User, Building2, Mail, MapPin, Tag, Activity, BarChart3, Shield,
  Briefcase, Phone, Globe, Zap, DollarSign, Calendar, Users,
} from "lucide-react";
import type {
  FilterDefinition,
  FilterCondition,
  FilterOperator,
} from "@/lib/advanced-filter-types";
import {
  createEmptyFilterDefinition,
  createEmptyCondition,
  genFilterId,
  OPERATORS,
  getOperatorsForType,
} from "@/lib/advanced-filter-types";
import type { FilterFieldMeta } from "@/lib/filter-field-registry";
import {
  getFieldsForEntity,
  getCategories,
  getFieldMeta,
  getPinnedFilters,
} from "@/lib/filter-field-registry";
import { countActiveConditions } from "@/lib/advanced-filter-engine";
import { cn } from "@/lib/utils";

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Person Info": <User className="h-3.5 w-3.5" />,
  "Contact Details": <Phone className="h-3.5 w-3.5" />,
  "Company Info": <Building2 className="h-3.5 w-3.5" />,
  "Email Status": <Mail className="h-3.5 w-3.5" />,
  "Lifecycle & Outreach": <Activity className="h-3.5 w-3.5" />,
  "Location": <MapPin className="h-3.5 w-3.5" />,
  "Firmographic": <BarChart3 className="h-3.5 w-3.5" />,
  "Funding": <DollarSign className="h-3.5 w-3.5" />,
  "Tech & Signals": <Zap className="h-3.5 w-3.5" />,
  "Created Source": <Tag className="h-3.5 w-3.5" />,
  "Scores": <Shield className="h-3.5 w-3.5" />,
  "Ownership": <Users className="h-3.5 w-3.5" />,
};

interface AdvancedFilterPanelProps {
  entityType: "contact" | "company";
  value: FilterDefinition;
  onChange: (def: FilterDefinition) => void;
  onSave?: (name: string) => void;
  onClear: () => void;
  className?: string;
}

export function AdvancedFilterPanel({
  entityType,
  value,
  onChange,
  onSave,
  onClear,
  className = "",
}: AdvancedFilterPanelProps) {
  const [filterSearch, setFilterSearch] = useState("");
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const fields = getFieldsForEntity(entityType);
  const categories = getCategories(entityType);
  const pinnedKeys = getPinnedFilters(entityType);
  const activeCount = countActiveConditions(value);

  // Get active condition for a field
  const getActiveCondition = useCallback((fieldKey: string): FilterCondition | undefined => {
    return value.conditions.find((c) => c.field === fieldKey);
  }, [value.conditions]);

  // Count active filters per field
  const activeFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    value.conditions.forEach((c) => { if (c.field) keys.add(c.field); });
    return keys;
  }, [value.conditions]);

  // Filter fields by search
  const filteredFields = useMemo(() => {
    if (!filterSearch.trim()) return null; // null = show categories
    const q = filterSearch.toLowerCase();
    return fields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  }, [fields, filterSearch]);

  const toggleFilter = (fieldKey: string) => {
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      next.has(fieldKey) ? next.delete(fieldKey) : next.add(fieldKey);
      return next;
    });
  };

  // Set or update a condition for a field
  const setFieldCondition = (fieldKey: string, patch: Partial<FilterCondition>) => {
    const existing = value.conditions.find((c) => c.field === fieldKey);
    if (existing) {
      onChange({
        ...value,
        conditions: value.conditions.map((c) =>
          c.id === existing.id ? { ...c, ...patch } : c
        ),
      });
    } else {
      const newCond = { ...createEmptyCondition(fieldKey), ...patch, field: fieldKey };
      onChange({ ...value, conditions: [...value.conditions, newCond] });
    }
  };

  const removeFieldCondition = (fieldKey: string) => {
    onChange({
      ...value,
      conditions: value.conditions.filter((c) => c.field !== fieldKey),
    });
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
  };

  const handleSave = () => {
    if (saveName.trim() && onSave) {
      onSave(saveName.trim());
      setSaveName("");
      setShowSaveInput(false);
    }
  };

  // Pinned fields
  const pinnedFields = useMemo(
    () => pinnedKeys.map((k) => fields.find((f) => f.key === k)).filter(Boolean) as FilterFieldMeta[],
    [pinnedKeys, fields]
  );

  // Grouped by category (excluding pinned from their categories to avoid duplication)
  const categorizedFields = useMemo(() => {
    const map = new Map<string, FilterFieldMeta[]>();
    categories.forEach((cat) => {
      const catFields = fields.filter((f) => f.category === cat);
      if (catFields.length > 0) map.set(cat, catFields);
    });
    return map;
  }, [fields, categories]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground tracking-tight">Filters</span>
            {activeCount > 0 && (
              <Badge className="h-[18px] text-[10px] px-1.5 rounded-full bg-primary text-primary-foreground">
                {activeCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {onSave && activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSaveInput(!showSaveInput)}
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )}
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                onClick={onClear}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Save input */}
        {showSaveInput && (
          <div className="flex gap-1.5 mb-2">
            <Input
              className="h-7 text-xs bg-secondary/50 border-border"
              placeholder="Search name..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs px-3" onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </div>
        )}

        {/* Search filters */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-xs bg-secondary/50 border-border placeholder:text-muted-foreground/60"
            placeholder="Search filters..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          {filterSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setFilterSearch("")}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Filter body */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Search results mode */}
          {filteredFields ? (
            <div className="px-1">
              {filteredFields.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No filters match "{filterSearch}"
                </div>
              ) : (
                filteredFields.map((field) => (
                  <FilterRow
                    key={field.key}
                    field={field}
                    isExpanded={expandedFilters.has(field.key)}
                    isActive={activeFieldKeys.has(field.key)}
                    condition={getActiveCondition(field.key)}
                    onToggle={() => toggleFilter(field.key)}
                    onSetCondition={(patch) => setFieldCondition(field.key, patch)}
                    onRemoveCondition={() => removeFieldCondition(field.key)}
                    entityType={entityType}
                  />
                ))
              )}
            </div>
          ) : (
            <>
              {/* Pinned filters */}
              <div className="px-1 pb-1">
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Pinned Filters
                  </span>
                </div>
                {pinnedFields.map((field) => (
                  <FilterRow
                    key={field.key}
                    field={field}
                    isExpanded={expandedFilters.has(field.key)}
                    isActive={activeFieldKeys.has(field.key)}
                    condition={getActiveCondition(field.key)}
                    onToggle={() => toggleFilter(field.key)}
                    onSetCondition={(patch) => setFieldCondition(field.key, patch)}
                    onRemoveCondition={() => removeFieldCondition(field.key)}
                    entityType={entityType}
                    isPinned
                  />
                ))}
              </div>

              <div className="mx-3 border-t border-border" />

              {/* Category groups */}
              {Array.from(categorizedFields.entries()).map(([category, catFields]) => (
                <CategorySection
                  key={category}
                  category={category}
                  fields={catFields}
                  expandedFilters={expandedFilters}
                  activeFieldKeys={activeFieldKeys}
                  getActiveCondition={getActiveCondition}
                  onToggleFilter={toggleFilter}
                  onSetCondition={setFieldCondition}
                  onRemoveCondition={removeFieldCondition}
                  entityType={entityType}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Apply footer */}
      {activeCount > 0 && (
        <div className="px-3 py-2 border-t border-border bg-secondary/30">
          <div className="text-[11px] text-muted-foreground text-center">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────
function CategorySection({
  category,
  fields,
  expandedFilters,
  activeFieldKeys,
  getActiveCondition,
  onToggleFilter,
  onSetCondition,
  onRemoveCondition,
  entityType,
}: {
  category: string;
  fields: FilterFieldMeta[];
  expandedFilters: Set<string>;
  activeFieldKeys: Set<string>;
  getActiveCondition: (key: string) => FilterCondition | undefined;
  onToggleFilter: (key: string) => void;
  onSetCondition: (key: string, patch: Partial<FilterCondition>) => void;
  onRemoveCondition: (key: string) => void;
  entityType: "contact" | "company";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const activeInCategory = fields.filter((f) => activeFieldKeys.has(f.key)).length;
  const icon = CATEGORY_ICONS[category] || <Tag className="h-3.5 w-3.5" />;

  return (
    <div className="px-1">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors rounded-sm"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground tracking-tight flex-1">
          {category}
        </span>
        {activeInCategory > 0 && (
          <Badge variant="secondary" className="h-4 text-[9px] px-1.5 rounded-full bg-primary/10 text-primary border-0">
            {activeInCategory}
          </Badge>
        )}
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="pb-1">
          {fields.map((field) => (
            <FilterRow
              key={field.key}
              field={field}
              isExpanded={expandedFilters.has(field.key)}
              isActive={activeFieldKeys.has(field.key)}
              condition={getActiveCondition(field.key)}
              onToggle={() => onToggleFilter(field.key)}
              onSetCondition={(patch) => onSetCondition(field.key, patch)}
              onRemoveCondition={() => onRemoveCondition(field.key)}
              entityType={entityType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Filter Row ────────────────────────────────────────
function FilterRow({
  field,
  isExpanded,
  isActive,
  condition,
  onToggle,
  onSetCondition,
  onRemoveCondition,
  entityType,
  isPinned = false,
}: {
  field: FilterFieldMeta;
  isExpanded: boolean;
  isActive: boolean;
  condition?: FilterCondition;
  onToggle: () => void;
  onSetCondition: (patch: Partial<FilterCondition>) => void;
  onRemoveCondition: () => void;
  entityType: "contact" | "company";
  isPinned?: boolean;
}) {
  const operators = getOperatorsForType(field.type);
  const currentOp = condition?.operator ?? "eq";
  const opMeta = OPERATORS.find((o) => o.value === currentOp);
  const hasOptions = field.options && field.options.length > 0;

  return (
    <div className="group">
      {/* Row header */}
      <button
        className={cn(
          "w-full flex items-center gap-1.5 px-3 py-[5px] text-left transition-colors rounded-sm",
          "hover:bg-accent/50",
          isActive && "bg-primary/5",
          isExpanded && "bg-accent/30"
        )}
        onClick={onToggle}
      >
        {isPinned && (
          <Pin className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
        )}
        <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className={cn(
          "text-[12px] flex-1 truncate",
          isActive ? "text-foreground font-medium" : "text-foreground/80"
        )}>
          {field.label}
        </span>
        {isActive && (
          <Badge variant="secondary" className="h-4 text-[9px] px-1 rounded bg-primary/10 text-primary border-0 shrink-0">
            ✓
          </Badge>
        )}
        <ChevronDown className={cn(
          "h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </button>

      {/* Expanded filter controls */}
      {isExpanded && (
        <div className="px-3 pb-2 pt-1 ml-4 border-l-2 border-primary/20">
          <div className="space-y-1.5">
            {/* Include / Exclude toggle */}
            <div className="flex items-center gap-1">
              <button
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-sm border transition-colors",
                  (!condition || condition.conditionType === "include")
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground border-border hover:bg-accent"
                )}
                onClick={() => onSetCondition({ conditionType: "include" })}
              >
                Include
              </button>
              <button
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-sm border transition-colors",
                  condition?.conditionType === "exclude"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "text-muted-foreground border-border hover:bg-accent"
                )}
                onClick={() => onSetCondition({ conditionType: "exclude" })}
              >
                Exclude
              </button>
            </div>

            {/* Operator */}
            <Select
              value={currentOp}
              onValueChange={(v) => onSetCondition({ operator: v as FilterOperator })}
            >
              <SelectTrigger className="h-6 text-[11px] w-full bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => {
                  const meta = OPERATORS.find((o) => o.value === op);
                  return (
                    <SelectItem key={op} value={op} className="text-xs">
                      {meta?.label ?? op}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Value input */}
            {opMeta?.needsValue && (
              hasOptions ? (
                <Select
                  value={String(condition?.value ?? "")}
                  onValueChange={(v) => onSetCondition({ value: v })}
                >
                  <SelectTrigger className="h-6 text-[11px] w-full bg-secondary/50 border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options!.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-6 text-[11px] bg-secondary/50 border-border"
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  value={String(condition?.value ?? "")}
                  onChange={(e) => onSetCondition({ value: e.target.value })}
                />
              )
            )}

            {opMeta?.needsTwoValues && (
              <div className="flex gap-1">
                <Input
                  className="h-6 text-[11px] bg-secondary/50 border-border"
                  placeholder="From"
                  value={Array.isArray(condition?.value) ? String(condition.value[0] ?? "") : ""}
                  onChange={(e) => {
                    const cur = Array.isArray(condition?.value) ? condition.value : ["", ""];
                    onSetCondition({ value: [e.target.value, cur[1]] as unknown as [number, number] });
                  }}
                />
                <Input
                  className="h-6 text-[11px] bg-secondary/50 border-border"
                  placeholder="To"
                  value={Array.isArray(condition?.value) ? String(condition.value[1] ?? "") : ""}
                  onChange={(e) => {
                    const cur = Array.isArray(condition?.value) ? condition.value : ["", ""];
                    onSetCondition({ value: [cur[0], e.target.value] as unknown as [number, number] });
                  }}
                />
              </div>
            )}

            {opMeta?.needsMultiValue && (
              <Input
                className="h-6 text-[11px] bg-secondary/50 border-border"
                placeholder="val1, val2, val3"
                value={Array.isArray(condition?.value) ? condition.value.join(", ") : String(condition?.value ?? "")}
                onChange={(e) =>
                  onSetCondition({
                    value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            )}

            {/* Clear this filter */}
            {isActive && (
              <button
                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                onClick={onRemoveCondition}
              >
                Remove filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active Filter Summary Badges ────────────────────────────
export function ActiveAdvancedFilters({
  definition,
  entityType,
  onClear,
}: {
  definition: FilterDefinition;
  entityType: "contact" | "company";
  onClear: () => void;
}) {
  const count = countActiveConditions(definition);
  if (count === 0) return null;

  const conditionBadges = definition.conditions
    .filter((c) => c.field)
    .map((c) => {
      const meta = getFieldMeta(entityType, c.field);
      const opLabel = OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
      return (
        <Badge key={c.id} variant="secondary" className="text-[10px] gap-1 bg-secondary border-border">
          {c.conditionType === "exclude" && <span className="text-destructive font-medium">NOT</span>}
          <span className="text-muted-foreground">{meta?.label ?? c.field}</span>
          <span className="text-foreground/60">{opLabel}</span>
          {c.value !== undefined && c.value !== "" && (
            <span className="font-medium text-foreground">{Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}</span>
          )}
        </Badge>
      );
    });

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {conditionBadges}
      {definition.groups.length > 0 && (
        <Badge variant="outline" className="text-[10px] border-border">
          +{definition.groups.length} group{definition.groups.length > 1 ? "s" : ""}
        </Badge>
      )}
      {(definition.includeDomains?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px] border-border">Domains: +{definition.includeDomains!.length}</Badge>
      )}
      {(definition.excludeDomains?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px] border-border">Excluded: {definition.excludeDomains!.length}</Badge>
      )}
      <Badge
        variant="outline"
        className="text-[10px] cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border-border transition-colors"
        onClick={onClear}
      >
        Clear all ({count})
      </Badge>
    </div>
  );
}
