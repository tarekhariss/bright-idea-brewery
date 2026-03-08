import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Download } from "lucide-react";
import { LifecycleBadge, OutreachBadge, QualityScoreBadge, DncBadge } from "@/components/data-table/StatusBadge";
import { BulkActionsBar } from "@/components/contacts/BulkActionsBar";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { TablePagination } from "@/components/data-table/TablePagination";
import { ColumnVisibility, type ColumnDef } from "@/components/data-table/ColumnVisibility";
import { FilterPanel, ActiveFilters, type FilterConfig, type FilterValues } from "@/components/data-table/FilterPanel";
import { SavedViewsDropdown } from "@/components/data-table/SavedViewsDropdown";
import { AddToListDialog } from "@/components/lists/AddToListDialog";
import { useSavedViews, type ViewState } from "@/hooks/use-saved-views";
import { applyFilters } from "@/lib/filter-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { TableSkeleton } from "@/components/data-table/TableSkeleton";
import { VirtualizedTableBody } from "@/components/data-table/VirtualizedTableBody";
import { format } from "date-fns";
import type { LifecycleStatus, OutreachStatus } from "@/integrations/supabase/db-types";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "secondary_email", label: "Secondary Email" },
  { key: "job_title", label: "Job Title", defaultVisible: true },
  { key: "seniority_level", label: "Seniority" },
  { key: "department", label: "Department" },
  { key: "company_name_raw", label: "Company", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "lifecycle_status", label: "Lifecycle", defaultVisible: true },
  { key: "outreach_status", label: "Outreach", defaultVisible: true },
  { key: "data_quality_score", label: "Quality", defaultVisible: true },
  { key: "last_contacted_at", label: "Last Contacted" },
  { key: "updated_at", label: "Updated", defaultVisible: true },
];

const DEFAULT_VISIBLE = new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

const FILTER_CONFIGS: FilterConfig[] = [
  // Status
  { key: "lifecycle_status", label: "Lifecycle Status", type: "select", group: "status", options: [
    { value: "new", label: "New" }, { value: "researching", label: "Researching" },
    { value: "qualified", label: "Qualified" }, { value: "nurturing", label: "Nurturing" },
    { value: "engaged", label: "Engaged" }, { value: "converted", label: "Converted" },
    { value: "churned", label: "Churned" }, { value: "archived", label: "Archived" },
  ]},
  { key: "outreach_status", label: "Outreach Status", type: "select", group: "status", options: [
    { value: "not_contacted", label: "Not Contacted" }, { value: "queued", label: "Queued" },
    { value: "contacted", label: "Contacted" }, { value: "replied", label: "Replied" },
    { value: "bounced", label: "Bounced" }, { value: "opted_out", label: "Opted Out" },
    { value: "unresponsive", label: "Unresponsive" },
  ]},
  { key: "do_not_contact", label: "Do Not Contact", type: "boolean", group: "status" },

  // Contact Info
  { key: "email", label: "Email", type: "exists", group: "contact_info" },
  { key: "phone", label: "Phone", type: "exists", group: "contact_info" },
  { key: "linkedin_url", label: "LinkedIn", type: "exists", group: "contact_info" },
  { key: "secondary_email", label: "Secondary Email", type: "exists", group: "contact_info" },
  { key: "email_validity_status", label: "Email Validity", type: "select", group: "contact_info", options: [
    { value: "unknown", label: "Unknown" }, { value: "valid", label: "Valid" },
    { value: "invalid", label: "Invalid" }, { value: "catch_all", label: "Catch-all" },
    { value: "disposable", label: "Disposable" }, { value: "role_based", label: "Role-based" },
  ]},

  // Company
  { key: "company_id", label: "Company Linked", type: "exists", group: "company" },
  { key: "department", label: "Department", type: "text", group: "company" },
  { key: "seniority_level", label: "Seniority Level", type: "text", group: "company" },

  // Enrichment
  { key: "country", label: "Country", type: "text", group: "enrichment" },
  { key: "source", label: "Source", type: "text", group: "enrichment" },
  { key: "data_quality_score", label: "Quality Score", type: "range", group: "enrichment" },

  // Ownership
  { key: "owner_id", label: "Owner Assigned", type: "exists", group: "ownership" },

  // External
  { key: "external_contact_id", label: "External Contact ID", type: "exists", group: "external" },

  // Dates
  { key: "created_at", label: "Created", type: "date_range", group: "dates" },
  { key: "updated_at", label: "Updated", type: "date_range", group: "dates" },
  { key: "last_contacted_at", label: "Last Contacted", type: "date_range", group: "dates" },
];

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  secondary_email: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  company_name_raw: string | null;
  country: string | null;
  lifecycle_status: LifecycleStatus;
  outreach_status: OutreachStatus;
  do_not_contact: boolean;
  data_quality_score: number | null;
  last_contacted_at: string | null;
  updated_at: string;
}

