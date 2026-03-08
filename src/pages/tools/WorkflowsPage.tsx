import { useState } from "react";
import {
  GitBranch, Plus, Play, Pause, MoreHorizontal, Loader2,
  Zap, Filter, ArrowRight, CheckCircle2, Mail, UserPlus,
  Tag, AlertTriangle, Clock, Trash2, ChevronRight, Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface Workflow {
  id: string;
  name: string;
  trigger_type: "contact_created" | "contact_updated" | "import_completed" | "manual" | "scheduled";
  status: "draft" | "active" | "paused";
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  last_run: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

interface WorkflowCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface WorkflowAction {
  id: string;
  type: "send_email" | "assign_owner" | "add_tag" | "update_field" | "add_to_sequence" | "create_task" | "send_notification";
  label: string;
}

const triggerLabels: Record<string, string> = {
  contact_created: "Contact Created",
  contact_updated: "Contact Updated",
  import_completed: "Import Completed",
  manual: "Manual Trigger",
  scheduled: "Scheduled",
};

const triggerIcons: Record<string, any> = {
  contact_created: UserPlus,
  contact_updated: Settings,
  import_completed: CheckCircle2,
  manual: Play,
  scheduled: Clock,
};

const actionIcons: Record<string, any> = {
  send_email: Mail,
  assign_owner: UserPlus,
  add_tag: Tag,
  update_field: Settings,
  add_to_sequence: GitBranch,
  create_task: CheckCircle2,
  send_notification: AlertTriangle,
};

const statusBadge = (s: string) => {
  if (s === "active") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>;
  if (s === "paused") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Paused</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
};

export default function WorkflowsListPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("contact_created");
  const [creating, setCreating] = useState(false);
  const [editWf, setEditWf] = useState<Workflow | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    setCreating(true);
    const wf: Workflow = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      trigger_type: newTrigger as any,
      status: "draft",
      conditions: [
        { id: crypto.randomUUID(), field: "lifecycle_status", operator: "equals", value: "new" },
      ],
      actions: [
        { id: crypto.randomUUID(), type: "assign_owner", label: "Assign to team lead" },
        { id: crypto.randomUUID(), type: "add_tag", label: "Add 'auto-assigned' tag" },
      ],
      last_run: null,
      run_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setWorkflows((p) => [...p, wf]);
      setCreateOpen(false);
      setNewName("");
      setCreating(false);
      setEditWf(wf);
    }, 400);
  };

  const addCondition = (wfId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== wfId) return w;
        const c: WorkflowCondition = { id: crypto.randomUUID(), field: "country", operator: "equals", value: "" };
        const updated = { ...w, conditions: [...w.conditions, c] };
        if (editWf?.id === wfId) setEditWf(updated);
        return updated;
      })
    );
  };

  const addAction = (wfId: string, type: string) => {
    const labels: Record<string, string> = {
      send_email: "Send notification email",
      assign_owner: "Assign owner",
      add_tag: "Add tag",
      update_field: "Update field",
      add_to_sequence: "Enroll in sequence",
      create_task: "Create task",
      send_notification: "Send alert",
    };
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== wfId) return w;
        const a: WorkflowAction = { id: crypto.randomUUID(), type: type as any, label: labels[type] || "New action" };
        const updated = { ...w, actions: [...w.actions, a] };
        if (editWf?.id === wfId) setEditWf(updated);
        return updated;
      })
    );
  };

  const removeCondition = (wfId: string, cId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== wfId) return w;
        const updated = { ...w, conditions: w.conditions.filter((c) => c.id !== cId) };
        if (editWf?.id === wfId) setEditWf(updated);
        return updated;
      })
    );
  };

  const removeAction = (wfId: string, aId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== wfId) return w;
        const updated = { ...w, actions: w.actions.filter((a) => a.id !== aId) };
        if (editWf?.id === wfId) setEditWf(updated);
        return updated;
      })
    );
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Automate actions with rule-based triggers and conditions.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <GitBranch className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No workflows configured</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Build automated workflows to route leads, update statuses, assign owners, and trigger actions based on data conditions.
            </p>
            <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Trigger</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Runs</TableHead>
                <TableHead className="text-xs">Last Run</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf) => (
                <TableRow key={wf.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditWf(wf)}>
                  <TableCell className="text-sm font-medium">{wf.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {(() => { const I = triggerIcons[wf.trigger_type]; return I ? <I className="h-3 w-3" /> : null; })()}
                      {triggerLabels[wf.trigger_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusBadge(wf.status)}</TableCell>
                  <TableCell className="text-sm">{wf.run_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{wf.last_run ? format(new Date(wf.last_run), "MMM d, HH:mm") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(wf.updated_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditWf(wf); }}>
                          <ChevronRight className="h-3.5 w-3.5 mr-2" /> Open Builder
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => {
                          e.stopPropagation(); setWorkflows((p) => p.filter((w) => w.id !== wf.id));
                        }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Create Workflow</DialogTitle>
            <DialogDescription className="text-sm">Define a new automation with triggers, conditions, and actions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Workflow Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Auto-assign new imports" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Trigger</Label>
              <Select value={newTrigger} onValueChange={setNewTrigger}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Builder Dialog */}
      <Dialog open={!!editWf} onOpenChange={() => setEditWf(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base flex-1">{editWf?.name}</DialogTitle>
              {editWf && statusBadge(editWf.status)}
            </div>
            <DialogDescription className="text-sm">Configure trigger, conditions, and actions for this workflow.</DialogDescription>
          </DialogHeader>
          {editWf && (
            <div className="space-y-5">
              {/* Trigger Section */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Trigger
                </h4>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    {(() => { const I = triggerIcons[editWf.trigger_type]; return I ? <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><I className="h-4 w-4" /></div> : null; })()}
                    <div>
                      <p className="text-sm font-medium">{triggerLabels[editWf.trigger_type]}</p>
                      <p className="text-xs text-muted-foreground">This workflow fires when this event occurs</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Arrow */}
              <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>

              {/* Conditions Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" /> Conditions
                  </h4>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => addCondition(editWf.id)}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {editWf.conditions.length === 0 ? (
                  <Card className="border-dashed"><CardContent className="p-3 text-xs text-muted-foreground text-center">No conditions — workflow runs on every trigger event.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {editWf.conditions.map((c) => (
                      <Card key={c.id} className="group">
                        <CardContent className="p-3 flex items-center gap-2">
                          <Input value={c.field} className="h-8 text-xs flex-1" placeholder="Field" readOnly />
                          <Select value={c.operator}>
                            <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">equals</SelectItem>
                              <SelectItem value="not_equals">not equals</SelectItem>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="is_empty">is empty</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input value={c.value} className="h-8 text-xs flex-1" placeholder="Value" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeCondition(editWf.id, c.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>

              {/* Actions Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Actions
                  </h4>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                        <Plus className="h-3 w-3" /> Add Action
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(actionIcons).map(([type, Icon]) => (
                        <DropdownMenuItem key={type} onClick={() => addAction(editWf.id, type)}>
                          <Icon className="h-3.5 w-3.5 mr-2" />
                          {type.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  {editWf.actions.map((a) => {
                    const Icon = actionIcons[a.type] || CheckCircle2;
                    return (
                      <Card key={a.id} className="group">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px] capitalize mb-0.5">{a.type.replace(/_/g, " ")}</Badge>
                            <p className="text-sm truncate">{a.label}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeAction(editWf.id, a.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Activity placeholder */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Workflow run history and activity logs will appear here once the automation engine is active.</p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditWf(null)}>Close</Button>
            <Button size="sm" onClick={() => {
              if (editWf) {
                const next = editWf.status === "active" ? "paused" : "active";
                setWorkflows((p) => p.map((w) => w.id === editWf.id ? { ...w, status: next as any, updated_at: new Date().toISOString() } : w));
                setEditWf(null);
              }
            }}>
              {editWf?.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> Publish</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
