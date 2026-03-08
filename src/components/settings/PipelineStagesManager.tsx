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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PipelineStagesManagerProps {
  entityType: "contact" | "company" | "deal";
  title: string;
  description: string;
}

export default function PipelineStagesManager({ entityType, title, description }: PipelineStagesManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any | null>(null);
  const [form, setForm] = useState({ stage_name: "", stage_key: "", color: "#6366f1", description: "", is_closed: false, is_won: false });

  const { data: stages, isLoading } = useQuery({
    queryKey: ["pipeline-stages", entityType],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pipeline_stages") as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("pipeline_name", "default")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (stage: any) => {
      const { error } = await (supabase.from("pipeline_stages") as any).insert({
        ...stage,
        entity_type: entityType,
        pipeline_name: "default",
        created_by: user?.id,
        display_order: (stages?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pipeline-stages", entityType] }); toast.success("Stage created"); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase.from("pipeline_stages") as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pipeline-stages", entityType] }); toast.success("Stage updated"); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("pipeline_stages") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pipeline-stages", entityType] }); toast.success("Stage deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("pipeline_stages") as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline-stages", entityType] }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditingStage(null); setForm({ stage_name: "", stage_key: "", color: "#6366f1", description: "", is_closed: false, is_won: false }); };

  const openCreate = () => { setEditingStage(null); setForm({ stage_name: "", stage_key: "", color: "#6366f1", description: "", is_closed: false, is_won: false }); setDialogOpen(true); };

  const openEdit = (stage: any) => {
    setEditingStage(stage);
    setForm({ stage_name: stage.stage_name, stage_key: stage.stage_key, color: stage.color || "#6366f1", description: stage.description || "", is_closed: stage.is_closed, is_won: stage.is_won });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const key = form.stage_key || form.stage_name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const payload = { ...form, stage_key: key };
    if (editingStage) updateMutation.mutate({ id: editingStage.id, ...payload });
    else createMutation.mutate(payload);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Add Stage
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !stages?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No pipeline stages defined yet.</p>
            <Button size="sm" className="mt-4 gap-1.5 text-xs" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add First Stage</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {stages.map((s: any, i: number) => (
            <Card key={s.id} className={`${!s.is_active ? "opacity-50" : ""}`}>
              <CardContent className="flex items-center gap-4 p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color || "#6b7280" }} />
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.stage_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.stage_key}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.is_closed && <Badge variant="outline" className="text-[10px]">{s.is_won ? "Won" : "Closed"}</Badge>}
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: s.id, is_active: v })} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStage ? "Edit Stage" : "Add Stage"}</DialogTitle>
            <DialogDescription>Configure a pipeline stage for {entityType} records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Stage Name</Label>
              <Input value={form.stage_name} onChange={(e) => setForm((p) => ({ ...p, stage_name: e.target.value }))} placeholder="e.g. Discovery" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Stage Key</Label>
              <Input
                value={form.stage_key || form.stage_name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}
                onChange={(e) => setForm((p) => ({ ...p, stage_key: e.target.value }))}
                className="mt-1 h-9 text-sm font-mono"
                disabled={!!editingStage}
              />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-9 text-sm font-mono flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" className="mt-1 h-9 text-sm" />
            </div>
            {entityType === "deal" && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_closed} onCheckedChange={(v) => setForm((p) => ({ ...p, is_closed: v }))} />
                  <Label className="text-xs">Closed stage</Label>
                </div>
                {form.is_closed && (
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_won} onCheckedChange={(v) => setForm((p) => ({ ...p, is_won: v }))} />
                    <Label className="text-xs">Won</Label>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.stage_name.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingStage ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
