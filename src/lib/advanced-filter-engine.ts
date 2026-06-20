/**
 * Advanced Filter Engine — Supabase Query Builder
 *
 * Translates a FilterDefinition into chained Supabase PostgREST calls.
 * Handles nested groups, AND/OR logic, include/exclude, and all operators.
 */
import type {
  FilterDefinition,
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "./advanced-filter-types";
import { COMPANY_FILTER_FIELDS } from "./filter-field-registry";

/**
 * Set of field keys that live on the `companies` table. When the active entity
 * is `contact`, we transparently rewrite these to `companies.<field>` so the
 * filter applies against the embedded join instead of the (non-existent)
 * contact column — and we tell the caller so it can switch to an inner join.
 */
const COMPANY_FIELD_KEYS = new Set(COMPANY_FILTER_FIELDS.map((f) => f.key));

function rewriteField(field: string, entityType?: "contact" | "company"): string {
  if (entityType !== "contact") return field;
  if (!field || field.includes(".")) return field;
  if (COMPANY_FIELD_KEYS.has(field)) return `companies.${field}`;
  return field;
}

/** True when the definition contains at least one company-table filter (used by
 * the search hook to switch to an inner join so parent rows are actually filtered). */
export function hasCompanyTableFilter(def: FilterDefinition | undefined | null): boolean {
  if (!def) return false;
  const checkConds = (cs?: FilterCondition[]) => cs?.some((c) => c.field && COMPANY_FIELD_KEYS.has(c.field) && !c.field.includes(".")) ?? false;
  const walkGroup = (g: FilterGroup): boolean => checkConds(g.conditions) || (g.groups ?? []).some(walkGroup);
  return (
    checkConds(def.conditions) ||
    (def.groups ?? []).some(walkGroup) ||
    !!def.includeDomains?.length || !!def.excludeDomains?.length ||
    !!def.includeWebsites?.length || !!def.excludeWebsites?.length
  );
}

// ─── Apply a complete FilterDefinition to a Supabase query ───
export function applyAdvancedFilters(query: any, def: FilterDefinition, entityType?: "contact" | "company"): any {
  if (!def) return query;

  // 1. Apply top-level conditions
  if (def.conditions?.length) {
    query = applyConditions(query, def.conditions, def.logic, entityType);
  }

  // 2. Apply nested groups
  if (def.groups?.length) {
    for (const group of def.groups) {
      query = applyGroup(query, group, entityType);
    }
  }

  // 3. Domain filtering — for contact searches this targets the joined company.
  const domainField = entityType === "contact" ? "companies.domain" : "domain";
  const websiteField = entityType === "contact" ? "companies.website" : "website";
  if (def.includeDomains?.length) {
    query = query.in(domainField, def.includeDomains);
  }
  if (def.excludeDomains?.length) {
    for (const d of def.excludeDomains) {
      query = query.neq(domainField, d);
    }
  }

  // 4. Website filtering
  if (def.includeWebsites?.length) {
    query = query.in(websiteField, def.includeWebsites);
  }
  if (def.excludeWebsites?.length) {
    for (const w of def.excludeWebsites) {
      query = query.neq(websiteField, w);
    }
  }

  return query;
}

// ─── Apply a group (recursive) ───────────────────────────────
function applyGroup(query: any, group: FilterGroup, entityType?: "contact" | "company"): any {
  if (group.logic === "or") {
    // Build OR clause from conditions
    const orParts = group.conditions
      .map((c) => conditionToPostgrest(c, entityType))
      .filter(Boolean);

    if (orParts.length > 0) {
      query = query.or(orParts.join(","));
    }
  } else {
    // AND — apply each condition sequentially
    query = applyConditions(query, group.conditions, "and", entityType);
  }

  // Recurse into nested sub-groups
  for (const sub of group.groups) {
    query = applyGroup(query, sub, entityType);
  }

  return query;
}

// ─── Apply a list of conditions with AND logic ───────────────
function applyConditions(query: any, conditions: FilterCondition[], logic: "and" | "or", entityType?: "contact" | "company"): any {
  if (logic === "or") {
    const orParts = conditions
      .map((c) => conditionToPostgrest(c, entityType))
      .filter(Boolean);
    if (orParts.length > 0) {
      query = query.or(orParts.join(","));
    }
    return query;
  }

  // AND — chain sequentially
  for (const condition of conditions) {
    query = applyCondition(query, condition, entityType);
  }
  return query;
}

// ─── Apply a single condition to a query (chain style) ───────
function applyCondition(query: any, c: FilterCondition, entityType?: "contact" | "company"): any {
  const { operator, value, conditionType } = c;
  const field = rewriteField(c.field, entityType);
  if (!field) return query;

  const isExclude = conditionType === "exclude";

  switch (operator) {
    case "eq":
      return isExclude ? query.neq(field, value) : query.eq(field, value);
    case "neq":
      return isExclude ? query.eq(field, value) : query.neq(field, value);
    case "contains":
      return isExclude
        ? query.not(field, "ilike", `%${value}%`)
        : query.ilike(field, `%${value}%`);
    case "not_contains":
      return isExclude
        ? query.ilike(field, `%${value}%`)
        : query.not(field, "ilike", `%${value}%`);
    case "starts_with":
      return isExclude
        ? query.not(field, "ilike", `${value}%`)
        : query.ilike(field, `${value}%`);
    case "ends_with":
      return isExclude
        ? query.not(field, "ilike", `%${value}`)
        : query.ilike(field, `%${value}`);
    case "in":
      if (Array.isArray(value) && value.length > 0) {
        return isExclude
          ? query.not(field, "in", `(${value.join(",")})`)
          : query.in(field, value);
      }
      return query;
    case "not_in":
      if (Array.isArray(value) && value.length > 0) {
        return isExclude
          ? query.in(field, value)
          : query.not(field, "in", `(${value.join(",")})`);
      }
      return query;
    case "gt":
      return isExclude ? query.lte(field, value) : query.gt(field, value);
    case "gte":
      return isExclude ? query.lt(field, value) : query.gte(field, value);
    case "lt":
      return isExclude ? query.gte(field, value) : query.lt(field, value);
    case "lte":
      return isExclude ? query.gt(field, value) : query.lte(field, value);
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        if (isExclude) {
          return query.or(`${field}.lt.${value[0]},${field}.gt.${value[1]}`);
        }
        return query.gte(field, value[0]).lte(field, value[1]);
      }
      return query;
    case "is_empty":
      return isExclude ? query.not(field, "is", null) : query.is(field, null);
    case "is_not_empty":
      return isExclude ? query.is(field, null) : query.not(field, "is", null);
    case "is_true":
      return isExclude ? query.eq(field, false) : query.eq(field, true);
    case "is_false":
      return isExclude ? query.eq(field, true) : query.eq(field, false);
    default:
      return query;
  }
}

