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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Loader2, Flag, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const GOAL_TYPES = [
  { value: "contacts_created", label: "Contacts Created" },
  { value: "emails_sent", label: "Emails Sent" },
  { value: "calls_made", label: "Calls Made" },
  { value: "meetings_booked", label: "Meetings Booked" },
  { value: "deals_won", label: "Deals Won" },
  { value: "revenue", label: "Revenue" },
  { value: "custom", label: "Custom" },
];

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export default function GoalsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", goal_type: "contacts_created", target_value: "100",
    period: "monthly", start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    team_goal: false,
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("goals") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (goal: any) => {
      const { error } = await (supabase.from("goals") as any).insert({ ...goal, created_by: user?.id, assigned_to: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal created"); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...u }: any) => {
      const { error } = await (supabase.from("goals") as any).update(u).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal updated"); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("goals") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGoal(null);
    setForm({ name: "", description: "", goal_type: "contacts_created", target_value: "100", period: "monthly", start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], team_goal: false });
  };

  const openEdit = (g: any) => {
    setEditingGoal(g);
    setForm({ name: g.name, description: g.description || "", goal_type: g.goal_type, target_value: String(g.target_value), period: g.period, start_date: g.start_date, end_date: g.end_date, team_goal: g.team_goal });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form, target_value: Number(form.target_value) };
    if (editingGoal) updateMutation.mutate({ id: editingGoal.id, ...payload });
    else createMutation.mutate(payload);
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const activeGoals = goals?.filter((g: any) => g.is_active) ?? [];
  const completedGoals = goals?.filter((g: any) => !g.is_active) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Goals</h2>
          <p className="text-sm text-muted-foreground">Set team and individual performance goals with real-time tracking.</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setEditingGoal(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> New Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !goals?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Target className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No goals set</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">Create performance goals to track your team's progress.</p>
            <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGoals.map((g: any) => {
                  const pct = g.target_value > 0 ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
                  return (
                    <Card key={g.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] capitalize">{g.goal_type.replace(/_/g, " ")}</Badge>
                              <Badge variant="outline" className="text-[10px] capitalize">{g.period}</Badge>
                              {g.team_goal && <Badge variant="outline" className="text-[10px]">Team</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{g.current_value.toLocaleString()} / {g.target_value.toLocaleString()}</span>
                            <span className="font-medium">{pct.toFixed(0)}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(g.start_date), "MMM d")} — {format(new Date(g.end_date), "MMM d, yyyy")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
            <DialogDescription>Set a measurable performance target.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Goal Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Q1 Outbound Emails" className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.goal_type} onValueChange={(v) => setForm((p) => ({ ...p, goal_type: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Period</Label>
                <Select value={form.period} onValueChange={(v) => setForm((p) => ({ ...p, period: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Target Value</Label>
              <Input type="number" value={form.target_value} onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))} className="mt-1 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" className="mt-1 text-sm" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.team_goal} onCheckedChange={(v) => setForm((p) => ({ ...p, team_goal: v }))} />
              <Label className="text-xs">Team goal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingGoal ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
