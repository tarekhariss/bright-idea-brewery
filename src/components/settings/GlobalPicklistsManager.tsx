import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Loader2, ChevronRight, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function GlobalPicklistsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPicklist, setEditingPicklist] = useState<any | null>(null);
  const [selectedPicklist, setSelectedPicklist] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [optionForm, setOptionForm] = useState({ label: "", value: "", color: "" });
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);

  const { data: picklists, isLoading } = useQuery({
    queryKey: ["global-picklists"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("global_picklists") as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["picklist-options", selectedPicklist?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("global_picklist_options") as any)
        .select("*")
        .eq("picklist_id", selectedPicklist!.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedPicklist,
  });

  const createPicklist = useMutation({
    mutationFn: async (pl: any) => {
      const { error } = await (supabase.from("global_picklists") as any).insert({ ...pl, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["global-picklists"] }); toast.success("Picklist created"); setDialogOpen(false); setForm({ name: "", description: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePicklist = useMutation({
    mutationFn: async ({ id, ...u }: any) => {
      const { error } = await (supabase.from("global_picklists") as any).update(u).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["global-picklists"] }); toast.success("Picklist updated"); setDialogOpen(false); setEditingPicklist(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePicklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("global_picklists") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["global-picklists"] }); setSelectedPicklist(null); toast.success("Picklist deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createOption = useMutation({
    mutationFn: async (opt: any) => {
      const { error } = await (supabase.from("global_picklist_options") as any).insert({
        ...opt,
        picklist_id: selectedPicklist!.id,
        display_order: (options?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["picklist-options"] }); toast.success("Option added"); setOptionDialogOpen(false); setOptionForm({ label: "", value: "", color: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("global_picklist_options") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["picklist-options"] }); toast.success("Option removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Global Picklists</h2>
          <p className="text-sm text-muted-foreground">Manage shared dropdown values used across contacts, companies, and deals.</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setEditingPicklist(null); setForm({ name: "", description: "" }); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add Picklist
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Picklist list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : !picklists?.length ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">No picklists yet.</CardContent>
            </Card>
          ) : (
            picklists.map((pl: any) => (
              <Card
                key={pl.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedPicklist?.id === pl.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedPicklist(pl)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pl.name}</p>
                    {pl.description && <p className="text-xs text-muted-foreground truncate">{pl.description}</p>}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Options panel */}
        <div className="md:col-span-2">
          {selectedPicklist ? (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{selectedPicklist.name}</h3>
                    {selectedPicklist.description && <p className="text-xs text-muted-foreground">{selectedPicklist.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setEditingPicklist(selectedPicklist); setForm({ name: selectedPicklist.name, description: selectedPicklist.description || "" }); setDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs text-destructive gap-1" onClick={() => deletePicklist.mutate(selectedPicklist.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Options</p>
                  <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => { setOptionForm({ label: "", value: "", color: "" }); setOptionDialogOpen(true); }}>
                    <Plus className="h-3 w-3" /> Add Option
                  </Button>
                </div>
                {optionsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : !options?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No options yet. Add your first value.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8">#</TableHead>
                        <TableHead className="text-xs">Label</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                        <TableHead className="text-xs w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {options.map((opt: any, i: number) => (
                        <TableRow key={opt.id}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              {opt.color && <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />}
                              {opt.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{opt.value}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOption.mutate(opt.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Select a picklist to manage its options.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Picklist dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingPicklist(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPicklist ? "Edit Picklist" : "Create Picklist"}</DialogTitle>
            <DialogDescription>A picklist is a shared set of dropdown values.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Lead Source" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" className="mt-1 text-sm" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => editingPicklist ? updatePicklist.mutate({ id: editingPicklist.id, ...form }) : createPicklist.mutate(form)} disabled={!form.name.trim()}>
              {(createPicklist.isPending || updatePicklist.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingPicklist ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={(o) => !o && setOptionDialogOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Option</DialogTitle>
            <DialogDescription>Add a value to {selectedPicklist?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={optionForm.label} onChange={(e) => setOptionForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Inbound" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Value (key)</Label>
              <Input
                value={optionForm.value || optionForm.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}
                onChange={(e) => setOptionForm((p) => ({ ...p, value: e.target.value }))}
                className="mt-1 h-9 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Color (optional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={optionForm.color || "#6366f1"} onChange={(e) => setOptionForm((p) => ({ ...p, color: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={optionForm.color} onChange={(e) => setOptionForm((p) => ({ ...p, color: e.target.value }))} className="h-9 text-sm font-mono flex-1" placeholder="#hex" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOptionDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createOption.mutate({ label: optionForm.label, value: optionForm.value || optionForm.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), color: optionForm.color || null })} disabled={!optionForm.label.trim()}>
              {createOption.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
