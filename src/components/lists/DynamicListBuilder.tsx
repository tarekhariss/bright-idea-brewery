/**
 * DynamicListBuilder — Dialog for creating/editing dynamic lists
 * with the Advanced Filter Engine and preview counts.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Zap, Users, Eye, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AdvancedFilterPanel } from "@/components/data-table/AdvancedFilterPanel";
import type { FilterDefinition } from "@/lib/advanced-filter-types";
import { createEmptyFilterDefinition } from "@/lib/advanced-filter-types";
import { applyAdvancedFilters, countActiveConditions } from "@/lib/advanced-filter-engine";
import { CONTACT_FILTER_FIELDS } from "@/lib/filter-field-registry";
import { useDebounce } from "@/hooks/use-debounce";

const db = () => supabase as any;

interface DynamicListBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If editing, pass existing list data */
  existingList?: {
    id: string;
    name: string;
    description: string | null;
    filter_criteria: FilterDefinition | null;
    include_lists?: string[];
    exclude_lists?: string[];
  } | null;
  onSuccess?: () => void;
}

interface ListOption {
  id: string;
  name: string;
}

export function DynamicListBuilder({ open, onOpenChange, existingList, onSuccess }: DynamicListBuilderProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filterDef, setFilterDef] = useState<FilterDefinition>(createEmptyFilterDefinition());
  const [includeLists, setIncludeLists] = useState<string[]>([]);
  const [excludeLists, setExcludeLists] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [allLists, setAllLists] = useState<ListOption[]>([]);

  const debouncedFilter = useDebounce(filterDef, 500);

  // Initialize from existing list
  useEffect(() => {
    if (open && existingList) {
      setName(existingList.name);
      setDescription(existingList.description ?? "");
      setFilterDef(existingList.filter_criteria ?? createEmptyFilterDefinition());
      setIncludeLists(existingList.include_lists ?? []);
      setExcludeLists(existingList.exclude_lists ?? []);
    } else if (open) {
      setName("");
      setDescription("");
      setFilterDef(createEmptyFilterDefinition());
      setIncludeLists([]);
      setExcludeLists([]);
    }
    setPreviewCount(null);
  }, [open, existingList]);

  // Load available lists for include/exclude
  useEffect(() => {
    if (!open) return;
    async function loadLists() {
      const { data } = await db().from("lists").select("id, name").eq("is_dynamic", false).order("name");
      setAllLists((data as ListOption[]) ?? []);
    }
    loadLists();
  }, [open]);

  // Preview count
  const runPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      let query = db().from("contacts").select("*", { count: "exact", head: true });
      query = applyAdvancedFilters(query, debouncedFilter);

      // Include list filtering
      if (includeLists.length > 0) {
        const { data: incData } = await supabase
          .from("list_contacts")
          .select("contact_id")
          .in("list_id", includeLists);
        const incIds = [...new Set((incData as any[])?.map(r => r.contact_id) ?? [])];
        if (incIds.length > 0) {
          query = query.in("id", incIds);
        } else {
          setPreviewCount(0);
          setPreviewLoading(false);
          return;
        }
      }

      // Exclude list filtering
      if (excludeLists.length > 0) {
        const { data: excData } = await supabase
          .from("list_contacts")
          .select("contact_id")
          .in("list_id", excludeLists);
        const excIds = [...new Set((excData as any[])?.map(r => r.contact_id) ?? [])];
        if (excIds.length > 0) {
          query = query.not("id", "in", `(${excIds.join(",")})`);
        }
      }

      const { count } = await query;
      setPreviewCount(count ?? 0);
    } catch {
      setPreviewCount(null);
    }
    setPreviewLoading(false);
  }, [debouncedFilter, includeLists, excludeLists]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      is_dynamic: true,
      filter_criteria: { ...filterDef, includeLists, excludeLists },
      created_by: user.id,
    };

    let error;
    if (existingList) {
      ({ error } = await db().from("lists").update(payload).eq("id", existingList.id));
    } else {
      ({ error } = await db().from("lists").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: existingList ? "List updated" : "Dynamic list created" });
      onSuccess?.();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const activeConditions = countActiveConditions(filterDef);
  const availableForInclude = allLists.filter(l => !includeLists.includes(l.id) && !excludeLists.includes(l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            {existingList ? "Edit Dynamic List" : "Create Dynamic List"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm mt-1" placeholder="List name..." autoFocus />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-sm mt-1" placeholder="Optional description..." />
            </div>
          </div>

          <Separator />

          {/* Filter Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium">Filter Rules</Label>
              <Badge variant="outline" className="text-[10px]">{activeConditions} condition{activeConditions !== 1 ? "s" : ""}</Badge>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20">
              <AdvancedFilterPanel
                filterDefinition={filterDef}
                onFilterChange={setFilterDef}
                fields={CONTACT_FILTER_FIELDS}
                entityType="contact"
              />
            </div>
          </div>

          {/* Include/Exclude Lists */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-green-600">Include from Lists</Label>
              <div className="mt-1 space-y-1">
                {includeLists.map(lid => {
                  const l = allLists.find(x => x.id === lid);
                  return (
                    <div key={lid} className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded px-2 py-1">
                      <span className="text-xs truncate">{l?.name ?? lid}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIncludeLists(prev => prev.filter(x => x !== lid))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
                {availableForInclude.length > 0 && (
                  <select
                    className="w-full h-7 text-xs border rounded px-2 bg-background"
                    value=""
                    onChange={(e) => { if (e.target.value) setIncludeLists(prev => [...prev, e.target.value]); }}
                  >
                    <option value="">+ Add list...</option>
                    {availableForInclude.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-red-600">Exclude from Lists</Label>
              <div className="mt-1 space-y-1">
                {excludeLists.map(lid => {
                  const l = allLists.find(x => x.id === lid);
                  return (
                    <div key={lid} className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 rounded px-2 py-1">
                      <span className="text-xs truncate">{l?.name ?? lid}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setExcludeLists(prev => prev.filter(x => x !== lid))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
                {availableForInclude.length > 0 && (
                  <select
                    className="w-full h-7 text-xs border rounded px-2 bg-background"
                    value=""
                    onChange={(e) => { if (e.target.value) setExcludeLists(prev => [...prev, e.target.value]); }}
                  >
                    <option value="">+ Exclude list...</option>
                    {availableForInclude.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Preview Count
            </Button>
            {previewCount !== null && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Users className="h-3 w-3" /> {previewCount.toLocaleString()} matching contacts
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {existingList ? "Save Changes" : "Create Dynamic List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
