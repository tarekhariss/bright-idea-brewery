import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Download, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { QualityScoreBadge } from "@/components/data-table/StatusBadge";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { TablePagination } from "@/components/data-table/TablePagination";
import { ColumnVisibility, type ColumnDef } from "@/components/data-table/ColumnVisibility";
import { FilterPanel, ActiveFilters, type FilterConfig, type FilterValues } from "@/components/data-table/FilterPanel";
import { SavedViewsDropdown } from "@/components/data-table/SavedViewsDropdown";
import { useSavedViews, type ViewState } from "@/hooks/use-saved-views";
import { applyFilters } from "@/lib/filter-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { TableSkeleton } from "@/components/data-table/TableSkeleton";
import { VirtualizedTableBody } from "@/components/data-table/VirtualizedTableBody";
import { Badge } from "@/components/ui/badge";
import { CompanyBulkActionsBar } from "@/components/companies/BulkActionsBar";
import { format } from "date-fns";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Company", defaultVisible: true },
  { key: "domain", label: "Domain", defaultVisible: true },
  { key: "industry", label: "Industry", defaultVisible: true },
  { key: "employee_count", label: "Employees" },
  { key: "employee_range", label: "Size", defaultVisible: true },
  { key: "revenue_range", label: "Revenue", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "data_quality_score", label: "Quality", defaultVisible: true },
  { key: "updated_at", label: "Updated", defaultVisible: true },
];

const DEFAULT_VISIBLE = new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

const FILTER_CONFIGS: FilterConfig[] = [
  // Firmographic
  { key: "industry", label: "Industry", type: "text", group: "firmographic" },
  { key: "employee_range", label: "Employee Range", type: "select", group: "firmographic", options: [
    { value: "1-10", label: "1-10" }, { value: "11-50", label: "11-50" },
    { value: "51-200", label: "51-200" }, { value: "201-500", label: "201-500" },
    { value: "501-1000", label: "501-1000" }, { value: "1001-5000", label: "1001-5000" },
    { value: "5001-10000", label: "5001-10000" }, { value: "10001+", label: "10001+" },
  ]},
  { key: "employee_count", label: "Employee Count", type: "range", group: "firmographic" },
  { key: "revenue_range", label: "Revenue Range", type: "select", group: "firmographic", options: [
    { value: "<$1M", label: "< $1M" }, { value: "$1M-$10M", label: "$1M-$10M" },
    { value: "$10M-$50M", label: "$10M-$50M" }, { value: "$50M-$100M", label: "$50M-$100M" },
    { value: "$100M-$500M", label: "$100M-$500M" }, { value: "$500M+", label: "$500M+" },
  ]},

  // Contact Info
  { key: "domain", label: "Domain", type: "exists", group: "contact_info" },
  { key: "website", label: "Website", type: "exists", group: "contact_info" },
  { key: "linkedin_url", label: "LinkedIn", type: "exists", group: "contact_info" },

  // Enrichment
  { key: "country", label: "Country", type: "text", group: "enrichment" },
  { key: "city", label: "City", type: "text", group: "enrichment" },
  { key: "state", label: "State", type: "text", group: "enrichment" },
  { key: "data_quality_score", label: "Quality Score", type: "range", group: "enrichment" },

  // Ownership
  { key: "owner_id", label: "Owner Assigned", type: "exists", group: "ownership" },

  // External
  { key: "external_account_id", label: "External Account ID", type: "exists", group: "external" },

  // Dates
  { key: "created_at", label: "Created", type: "date_range", group: "dates" },
  { key: "updated_at", label: "Updated", type: "date_range", group: "dates" },
];

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  revenue_range: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  data_quality_score: number | null;
  updated_at: string;
}

