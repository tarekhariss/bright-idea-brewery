import { useState } from "react";
import {
  GitBranch, Plus, Play, Pause, Trash2, MoreHorizontal,
  Mail, Phone, CheckSquare, Loader2, Clock, ChevronRight, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  useSequences, useSequenceSteps, useSequenceEnrollments,
  useCreateSequence, useUpdateSequence, useDeleteSequence,
  useAddStep, useDeleteStep, useUpdateStep,
} from "@/hooks/use-engage";

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-muted text-muted-foreground", label: "Draft" },
    active: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Active" },
    paused: { cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Paused" },
    archived: { cls: "bg-muted text-muted-foreground", label: "Archived" },
  };
  const m = map[s] || map.draft;
  return <Badge className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
};

const stepIcon = (type: string) => {
  if (type === "email") return <Mail className="h-3.5 w-3.5" />;
  if (type === "call") return <Phone className="h-3.5 w-3.5" />;
  return <CheckSquare className="h-3.5 w-3.5" />;
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
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [stepEdits, setStepEdits] = useState<Record<string, { label?: string; delay_days?: number; delay_hours?: number; email_subject?: string; email_body?: string; task_instructions?: string; call_instructions?: string }>>({});

  const { data: steps } = useSequenceSteps(editId);
  const { data: enrollments } = useSequenceEnrollments(editId);
  const editSeq = sequences?.find((s) => s.id === editId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const seq = await createSeq.mutateAsync({ name: newName.trim(), description: newDesc || undefined });
    // Add default steps
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
    await addStep.mutateAsync({ sequence_id: editId, step_order: nextOrder, step_type: type, label, delay_days: 2, delay_hours: 0 });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
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
                <TableRow key={seq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditId(seq.id)}>
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditId(seq.id); }}>
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

      {/* Sequence Detail */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base flex-1">{editSeq?.name}</DialogTitle>
              {editSeq && statusBadge(editSeq.status)}
            </div>
            <DialogDescription className="text-sm">{editSeq?.description || "Manage sequence steps and configuration."}</DialogDescription>
          </DialogHeader>
          {editSeq && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold">{steps?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Steps</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold">{enrollments?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enrolled</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold capitalize">{editSeq.status}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps</h4>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 h-7">
                        <Plus className="h-3 w-3" /> Add Step
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleAddStep("email")}><Mail className="h-3.5 w-3.5 mr-2" /> Email Step</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddStep("call")}><Phone className="h-3.5 w-3.5 mr-2" /> Call Step</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddStep("task")}><CheckSquare className="h-3.5 w-3.5 mr-2" /> Task Step</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  {steps?.map((step, i) => {
                    const isExpanded = expandedStepId === step.id;
                    const edits = stepEdits[step.id] || {};
                    return (
                      <div key={step.id} className="rounded-lg border bg-card overflow-hidden">
                        <div
                          className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedStepId(null);
                            } else {
                              setExpandedStepId(step.id);
                              setStepEdits((prev) => ({
                                ...prev,
                                [step.id]: {
                                  label: step.label,
                                  delay_days: step.delay_days,
                                  delay_hours: step.delay_hours,
                                  email_subject: step.email_subject || "",
                                  email_body: step.email_body || "",
                                  task_instructions: step.task_instructions || "",
                                  call_instructions: step.call_instructions || "",
                                },
                              }));
                            }
                          }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            {stepIcon(step.step_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">STEP {step.step_order}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">{step.step_type}</Badge>
                            </div>
                            <p className="text-sm mt-0.5 truncate">{step.label}</p>
                          </div>
                          {i > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>+{step.delay_days}d {step.delay_hours > 0 ? `${step.delay_hours}h` : ""}</span>
                            </div>
                          )}
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteStep.mutate({ id: step.id, sequenceId: editSeq.id }); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="border-t p-4 space-y-3 bg-muted/10">
                            <div>
                              <Label className="text-xs">Label</Label>
                              <Input
                                value={edits.label ?? step.label}
                                onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], label: e.target.value } }))}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Delay (days)</Label>
                                <Input
                                  type="number" min={0}
                                  value={edits.delay_days ?? step.delay_days}
                                  onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], delay_days: parseInt(e.target.value) || 0 } }))}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Delay (hours)</Label>
                                <Input
                                  type="number" min={0}
                                  value={edits.delay_hours ?? step.delay_hours}
                                  onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], delay_hours: parseInt(e.target.value) || 0 } }))}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            </div>
                            {step.step_type === "email" && (
                              <>
                                <div>
                                  <Label className="text-xs">Email Subject</Label>
                                  <Input
                                    value={edits.email_subject ?? ""}
                                    onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], email_subject: e.target.value } }))}
                                    placeholder="Subject line..."
                                    className="mt-1 h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Email Body</Label>
                                  <Textarea
                                    value={edits.email_body ?? ""}
                                    onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], email_body: e.target.value } }))}
                                    placeholder="Write your email content..."
                                    className="mt-1 text-sm" rows={4}
                                  />
                                </div>
                              </>
                            )}
                            {step.step_type === "call" && (
                              <div>
                                <Label className="text-xs">Call Instructions</Label>
                                <Textarea
                                  value={edits.call_instructions ?? ""}
                                  onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], call_instructions: e.target.value } }))}
                                  placeholder="Talking points, goals..."
                                  className="mt-1 text-sm" rows={3}
                                />
                              </div>
                            )}
                            {step.step_type === "task" && (
                              <div>
                                <Label className="text-xs">Task Instructions</Label>
                                <Textarea
                                  value={edits.task_instructions ?? ""}
                                  onChange={(e) => setStepEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], task_instructions: e.target.value } }))}
                                  placeholder="What needs to be done..."
                                  className="mt-1 text-sm" rows={3}
                                />
                              </div>
                            )}
                            <div className="flex justify-end">
                              <Button
                                size="sm" className="text-xs h-7"
                                disabled={updateStep.isPending}
                                onClick={() => {
                                  updateStep.mutate({
                                    id: step.id,
                                    sequenceId: editSeq.id,
                                    label: edits.label,
                                    delay_days: edits.delay_days,
                                    delay_hours: edits.delay_hours,
                                    email_subject: edits.email_subject || null,
                                    email_body: edits.email_body || null,
                                    call_instructions: edits.call_instructions || null,
                                    task_instructions: edits.task_instructions || null,
                                  });
                                  setExpandedStepId(null);
                                }}
                              >
                                {updateStep.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Save Step
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!steps?.length && <p className="text-sm text-muted-foreground text-center py-4">No steps yet. Add one above.</p>}
                </div>
              </div>

              {/* Enrollments preview */}
              {enrollments && enrollments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <Users className="h-3 w-3 inline mr-1" /> Enrolled Contacts ({enrollments.length})
                  </h4>
                  <div className="space-y-1">
                    {enrollments.slice(0, 5).map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                        <span>{e.contacts?.first_name} {e.contacts?.last_name} — {e.contacts?.email}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{e.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Close</Button>
            <Button size="sm" onClick={() => {
              if (editSeq) {
                const newStatus = editSeq.status === "active" ? "paused" : "active";
                updateSeq.mutate({ id: editSeq.id, status: newStatus as any });
                setEditId(null);
              }
            }}>
              {editSeq?.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> Activate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
