import { useState, useMemo } from "react";
import {
  Eye, UserPlus, Clock4, MessageSquare, Mail, ThumbsUp, MessageCircle,
  Award, XCircle, Hourglass, ListTodo, Flag, CircleStop, Plus, Trash2,
  GitBranch, AlertTriangle, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useWorkflowNodes, useWorkflowEdges, useCreateNode, useUpdateNode, useDeleteNode,
  useCreateEdge, useNodeVariants, useCreateVariant, useUpdateVariant, useDeleteVariant,
  type LinkedinNodeType, type LinkedinEdgeCondition, type WfNode, type WfEdge,
} from "@/hooks/use-linkedin-workflow";

const NODE_META: Record<LinkedinNodeType, { label: string; icon: any; color: string; group: string }> = {
  start: { label: "Automation Start", icon: Flag, color: "text-emerald-600 bg-emerald-500/10", group: "Flow" },
  end: { label: "End Automation", icon: CircleStop, color: "text-rose-600 bg-rose-500/10", group: "Flow" },
  visit_profile: { label: "Visit Profile", icon: Eye, color: "text-sky-600 bg-sky-500/10", group: "Actions" },
  connect_request: { label: "Connection Request", icon: UserPlus, color: "text-sky-600 bg-sky-500/10", group: "Actions" },
  wait_for_connection: { label: "Wait for Connection", icon: Hourglass, color: "text-amber-600 bg-amber-500/10", group: "Conditions" },
  message: { label: "Send Message", icon: MessageSquare, color: "text-blue-600 bg-blue-500/10", group: "Actions" },
  inmail: { label: "Send InMail", icon: Mail, color: "text-blue-600 bg-blue-500/10", group: "Actions" },
  like_post: { label: "Like Latest Post", icon: ThumbsUp, color: "text-violet-600 bg-violet-500/10", group: "Engagement" },
  comment_post: { label: "Comment Post", icon: MessageCircle, color: "text-violet-600 bg-violet-500/10", group: "Engagement" },
  endorse_skills: { label: "Endorse Skills", icon: Award, color: "text-violet-600 bg-violet-500/10", group: "Engagement" },
  withdraw_request: { label: "Withdraw Request", icon: XCircle, color: "text-rose-600 bg-rose-500/10", group: "Actions" },
  time_delay: { label: "Time Delay", icon: Clock4, color: "text-muted-foreground bg-muted", group: "Flow" },
  manual_task: { label: "Manual Task", icon: ListTodo, color: "text-orange-600 bg-orange-500/10", group: "Flow" },
};

const ADDABLE: LinkedinNodeType[] = [
  "visit_profile","connect_request","wait_for_connection","message","inmail",
  "like_post","comment_post","endorse_skills","withdraw_request","time_delay","manual_task","end",
];

const VARIABLES = ["{first_name}","{last_name}","{company}","{title}","{industry}"];

interface Props { campaignId: string; }

