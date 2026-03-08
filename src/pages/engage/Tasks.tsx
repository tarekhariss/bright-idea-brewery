import { useState, useMemo } from "react";
import {
  CheckSquare, Plus, Loader2, MoreHorizontal, Check, Clock, AlertCircle,
  Filter, Linkedin, Mail, Phone, Users,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useTasks, useCreateTask, useUpdateTask } from "@/hooks/use-engage";

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-muted text-muted-foreground", label: "Pending" },
    in_progress: { cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "In Progress" },
    completed: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Completed" },
    skipped: { cls: "bg-muted text-muted-foreground", label: "Skipped" },
    cancelled: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Cancelled" },
  };
  const m = map[s] || map.pending;
  return <Badge className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
};

const priorityBadge = (p: string) => {
  const map: Record<string, { cls: string }> = {
    low: { cls: "bg-muted text-muted-foreground" },
    medium: { cls: "bg-blue-500/10 text-blue-600" },
    high: { cls: "bg-amber-500/10 text-amber-600" },
    urgent: { cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[p] || map.medium;
  return <Badge className={`${m.cls} text-[10px] capitalize`}>{p}</Badge>;
};

const typeIcon = (t: string) => {
  switch (t) {
    case "linkedin_connect": case "linkedin_message": case "linkedin": return <Linkedin className="h-3 w-3" />;
    case "email": return <Mail className="h-3 w-3" />;
    case "call": return <Phone className="h-3 w-3" />;
    default: return <CheckSquare className="h-3 w-3" />;
  }
};

export default function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("general");
  const [dueDate, setDueDate] = useState("");
  const [filterTab, setFilterTab] = useState("all");

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (filterTab === "all") return tasks;
    if (filterTab === "pending") return tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
    if (filterTab === "completed") return tasks.filter((t: any) => t.status === "completed");
    if (filterTab === "linkedin") return tasks.filter((t: any) => ["linkedin", "linkedin_connect", "linkedin_message"].includes(t.task_type));
    return tasks;
  }, [tasks, filterTab]);

  const counts = useMemo(() => {
    if (!tasks) return { all: 0, pending: 0, completed: 0, linkedin: 0 };
    return {
      all: tasks.length,
      pending: tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress").length,
      completed: tasks.filter((t: any) => t.status === "completed").length,
      linkedin: tasks.filter((t: any) => ["linkedin", "linkedin_connect", "linkedin_message"].includes(t.task_type)).length,
    };
  }, [tasks]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title: title.trim(),
      description: desc || undefined,
      priority,
      task_type: taskType,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setCreateOpen(false);
    setTitle(""); setDesc(""); setPriority("medium"); setTaskType("general"); setDueDate("");
  };

  const handleComplete = (id: string) => {
    updateTask.mutate({ id, status: "completed" as any, completed_at: new Date().toISOString() });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage outreach tasks, LinkedIn actions, and manual follow-ups.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.all, color: "text-foreground" },
          { label: "Pending", value: counts.pending, color: "text-amber-600" },
          { label: "Completed", value: counts.completed, color: "text-emerald-600" },
          { label: "LinkedIn", value: counts.linkedin, color: "text-sky-600" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="py-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={filterTab} onValueChange={setFilterTab}>
        <TabsList>
          <TabsTrigger value="all" className="text-xs">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="linkedin" className="text-xs">LinkedIn ({counts.linkedin})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed ({counts.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !filtered?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <CheckSquare className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No tasks</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Tasks appear from campaigns, sequences, and manual assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-10"></TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Priority</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Due</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>
                    {task.status !== "completed" ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleComplete(task.id)}>
                        <Check className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-600" />
                      </Button>
                    ) : (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </TableCell>
                  <TableCell className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] capitalize gap-1">
                      {typeIcon(task.task_type)} {task.task_type?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{priorityBadge(task.priority)}</TableCell>
                  <TableCell>{statusBadge(task.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.contacts ? `${task.contacts.first_name || ""} ${task.contacts.last_name || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.due_date ? format(new Date(task.due_date), "MMM d, HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {task.status !== "completed" && (
                          <DropdownMenuItem onClick={() => handleComplete(task.id)}>
                            <Check className="h-3.5 w-3.5 mr-2" /> Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => updateTask.mutate({ id: task.id, status: "cancelled" as any })}>
                          <AlertCircle className="h-3.5 w-3.5 mr-2" /> Cancel
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
            <DialogTitle className="text-base">Create Task</DialogTitle>
            <DialogDescription className="text-sm">Add a new task to your workflow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow up with VP Sales" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Task details..." className="mt-1 text-sm" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="linkedin_connect">LinkedIn Connect</SelectItem>
                    <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                    <SelectItem value="manual_followup">Manual Follow-up</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
