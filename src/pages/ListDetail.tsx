import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Zap, Users, Trash2, Plus, Download, Calendar, Pencil, RefreshCw, Upload } from "lucide-react";
import { LifecycleBadge } from "@/components/data-table/StatusBadge";
import { TablePagination } from "@/components/data-table/TablePagination";
import { AddToListDialog } from "@/components/lists/AddToListDialog";
import { DynamicListBuilder } from "@/components/lists/DynamicListBuilder";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";
import { applyAdvancedFilters } from "@/lib/advanced-filter-engine";
import { format } from "date-fns";
import type { LifecycleStatus } from "@/integrations/supabase/db-types";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import { toast } from "@/hooks/use-toast";

const db = () => supabase as any;

interface ListData {
  id: string;
  name: string;
  description: string | null;
  is_dynamic: boolean;
  filter_criteria: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ListContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  company_name_raw: string | null;
  lifecycle_status: LifecycleStatus;
}

const PAGE_SIZE = 25;

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<ListData | null>(null);
  const [contacts, setContacts] = useState<ListContact[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchList = useCallback(async () => {
    if (!id) return;
    const { data } = await db().from("lists").select("*").eq("id", id).maybeSingle();
    setList(data as ListData | null);
  }, [id]);

  const fetchDynamicContacts = useCallback(async (listData: ListData) => {
    const fc = listData.filter_criteria as FilterDefinition | null;
    if (!fc) {
      setContacts([]);
      setContactCount(0);
      return;
    }

    // Count query
    let countQuery = db().from("contacts").select("*", { count: "exact", head: true });
    countQuery = applyAdvancedFilters(countQuery, fc);
    countQuery = await applyListFilters(countQuery, fc);
    const { count } = await countQuery;
    setContactCount(count ?? 0);

    // Data query
    let dataQuery = db().from("contacts")
      .select("id, first_name, last_name, email, job_title, company_name_raw, lifecycle_status")
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    dataQuery = applyAdvancedFilters(dataQuery, fc);
    dataQuery = await applyListFilters(dataQuery, fc);
    const { data } = await dataQuery;
    setContacts((data as ListContact[]) ?? []);
  }, [page]);

  const fetchStaticContacts = useCallback(async () => {
    if (!id) return;
    const { count } = await supabase
      .from("list_contacts")
      .select("contact_id", { count: "exact", head: true })
      .eq("list_id", id);
    setContactCount(count ?? 0);

    const { data: linkData } = await supabase
      .from("list_contacts")
      .select("contact_id")
      .eq("list_id", id)
      .order("added_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (linkData && linkData.length > 0) {
      const contactIds = (linkData as any[]).map((l) => l.contact_id);
      const { data: contactData } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, job_title, company_name_raw, lifecycle_status")
        .in("id", contactIds);
      setContacts((contactData as ListContact[]) ?? []);
    } else {
      setContacts([]);
    }
  }, [id, page]);

  const fetchContacts = useCallback(async () => {
    if (!list) return;
    setLoading(true);
    if (list.is_dynamic) {
      await fetchDynamicContacts(list);
    } else {
      await fetchStaticContacts();
    }
    setLoading(false);
  }, [list, fetchDynamicContacts, fetchStaticContacts]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { if (list) fetchContacts(); }, [fetchContacts, list]);

  const removeContact = async (contactId: string) => {
    if (!id) return;
    const { error } = await db().from("list_contacts").delete().eq("list_id", id).eq("contact_id", contactId);
    if (!error) {
      toast({ title: "Contact removed from list" });
      fetchContacts();
    }
  };

  const totalPages = Math.ceil(contactCount / PAGE_SIZE);
  const fmtDate = (d: string) => { try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; } };

  const filterCriteria = list?.filter_criteria as FilterDefinition | null;
  const ruleCount = filterCriteria
    ? (filterCriteria.conditions?.filter(c => c.field).length ?? 0) +
      (filterCriteria.groups?.length ?? 0) +
      (filterCriteria.includeLists?.length ?? 0) +
      (filterCriteria.excludeLists?.length ?? 0)
    : 0;

  if (!list && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">List not found</p>
        <Button variant="outline" onClick={() => navigate("/lists")}>Back to Lists</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/lists")} className="gap-1.5 text-xs -ml-2 text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Lists
      </Button>

      {list && (
        <>
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
                <Badge variant={list.is_dynamic ? "default" : "secondary"} className="text-[11px]">
                  {list.is_dynamic ? <><Zap className="h-3 w-3 mr-0.5" /> Dynamic</> : "Static"}
                </Badge>
              </div>
              {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {contactCount.toLocaleString()} contacts</span>
                {list.is_dynamic && <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {ruleCount} rule{ruleCount !== 1 ? "s" : ""}</span>}
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Updated {fmtDate(list.updated_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {list.is_dynamic && (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fetchContacts()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit Rules
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              {!list.is_dynamic && (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/imports/new?list_id=${list.id}`)}>
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Contacts
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Dynamic rules display */}
          {list.is_dynamic && filterCriteria && ruleCount > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Filter Rules</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {filterCriteria.conditions?.filter(c => c.field).map((c) => (
                    <Badge key={c.id} variant="outline" className="text-[11px]">
                      {c.conditionType === "exclude" ? "NOT " : ""}{c.field} {c.operator} {String(c.value ?? "")}
                    </Badge>
                  ))}
                  {filterCriteria.includeLists?.map(lid => (
                    <Badge key={`inc-${lid}`} variant="outline" className="text-[11px] border-primary/30">Include list</Badge>
                  ))}
                  {filterCriteria.excludeLists?.map(lid => (
                    <Badge key={`exc-${lid}`} variant="outline" className="text-[11px] border-destructive/30">Exclude list</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts table */}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Email</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Job Title</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Lifecycle</TableHead>
                  <TableHead className="w-24 text-right text-xs font-medium text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium">No contacts in this list</p>
                        {!list.is_dynamic && (
                          <Button variant="outline" size="sm" className="text-xs mt-1" onClick={() => setAddOpen(true)}>
                            Add Contacts
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((c) => (
                    <TableRow key={c.id} className="h-10">
                      <TableCell>
                        <Link to={`/contacts/${c.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                          {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-xs">{c.job_title ?? "—"}</TableCell>
                      <TableCell className="text-xs">{c.company_name_raw ?? "—"}</TableCell>
                      <TableCell><LifecycleBadge status={c.lifecycle_status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PushToCrmButton
                            size="sm"
                            variant="ghost"
                            label="CRM"
                            className="h-7 px-2 text-[11px]"
                            contactId={c.id}
                            sourceChannel="list"
                          />
                          {!list.is_dynamic && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeContact(c.id)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <TablePagination
                page={page}
                totalPages={totalPages}
                totalRows={contactCount}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      <AddToListDialog open={addOpen} onOpenChange={setAddOpen} contactIds={[]} onSuccess={fetchContacts} />

      {list?.is_dynamic && (
        <DynamicListBuilder
          open={editOpen}
          onOpenChange={setEditOpen}
          existingList={{
            id: list.id,
            name: list.name,
            description: list.description,
            filter_criteria: filterCriteria,
            include_lists: filterCriteria?.includeLists ?? [],
            exclude_lists: filterCriteria?.excludeLists ?? [],
          }}
          onSuccess={() => { fetchList(); }}
        />
      )}
    </div>
  );
}

/** Apply include/exclude list filters from the FilterDefinition */
async function applyListFilters(query: any, fc: FilterDefinition): Promise<any> {
  if (fc.includeLists?.length) {
    const { data } = await supabase
      .from("list_contacts")
      .select("contact_id")
      .in("list_id", fc.includeLists);
    const ids = [...new Set((data as any[])?.map(r => r.contact_id) ?? [])];
    if (ids.length > 0) {
      query = query.in("id", ids);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // no matches
    }
  }
  if (fc.excludeLists?.length) {
    const { data } = await supabase
      .from("list_contacts")
      .select("contact_id")
      .in("list_id", fc.excludeLists);
    const ids = [...new Set((data as any[])?.map(r => r.contact_id) ?? [])];
    if (ids.length > 0) {
      query = query.not("id", "in", `(${ids.join(",")})`);
    }
  }
  return query;
}
