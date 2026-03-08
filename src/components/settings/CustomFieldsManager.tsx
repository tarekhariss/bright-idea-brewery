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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EntityType = "contact" | "company" | "deal";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "picklist", label: "Picklist" },
  { value: "multi_picklist", label: "Multi Picklist" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Long Text" },
  { value: "currency", label: "Currency" },
];

interface CustomFieldsManagerProps {
  entityType: EntityType;
  title: string;
  description: string;
}

export default function CustomFieldsManager({ entityType, title, description }: CustomFieldsManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [form, setForm] = useState({
    field_name: "",
    field_label: "",
    field_type: "text",
    is_required: false,
    default_value: "",
    description: "",
  });

  const { data: fields, isLoading } = useQuery({
    queryKey: ["custom-fields", entityType],
    queryFn: async () => {
      const { data, error } = await (supabase.from("custom_fields") as any)
        .select("*")
        .eq("entity_type", entityType)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (field: any) => {
      const { error } = await (supabase.from("custom_fields") as any).insert({
        ...field,
        entity_type: entityType,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", entityType] });
      toast.success("Field created");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase.from("custom_fields") as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", entityType] });
      toast.success("Field updated");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("custom_fields") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", entityType] });
      toast.success("Field deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("custom_fields") as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-fields", entityType] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingField(null);
    setForm({ field_name: "", field_label: "", field_type: "text", is_required: false, default_value: "", description: "" });
  };

  const openCreate = () => {
    setEditingField(null);
    setForm({ field_name: "", field_label: "", field_type: "text", is_required: false, default_value: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (field: any) => {
    setEditingField(field);
    setForm({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      default_value: field.default_value || "",
      description: field.description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const slug = form.field_name || form.field_label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const payload = { ...form, field_name: slug };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, ...payload });
    } else {
      createMutation.mutate({ ...payload, display_order: (fields?.length ?? 0) + 1 });
    }
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
          <Plus className="h-3.5 w-3.5" /> Add Field
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !fields?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No custom fields defined for {entityType}s yet.</p>
            <Button size="sm" className="mt-4 gap-1.5 text-xs" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Add First Field
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8"></TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Key</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Required</TableHead>
                <TableHead className="text-xs">Active</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell><GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" /></TableCell>
                  <TableCell className="text-sm font-medium">{f.field_label}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{f.field_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] capitalize">{f.field_type.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>{f.is_required && <Badge variant="outline" className="text-[10px]">Required</Badge>}</TableCell>
                  <TableCell>
                    <Switch checked={f.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: f.id, is_active: v })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edit Field" : "Add Custom Field"}</DialogTitle>
            <DialogDescription>Define a custom field for {entityType} records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Field Label</Label>
              <Input value={form.field_label} onChange={(e) => setForm((p) => ({ ...p, field_label: e.target.value }))} placeholder="e.g. LinkedIn Score" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Field Key</Label>
              <Input
                value={form.field_name || form.field_label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}
                onChange={(e) => setForm((p) => ({ ...p, field_name: e.target.value }))}
                placeholder="auto-generated"
                className="mt-1 h-9 text-sm font-mono"
                disabled={!!editingField}
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.field_type} onValueChange={(v) => setForm((p) => ({ ...p, field_type: v }))}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" className="mt-1 text-sm" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_required} onCheckedChange={(v) => setForm((p) => ({ ...p, is_required: v }))} />
              <Label className="text-xs">Required field</Label>
            </div>
            <div>
              <Label className="text-xs">Default Value</Label>
              <Input value={form.default_value} onChange={(e) => setForm((p) => ({ ...p, default_value: e.target.value }))} placeholder="Optional" className="mt-1 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.field_label.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingField ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
