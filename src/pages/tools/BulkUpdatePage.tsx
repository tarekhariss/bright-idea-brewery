/**
 * BulkUpdatePage — Bulk update fields on contacts or companies
 * with field selection, value assignment, and audit trail.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const db = () => supabase as any;

type EntityType = "contacts" | "companies";

interface FieldUpdate {
  id: string;
  field: string;
  value: string;
}

const CONTACT_UPDATABLE = [
  { value: "owner_id", label: "Owner" },
  { value: "lifecycle_status", label: "Lifecycle Status" },
  { value: "outreach_status", label: "Outreach Status" },
  { value: "source", label: "Source" },
  { value: "persona", label: "Persona" },
  { value: "import_tag", label: "Import Tag" },
  { value: "seniority_level", label: "Seniority Level" },
  { value: "department", label: "Department" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "timezone", label: "Timezone" },
  { value: "do_not_contact", label: "Do Not Contact" },
];

const COMPANY_UPDATABLE = [
  { value: "owner_id", label: "Owner" },
  { value: "industry", label: "Industry" },
  { value: "employee_range", label: "Employee Range" },
  { value: "revenue_range", label: "Revenue Range" },
  { value: "funding_stage", label: "Funding Stage" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "company_type", label: "Company Type" },
];

let _id = 0;
const genId = () => `bu_${++_id}`;

export default function BulkUpdatePage() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState<EntityType>("contacts");
  const [scope, setScope] = useState<"filtered" | "list" | "ids">("filtered");
  const [listId, setListId] = useState("");
  const [ids, setIds] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [updates, setUpdates] = useState<FieldUpdate[]>([{ id: genId(), field: "", value: "" }]);
  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);

  const fields = entityType === "contacts" ? CONTACT_UPDATABLE : COMPANY_UPDATABLE;

  useEffect(() => {
    async function loadLists() {
      const { data } = await db().from("lists").select("id, name").eq("is_dynamic", false).order("name");
      setLists((data ?? []) as any[]);
    }
    loadLists();
  }, []);

  const buildBaseQuery = (select: string, opts?: { count?: boolean; head?: boolean }) => {
    let query = opts?.count
      ? db().from(entityType).select(select, { count: "exact", head: opts.head ?? false })
      : db().from(entityType).select(select);

    if (scope === "filtered" && filterField && filterValue) {
      query = query.eq(filterField, filterValue);
    }
    return query;
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    setResult(null);
    try {
      if (scope === "list" && listId) {
        const { data: linkData } = await supabase
          .from("list_contacts")
          .select("contact_id")
          .eq("list_id", listId)
          .limit(5);
        const contactIds = (linkData as any[])?.map(r => r.contact_id) ?? [];
        const { count } = await supabase
          .from("list_contacts")
          .select("contact_id", { count: "exact", head: true })
          .eq("list_id", listId);
        
        let sample: any[] = [];
        if (contactIds.length > 0) {
          const { data } = await db().from("contacts").select("id, first_name, last_name, email").in("id", contactIds);
          sample = data ?? [];
        }
        setPreview({ count: count ?? 0, sample });
      } else if (scope === "ids" && ids.trim()) {
        const idList = ids.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const { data } = await db().from(entityType).select("id, " + (entityType === "contacts" ? "first_name, last_name, email" : "name, domain")).in("id", idList);
        setPreview({ count: data?.length ?? 0, sample: (data ?? []).slice(0, 5) });
      } else {
        const { count } = await buildBaseQuery("id", { count: true, head: true });
        const { data } = await buildBaseQuery("id, " + (entityType === "contacts" ? "first_name, last_name, email" : "name, domain")).limit(5);
        setPreview({ count: count ?? 0, sample: data ?? [] });
      }
    } catch (err: any) {
      toast({ title: "Preview error", description: err.message, variant: "destructive" });
    }
    setPreviewLoading(false);
  };

  const applyUpdates = async () => {
    if (!user) return;
    const validUpdates = updates.filter(u => u.field && u.value !== undefined);
    if (validUpdates.length === 0) {
      toast({ title: "No updates defined", variant: "destructive" });
      return;
    }

    setApplying(true);
    try {
      const updatePayload: Record<string, any> = {};
      for (const u of validUpdates) {
        updatePayload[u.field] = u.value === "true" ? true : u.value === "false" ? false : u.value;
      }

      let query: any;

      if (scope === "list" && listId && entityType === "contacts") {
        // Get all contact IDs from list, then batch update
        const { data: linkData } = await supabase.from("list_contacts").select("contact_id").eq("list_id", listId);
        const contactIds = (linkData as any[])?.map(r => r.contact_id) ?? [];
        if (contactIds.length === 0) {
          toast({ title: "No records to update" });
          setApplying(false);
          return;
        }
        // Batch in chunks of 500
        let updated = 0;
        for (let i = 0; i < contactIds.length; i += 500) {
          const chunk = contactIds.slice(i, i + 500);
          const { count } = await db().from("contacts").update(updatePayload).in("id", chunk).select("id", { count: "exact", head: true });
          updated += count ?? 0;
        }
        setResult({ updated });
      } else if (scope === "ids" && ids.trim()) {
        const idList = ids.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        const { count } = await db().from(entityType).update(updatePayload).in("id", idList).select("id", { count: "exact", head: true });
        setResult({ updated: count ?? 0 });
      } else {
        query = db().from(entityType).update(updatePayload);
        if (filterField && filterValue) {
          query = query.eq(filterField, filterValue);
        }
        const { count } = await query.select("id", { count: "exact", head: true });
        setResult({ updated: count ?? 0 });
      }

      toast({ title: "Bulk update complete", description: `${result?.updated ?? 0} records updated.` });
    } catch (err: any) {
      toast({ title: "Update error", description: err.message, variant: "destructive" });
    }
    setApplying(false);
  };

  const addUpdate = () => setUpdates(prev => [...prev, { id: genId(), field: "", value: "" }]);
  const removeUpdate = (id: string) => setUpdates(prev => prev.filter(u => u.id !== id));
  const setUpdateField = (id: string, field: string) =>
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, field } : u));
  const setUpdateValue = (id: string, value: string) =>
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, value } : u));

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" /> Bulk Update
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Update fields across multiple records at once</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scope card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Target Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Entity Type</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="companies">Companies</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="filtered">By Filter</SelectItem>
                  <SelectItem value="list">By List</SelectItem>
                  <SelectItem value="ids">By IDs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "filtered" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Filter Field</Label>
                  <Select value={filterField} onValueChange={setFilterField}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {fields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="h-8 text-xs mt-1" placeholder="Filter value..." />
                </div>
              </div>
            )}

            {scope === "list" && entityType === "contacts" && (
              <div>
                <Label className="text-xs">List</Label>
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select list..." /></SelectTrigger>
                  <SelectContent>
                    {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "ids" && (
              <div>
                <Label className="text-xs">Record IDs (comma or newline separated)</Label>
                <textarea
                  value={ids}
                  onChange={(e) => setIds(e.target.value)}
                  className="w-full h-20 text-xs border rounded-md px-2 py-1.5 mt-1 bg-background resize-none"
                  placeholder="Paste IDs..."
                />
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              Preview Affected Records
            </Button>

            {preview && (
              <Badge variant="secondary" className="text-xs">
                {preview.count.toLocaleString()} records will be updated
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Updates card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Field Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <Select value={u.field} onValueChange={(v) => setUpdateField(u.id, v)}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Field..." /></SelectTrigger>
                  <SelectContent>
                    {fields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={u.value}
                  onChange={(e) => setUpdateValue(u.id, e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="New value..."
                />
                {updates.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeUpdate(u.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={addUpdate}>
              <Plus className="h-3 w-3" /> Add Field
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Result */}
      {result && (
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium">Bulk update completed</p>
              <p className="text-xs text-muted-foreground">{result.updated.toLocaleString()} records updated successfully</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={applyUpdates}
          disabled={applying || updates.every(u => !u.field || u.value === "")}
        >
          {applying && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Apply Bulk Update
        </Button>
      </div>
    </div>
  );
}