const SELECT_FIELDS = "id, name, domain, industry, employee_count, employee_range, revenue_range, country, city, state, data_quality_score, updated_at";

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedViews = useSavedViews("company");
  const { canEdit } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const viewId = searchParams.get("view");
    if (viewId && savedViews.views.length > 0) {
      const view = savedViews.views.find((v) => v.id === viewId);
      if (view) applyView(view);
    }
  }, [savedViews.views, searchParams]);

  const applyView = (view: any) => {
    const state = savedViews.loadViewState(view);
    setSearch(state.search);
    setFilterValues(state.filters);
    setSortBy(state.sortBy);
    setSortDir(state.sortDirection);
    setPageSize(state.pageSize);
    if (state.visibleColumns.length > 0) setVisibleCols(new Set(state.visibleColumns));
    savedViews.setActiveViewId(view.id);
    setPage(0);
  };

  const getCurrentViewState = (): ViewState => ({
    search, filters: filterValues, visibleColumns: Array.from(visibleCols),
    sortBy, sortDirection: sortDir, pageSize,
  });

  const debouncedSearch = useDebounce(search, 300);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("companies")
      .select(SELECT_FIELDS, { count: "exact" })
      .order(sortBy, { ascending: sortDir === "asc" })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (debouncedSearch.trim()) {
      query = query.or(`name.ilike.%${debouncedSearch}%,domain.ilike.%${debouncedSearch}%,industry.ilike.%${debouncedSearch}%,country.ilike.%${debouncedSearch}%`);
    }

    query = applyFilters(query, filterValues, FILTER_CONFIGS);
    const { data, count: total, error } = await query;
    if (!error) { setCompanies(data ?? []); setCount(total ?? 0); }
    setLoading(false);
  }, [page, pageSize, debouncedSearch, sortBy, sortDir, filterValues]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const totalPages = Math.ceil(count / pageSize);
  const activeFilterCount = Object.values(filterValues).filter((v) => v && v !== "" && v !== "all").length;

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
    setPage(0);
  };
  const toggleColumn = (key: string) => {
    setVisibleCols((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };
  const handleFilterRemove = (key: string) => {
    setFilterValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setPage(0);
  };
  const col = (key: string) => visibleCols.has(key);
  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    selected.size === companies.length ? setSelected(new Set()) : setSelected(new Set(companies.map((c) => c.id)));
  };
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {count.toLocaleString()} total companies
              {search && <span className="ml-1">matching "{search}"</span>}
              {activeFilterCount > 0 && <span className="ml-1">· {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <CompanyBulkActionsBar selectedIds={Array.from(selected)} onDone={() => { setSelected(new Set()); fetchCompanies(); }} />
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add Company</Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search by name, domain, industry, website, country, city..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-8 text-xs" />
          </div>
          <SavedViewsDropdown
            views={savedViews.views} activeViewId={savedViews.activeViewId}
            onLoad={applyView}
            onSave={(name) => savedViews.saveView(name, getCurrentViewState())}
            onUpdate={(id) => savedViews.updateView(id, getCurrentViewState())}
            onRename={savedViews.renameView} onDelete={savedViews.deleteView}
            onSetDefault={savedViews.setDefault}
          />
          <FilterPanel filters={FILTER_CONFIGS} values={filterValues}
            onChange={(v) => { setFilterValues(v); setPage(0); }}
            onClear={() => { setFilterValues({}); setPage(0); }} />
          <ColumnVisibility columns={COLUMNS} visibleColumns={visibleCols} onToggle={toggleColumn} />
        </div>
        <ActiveFilters values={filterValues} filters={FILTER_CONFIGS} onRemove={handleFilterRemove} />
      </div>

      <div className="flex-1 overflow-auto border-t">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox checked={companies.length > 0 && selected.size === companies.length} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {col("name") && <TableHead><SortableHeader label="Company" sortKey="name" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("domain") && <TableHead><SortableHeader label="Domain" sortKey="domain" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("industry") && <TableHead><SortableHeader label="Industry" sortKey="industry" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("employee_count") && <TableHead><SortableHeader label="Employees" sortKey="employee_count" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("employee_range") && <TableHead className="text-xs font-medium text-muted-foreground">Size</TableHead>}
              {col("revenue_range") && <TableHead className="text-xs font-medium text-muted-foreground">Revenue</TableHead>}
              {col("country") && <TableHead><SortableHeader label="Country" sortKey="country" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("city") && <TableHead><SortableHeader label="City" sortKey="city" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("state") && <TableHead className="text-xs font-medium text-muted-foreground">State</TableHead>}
              {col("data_quality_score") && <TableHead><SortableHeader label="Quality" sortKey="data_quality_score" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("updated_at") && <TableHead><SortableHeader label="Updated" sortKey="updated_at" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={20} className="h-48 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">Loading companies...</p>
              </TableCell></TableRow>
            ) : companies.length === 0 ? (
              <TableRow><TableCell colSpan={20} className="h-48 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No companies found</p>
                  <p className="text-xs text-muted-foreground/70">
                    {search || activeFilterCount > 0 ? "Try adjusting your search or filters" : "Import companies or add them manually"}
                  </p>
                </div>
              </TableCell></TableRow>
            ) : (
              companies.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 h-10" onClick={() => navigate(`/companies/${c.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                  </TableCell>
                  {col("name") && <TableCell className="font-medium text-sm">{c.name}</TableCell>}
                  {col("domain") && <TableCell className="text-xs text-muted-foreground">{c.domain ? <span className="text-primary">{c.domain}</span> : "—"}</TableCell>}
                  {col("industry") && <TableCell className="text-xs">{c.industry ?? "—"}</TableCell>}
                  {col("employee_count") && <TableCell className="text-xs tabular-nums">{c.employee_count?.toLocaleString() ?? "—"}</TableCell>}
                  {col("employee_range") && <TableCell>{c.employee_range ? <Badge variant="outline" className="text-[11px]">{c.employee_range}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>}
                  {col("revenue_range") && <TableCell>{c.revenue_range ? <Badge variant="outline" className="text-[11px]">{c.revenue_range}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>}
                  {col("country") && <TableCell className="text-xs">{c.country ?? "—"}</TableCell>}
                  {col("city") && <TableCell className="text-xs">{c.city ?? "—"}</TableCell>}
                  {col("state") && <TableCell className="text-xs">{c.state ?? "—"}</TableCell>}
                  {col("data_quality_score") && <TableCell><QualityScoreBadge score={c.data_quality_score} /></TableCell>}
                  {col("updated_at") && <TableCell className="text-xs text-muted-foreground">{formatDate(c.updated_at)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination page={page} totalPages={totalPages} totalRows={count} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(0); }} selectedCount={selected.size} />
    </div>
  );
}
