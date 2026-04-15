/**
 * AdvancedFilterPanel — Apollo-style filter sidebar
 *
 * Supports nested filter groups, AND/OR logic, include/exclude,
 * saved searches, and all operator types.
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, X,
  ToggleLeft, Copy, Pin,
} from "lucide-react";
import type {
  FilterDefinition,
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "@/lib/advanced-filter-types";
import {
  createEmptyFilterDefinition,
  createEmptyCondition,
  createEmptyGroup,
  genFilterId,
  OPERATORS,
  getOperatorsForType,
} from "@/lib/advanced-filter-types";
import type { FilterFieldMeta } from "@/lib/filter-field-registry";
import { getFieldsForEntity, getCategories, getFieldMeta } from "@/lib/filter-field-registry";
import { countActiveConditions } from "@/lib/advanced-filter-engine";

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["quick"]));
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const fields = getFieldsForEntity(entityType);
  const categories = getCategories(entityType);
  const activeCount = countActiveConditions(value);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // ─── Condition CRUD ────────────────────────────────────────
  const addCondition = () => {
    onChange({
      ...value,
      conditions: [...value.conditions, createEmptyCondition()],
    });
  };

  const updateCondition = (id: string, patch: Partial<FilterCondition>) => {
    onChange({
      ...value,
      conditions: value.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const removeCondition = (id: string) => {
    onChange({
      ...value,
      conditions: value.conditions.filter((c) => c.id !== id),
    });
  };

  // ─── Group CRUD ────────────────────────────────────────────
  const addGroup = () => {
    onChange({
      ...value,
      groups: [...value.groups, createEmptyGroup()],
    });
  };

  const updateGroup = (id: string, patch: Partial<FilterGroup>) => {
    onChange({
      ...value,
      groups: value.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    });
  };

  const removeGroup = (id: string) => {
    onChange({
      ...value,
      groups: value.groups.filter((g) => g.id !== id),
    });
  };

  const addConditionToGroup = (groupId: string) => {
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, createEmptyCondition()] }
          : g
      ),
    });
  };

  const updateConditionInGroup = (groupId: string, condId: string, patch: Partial<FilterCondition>) => {
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.map((c) => (c.id === condId ? { ...c, ...patch } : c)) }
          : g
      ),
    });
  };

  const removeConditionFromGroup = (groupId: string, condId: string) => {
    onChange({
      ...value,
      groups: value.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== condId) }
          : g
      ),
    });
  };

  const handleSave = () => {
    if (saveName.trim() && onSave) {
      onSave(saveName.trim());
      setSaveName("");
      setShowSaveInput(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Filters</span>
          {activeCount > 0 && (
            <Badge variant="default" className="h-5 text-[10px] px-1.5">{activeCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onSave && activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowSaveInput(!showSaveInput)}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          )}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Save input */}
      {showSaveInput && (
        <div className="px-3 py-2 border-b flex gap-2">
          <Input
            className="h-7 text-xs"
            placeholder="Search name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!saveName.trim()}>
            Save
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Top-level logic toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Match</span>
            <Button
              variant={value.logic === "and" ? "default" : "outline"}
              size="sm" className="h-6 text-[10px] px-2"
              onClick={() => onChange({ ...value, logic: "and" })}
            >
              ALL
            </Button>
            <Button
              variant={value.logic === "or" ? "default" : "outline"}
              size="sm" className="h-6 text-[10px] px-2"
              onClick={() => onChange({ ...value, logic: "or" })}
            >
              ANY
            </Button>
            <span className="text-xs text-muted-foreground">conditions</span>
          </div>

          {/* Top-level conditions */}
          {value.conditions.map((cond) => (
            <ConditionRow
              key={cond.id}
              condition={cond}
              fields={fields}
              entityType={entityType}
              onChange={(patch) => updateCondition(cond.id, patch)}
              onRemove={() => removeCondition(cond.id)}
            />
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCondition}>
              <Plus className="h-3 w-3" /> Condition
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addGroup}>
              <Plus className="h-3 w-3" /> Group
            </Button>
          </div>

          {/* Nested groups */}
          {value.groups.map((group) => (
            <GroupBlock
              key={group.id}
              group={group}
              fields={fields}
              entityType={entityType}
              onUpdateGroup={(patch) => updateGroup(group.id, patch)}
              onRemoveGroup={() => removeGroup(group.id)}
              onAddCondition={() => addConditionToGroup(group.id)}
              onUpdateCondition={(condId, patch) => updateConditionInGroup(group.id, condId, patch)}
              onRemoveCondition={(condId) => removeConditionFromGroup(group.id, condId)}
            />
          ))}

          {/* Domain / Website include/exclude */}
          <Separator />
          <ListFilter
            label="Include Domains"
            values={value.includeDomains ?? []}
            onChange={(v) => onChange({ ...value, includeDomains: v })}
            placeholder="e.g. google.com"
          />
          <ListFilter
            label="Exclude Domains"
            values={value.excludeDomains ?? []}
            onChange={(v) => onChange({ ...value, excludeDomains: v })}
            placeholder="e.g. competitor.com"
          />
          <ListFilter
            label="Include Websites"
            values={value.includeWebsites ?? []}
            onChange={(v) => onChange({ ...value, includeWebsites: v })}
            placeholder="e.g. https://example.com"
          />
          <ListFilter
            label="Exclude Websites"
            values={value.excludeWebsites ?? []}
            onChange={(v) => onChange({ ...value, excludeWebsites: v })}
            placeholder="e.g. https://exclude.com"
          />
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Condition Row ──────────────────────────────────────────
function ConditionRow({
  condition,
  fields,
  entityType,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  fields: FilterFieldMeta[];
  entityType: "contact" | "company";
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) {
  const fieldMeta = condition.field ? getFieldMeta(entityType, condition.field) : undefined;
  const operators = fieldMeta ? getOperatorsForType(fieldMeta.type) : [];
  const opMeta = OPERATORS.find((o) => o.value === condition.operator);
  const hasOptions = fieldMeta?.options && fieldMeta.options.length > 0;

  // Group fields by category for the selector
  const categorized = new Map<string, FilterFieldMeta[]>();
  fields.forEach((f) => {
    if (!categorized.has(f.category)) categorized.set(f.category, []);
    categorized.get(f.category)!.push(f);
  });

  return (
    <div className="border rounded-md p-2 space-y-2 bg-muted/30">
      <div className="flex items-center gap-1">
        {/* Include / Exclude toggle */}
        <Button
          variant={condition.conditionType === "include" ? "default" : "destructive"}
          size="sm"
          className="h-6 text-[10px] px-2 min-w-[60px]"
          onClick={() =>
            onChange({ conditionType: condition.conditionType === "include" ? "exclude" : "include" })
          }
        >
          {condition.conditionType === "include" ? "Include" : "Exclude"}
        </Button>

        {/* Field selector */}
        <Select
          value={condition.field || ""}
          onValueChange={(v) => onChange({ field: v, operator: "eq", value: "" })}
        >
          <SelectTrigger className="h-6 text-[10px] flex-1 min-w-[100px]">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Array.from(categorized.entries()).map(([cat, catFields]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                {catFields.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {condition.field && (
        <div className="flex items-center gap-1">
          {/* Operator */}
          <Select
            value={condition.operator}
            onValueChange={(v) => onChange({ operator: v as FilterOperator })}
          >
            <SelectTrigger className="h-6 text-[10px] w-[120px]">
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
                value={String(condition.value ?? "")}
                onValueChange={(v) => onChange({ value: v })}
              >
                <SelectTrigger className="h-6 text-[10px] flex-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {fieldMeta!.options!.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-6 text-[10px] flex-1"
                placeholder="Value..."
                value={String(condition.value ?? "")}
                onChange={(e) => onChange({ value: e.target.value })}
              />
            )
          )}

          {opMeta?.needsTwoValues && (
            <div className="flex gap-1 flex-1">
              <Input
                className="h-6 text-[10px]"
                placeholder="From"
                value={Array.isArray(condition.value) ? String(condition.value[0] ?? "") : ""}
                onChange={(e) => {
                  const cur = Array.isArray(condition.value) ? condition.value : ["", ""];
                  onChange({ value: [e.target.value, cur[1]] as [number, number] });
                }}
              />
              <Input
                className="h-6 text-[10px]"
                placeholder="To"
                value={Array.isArray(condition.value) ? String(condition.value[1] ?? "") : ""}
                onChange={(e) => {
                  const cur = Array.isArray(condition.value) ? condition.value : ["", ""];
                  onChange({ value: [cur[0], e.target.value] as [number, number] });
                }}
              />
            </div>
          )}

          {opMeta?.needsMultiValue && (
            <Input
              className="h-6 text-[10px] flex-1"
              placeholder="val1, val2, val3"
              value={Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value ?? "")}
              onChange={(e) =>
                onChange({
                  value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Group Block ────────────────────────────────────────────
function GroupBlock({
  group,
  fields,
  entityType,
  onUpdateGroup,
  onRemoveGroup,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}: {
  group: FilterGroup;
  fields: FilterFieldMeta[];
  entityType: "contact" | "company";
  onUpdateGroup: (patch: Partial<FilterGroup>) => void;
  onRemoveGroup: () => void;
  onAddCondition: () => void;
  onUpdateCondition: (condId: string, patch: Partial<FilterCondition>) => void;
  onRemoveCondition: (condId: string) => void;
}) {
  return (
    <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-2 space-y-2 bg-muted/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase">Group</span>
          <Button
            variant={group.logic === "and" ? "default" : "outline"}
            size="sm" className="h-5 text-[10px] px-1.5"
            onClick={() => onUpdateGroup({ logic: "and" })}
          >
            AND
          </Button>
          <Button
            variant={group.logic === "or" ? "default" : "outline"}
            size="sm" className="h-5 text-[10px] px-1.5"
            onClick={() => onUpdateGroup({ logic: "or" })}
          >
            OR
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onRemoveGroup}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {group.conditions.map((cond) => (
        <ConditionRow
          key={cond.id}
          condition={cond}
          fields={fields}
          entityType={entityType}
          onChange={(patch) => onUpdateCondition(cond.id, patch)}
          onRemove={() => onRemoveCondition(cond.id)}
        />
      ))}

      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={onAddCondition}>
        <Plus className="h-3 w-3" /> Add condition
      </Button>
    </div>
  );
}

// ─── List Filter (domains, websites) ─────────────────────────
function ListFilter({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      <div className="flex gap-1">
        <Input
          className="h-6 text-[10px] flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={add} disabled={!input.trim()}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="text-[10px] cursor-pointer gap-1 hover:bg-destructive/10"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              {v}
              <X className="h-2 w-2" />
            </Badge>
          ))}
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
        <Badge key={c.id} variant="secondary" className="text-[10px] gap-1">
          {c.conditionType === "exclude" && <span className="text-destructive">NOT</span>}
          {meta?.label ?? c.field} {opLabel}{" "}
          {c.value !== undefined && c.value !== "" && (
            <span className="font-medium">{Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}</span>
          )}
        </Badge>
      );
    });

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {conditionBadges}
      {definition.groups.length > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{definition.groups.length} group{definition.groups.length > 1 ? "s" : ""}
        </Badge>
      )}
      {(definition.includeDomains?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px]">Domains: +{definition.includeDomains!.length}</Badge>
      )}
      {(definition.excludeDomains?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px]">Excluded domains: {definition.excludeDomains!.length}</Badge>
      )}
      <Badge
        variant="outline"
        className="text-[10px] cursor-pointer hover:bg-muted"
        onClick={onClear}
      >
        Clear all ({count})
      </Badge>
    </div>
  );
}