const SELECT_FIELDS = "id, first_name, last_name, email, secondary_email, job_title, seniority_level, department, company_name_raw, country, lifecycle_status, outreach_status, do_not_contact, data_quality_score, last_contacted_at, updated_at";

export default function ContactsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedViews = useSavedViews("contact");
  const { canEdit } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [addToListOpen, setAddToListOpen] = useState(false);

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

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("contacts")
      .select(SELECT_FIELDS, { count: "exact" })
      .order(sortBy, { ascending: sortDir === "asc" })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (debouncedSearch.trim()) {
      query = query.or(`email.ilike.%${debouncedSearch}%,first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,company_name_raw.ilike.%${debouncedSearch}%,job_title.ilike.%${debouncedSearch}%`);
    }

    query = applyFilters(query, filterValues, FILTER_CONFIGS);
    const { data, count: total, error } = await query;
    if (!error) { setContacts(data ?? []); setCount(total ?? 0); }
    setLoading(false);
  }, [page, pageSize, debouncedSearch, sortBy, sortDir, filterValues]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const totalPages = Math.ceil(count / pageSize);
  const activeFilterCount = Object.values(filterValues).filter((v) => v && v !== "" && v !== "all").length;

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
    setPage(0);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    selected.size === contacts.length ? setSelected(new Set()) : setSelected(new Set(contacts.map((c) => c.id)));
  };
  const toggleColumn = (key: string) => {
    setVisibleCols((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };
  const handleFilterRemove = (key: string) => {
    setFilterValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setPage(0);
  };

  const col = (key: string) => visibleCols.has(key);
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {count.toLocaleString()} total contacts
              {search && <span className="ml-1">matching "{search}"</span>}
              {activeFilterCount > 0 && <span className="ml-1">· {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <BulkActionsBar
                selectedIds={Array.from(selected)}
                onDone={() => { setSelected(new Set()); fetchContacts(); }}
                onOpenAddToList={() => setAddToListOpen(true)}
              />
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Contact
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, company, title, department, LinkedIn, source..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <SavedViewsDropdown
            views={savedViews.views} activeViewId={savedViews.activeViewId}
            onLoad={applyView}
            onSave={(name) => savedViews.saveView(name, getCurrentViewState())}
            onUpdate={(id) => savedViews.updateView(id, getCurrentViewState())}
            onRename={savedViews.renameView} onDelete={savedViews.deleteView}
            onSetDefault={savedViews.setDefault}
          />
          <FilterPanel
            filters={FILTER_CONFIGS} values={filterValues}
            onChange={(v) => { setFilterValues(v); setPage(0); }}
            onClear={() => { setFilterValues({}); setPage(0); }}
          />
          <ColumnVisibility columns={COLUMNS} visibleColumns={visibleCols} onToggle={toggleColumn} />
        </div>

        <ActiveFilters values={filterValues} filters={FILTER_CONFIGS} onRemove={handleFilterRemove} />
      </div>

      <div className="flex-1 overflow-auto border-t">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox checked={contacts.length > 0 && selected.size === contacts.length} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {col("name") && <TableHead><SortableHeader label="Name" sortKey="last_name" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("email") && <TableHead><SortableHeader label="Email" sortKey="email" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("secondary_email") && <TableHead className="text-xs font-medium text-muted-foreground">Secondary Email</TableHead>}
              {col("job_title") && <TableHead><SortableHeader label="Job Title" sortKey="job_title" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("seniority_level") && <TableHead className="text-xs font-medium text-muted-foreground">Seniority</TableHead>}
              {col("department") && <TableHead className="text-xs font-medium text-muted-foreground">Department</TableHead>}
              {col("company_name_raw") && <TableHead><SortableHeader label="Company" sortKey="company_name_raw" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("country") && <TableHead><SortableHeader label="Country" sortKey="country" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("lifecycle_status") && <TableHead className="text-xs font-medium text-muted-foreground">Lifecycle</TableHead>}
              {col("outreach_status") && <TableHead className="text-xs font-medium text-muted-foreground">Outreach</TableHead>}
              {col("data_quality_score") && <TableHead><SortableHeader label="Quality" sortKey="data_quality_score" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("last_contacted_at") && <TableHead><SortableHeader label="Last Contacted" sortKey="last_contacted_at" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
              {col("updated_at") && <TableHead><SortableHeader label="Updated" sortKey="updated_at" currentSort={sortBy} currentDirection={sortDir} onSort={handleSort} /></TableHead>}
            </TableRow>
          </TableHeader>
          {loading ? (
            <tbody><TableSkeleton rows={pageSize > 50 ? 15 : 10} columns={visibleCols.size + 1} /></tbody>
          ) : contacts.length === 0 ? (
            <tbody>
              <TableRow><TableCell colSpan={20} className="h-48 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No contacts found</p>
                  <p className="text-xs text-muted-foreground/70">
                    {search || activeFilterCount > 0
                      ? "Try adjusting your search query or removing some filters"
                      : "Import contacts or add them manually to get started"}
                  </p>
                </div>
              </TableCell></TableRow>
            </tbody>
          ) : (
            <VirtualizedTableBody
              items={contacts}
              estimateSize={40}
              renderRow={(c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 h-10" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                  </TableCell>
                  {col("name") && (
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                        <DncBadge dnc={c.do_not_contact} />
                      </div>
                    </TableCell>
                  )}
                  {col("email") && <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.email ?? "—"}</TableCell>}
                  {col("secondary_email") && <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.secondary_email ?? "—"}</TableCell>}
                  {col("job_title") && <TableCell className="text-xs max-w-[180px] truncate">{c.job_title ?? "—"}</TableCell>}
                  {col("seniority_level") && <TableCell className="text-xs">{c.seniority_level ?? "—"}</TableCell>}
                  {col("department") && <TableCell className="text-xs">{c.department ?? "—"}</TableCell>}
                  {col("company_name_raw") && <TableCell className="text-xs max-w-[180px] truncate">{c.company_name_raw ?? "—"}</TableCell>}
                  {col("country") && <TableCell className="text-xs">{c.country ?? "—"}</TableCell>}
                  {col("lifecycle_status") && <TableCell><LifecycleBadge status={c.lifecycle_status} /></TableCell>}
                  {col("outreach_status") && <TableCell><OutreachBadge status={c.outreach_status} /></TableCell>}
                  {col("data_quality_score") && <TableCell><QualityScoreBadge score={c.data_quality_score} /></TableCell>}
                  {col("last_contacted_at") && <TableCell className="text-xs text-muted-foreground">{formatDate(c.last_contacted_at)}</TableCell>}
                  {col("updated_at") && <TableCell className="text-xs text-muted-foreground">{formatDate(c.updated_at)}</TableCell>}
                </TableRow>
              ))
            )}
          )}
        </Table>
      </div>

      <TablePagination
        page={page} totalPages={totalPages} totalRows={count} pageSize={pageSize}
        onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        selectedCount={selected.size}
      />

      <AddToListDialog open={addToListOpen} onOpenChange={setAddToListOpen}
        contactIds={Array.from(selected)} onSuccess={() => setSelected(new Set())} />
    </div>
  );
}
