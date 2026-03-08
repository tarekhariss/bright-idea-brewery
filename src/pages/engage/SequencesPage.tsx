import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GitBranch, Plus, Play, Pause, Copy, Archive, MoreHorizontal,
  Mail, Phone, CheckSquare, Loader2, Users, Clock, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Sequence {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  steps: SequenceStep[];
  enrolled: number;
  owner: string;
  created_at: string;
  updated_at: string;
}

interface SequenceStep {
  id: string;
  order: number;
  type: "email" | "call" | "task";
  label: string;
  delay_days: number;
}

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
  const navigate = useNavigate();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editSeq, setEditSeq] = useState<Sequence | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    setCreating(true);
    const seq: Sequence = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      status: "draft",
      steps: [
        { id: crypto.randomUUID(), order: 1, type: "email", label: "Initial outreach email", delay_days: 0 },
        { id: crypto.randomUUID(), order: 2, type: "email", label: "Follow-up email", delay_days: 3 },
        { id: crypto.randomUUID(), order: 3, type: "call", label: "Discovery call", delay_days: 2 },
      ],
      enrolled: 0,
      owner: "You",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setSequences((p) => [...p, seq]);
      setCreateOpen(false);
      setNewName("");
      setCreating(false);
      setEditSeq(seq);
    }, 400);
  };

  const addStep = (seqId: string, type: "email" | "call" | "task") => {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== seqId) return s;
        const step: SequenceStep = {
          id: crypto.randomUUID(),
          order: s.steps.length + 1,
          type,
          label: type === "email" ? "New email step" : type === "call" ? "New call step" : "New task step",
          delay_days: 2,
        };
        const updated = { ...s, steps: [...s.steps, step], updated_at: new Date().toISOString() };
        if (editSeq?.id === seqId) setEditSeq(updated);
        return updated;
      })
    );
  };

  const removeStep = (seqId: string, stepId: string) => {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== seqId) return s;
        const steps = s.steps.filter((st) => st.id !== stepId).map((st, i) => ({ ...st, order: i + 1 }));
        const updated = { ...s, steps, updated_at: new Date().toISOString() };
        if (editSeq?.id === seqId) setEditSeq(updated);
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
            <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Build multi-step outreach sequences with automated follow-ups.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <GitBranch className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No sequences yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Create your first automated outreach sequence to engage prospects at scale with personalized multi-channel touchpoints.
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
                <TableHead className="text-xs">Enrolled</TableHead>
                <TableHead className="text-xs">Owner</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map((seq) => (
                <TableRow key={seq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditSeq(seq)}>
                  <TableCell className="text-sm font-medium">{seq.name}</TableCell>
                  <TableCell>{statusBadge(seq.status)}</TableCell>
                  <TableCell className="text-sm">{seq.steps.length}</TableCell>
                  <TableCell className="text-sm">{seq.enrolled}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{seq.owner}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(seq.updated_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditSeq(seq); }}>
                          <ChevronRight className="h-3.5 w-3.5 mr-2" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => {
                          e.stopPropagation();
                          setSequences((p) => p.filter((s) => s.id !== seq.id));
                        }}>
                          <Archive className="h-3.5 w-3.5 mr-2" /> Archive
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
          <div>
            <Label className="text-xs">Sequence Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Q1 Outbound - VP Sales" className="mt-1 h-9 text-sm" autoFocus />
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

      {/* Sequence Detail / Editor */}
      <Dialog open={!!editSeq} onOpenChange={() => setEditSeq(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base flex-1">{editSeq?.name}</DialogTitle>
              {editSeq && statusBadge(editSeq.status)}
            </div>
            <DialogDescription className="text-sm">Manage sequence steps and configuration.</DialogDescription>
          </DialogHeader>
          {editSeq && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold">{editSeq.steps.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Steps</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold">{editSeq.enrolled}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enrolled</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold capitalize">{editSeq.status}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                </div>
              </div>

              {/* Step list */}
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
                      <DropdownMenuItem onClick={() => addStep(editSeq.id, "email")}>
                        <Mail className="h-3.5 w-3.5 mr-2" /> Email Step
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addStep(editSeq.id, "call")}>
                        <Phone className="h-3.5 w-3.5 mr-2" /> Call Step
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addStep(editSeq.id, "task")}>
                        <CheckSquare className="h-3.5 w-3.5 mr-2" /> Task Step
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  {editSeq.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {stepIcon(step.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground">STEP {step.order}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{step.type}</Badge>
                        </div>
                        <p className="text-sm mt-0.5 truncate">{step.label}</p>
                      </div>
                      {i > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>+{step.delay_days}d</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => removeStep(editSeq.id, step.id)}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings placeholder */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Sequence settings (scheduling, throttling, opt-out) will be configured here.</p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditSeq(null)}>Close</Button>
            <Button size="sm" onClick={() => {
              if (editSeq) {
                setSequences((p) => p.map((s) => s.id === editSeq.id ? { ...s, status: s.status === "active" ? "paused" : "active", updated_at: new Date().toISOString() } : s));
                setEditSeq(null);
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
