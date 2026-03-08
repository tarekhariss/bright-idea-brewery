import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, List, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onSuccess?: () => void;
}

interface ListItem {
  id: string;
  name: string;
  is_dynamic: boolean;
  description: string | null;
}

export function AddToListDialog({ open, onOpenChange, contactIds, onSuccess }: AddToListDialogProps) {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("lists")
        .select("id, name, is_dynamic, description")
        .order("name", { ascending: true });
      setLists((data as ListItem[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, [open]);

  const staticLists = lists.filter((l) => !l.is_dynamic && l.name.toLowerCase().includes(search.toLowerCase()));

  const addToList = async (listId: string) => {
    if (!user) return;
    setAdding(true);
    const rows = contactIds.map((cid) => ({
      list_id: listId,
      contact_id: cid,
      added_by: user.id,
    }));
    const { error } = await supabase.from("list_contacts").upsert(rows, { onConflict: "list_id,contact_id" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added to list", description: `${contactIds.length} contact(s) added.` });
      onSuccess?.();
      onOpenChange(false);
    }
    setAdding(false);
  };

  const createAndAdd = async () => {
    if (!user || !newName.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.from("lists").insert({
      name: newName.trim(),
      is_dynamic: false,
      created_by: user.id,
    }).select("id").single();
    if (error || !data) {
      toast({ title: "Error", description: error?.message ?? "Failed to create list", variant: "destructive" });
      setAdding(false);
      return;
    }
    await addToList(data.id);
    setCreating(false);
    setNewName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add {contactIds.length} contact(s) to list</DialogTitle>
        </DialogHeader>

        {creating ? (
          <div className="space-y-3">
            <Input
              placeholder="New list name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              className="h-9 text-sm"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Back</Button>
              <Button size="sm" onClick={createAndAdd} disabled={!newName.trim() || adding}>
                {adding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Create & Add
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search static lists..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New List
              </Button>
            </div>
            <Separator />
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : staticLists.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <List className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No static lists found</p>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreating(true)}>Create One</Button>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {staticLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => addToList(list.id)}
                    disabled={adding}
                    className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{list.name}</p>
                      {list.description && <p className="text-xs text-muted-foreground truncate">{list.description}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Static</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
