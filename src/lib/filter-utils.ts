import type { FilterValues } from "@/components/data-table/FilterPanel";

/**
 * Apply filter values to a Supabase query builder.
 * Handles select, text, boolean, exists, range, and date_range filters.
 */
export function applyFilters(query: any, filters: FilterValues, filterConfigs: { key: string; type: string }[]) {
  for (const config of filterConfigs) {
    const { key, type } = config;

    if (type === "select" || type === "text") {
      const val = filters[key];
      if (val && val !== "all" && val !== "") {
        if (type === "select") {
          query = query.eq(key, val);
        } else {
          query = query.ilike(key, `%${val}%`);
        }
      }
    }

    if (type === "boolean") {
      const val = filters[key];
      if (val === "true") query = query.eq(key, true);
      if (val === "false") query = query.eq(key, false);
    }

    if (type === "exists") {
      const val = filters[key];
      if (val === "exists") query = query.not(key, "is", null);
      if (val === "missing") query = query.is(key, null);
    }

    if (type === "range") {
      const min = filters[`${key}_min`];
      const max = filters[`${key}_max`];
      if (min && min !== "") query = query.gte(key, Number(min));
      if (max && max !== "") query = query.lte(key, Number(max));
    }

    if (type === "date_range") {
      const from = filters[`${key}_from`];
      const to = filters[`${key}_to`];
      if (from && from !== "") query = query.gte(key, from);
      if (to && to !== "") query = query.lte(key, `${to}T23:59:59`);
    }
  }

  return query;
}
