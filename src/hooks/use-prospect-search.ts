/**
 * useProspectSearch — Server-side search hook for the Prospect Search page.
 * Applies advanced filters, pagination, sorting, and text search.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import { applyAdvancedFilters, hasCompanyTableFilter } from "@/lib/advanced-filter-engine";
import { useDebounce } from "./use-debounce";
import { buildOrSearch } from "@/lib/postgrest-filter";
import { applyListFilters, buildListEmbeds, withEmbeds } from "@/lib/list-filters";
import { useState, useCallback } from "react";
import { createEmptyFilterDefinition } from "@/lib/advanced-filter-types";

const db = () => supabase as any;

/**
 * Result-count strategy.
 *
 * `exact` runs a COUNT(*) across the whole filtered set, as a second round trip,
 * on every keystroke. Invisible at ten thousand rows; at a million-plus it
 * dominates response time and degrades as the table grows.
 *
 * `estimated` asks the query planner first and falls back to an exact count when
 * the estimate lands below PostgREST's threshold — so narrow result sets still
 * report a precise number, while broad ones stop paying for a full scan to say
 * "about 1.2 million".
 */
const COUNT_MODE = "estimated" as const;

/**
 * Counts at or above this are planner estimates rather than exact tallies, and
 * should be rendered as approximate ("~1,240,000"). Below it, PostgREST has
 * returned a real count.
 */
export const ESTIMATED_COUNT_THRESHOLD = 1000;

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
  /** When false (default), only canonical (non-merged) records are returned. */
  includeMerged?: boolean;
}

