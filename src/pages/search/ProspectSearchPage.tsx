/**
 * ProspectSearchPage — Apollo-style prospecting workspace.
 * Left filter sidebar + results table + preview drawer.
 */
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, RefreshCw, Users, Building2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ArrowUpDown, SlidersHorizontal,
  Bookmark, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdvancedFilterPanel, ActiveAdvancedFilters } from "@/components/data-table/AdvancedFilterPanel";
import { ProspectMetricsBar } from "@/components/search/ProspectMetricsBar";
import { SearchBulkActionsBar } from "@/components/search/SearchBulkActionsBar";
import { ProspectPreviewDrawer } from "@/components/search/ProspectPreviewDrawer";
import { useProspectSearch, useProspectSearchState, type EntityType } from "@/hooks/use-prospect-search";
import { useSavedSearches, type SavedSearch } from "@/hooks/use-saved-searches";
import { countActiveConditions } from "@/lib/advanced-filter-engine";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import { createEmptyFilterDefinition } from "@/lib/advanced-filter-types";
import { cn } from "@/lib/utils";

// ─── Column definitions ──────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
  className?: string;
}

const CONTACT_COLUMNS: ColDef[] = [
  {
    key: "name", label: "Name", sortable: true,
    render: (r) => (
      <div className="min-w-[140px]">
        <div className="font-medium text-sm truncate">
          {`${r.first_name || ""} ${r.last_name || ""}`.trim() || "—"}
        </div>
        {r.email && <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>}
      </div>
    ),
  },
  { key: "job_title", label: "Title", render: (r) => <span className="text-xs truncate max-w-[160px] block">{r.job_title || "—"}</span> },
  {
    key: "company_name_raw", label: "Company",
    render: (r) => <span className="text-xs truncate max-w-[140px] block">{r.company_name_raw || "—"}</span>,
  },
  {
    key: "email_validity_status", label: "Email", sortable: true,
    render: (r) => {
      const s = r.email_validity_status;
      if (!s) return <span className="text-xs text-muted-foreground">—</span>;
      const color = s === "valid" ? "bg-primary/10 text-primary" : s === "invalid" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
      return <Badge variant="outline" className={`text-[10px] ${color}`}>{s}</Badge>;
    },
  },
  {
    key: "phone_status", label: "Phone", sortable: true,
    render: (r) => {
      const s = r.phone_status;
      if (!s || s === "unknown") return <span className="text-xs text-muted-foreground">—</span>;
      return <Badge variant="outline" className="text-[10px]">{s}</Badge>;
    },
  },
  {
    key: "location", label: "Location",
    render: (r) => {
      const loc = [r.city, r.state, r.country].filter(Boolean).join(", ");
      return <span className="text-xs truncate max-w-[140px] block">{loc || "—"}</span>;
    },
  },
  {
    key: "seniority_level", label: "Seniority",
    render: (r) => <span className="text-xs">{r.seniority_level || "—"}</span>,
  },
  {
    key: "lifecycle_status", label: "Stage", sortable: true,
    render: (r) => r.lifecycle_status ? <Badge variant="secondary" className="text-[10px]">{r.lifecycle_status}</Badge> : <span className="text-xs text-muted-foreground">—</span>,
  },
  {
    key: "updated_at", label: "Updated", sortable: true,
    render: (r) => <span className="text-xs text-muted-foreground">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"}</span>,
  },
];

