/**
 * Advanced Filter Engine — Type Definitions
 *
 * Supports nested filter groups with AND/OR logic,
 * include/exclude conditions, and a wide range of operators.
 * Used by: Prospect Search, Saved Searches, Dynamic Lists, Exports, Campaign Targeting.
 */

// ─── Operators ───────────────────────────────────────────────
export type FilterOperator =
  | "eq"        // equals
  | "neq"       // not equals
  | "contains"  // ILIKE %val%
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"        // value in list
  | "not_in"
  | "gt"        // greater than
  | "gte"       // >=
  | "lt"        // less than
  | "lte"       // <=
  | "between"   // two-value range
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false";

// ─── Single condition ────────────────────────────────────────
export interface FilterCondition {
  id: string;
  field: string;           // column name or dot-path (e.g. "company.industry")
  operator: FilterOperator;
  value?: string | number | boolean | string[] | [number, number];
  conditionType: "include" | "exclude";
}

// ─── Group of conditions with AND/OR logic ───────────────────
export interface FilterGroup {
  id: string;
  logic: "and" | "or";
  conditions: FilterCondition[];
  groups: FilterGroup[];  // nested sub-groups
}

// ─── Root filter definition (stored in saved_searches.filter_definition)
export interface FilterDefinition {
  logic: "and" | "or";
  groups: FilterGroup[];
  /** Top-level quick conditions (no nesting) */
  conditions: FilterCondition[];
  /** List include/exclude */
  includeLists?: string[];
  excludeLists?: string[];
  /** Domain include/exclude */
  includeDomains?: string[];
  excludeDomains?: string[];
  /** Website include/exclude */
  includeWebsites?: string[];
  excludeWebsites?: string[];
}

// ─── Operator metadata (for UI rendering) ────────────────────
export interface OperatorMeta {
  value: FilterOperator;
  label: string;
  needsValue: boolean;
  needsTwoValues: boolean;
  needsMultiValue: boolean;
}

export const OPERATORS: OperatorMeta[] = [
  { value: "eq", label: "Equals", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "neq", label: "Not equals", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "contains", label: "Contains", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "not_contains", label: "Not contains", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "starts_with", label: "Starts with", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "ends_with", label: "Ends with", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "in", label: "In list", needsValue: false, needsTwoValues: false, needsMultiValue: true },
  { value: "not_in", label: "Not in list", needsValue: false, needsTwoValues: false, needsMultiValue: true },
  { value: "gt", label: "Greater than", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "gte", label: "Greater or equal", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "lt", label: "Less than", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "lte", label: "Less or equal", needsValue: true, needsTwoValues: false, needsMultiValue: false },
  { value: "between", label: "Between", needsValue: false, needsTwoValues: true, needsMultiValue: false },
  { value: "is_empty", label: "Is empty", needsValue: false, needsTwoValues: false, needsMultiValue: false },
  { value: "is_not_empty", label: "Is not empty", needsValue: false, needsTwoValues: false, needsMultiValue: false },
  { value: "is_true", label: "Is true", needsValue: false, needsTwoValues: false, needsMultiValue: false },
  { value: "is_false", label: "Is false", needsValue: false, needsTwoValues: false, needsMultiValue: false },
];

// ─── Field registry (what's filterable) ──────────────────────
export type FieldType = "text" | "number" | "date" | "boolean" | "enum" | "array" | "json";

export interface FilterFieldMeta {
  key: string;
  label: string;
  type: FieldType;
  table: "contacts" | "companies";
  category: string;
  options?: { value: string; label: string }[];
  /** Operators valid for this field (defaults based on type) */
  operators?: FilterOperator[];
}

// ─── Helpers ─────────────────────────────────────────────────
export function createEmptyFilterDefinition(): FilterDefinition {
  return {
    logic: "and",
    groups: [],
    conditions: [],
    includeLists: [],
    excludeLists: [],
    includeDomains: [],
    excludeDomains: [],
    includeWebsites: [],
    excludeWebsites: [],
  };
}

let _idCounter = 0;
export function genFilterId(): string {
  return `f_${Date.now()}_${++_idCounter}`;
}

export function createEmptyCondition(field = ""): FilterCondition {
  return { id: genFilterId(), field, operator: "eq", value: "", conditionType: "include" };
}

export function createEmptyGroup(): FilterGroup {
  return { id: genFilterId(), logic: "and", conditions: [createEmptyCondition()], groups: [] };
}

export function getOperatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case "text":
      return ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"];
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"];
    case "date":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false"];
    case "enum":
      return ["eq", "neq", "in", "not_in", "is_empty", "is_not_empty"];
    case "array":
      return ["contains", "not_contains", "is_empty", "is_not_empty"];
    default:
      return ["eq", "neq", "is_empty", "is_not_empty"];
  }
}
