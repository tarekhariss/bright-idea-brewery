import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Plus, List, Zap, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { DynamicListBuilder } from "@/components/lists/DynamicListBuilder";

const db = () => supabase as any;

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  is_dynamic: boolean;
  filter_criteria: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function ListsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "static" | "dynamic">("all");
  const [sortBy, setSortBy] = useState<"updated_at" | "created_at" | "name">("updated_at");
  const [createOpen, setCreateOpen] = useState(false);
  const [dynamicOpen, setDynamicOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    let query = db().from("lists").select("*").order(sortBy, { ascending: sortBy === "name" });
    const { data } = await query;
    const rows = (data as ListRow[]) ?? [];
    setLists(rows);

    const staticIds = rows.filter((l) => !l.is_dynamic).map((l) => l.id);
    if (staticIds.length > 0) {
      const countMap: Record<string, number> = {};
      for (const lid of staticIds) {
        const { count } = await supabase
          .from("list_contacts")
          .select("contact_id", { count: "exact", head: true })
          .eq("list_id", lid);
        countMap[lid] = count ?? 0;
      }
      setCounts(countMap);
    }
    setLoading(false);
  }, [sortBy]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const filtered = lists.filter((l) => {
    if (typeFilter === "static" && l.is_dynamic) return false;
    if (typeFilter === "dynamic" && !l.is_dynamic) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreateStatic = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { error } = await db().from("lists").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      is_dynamic: false,
      filter_criteria: null,
      created_by: user.id,
    });
    if (!error) {
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      await fetchLists();
    }
    setCreating(false);
  };

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
  };

  const dynamicConditionCount = (l: ListRow) => {
    if (!l.filter_criteria) return 0;
    const fc = l.filter_criteria;
    return (fc.conditions?.length ?? 0) + (fc.groups?.length ?? 0) + (fc.includeLists?.length ?? 0) + (fc.excludeLists?.length ?? 0);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize contacts into segments for targeted outreach</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setDynamicOpen(true)}>
            <Zap className="h-3.5 w-3.5" /> Dynamic List
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Static List
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search lists..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="static">Static</SelectItem>
            <SelectItem value="dynamic">Dynamic</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Last Updated</SelectItem>
            <SelectItem value="created_at">Created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <List className="h-10 w-10 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">No lists found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {lists.length === 0 ? "Create your first list to start organizing contacts." : "Try adjusting your search or filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((list) => (
            <Card key={list.id} className="cursor-pointer hover:border-primary/30 transition-colors group" onClick={() => navigate(`/lists/${list.id}`)}>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold group-hover:text-primary transition-colors truncate flex-1">{list.name}</h3>
                  <Badge variant={list.is_dynamic ? "default" : "secondary"} className="text-[10px] shrink-0 ml-2">
                    {list.is_dynamic ? <><Zap className="h-2.5 w-2.5 mr-0.5" /> Dynamic</> : "Static"}
                  </Badge>
                </div>
                {list.description && <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {list.is_dynamic
                      ? `${dynamicConditionCount(list)} rule${dynamicConditionCount(list) !== 1 ? "s" : ""}`
                      : `${(counts[list.id] ?? 0).toLocaleString()} contacts`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(list.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Static List Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base">Create Static List</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm mt-1" placeholder="List name..." autoFocus />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-sm mt-1 resize-none" rows={2} placeholder="Optional description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateStatic} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dynamic List Builder */}
      <DynamicListBuilder open={dynamicOpen} onOpenChange={setDynamicOpen} onSuccess={fetchLists} />
    </div>
  );
}
