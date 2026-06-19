import { useState, useCallback } from "react";
import {
  GitBranch, Plus, Play, Pause, Trash2, MoreHorizontal,
  Mail, Phone, CheckSquare, Loader2, Clock, ChevronRight, Users,
  ChevronDown, GripVertical, ArrowUp, ArrowDown, Eye, Code,
  Copy, Variable, User, Building2, Briefcase, ToggleLeft,
  Settings2, Save, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfigRequiredBanner } from "@/components/config";
import {
  useSequences, useSequenceSteps, useSequenceEnrollments,
  useCreateSequence, useUpdateSequence, useDeleteSequence,
  useAddStep, useDeleteStep, useUpdateStep,
} from "@/hooks/use-engage";

// ── Variable placeholders ──
const VARIABLES = [
  { key: "{{first_name}}", label: "First Name", icon: User },
  { key: "{{last_name}}", label: "Last Name", icon: User },
  { key: "{{company_name}}", label: "Company", icon: Building2 },
  { key: "{{job_title}}", label: "Job Title", icon: Briefcase },
];

const statusConfig: Record<string, { cls: string; label: string }> = {
  draft: { cls: "bg-muted text-muted-foreground", label: "Draft" },
  active: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Active" },
  paused: { cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Paused" },
  archived: { cls: "bg-muted text-muted-foreground", label: "Archived" },
};

const statusBadge = (s: string) => {
  const m = statusConfig[s] || statusConfig.draft;
  return <Badge className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
};

const stepTypeConfig: Record<string, { icon: typeof Mail; color: string; bg: string; label: string }> = {
  email: { icon: Mail, color: "text-blue-600", bg: "bg-blue-500/10", label: "Email" },
  call: { icon: Phone, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Call" },
  task: { icon: CheckSquare, color: "text-amber-600", bg: "bg-amber-500/10", label: "Task" },
};

type StepEdits = {
  label: string;
  delay_days: number;
  delay_hours: number;
  email_subject: string;
  email_body: string;
  task_instructions: string;
  call_instructions: string;
  is_active: boolean;
};

export default function SequencesListPage() {
  const { data: sequences, isLoading } = useSequences();
  const createSeq = useCreateSequence();
  const updateSeq = useUpdateSequence();
  const deleteSeq = useDeleteSequence();
  const addStep = useAddStep();
  const deleteStep = useDeleteStep();
  const updateStep = useUpdateStep();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepEdits, setStepEdits] = useState<StepEdits | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: steps } = useSequenceSteps(editId);
  const { data: enrollments } = useSequenceEnrollments(editId);
  const editSeq = sequences?.find((s) => s.id === editId);
  const selectedStep = steps?.find((s) => s.id === selectedStepId);

  const selectStep = useCallback((stepId: string | null) => {
    if (dirty && selectedStepId) {
      // auto-save before switching
      handleSaveStep();
    }
    setSelectedStepId(stepId);
    if (stepId && steps) {
      const step = steps.find((s) => s.id === stepId);
      if (step) {
        setStepEdits({
          label: step.label || "",
          delay_days: step.delay_days ?? 0,
          delay_hours: step.delay_hours ?? 0,
          email_subject: step.email_subject || "",
          email_body: step.email_body || "",
          task_instructions: step.task_instructions || "",
          call_instructions: step.call_instructions || "",
          is_active: step.is_active ?? true,
        });
        setDirty(false);
        setPreviewMode(false);
      }
    } else {
      setStepEdits(null);
      setDirty(false);
    }
  }, [steps, dirty, selectedStepId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const seq = await createSeq.mutateAsync({ name: newName.trim(), description: newDesc || undefined });
    await addStep.mutateAsync({ sequence_id: seq.id, step_order: 1, step_type: "email", label: "Initial outreach email", delay_days: 0, delay_hours: 0 });
    await addStep.mutateAsync({ sequence_id: seq.id, step_order: 2, step_type: "email", label: "Follow-up email", delay_days: 3, delay_hours: 0 });
    await addStep.mutateAsync({ sequence_id: seq.id, step_order: 3, step_type: "call", label: "Discovery call", delay_days: 2, delay_hours: 0 });
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setEditId(seq.id);
  };

  const handleAddStep = async (type: "email" | "call" | "task") => {
    if (!editId) return;
    const nextOrder = (steps?.length ?? 0) + 1;
    const label = type === "email" ? "New email step" : type === "call" ? "New call step" : "New task step";
    const step = await addStep.mutateAsync({ sequence_id: editId, step_order: nextOrder, step_type: type, label, delay_days: 2, delay_hours: 0 });
    setTimeout(() => selectStep(step.id), 100);
  };

  const handleSaveStep = async () => {
    if (!selectedStepId || !stepEdits || !editId) return;
    await updateStep.mutateAsync({
      id: selectedStepId,
      sequenceId: editId,
      label: stepEdits.label,
      delay_days: stepEdits.delay_days,
      delay_hours: stepEdits.delay_hours,
      email_subject: stepEdits.email_subject || null,
      email_body: stepEdits.email_body || null,
      call_instructions: stepEdits.call_instructions || null,
      task_instructions: stepEdits.task_instructions || null,
      is_active: stepEdits.is_active,
    });
    setDirty(false);
  };

  const handleMoveStep = async (stepId: string, direction: "up" | "down") => {
    if (!steps || !editId) return;
    const idx = steps.findIndex((s) => s.id === stepId);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= steps.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const current = steps[idx];
    const swap = steps[swapIdx];
    await Promise.all([
      updateStep.mutateAsync({ id: current.id, sequenceId: editId, step_order: swap.step_order }),
      updateStep.mutateAsync({ id: swap.id, sequenceId: editId, step_order: current.step_order }),
    ]);
  };

  const updateField = (field: keyof StepEdits, value: any) => {
    setStepEdits((prev) => prev ? { ...prev, [field]: value } : prev);
    setDirty(true);
  };

  const insertVariable = (variable: string, field: "email_subject" | "email_body" | "call_instructions" | "task_instructions") => {
    setStepEdits((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: (prev[field] || "") + variable };
    });
    setDirty(true);
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, "John")
      .replace(/\{\{last_name\}\}/g, "Smith")
      .replace(/\{\{company_name\}\}/g, "Acme Corp")
      .replace(/\{\{job_title\}\}/g, "VP of Sales");
  };

  const openEditor = (seqId: string) => {
    setEditId(seqId);
    setSelectedStepId(null);
    setStepEdits(null);
    setDirty(false);
  };

  const closeEditor = () => {
    setEditId(null);
    setSelectedStepId(null);
    setStepEdits(null);
    setDirty(false);
  };

  // ── Sequence List View ──
  if (!editId) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <ConfigRequiredBanner capabilities={["email", "domains"]} title="Sequences require a sender" />
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Build multi-step outreach sequences with automated follow-ups.</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Sequence
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !sequences?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <GitBranch className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-medium">No sequences yet</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
                Create your first automated outreach sequence to engage prospects at scale.
              </p>
              <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Create Sequence
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Steps</TableHead>
                  <TableHead className="text-xs">Updated</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((seq) => (
                  <TableRow key={seq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditor(seq.id)}>
                    <TableCell className="text-sm font-medium">{seq.name}</TableCell>
                    <TableCell>{statusBadge(seq.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(seq.updated_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor(seq.id); }}>
                            <ChevronRight className="h-3.5 w-3.5 mr-2" /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteSeq.mutate(seq.id); }}>
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
              <DialogTitle className="text-base">Create Sequence</DialogTitle>
              <DialogDescription className="text-sm">Start building a new multi-step outreach sequence.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Sequence Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Q1 Outbound - VP Sales" className="mt-1 h-9 text-sm" autoFocus />
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe the purpose..." className="mt-1 text-sm" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createSeq.isPending}>
                {createSeq.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Sequence Editor View (full page) ──
  const StepTypeIcon = ({ type }: { type: string }) => {
    const cfg = stepTypeConfig[type] || stepTypeConfig.task;
    const Icon = cfg.icon;
    return (
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* ── Editor Header ── */}
      <div className="border-b bg-card px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeEditor}>
              <X className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">{editSeq?.name}</h2>
                <p className="text-[11px] text-muted-foreground">{editSeq?.description || "Outreach sequence"}</p>
              </div>
            </div>
            <div className="ml-2">{editSeq && statusBadge(editSeq.status)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground mr-3">
              <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> {steps?.length ?? 0} steps</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {enrollments?.length ?? 0} enrolled</span>
            </div>
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5 h-8"
              onClick={() => {
                if (editSeq) {
                  const newStatus = editSeq.status === "active" ? "paused" : "active";
                  updateSeq.mutate({ id: editSeq.id, status: newStatus });
                }
              }}
            >
              {editSeq?.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Activate</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Editor Body: Steps List + Editor Panel ── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Step list */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sequence Steps</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-xs gap-1 h-7">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleAddStep("email")}><Mail className="h-3.5 w-3.5 mr-2" /> Email</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddStep("call")}><Phone className="h-3.5 w-3.5 mr-2" /> Call</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddStep("task")}><CheckSquare className="h-3.5 w-3.5 mr-2" /> Task</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {steps?.map((step, i) => {
                const isSelected = selectedStepId === step.id;
                const cfg = stepTypeConfig[step.step_type] || stepTypeConfig.task;
                return (
                  <div key={step.id}>
                    {/* Delay indicator between steps */}
                    {i > 0 && (
                      <div className="flex items-center justify-center py-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          Wait {step.delay_days}d {step.delay_hours > 0 ? `${step.delay_hours}h` : ""}
                        </div>
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all group
                        ${isSelected
                          ? "bg-primary/10 border border-primary/30 shadow-sm"
                          : "hover:bg-muted/50 border border-transparent"
                        }
                        ${!step.is_active ? "opacity-50" : ""}
                      `}
                      onClick={() => selectStep(step.id)}
                    >
                      <StepTypeIcon type={step.step_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground">#{step.step_order}</span>
                          <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                          {!step.is_active && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Off</Badge>}
                        </div>
                        <p className="text-xs mt-0.5 truncate font-medium">{step.label}</p>
                        {step.step_type === "email" && step.email_subject && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">📧 {step.email_subject}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          disabled={i === 0}
                          onClick={(e) => { e.stopPropagation(); handleMoveStep(step.id, "up"); }}
                        >
                          <ArrowUp className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          disabled={i === (steps?.length ?? 0) - 1}
                          onClick={(e) => { e.stopPropagation(); handleMoveStep(step.id, "down"); }}
                        >
                          <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!steps?.length && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">No steps yet</p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs h-7" onClick={() => handleAddStep("email")}>
                    <Plus className="h-3 w-3 mr-1" /> Add first step
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Step Editor Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedStepId || !stepEdits || !selectedStep ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Settings2 className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">Select a step to edit</h3>
                <p className="text-xs text-muted-foreground mt-1">Click any step on the left to configure it.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Editor toolbar */}
              <div className="border-b px-5 py-2.5 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <StepTypeIcon type={selectedStep.step_type} />
                  <div>
                    <h3 className="text-sm font-semibold">Step {selectedStep.step_order} — {(stepTypeConfig[selectedStep.step_type] || stepTypeConfig.task).label}</h3>
                    <p className="text-[11px] text-muted-foreground">{stepEdits.label || "Untitled step"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dirty && <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600">Unsaved</Badge>}
                  <Button
                    size="sm" variant="outline" className="text-xs gap-1.5 h-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      deleteStep.mutate({ id: selectedStep.id, sequenceId: editId! });
                      setSelectedStepId(null);
                      setStepEdits(null);
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                  <Button size="sm" className="text-xs gap-1.5 h-7" onClick={handleSaveStep} disabled={!dirty || updateStep.isPending}>
                    {updateStep.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </Button>
                </div>
              </div>

              {/* Editor content */}
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5 max-w-2xl">
                  {/* Common fields */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-xs font-medium">Step Label</Label>
                      <Input
                        value={stepEdits.label}
                        onChange={(e) => updateField("label", e.target.value)}
                        placeholder="e.g. Initial outreach email"
                        className="mt-1.5 h-9 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-medium">Delay (days)</Label>
                        <Input
                          type="number" min={0}
                          value={stepEdits.delay_days}
                          onChange={(e) => updateField("delay_days", parseInt(e.target.value) || 0)}
                          className="mt-1.5 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Delay (hours)</Label>
                        <Input
                          type="number" min={0} max={23}
                          value={stepEdits.delay_hours}
                          onChange={(e) => updateField("delay_hours", parseInt(e.target.value) || 0)}
                          className="mt-1.5 h-9 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-2 pb-1">
                          <Switch
                            checked={stepEdits.is_active}
                            onCheckedChange={(v) => updateField("is_active", v)}
                          />
                          <Label className="text-xs">{stepEdits.is_active ? "Active" : "Inactive"}</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Email step editor */}
                  {selectedStep.step_type === "email" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs font-medium">Subject Line</Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                                <Variable className="h-3 w-3" /> Insert Variable
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {VARIABLES.map((v) => (
                                <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key, "email_subject")}>
                                  <v.icon className="h-3 w-3 mr-2" /> {v.label}
                                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{v.key}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <Input
                          value={stepEdits.email_subject}
                          onChange={(e) => updateField("email_subject", e.target.value)}
                          placeholder="e.g. Quick question about {{company_name}}"
                          className="h-9 text-sm"
                        />
                        {!stepEdits.email_subject.trim() && (
                          <p className="text-[10px] text-amber-600 mt-1">⚠ Subject line is required for sending</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs font-medium">Email Body</Label>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                                  <Variable className="h-3 w-3" /> Variable
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {VARIABLES.map((v) => (
                                  <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key, "email_body")}>
                                    <v.icon className="h-3 w-3 mr-2" /> {v.label}
                                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">{v.key}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant={previewMode ? "secondary" : "ghost"}
                              size="sm" className="h-6 text-[10px] gap-1"
                              onClick={() => setPreviewMode(!previewMode)}
                            >
                              {previewMode ? <Code className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {previewMode ? "Edit" : "Preview"}
                            </Button>
                          </div>
                        </div>
                        {previewMode ? (
                          <div className="rounded-lg border bg-card p-4 min-h-[200px]">
                            <div className="text-xs text-muted-foreground mb-2 pb-2 border-b">
                              <strong>Subject:</strong> {renderPreview(stepEdits.email_subject || "(no subject)")}
                            </div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">
                              {renderPreview(stepEdits.email_body || "(empty body)")}
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            value={stepEdits.email_body}
                            onChange={(e) => updateField("email_body", e.target.value)}
                            placeholder={`Hi {{first_name}},\n\nI noticed that {{company_name}} is...\n\nWould love to connect about...\n\nBest,\n[Your name]`}
                            className="text-sm min-h-[200px] font-mono leading-relaxed"
                          />
                        )}
                        {!stepEdits.email_body.trim() && !previewMode && (
                          <p className="text-[10px] text-amber-600 mt-1">⚠ Email body is empty</p>
                        )}
                      </div>

                      {/* Variable reference */}
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Available Variables</p>
                        <div className="flex flex-wrap gap-1.5">
                          {VARIABLES.map((v) => (
                            <Tooltip key={v.key}>
                              <TooltipTrigger asChild>
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-card border text-[10px] font-mono hover:bg-primary/5 hover:border-primary/30 transition-colors"
                                  onClick={() => insertVariable(v.key, "email_body")}
                                >
                                  {v.key}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Click to insert {v.label}</p></TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Call step editor */}
                  {selectedStep.step_type === "call" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs font-medium">Call Instructions / Talking Points</Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                                <Variable className="h-3 w-3" /> Variable
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {VARIABLES.map((v) => (
                                <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key, "call_instructions")}>
                                  <v.icon className="h-3 w-3 mr-2" /> {v.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <Textarea
                          value={stepEdits.call_instructions}
                          onChange={(e) => updateField("call_instructions", e.target.value)}
                          placeholder={`1. Introduce yourself and reference {{company_name}}\n2. Ask about their current challenges with...\n3. Propose a demo or meeting\n4. Confirm next steps`}
                          className="text-sm min-h-[180px] leading-relaxed"
                        />
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tips</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Keep talking points concise and actionable</li>
                          <li>Use variables to personalize the conversation</li>
                          <li>Include objection handling notes</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Task step editor */}
                  {selectedStep.step_type === "task" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs font-medium">Task Instructions</Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                                <Variable className="h-3 w-3" /> Variable
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {VARIABLES.map((v) => (
                                <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key, "task_instructions")}>
                                  <v.icon className="h-3 w-3 mr-2" /> {v.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <Textarea
                          value={stepEdits.task_instructions}
                          onChange={(e) => updateField("task_instructions", e.target.value)}
                          placeholder={`Research {{company_name}} on LinkedIn\nCheck if {{first_name}} has engaged with any recent content\nPrepare personalized talking points`}
                          className="text-sm min-h-[180px] leading-relaxed"
                        />
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tips</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Be specific about what needs to be done</li>
                          <li>Include links or resources if helpful</li>
                          <li>Set a clear completion criteria</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