const COMPANY_COLUMNS: ColDef[] = [
  {
    key: "name", label: "Company", sortable: true,
    render: (r) => (
      <div className="min-w-[140px]">
        <div className="font-medium text-sm truncate">{r.name || "—"}</div>
        {r.domain && <div className="text-[11px] text-muted-foreground truncate">{r.domain}</div>}
      </div>
    ),
  },
  { key: "industry", label: "Industry", sortable: true, render: (r) => <span className="text-xs truncate max-w-[140px] block">{r.industry || "—"}</span> },
  {
    key: "employee_count", label: "Employees", sortable: true,
    render: (r) => <span className="text-xs">{r.employee_count?.toLocaleString() ?? r.employee_range ?? "—"}</span>,
  },
  { key: "revenue_range", label: "Revenue", render: (r) => <span className="text-xs">{r.revenue_range || "—"}</span> },
  { key: "funding_stage", label: "Funding", render: (r) => <span className="text-xs">{r.funding_stage || "—"}</span> },
  {
    key: "technologies", label: "Technologies",
    render: (r) => {
      if (!r.technologies?.length) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex gap-1 flex-wrap max-w-[180px]">
          {r.technologies.slice(0, 3).map((t: string) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
          {r.technologies.length > 3 && <Badge variant="outline" className="text-[9px]">+{r.technologies.length - 3}</Badge>}
        </div>
      );
    },
  },
  {
    key: "location", label: "Location",
    render: (r) => <span className="text-xs truncate max-w-[130px] block">{[r.city, r.state, r.country].filter(Boolean).join(", ") || r.headquarters || "—"}</span>,
  },
  {
    key: "updated_at", label: "Updated", sortable: true,
    render: (r) => <span className="text-xs text-muted-foreground">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"}</span>,
  },
];

// ─── Main page ───────────────────────────────────────────────
export default function ProspectSearchPage() {
  const state = useProspectSearchState();
  const [showFilters, setShowFilters] = useState(true);
  const [previewRecord, setPreviewRecord] = useState<any>(null);

  // TODO: replace with real workspace_id from context when available
  const workspaceId = "00000000-0000-0000-0000-000000000000";

  const { searches, create: createSearch, isCreating } = useSavedSearches(state.entityType, workspaceId);

  const searchResult = useProspectSearch({
    entityType: state.entityType,
    filterDefinition: state.filterDefinition,
    search: state.search,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    page: state.page,
    pageSize: state.pageSize,
  });

  const columns = state.entityType === "contact" ? CONTACT_COLUMNS : COMPANY_COLUMNS;
  const rows = searchResult.data?.data ?? [];
  const totalCount = searchResult.data?.totalCount ?? 0;
  const totalPages = searchResult.data?.totalPages ?? 0;
  const filterCount = countActiveConditions(state.filterDefinition);
  const allSelected = rows.length > 0 && rows.every((r: any) => state.selectedRows.has(r.id));

  const handleSort = (key: string) => {
    if (key === "name") key = state.entityType === "contact" ? "first_name" : "name";
    if (key === "location") return;
    if (state.sortBy === key) {
      state.setSortDirection(state.sortDirection === "asc" ? "desc" : "asc");
    } else {
      state.setSortBy(key);
      state.setSortDirection("asc");
    }
    state.setPage(0);
  };

  const handleLoadSearch = (s: SavedSearch) => {
    state.setFilterDefinition(s.filter_definition);
    state.setPage(0);
  };

  const handleSaveSearch = async (name: string) => {
    await createSearch({ name, filter_definition: state.filterDefinition });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Left filter sidebar */}
      {showFilters && (
        <div className="w-[320px] border-r border-border flex flex-col shrink-0 bg-card">
          <AdvancedFilterPanel
            entityType={state.entityType}
            value={state.filterDefinition}
            onChange={(def) => { state.setFilterDefinition(def); state.setPage(0); }}
            onSave={handleSaveSearch}
            onClear={state.clearFilters}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Metrics summary bar */}
        <ProspectMetricsBar
          entityType={state.entityType}
          filteredCount={totalCount}
          filteredLoading={searchResult.isLoading}
        />

        {/* Top bar */}
        <div className="border-b px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-3">
            {/* Toggle filters */}
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showFilters ? "Hide" : "Filters"}
              {!showFilters && filterCount > 0 && (
                <Badge variant="default" className="h-4 text-[10px] px-1">{filterCount}</Badge>
              )}
            </Button>

            {/* Entity tabs */}
            <Tabs
              value={state.entityType}
              onValueChange={(v) => {
                state.setEntityType(v as EntityType);
                state.clearFilters();
                state.clearSelection();
                state.setPage(0);
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="contact" className="text-xs h-7 gap-1 px-3">
                  <Users className="h-3 w-3" /> Contacts
                </TabsTrigger>
                <TabsTrigger value="company" className="text-xs h-7 gap-1 px-3">
                  <Building2 className="h-3 w-3" /> Companies
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder={state.entityType === "contact" ? "Search name, email, company..." : "Search company, domain..."}
                value={state.search}
                onChange={(e) => { state.setSearch(e.target.value); state.setPage(0); }}
              />
            </div>

            {/* Saved searches */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Bookmark className="h-3 w-3" /> Saved <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                {searches.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">No saved searches yet</div>
                ) : (
                  searches.map((s) => (
                    <DropdownMenuItem key={s.id} className="text-xs gap-2" onClick={() => handleLoadSearch(s)}>
                      {s.is_pinned && <span className="text-amber-500">📌</span>}
                      <span className="truncate">{s.name}</span>
                      <Badge variant="outline" className="ml-auto text-[9px]">{countActiveConditions(s.filter_definition)}</Badge>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick count + refresh */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">
                {searchResult.isLoading ? "..." : totalCount.toLocaleString()} results
              </span>
              <Button
                variant="ghost" size="sm" className="h-8 w-8 p-0"
                onClick={() => searchResult.refetch()}
                disabled={searchResult.isFetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", searchResult.isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Active filters row */}
          {filterCount > 0 && (
            <ActiveAdvancedFilters
              definition={state.filterDefinition}
              entityType={state.entityType}
              onClear={state.clearFilters}
            />
          )}

          {/* Bulk actions */}
          <SearchBulkActionsBar
            selectedCount={state.selectedRows.size}
            selectedIds={Array.from(state.selectedRows)}
            entityType={state.entityType}
            workspaceId=""
            onClear={state.clearSelection}
          />
        </div>

        {/* Results table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) state.selectAll(rows.map((r: any) => r.id));
                      else state.clearSelection();
                    }}
                  />
                </TableHead>
                {columns.map((col) => (
                  <TableHead key={col.key} className={cn("text-xs", col.className)}>
                    {col.sortable ? (
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResult.isLoading ? (
                Array.from({ length: state.pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.key}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-16 text-muted-foreground">
                    No {state.entityType === "contact" ? "contacts" : "companies"} found. Try adjusting your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      state.selectedRows.has(row.id) && "bg-primary/5"
                    )}
                    onClick={() => setPreviewRecord(row)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={state.selectedRows.has(row.id)}
                        onCheckedChange={() => state.toggleRow(row.id)}
                      />
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="py-2">
                        {col.render ? col.render(row) : <span className="text-xs">{row[col.key] ?? "—"}</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="border-t px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select value={String(state.pageSize)} onValueChange={(v) => { state.setPageSize(Number(v)); state.setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Page {state.page + 1} of {Math.max(totalPages, 1)}
            </span>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={state.page === 0} onClick={() => state.setPage(0)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={state.page === 0} onClick={() => state.setPage(state.page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={state.page >= totalPages - 1} onClick={() => state.setPage(state.page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={state.page >= totalPages - 1} onClick={() => state.setPage(totalPages - 1)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Preview drawer */}
      <ProspectPreviewDrawer
        open={!!previewRecord}
        onClose={() => setPreviewRecord(null)}
        entityType={state.entityType}
        record={previewRecord}
      />
    </div>
  );
}