// ─── Convert a condition to a PostgREST OR fragment ──────────
function conditionToPostgrest(c: FilterCondition, entityType?: "contact" | "company"): string | null {
  const { operator, value, conditionType } = c;
  const field = rewriteField(c.field, entityType);
  if (!field) return null;

  const isExclude = conditionType === "exclude";

  switch (operator) {
    case "eq":
      return isExclude ? `${field}.neq.${value}` : `${field}.eq.${value}`;
    case "neq":
      return isExclude ? `${field}.eq.${value}` : `${field}.neq.${value}`;
    case "contains":
      return isExclude
        ? `${field}.not.ilike.*${value}*`
        : `${field}.ilike.*${value}*`;
    case "not_contains":
      return isExclude
        ? `${field}.ilike.*${value}*`
        : `${field}.not.ilike.*${value}*`;
    case "starts_with":
      return isExclude
        ? `${field}.not.ilike.${value}*`
        : `${field}.ilike.${value}*`;
    case "ends_with":
      return isExclude
        ? `${field}.not.ilike.*${value}`
        : `${field}.ilike.*${value}`;
    case "gt":
      return isExclude ? `${field}.lte.${value}` : `${field}.gt.${value}`;
    case "gte":
      return isExclude ? `${field}.lt.${value}` : `${field}.gte.${value}`;
    case "lt":
      return isExclude ? `${field}.gte.${value}` : `${field}.lt.${value}`;
    case "lte":
      return isExclude ? `${field}.gt.${value}` : `${field}.lte.${value}`;
    case "is_empty":
      return isExclude ? `${field}.not.is.null` : `${field}.is.null`;
    case "is_not_empty":
      return isExclude ? `${field}.is.null` : `${field}.not.is.null`;
    case "is_true":
      return isExclude ? `${field}.eq.false` : `${field}.eq.true`;
    case "is_false":
      return isExclude ? `${field}.eq.true` : `${field}.eq.false`;
    case "in":
      if (Array.isArray(value) && value.length > 0) {
        return `${field}.in.(${value.join(",")})`;
      }
      return null;
    case "not_in":
      if (Array.isArray(value) && value.length > 0) {
        return `${field}.not.in.(${value.join(",")})`;
      }
      return null;
    default:
      return null;
  }
}

// ─── Count active conditions in a definition ─────────────────
export function countActiveConditions(def: FilterDefinition): number {
  let count = 0;
  count += def.conditions?.filter((c) => c.field).length ?? 0;
  count += def.includeLists?.length ?? 0;
  count += def.excludeLists?.length ?? 0;
  count += def.includeDomains?.length ?? 0;
  count += def.excludeDomains?.length ?? 0;
  count += def.includeWebsites?.length ?? 0;
  count += def.excludeWebsites?.length ?? 0;

  function countGroup(g: FilterGroup): number {
    let c = g.conditions.filter((c) => c.field).length;
    for (const sub of g.groups) c += countGroup(sub);
    return c;
  }
  for (const g of def.groups ?? []) count += countGroup(g);

  return count;
}