export interface ProspectSearchResult<T = any> {
  data: T[];
  totalCount: number;
  /** True when totalCount is a planner estimate — render it as approximate. */
  isEstimatedCount: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useProspectSearch(options: ProspectSearchOptions) {
  const { user, workspaceId, accessibleWorkspaceIds } = useAuth();
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
      // Account-wide: key off the full set of accessible workspaces, not the
      // currently-selected one. This guarantees results refresh when the user
      // gains/loses workspace access but stay stable while switching the
      // "active" workspace for write operations.
      accessibleWorkspaceIds.slice().sort().join(","),
      options.sourceFile,
      options.importTag,
      options.includeMerged ?? false,
    ],
    enabled: !!user,
    queryFn: async (): Promise<ProspectSearchResult> => {
      const table = options.entityType === "contact" ? "contacts" : "companies";
      const from = options.page * options.pageSize;
      const to = from + options.pageSize - 1;

      // List membership is resolved in SQL via aliased embeds (see buildListEmbeds).
      // Lists only exist for contacts, so they are ignored on the companies view.
      const includeLists =
        options.entityType === "contact" ? options.filterDefinition.includeLists ?? [] : [];
      const excludeLists =
        options.entityType === "contact" ? options.filterDefinition.excludeLists ?? [] : [];
      const listEmbeds = buildListEmbeds(includeLists, excludeLists);

      const needsCompanyJoin = options.entityType === "contact" && hasCompanyTableFilter(options.filterDefinition);
      const companyEmbed = needsCompanyJoin
        ? "companies!inner(name,industry,employee_count,employee_range,domain,website,annual_revenue,revenue_range,funding_stage,headquarters,company_city,company_state,company_country,company_linkedin_url,keywords,custom_fields,company_name_for_emails)"
        : "companies(name,industry,employee_count,employee_range,domain,website,annual_revenue,revenue_range,funding_stage,headquarters,company_city,company_state,company_country,company_linkedin_url,keywords,custom_fields,company_name_for_emails)";

      // Build count query
      const countSelect = withEmbeds(
        options.entityType === "contact" && needsCompanyJoin ? `id, ${companyEmbed}` : "id",
        listEmbeds,
      );
      let countQuery = db().from(table).select(countSelect, { count: COUNT_MODE, head: true });
      countQuery = applyAccountScope(countQuery, accessibleWorkspaceIds, user!.id);
      countQuery = applySearchFilter(countQuery, options.entityType, debouncedSearch);
      countQuery = applyAdvancedFilters(countQuery, options.filterDefinition, options.entityType);
      countQuery = applyListFilters(countQuery, includeLists, excludeLists);
      if (options.sourceFile) countQuery = countQuery.eq("source_file", options.sourceFile);
      if (options.importTag) countQuery = countQuery.eq("import_tag", options.importTag);
      if (!options.includeMerged) countQuery = countQuery.is("merged_into", null);
      const { count } = await countQuery;
      const totalCount = count ?? 0;

      // Build data query
      let dataQuery = db()
        .from(table)
        .select(withEmbeds(options.entityType === "contact"
          ? `id,workspace_id,first_name,last_name,email,job_title,company_name_raw,company_id,email_validity_status,phone_status,phone,mobile_phone,corporate_phone,work_direct_phone,country,city,state,lifecycle_status,outreach_status,owner_id,linkedin_url,seniority_level,department,source,source_file,import_tag,data_quality_score,last_contacted_at,created_at,updated_at,headline,persona,address,postal_code,timezone,bio,skills,languages,years_experience,current_role_start_date,personal_email,secondary_email,email_canonical_status,email_is_role_based,email_is_disposable,email_is_free_email,email_is_catch_all,email_is_syntax_invalid,email_is_mx_missing,email_is_temporary_failure,email_status_source,email_status_verified_at,email_status_updated_at,${companyEmbed}`
          : "id,workspace_id,name,domain,website,industry,employee_count,employee_range,revenue_range,annual_revenue,funding_stage,total_funding,country,city,state,headquarters,technologies,keywords,owner_id,data_quality_score,linkedin_url,created_at,updated_at,description,founded_year,company_type,stock_ticker,facebook_url,twitter_url,company_city,company_state,company_country,company_linkedin_url,company_name_for_emails,custom_fields,normalized_domain"
        , listEmbeds))
        .range(from, to)
        .order(options.sortBy, { ascending: options.sortDirection === "asc" });

      dataQuery = applyAccountScope(dataQuery, accessibleWorkspaceIds, user!.id);
      dataQuery = applySearchFilter(dataQuery, options.entityType, debouncedSearch);
      dataQuery = applyAdvancedFilters(dataQuery, options.filterDefinition, options.entityType);
      dataQuery = applyListFilters(dataQuery, includeLists, excludeLists);
      if (options.sourceFile) dataQuery = dataQuery.eq("source_file", options.sourceFile);
      if (options.importTag) dataQuery = dataQuery.eq("import_tag", options.importTag);
      if (!options.includeMerged) dataQuery = dataQuery.is("merged_into", null);

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        data: data ?? [],
        totalCount,
        isEstimatedCount: totalCount >= ESTIMATED_COUNT_THRESHOLD,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(totalCount / options.pageSize),
      };
    },
  });
}

/**
 * Account-wide scope: show records from every workspace the signed-in user
 * can access. Falls back to created_by when the user has no workspace yet
 * (legacy/null-workspace personal records).
 */
function applyAccountScope(query: any, accessibleWorkspaceIds: string[], userId: string) {
  if (accessibleWorkspaceIds.length > 0) {
    return query.in("workspace_id", accessibleWorkspaceIds);
  }
  return query.is("workspace_id", null).eq("created_by", userId);
}

const CONTACT_SEARCH_COLUMNS = ["first_name", "last_name", "email", "company_name_raw"];
const COMPANY_SEARCH_COLUMNS = ["name", "domain"];

function applySearchFilter(query: any, entityType: EntityType, search: string) {
  const columns = entityType === "contact" ? CONTACT_SEARCH_COLUMNS : COMPANY_SEARCH_COLUMNS;
  const clause = buildOrSearch(columns, search);
  return clause ? query.or(clause) : query;
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
