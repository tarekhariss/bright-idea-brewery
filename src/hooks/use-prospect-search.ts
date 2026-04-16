/**
 * useProspectSearch — Server-side search hook for the Prospect Search page.
 * Applies advanced filters, pagination, sorting, and text search.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import { applyAdvancedFilters } from "@/lib/advanced-filter-engine";
import { useDebounce } from "./use-debounce";
import { useState, useCallback } from "react";
import { createEmptyFilterDefinition } from "@/lib/advanced-filter-types";

const db = () => supabase as any;

export type EntityType = "contact" | "company";

interface ProspectSearchOptions {
  entityType: EntityType;
  filterDefinition: FilterDefinition;
  search: string;
  sortBy: string;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  sourceFile?: string;
  importTag?: string;
}

export interface ProspectSearchResult<T = any> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useProspectSearch(options: ProspectSearchOptions) {
  const { user, workspaceId } = useAuth();
  const debouncedSearch = useDebounce(options.search, 300);

  return useQuery({
    queryKey: [
      "prospect-search",
      options.entityType,
      options.filterDefinition,
      debouncedSearch,
      options.sortBy,
      options.sortDirection,
      options.page,
      options.pageSize,
      workspaceId,
    ],
    enabled: !!user,
    queryFn: async (): Promise<ProspectSearchResult> => {
      const table = options.entityType === "contact" ? "contacts" : "companies";
      const from = options.page * options.pageSize;
      const to = from + options.pageSize - 1;

      const listIds = await resolveListFilters(options.filterDefinition);

      // Build count query
      let countQuery = db().from(table).select("*", { count: "exact", head: true });
      countQuery = applyOwnershipFilter(countQuery, workspaceId, user!.id);
      countQuery = applySearchFilter(countQuery, options.entityType, debouncedSearch);
      countQuery = applyAdvancedFilters(countQuery, options.filterDefinition);
      countQuery = applyListIds(countQuery, listIds);
      const { count } = await countQuery;
      const totalCount = count ?? 0;

      // Build data query
      let dataQuery = db()
        .from(table)
        .select(options.entityType === "contact"
          ? "id,first_name,last_name,email,job_title,company_name_raw,company_id,email_validity_status,phone_status,phone,mobile_phone,corporate_phone,work_direct_phone,country,city,state,lifecycle_status,outreach_status,owner_id,linkedin_url,seniority_level,department,source,data_quality_score,last_contacted_at,created_at,updated_at,headline,persona,address,postal_code,timezone,bio,skills,languages,years_experience,current_role_start_date,personal_email,secondary_email,companies(name,industry,employee_count,employee_range,domain,website,annual_revenue,revenue_range,funding_stage,headquarters)"
          : "id,name,domain,website,industry,employee_count,employee_range,revenue_range,annual_revenue,funding_stage,total_funding,country,city,state,headquarters,technologies,keywords,owner_id,data_quality_score,linkedin_url,created_at,updated_at,description,founded_year,company_type,stock_ticker,facebook_url,twitter_url"
        )
        .range(from, to)
        .order(options.sortBy, { ascending: options.sortDirection === "asc" });

      dataQuery = applyOwnershipFilter(dataQuery, workspaceId, user!.id);
      dataQuery = applySearchFilter(dataQuery, options.entityType, debouncedSearch);
      dataQuery = applyAdvancedFilters(dataQuery, options.filterDefinition);
      dataQuery = applyListIds(dataQuery, listIds);

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        data: data ?? [],
        totalCount,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(totalCount / options.pageSize),
      };
    },
  });
}

/** Apply workspace_id filter if available, otherwise filter by created_by */
function applyOwnershipFilter(query: any, workspaceId: string | null, userId: string) {
  if (workspaceId) {
    return query.eq("workspace_id", workspaceId);
  }
  return query.is("workspace_id", null).eq("created_by", userId);
}

function applySearchFilter(query: any, entityType: EntityType, search: string) {
  if (!search) return query;
  if (entityType === "contact") {
    return query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name_raw.ilike.%${search}%`
    );
  }
  return query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`);
}

interface ListFilterIds {
  includeIds: string[] | null;
  excludeIds: string[] | null;
}

async function resolveListFilters(def: FilterDefinition): Promise<ListFilterIds> {
  let includeIds: string[] | null = null;
  let excludeIds: string[] | null = null;

  if (def.includeLists?.length) {
    const { data } = await supabase
      .from("list_contacts")
      .select("contact_id")
      .in("list_id", def.includeLists);
    includeIds = [...new Set((data as any[])?.map(r => r.contact_id) ?? [])];
  }
  if (def.excludeLists?.length) {
    const { data } = await supabase
      .from("list_contacts")
      .select("contact_id")
      .in("list_id", def.excludeLists);
    excludeIds = [...new Set((data as any[])?.map(r => r.contact_id) ?? [])];
  }
  return { includeIds, excludeIds };
}

function applyListIds(query: any, ids: ListFilterIds): any {
  if (ids.includeIds !== null) {
    if (ids.includeIds.length > 0) {
      query = query.in("id", ids.includeIds);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }
  if (ids.excludeIds !== null && ids.excludeIds.length > 0) {
    query = query.not("id", "in", `(${ids.excludeIds.join(",")})`);
  }
  return query;
}

// ─── State manager hook ──────────────────────────────────────
export function useProspectSearchState() {
  const [entityType, setEntityType] = useState<EntityType>("contact");
  const [filterDefinition, setFilterDefinition] = useState<FilterDefinition>(createEmptyFilterDefinition());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  const clearFilters = useCallback(() => {
    setFilterDefinition(createEmptyFilterDefinition());
    setPage(0);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelectAllMode(false);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectAllMode(false);
    setSelectedRows(new Set(ids));
  }, []);

  const selectAllResults = useCallback(() => {
    setSelectAllMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
    setSelectAllMode(false);
  }, []);

  return {
    entityType, setEntityType,
    filterDefinition, setFilterDefinition,
    search, setSearch,
    sortBy, setSortBy,
    sortDirection, setSortDirection,
    page, setPage,
    pageSize, setPageSize,
    selectedRows, toggleRow, selectAll, selectAllResults, selectAllMode, clearSelection,
    clearFilters,
  };
}