export function LinkedinWorkflowBuilder({ campaignId }: Props) {
  const { data: nodes = [] } = useWorkflowNodes(campaignId);
  const { data: edges = [] } = useWorkflowEdges(campaignId);
  const createNode = useCreateNode();
  const createEdge = useCreateEdge();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adderOpen, setAdderOpen] = useState<{ fromId: string; condition: LinkedinEdgeCondition } | null>(null);

  // Auto-seed Start node if empty
  useMemo(() => {
    if (nodes.length === 0 && !createNode.isPending) {
      createNode.mutate({ campaign_id: campaignId, node_type: "start", label: "Automation Start" });
    }
  }, [nodes.length, campaignId]); // eslint-disable-line

  const startNode = nodes.find((n) => n.node_type === "start");
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const handleAddNode = async (parentId: string, condition: LinkedinEdgeCondition, type: LinkedinNodeType) => {
    const created = await createNode.mutateAsync({
      campaign_id: campaignId, node_type: type, label: NODE_META[type].label,
      delay_amount: type === "time_delay" ? 1 : type === "wait_for_connection" ? null : 0,
      delay_unit: type === "time_delay" ? "days" : null,
      wait_timeout_days: type === "wait_for_connection" ? 7 : null,
      withdraw_after_days: type === "withdraw_request" ? 14 : null,
      skip_note_if_too_long: true, send_always: false,
    });
    await createEdge.mutateAsync({ campaign_id: campaignId, from_node_id: parentId, to_node_id: created.id, condition });
    setSelectedId(created.id);
    setAdderOpen(null);
  };

  return (
    <div className="grid grid-cols-[1fr,380px] gap-4 min-h-[600px]">
      {/* Canvas */}
      <ScrollArea className="rounded-lg border bg-muted/30 p-6 max-h-[78vh]">
        {startNode ? (
          <div className="flex flex-col items-center gap-2">
            <NodeBranch
              node={startNode} nodes={nodes} edges={edges}
              selectedId={selectedId} onSelect={setSelectedId}
              onAddAfter={(fromId, cond) => setAdderOpen({ fromId, condition: cond })}
            />
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-12">Initializing workflow…</div>
        )}
      </ScrollArea>

      {/* Side panel */}
      <div className="rounded-lg border bg-card overflow-hidden flex flex-col max-h-[78vh]">
        {selected ? (
          <NodeEditor key={selected.id} node={selected} campaignId={campaignId} />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            <GitBranch className="h-5 w-5 mb-2" />
            Select a node to configure it. Click <span className="font-medium">+</span> on the canvas to add a step.
          </div>
        )}
      </div>

      {/* Add node dialog */}
      <Dialog open={!!adderOpen} onOpenChange={(o) => !o && setAdderOpen(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle className="text-base">Add Step</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-auto">
            {ADDABLE.map((t) => {
              const m = NODE_META[t];
              const Icon = m.icon;
              return (
                <button
                  key={t}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted transition"
                  onClick={() => adderOpen && handleAddNode(adderOpen.fromId, adderOpen.condition, t)}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", m.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.group}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Recursive node renderer with branching ──────────────────
function NodeBranch({
  node, nodes, edges, selectedId, onSelect, onAddAfter,
}: {
  node: WfNode; nodes: WfNode[]; edges: WfEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddAfter: (fromId: string, condition: LinkedinEdgeCondition) => void;
}) {
  const outgoing = edges.filter((e) => e.from_node_id === node.id);
  const isBranching = node.node_type === "wait_for_connection" || node.node_type === "connect_request"
                      || node.node_type === "message" || node.node_type === "inmail";

  // Define branch slots per node type
  const branches: { condition: LinkedinEdgeCondition; label: string; color: string }[] =
    node.node_type === "wait_for_connection"
      ? [
          { condition: "connected", label: "Connected", color: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" },
          { condition: "not_connected", label: "Not Connected", color: "text-rose-600 border-rose-500/30 bg-rose-500/5" },
        ]
      : node.node_type === "connect_request"
      ? [
          { condition: "accepted", label: "Accepted", color: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" },
          { condition: "declined", label: "Declined", color: "text-rose-600 border-rose-500/30 bg-rose-500/5" },
          { condition: "timeout", label: "Timeout", color: "text-amber-600 border-amber-500/30 bg-amber-500/5" },
        ]
      : node.node_type === "message" || node.node_type === "inmail"
      ? [
          { condition: "replied", label: "Replied", color: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" },
          { condition: "no_reply", label: "No Reply", color: "text-muted-foreground border-border bg-muted/30" },
        ]
      : [{ condition: "default", label: "Next", color: "text-muted-foreground border-border bg-muted/30" }];

  return (
    <div className="flex flex-col items-center gap-1">
      <NodeCard node={node} selected={selectedId === node.id} onClick={() => onSelect(node.id)} />

      {node.node_type !== "end" && (
        <>
          {isBranching ? (
            <div className="flex gap-6 items-start mt-2">
              {branches.map((b) => {
                const childEdge = outgoing.find((e) => e.condition === b.condition);
                const child = childEdge ? nodes.find((n) => n.id === childEdge.to_node_id) : null;
                return (
                  <div key={b.condition} className="flex flex-col items-center gap-1 min-w-[200px]">
                    <div className="h-6 w-px bg-border" />
                    <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", b.color)}>{b.label}</span>
                    {child ? (
                      <NodeBranch node={child} nodes={nodes} edges={edges} selectedId={selectedId} onSelect={onSelect} onAddAfter={onAddAfter} />
                    ) : (
                      <AddSlot onClick={() => onAddAfter(node.id, b.condition)} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="h-6 w-px bg-border" />
              {(() => {
                const e = outgoing.find((x) => x.condition === "default");
                const child = e ? nodes.find((n) => n.id === e.to_node_id) : null;
                if (child) return <NodeBranch node={child} nodes={nodes} edges={edges} selectedId={selectedId} onSelect={onSelect} onAddAfter={onAddAfter} />;
                return <AddSlot onClick={() => onAddAfter(node.id, "default")} />;
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}

function NodeCard({ node, selected, onClick }: { node: WfNode; selected: boolean; onClick: () => void }) {
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;
  const subtitle = useMemo(() => {
    if (node.node_type === "time_delay") return `Wait ${node.delay_amount ?? 0} ${node.delay_unit ?? "days"}`;
    if (node.node_type === "wait_for_connection") return `Up to ${node.wait_timeout_days ?? 7} days`;
    if (node.node_type === "withdraw_request") return `After ${node.withdraw_after_days ?? 14} days`;
    if (node.node_type === "manual_task") return node.task_title || "Task";
    if (node.node_type === "message" || node.node_type === "inmail" || node.node_type === "connect_request") {
      return node.message_body?.slice(0, 60) || node.connection_note?.slice(0, 60) || "Click to configure";
    }
    return null;
  }, [node]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-[260px] rounded-lg border bg-card text-left transition-all hover:shadow-md",
        selected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", meta.color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-medium flex-1 truncate">{node.label || meta.label}</p>
      </div>
      {subtitle && <p className="px-3 py-2 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
    </button>
  );
}

function AddSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition"
      title="Add step"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

// ── Side editor ─────────────────────────────────────────────
function NodeEditor({ node, campaignId }: { node: WfNode; campaignId: string }) {
  const update = useUpdateNode();
  const del = useDeleteNode();
  const [tab, setTab] = useState<"config" | "variants">("config");
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;
  const supportsVariants = ["message", "inmail", "connect_request", "comment_post"].includes(node.node_type);

  const save = (patch: Partial<WfNode>) => update.mutate({ id: node.id, campaign_id: campaignId, ...patch });

  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", meta.color)}><Icon className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground">{meta.group}</p>
        </div>
        {node.node_type !== "start" && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => { if (confirm("Delete this node and all its branches?")) del.mutate({ id: node.id, campaign_id: campaignId }); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {supportsVariants ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="config" className="text-xs">Config</TabsTrigger>
            <TabsTrigger value="variants" className="text-xs">A/B Variants</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 px-4 py-4">
            <TabsContent value="config" className="mt-0 space-y-4">
              <NodeConfigFields node={node} onSave={save} />
            </TabsContent>
            <TabsContent value="variants" className="mt-0">
              <VariantsEditor nodeId={node.id} campaignId={campaignId} nodeType={node.node_type} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      ) : (
        <ScrollArea className="flex-1 px-4 py-4">
          <NodeConfigFields node={node} onSave={save} />
        </ScrollArea>
      )}
    </>
  );
}

function NodeConfigFields({ node, onSave }: { node: WfNode; onSave: (p: Partial<WfNode>) => void }) {
  const t = node.node_type;
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Label</Label>
        <Input defaultValue={node.label ?? ""} onBlur={(e) => onSave({ label: e.target.value })} className="mt-1 h-8 text-sm" />
      </div>

      {t === "time_delay" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Wait</Label>
            <Input type="number" min={1} defaultValue={node.delay_amount ?? 1} onBlur={(e) => onSave({ delay_amount: parseInt(e.target.value) || 1 })} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Unit</Label>
            <Select value={node.delay_unit ?? "days"} onValueChange={(v) => onSave({ delay_unit: v as any })}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {t === "wait_for_connection" && (
        <div>
          <Label className="text-xs">Wait up to (days)</Label>
          <Input type="number" min={1} defaultValue={node.wait_timeout_days ?? 7} onBlur={(e) => onSave({ wait_timeout_days: parseInt(e.target.value) || 7 })} className="mt-1 h-8 text-sm" />
          <p className="text-[11px] text-muted-foreground mt-1">If still not connected by then, the flow takes the “Not Connected” branch.</p>
        </div>
      )}

      {t === "withdraw_request" && (
        <div>
          <Label className="text-xs">Withdraw after (days)</Label>
          <Input type="number" min={1} defaultValue={node.withdraw_after_days ?? 14} onBlur={(e) => onSave({ withdraw_after_days: parseInt(e.target.value) || 14 })} className="mt-1 h-8 text-sm" />
        </div>
      )}

      {(t === "message" || t === "inmail" || t === "connect_request" || t === "comment_post") && (
        <>
          {t === "inmail" && (
            <div>
              <Label className="text-xs">Subject</Label>
              <Input defaultValue={node.message_subject ?? ""} onBlur={(e) => onSave({ message_subject: e.target.value })} className="mt-1 h-8 text-sm" />
            </div>
          )}

          {t === "connect_request" ? (
            <>
              <div>
                <Label className="text-xs">Connection Note (optional)</Label>
                <Textarea defaultValue={node.connection_note ?? ""} onBlur={(e) => onSave({ connection_note: e.target.value })} className="mt-1 text-sm min-h-[100px]" placeholder="Hi {first_name}, I noticed…" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Skip note if too long</p>
                  <p className="text-[11px] text-muted-foreground">Send without note if note exceeds LinkedIn's limit.</p>
                </div>
                <Switch checked={node.skip_note_if_too_long} onCheckedChange={(v) => onSave({ skip_note_if_too_long: v })} />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs">Message body (default — variants override)</Label>
              <Textarea defaultValue={node.message_body ?? ""} onBlur={(e) => onSave({ message_body: e.target.value })} className="mt-1 text-sm min-h-[120px]" placeholder="Hi {first_name}…" />
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Insert variable:</p>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <Badge key={v} variant="outline" className="text-[10px] cursor-default">{v}</Badge>
              ))}
            </div>
          </div>

          {(t === "message" || t === "inmail") && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-xs font-medium">Send always</p>
                <p className="text-[11px] text-muted-foreground">Send even if not connected.</p>
              </div>
              <Switch checked={node.send_always} onCheckedChange={(v) => onSave({ send_always: v })} />
            </div>
          )}
        </>
      )}

      {t === "manual_task" && (
        <>
          <div>
            <Label className="text-xs">Task title</Label>
            <Input defaultValue={node.task_title ?? ""} onBlur={(e) => onSave({ task_title: e.target.value })} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea defaultValue={node.task_description ?? ""} onBlur={(e) => onSave({ task_description: e.target.value })} className="mt-1 text-sm min-h-[80px]" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Variants editor ─────────────────────────────────────────
function VariantsEditor({ nodeId, campaignId, nodeType }: { nodeId: string; campaignId: string; nodeType: LinkedinNodeType }) {
  const { data: variants = [] } = useNodeVariants(nodeId);
  const create = useCreateVariant();
  const update = useUpdateVariant();
  const del = useDeleteVariant();

  const nextLabel = String.fromCharCode(65 + variants.length); // A, B, C…

  return (
    <div className="space-y-3">
      {variants.length === 0 && (
        <p className="text-xs text-muted-foreground">No variants yet. Add one to start A/B testing — the system will rotate evenly until enough sends, then auto-pick the winner.</p>
      )}

      {variants.map((v) => (
        <Card key={v.id}>
          <CardContent className="pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="text-[10px]">Variant {v.label}</Badge>
              {v.is_winner && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Winner</Badge>}
              <span className="text-[10px] text-muted-foreground ml-auto">{v.sends_count} sends · {v.replies_count} replies</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate({ id: v.id, node_id: nodeId })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {nodeType === "inmail" && (
              <Input defaultValue={v.subject ?? ""} placeholder="Subject"
                onBlur={(e) => update.mutate({ id: v.id, node_id: nodeId, subject: e.target.value })}
                className="h-8 text-sm" />
            )}
            <Textarea defaultValue={v.body ?? ""} placeholder={nodeType === "connect_request" ? "Connection note" : "Message"}
              onBlur={(e) => update.mutate({ id: v.id, node_id: nodeId, body: e.target.value })}
              className="text-sm min-h-[80px]" />
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
        onClick={() => create.mutate({ node_id: nodeId, campaign_id: campaignId, label: nextLabel, body: "" })}>
        <Plus className="h-3.5 w-3.5" /> Add Variant {nextLabel}
      </Button>
    </div>
  );
}
