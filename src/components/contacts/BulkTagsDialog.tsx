/**
 * BulkTagsDialog — apply or remove tags on a set of contacts/companies.
 * Uses contact_tags / company_tags junction tables.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds: string[];
  entityType: "contact" | "company";
  workspaceId: string;
  onSuccess?: () => void;
}

interface Tag { id: string; name: string; color: string | null; }

export function BulkTagsDialog({ open, onOpenChange, entityIds, entityType, workspaceId, onSuccess }: Props) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");
    (async () => {
      const { data } = await supabase
        .from("tags").select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("name");
      setTags((data ?? []) as Tag[]);
    })();
  }, [open, workspaceId]);

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const joinTable = entityType === "contact" ? "contact_tags" : "company_tags";
  const fk = entityType === "contact" ? "contact_id" : "company_id";

  async function createTag() {
    if (!search.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("tags").insert({
      name: search.trim(), workspace_id: workspaceId, created_by: user?.id ?? null,
    } as any).select("id, name, color").single();
    setCreating(false);
    if (error || !data) { toast.error("Could not create tag"); return; }
    setTags(prev => [...prev, data as Tag]);
    setSelected(prev => new Set([...prev, (data as Tag).id]));
    setSearch("");
  }

  async function apply(mode: "add" | "remove") {
    if (selected.size === 0) { toast.error("Select at least one tag"); return; }
    setBusy(true);
    if (mode === "add") {
      const rows = entityIds.flatMap(eid => Array.from(selected).map(tid => ({ [fk]: eid, tag_id: tid })));
      const { error } = await (supabase.from(joinTable as any) as any).upsert(rows, { onConflict: `${fk},tag_id` });
      if (error) { toast.error("Failed to add tags"); setBusy(false); return; }
      toast.success(`Tags applied to ${entityIds.length} ${entityType}(s)`);
    } else {
      const { error } = await (supabase.from(joinTable as any) as any)
        .delete().in(fk, entityIds).in("tag_id", Array.from(selected));
      if (error) { toast.error("Failed to remove tags"); setBusy(false); return; }
      toast.success(`Tags removed from ${entityIds.length} ${entityType}(s)`);
    }
    setBusy(false);
    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Manage Tags</DialogTitle>
          <DialogDescription className="text-xs">
            Apply or remove tags on {entityIds.length} selected {entityType}(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Search or create tag…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
            {search.trim() && !filtered.some(t => t.name.toLowerCase() === search.toLowerCase().trim()) && (
              <Button size="sm" variant="outline" onClick={createTag} disabled={creating}>
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} New
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No tags found.</p>}
            {filtered.map(t => {
              const active = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(prev => {
                    const next = new Set(prev);
                    next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                    return next;
                  })}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between ${active ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: t.color ?? "hsl(var(--primary))" }} />
                    {t.name}
                  </span>
                  {active && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(selected).map(id => {
                const t = tags.find(x => x.id === id);
                return t ? <Badge key={id} variant="secondary" className="text-[10px]">{t.name}</Badge> : null;
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => apply("remove")} disabled={busy || selected.size === 0}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Remove
            </Button>
            <Button size="sm" onClick={() => apply("add")} disabled={busy || selected.size === 0}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
