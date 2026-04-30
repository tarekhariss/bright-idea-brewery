import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Users, GitBranch, Inbox, BarChart3, Settings, Plus, Trash2, Eye, UserPlus, MessageSquare, Reply, ListTodo, Clock, Save, Pause, Play, ShieldAlert, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useLinkedinCampaign, useUpdateLinkedinCampaign,
  useLinkedinCampaignSteps, useCreateLinkedinStep, useUpdateLinkedinStep, useDeleteLinkedinStep,
  useLinkedinCampaignLeads,
  useLinkedinInboxThreads,
} from "@/hooks/use-linkedin-campaigns";
import { useEnrollLeadsInLinkedinCampaign, useTransitionLinkedinLead, useHasActiveLinkedinAdapter, useLinkedinCampaignStats } from "@/hooks/use-linkedin-engine";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

const STEP_TYPES = [
  { value: "view_profile", label: "View Profile", icon: Eye },
  { value: "connect_request", label: "Send Connection Request", icon: UserPlus },
  { value: "message", label: "Send Message", icon: MessageSquare },
  { value: "follow_up_message", label: "Follow-up Message", icon: Reply },
  { value: "manual_task", label: "Manual Task", icon: ListTodo },
  { value: "wait", label: "Wait Delay", icon: Clock },
];

export default function LinkedinCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useLinkedinCampaign(id || null);

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!campaign) return <div className="p-6">Campaign not found.</div>;

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-card px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/linkedin/campaigns")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{campaign.name}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{campaign.description || "LinkedIn outreach campaign"}</p>
        </div>
        <Badge className="text-[10px] capitalize">{campaign.status}</Badge>
      </header>

      <Tabs defaultValue="leads" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="leads"><Users className="h-3.5 w-3.5 mr-1.5" />Leads</TabsTrigger>
          <TabsTrigger value="sequence"><GitBranch className="h-3.5 w-3.5 mr-1.5" />Sequence</TabsTrigger>
          <TabsTrigger value="inbox"><Inbox className="h-3.5 w-3.5 mr-1.5" />Inbox</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5 mr-1.5" />Settings</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="leads" className="mt-0"><LeadsTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="sequence" className="mt-0"><SequenceTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="inbox" className="mt-0"><InboxTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="analytics" className="mt-0"><AnalyticsTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="settings" className="mt-0"><SettingsTab campaign={campaign} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Leads Tab ──
function LeadsTab({ campaignId }: { campaignId: string }) {
  const { data: leads, isLoading } = useLinkedinCampaignLeads(campaignId);
  const removeLead = useRemoveLinkedinLead();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{leads?.length || 0} leads in campaign</p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Leads</Button>
      </div>
      <Card>
        {isLoading ? (
          <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !leads?.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No leads yet — add from your contacts.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">Connection</TableHead>
                <TableHead className="text-xs">Step</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Last Action</TableHead>
                <TableHead className="text-xs">Reply</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{l.contacts?.first_name} {l.contacts?.last_name}</TableCell>
                  <TableCell className="text-xs">{l.contacts?.companies?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.connection_status?.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-xs">Step {l.current_step_order}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.status}</Badge></TableCell>
                  <TableCell className="text-xs">{l.last_action_at ? new Date(l.last_action_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-xs">{l.reply_status || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLead.mutate({ id: l.id, campaign_id: campaignId })}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <AddLeadsDialog open={addOpen} onOpenChange={setAddOpen} campaignId={campaignId} />
    </div>
  );
}

function AddLeadsDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string }) {
  const { workspaceId } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addLeads = useAddLinkedinLeads();

  const { data: contacts } = useQuery({
    queryKey: ["contacts_picker", workspaceId, search],
    enabled: open && !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any).from("contacts").select("id, first_name, last_name, email, linkedin_url").eq("workspace_id", workspaceId).limit(50);
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const toggle = (id: string) => {
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s);
  };

  const handleAdd = async () => {
    await addLeads.mutateAsync({ campaign_id: campaignId, contact_ids: Array.from(selected) });
    setSelected(new Set()); setSearch(""); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="text-base">Add Leads to Campaign</DialogTitle></DialogHeader>
        <Input placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-sm" />
        <div className="max-h-[400px] overflow-auto border rounded">
          {contacts?.map((c: any) => (
            <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-0">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
              </div>
            </label>
          )) || <div className="p-4 text-sm text-muted-foreground">No contacts.</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!selected.size || addLeads.isPending} onClick={handleAdd}>
            {addLeads.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Add {selected.size} lead{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sequence Tab ──
function SequenceTab({ campaignId }: { campaignId: string }) {
  const { data: steps, isLoading } = useLinkedinCampaignSteps(campaignId);
  const createStep = useCreateLinkedinStep();
  const updateStep = useUpdateLinkedinStep();
  const deleteStep = useDeleteLinkedinStep();

  const handleAdd = (type: string) => {
    const order = (steps?.length || 0) + 1;
    createStep.mutate({ campaign_id: campaignId, step_order: order, step_type: type, delay_days: type === "wait" ? 1 : 0 });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{steps?.length || 0} steps in sequence</p>
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="space-y-3">
          {steps?.map((s: any, idx: number) => {
            const meta = STEP_TYPES.find(t => t.value === s.step_type);
            const Icon = meta?.icon || GitBranch;
            return (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 text-xs font-semibold">{idx + 1}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-sky-600" />
                        <span className="text-sm font-medium">{meta?.label || s.step_type}</span>
                      </div>
                      {(s.step_type === "message" || s.step_type === "follow_up_message" || s.step_type === "connect_request") && (
                        <Textarea
                          placeholder="Message body — supports {first_name}, {company}, etc."
                          defaultValue={s.message_body || ""}
                          onBlur={(e) => updateStep.mutate({ id: s.id, campaign_id: campaignId, message_body: e.target.value })}
                          className="text-sm min-h-[80px]"
                        />
                      )}
                      {s.step_type === "manual_task" && (
                        <>
                          <Input placeholder="Task title" defaultValue={s.task_title || ""} onBlur={(e) => updateStep.mutate({ id: s.id, campaign_id: campaignId, task_title: e.target.value })} className="h-8 text-sm" />
                          <Textarea placeholder="Task description" defaultValue={s.task_description || ""} onBlur={(e) => updateStep.mutate({ id: s.id, campaign_id: campaignId, task_description: e.target.value })} className="text-sm min-h-[60px]" />
                        </>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        <Label className="text-xs text-muted-foreground">Delay:</Label>
                        <Input type="number" min={0} defaultValue={s.delay_days} onBlur={(e) => updateStep.mutate({ id: s.id, campaign_id: campaignId, delay_days: parseInt(e.target.value) || 0 })} className="h-7 w-16 text-xs" />
                        <span className="text-xs text-muted-foreground">days</span>
                        <Input type="number" min={0} defaultValue={s.delay_hours} onBlur={(e) => updateStep.mutate({ id: s.id, campaign_id: campaignId, delay_hours: parseInt(e.target.value) || 0 })} className="h-7 w-16 text-xs" />
                        <span className="text-xs text-muted-foreground">hours</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteStep.mutate({ id: s.id, campaign_id: campaignId })}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Add Step</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STEP_TYPES.map((t) => (
            <Button key={t.value} variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleAdd(t.value)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Inbox Tab (campaign-scoped) ──
function InboxTab({ campaignId }: { campaignId: string }) {
  const { data: threads, isLoading } = useLinkedinInboxThreads({ campaignId });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!threads?.length) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No replies yet for this campaign.</CardContent></Card>;
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead className="text-xs">Contact</TableHead><TableHead className="text-xs">Subject</TableHead><TableHead className="text-xs">Category</TableHead><TableHead className="text-xs">Last Message</TableHead></TableRow></TableHeader>
        <TableBody>
          {threads.map((t: any) => (
            <TableRow key={t.id}>
              <TableCell className="text-sm">{t.contacts?.first_name} {t.contacts?.last_name}</TableCell>
              <TableCell className="text-xs truncate max-w-[300px]">{t.subject || t.preview || "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{(t.user_category || t.category)?.replace("_"," ")}</Badge></TableCell>
              <TableCell className="text-xs">{t.last_message_at ? new Date(t.last_message_at).toLocaleString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ── Analytics Tab ──
function AnalyticsTab({ campaignId }: { campaignId: string }) {
  const { data: leads } = useLinkedinCampaignLeads(campaignId);
  const total = leads?.length || 0;
  const connected = leads?.filter((l: any) => l.connection_status === "connected").length || 0;
  const replied = leads?.filter((l: any) => l.reply_status && l.reply_status !== "none").length || 0;
  const meetings = leads?.filter((l: any) => l.reply_status === "meeting_booked").length || 0;
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "Total Leads", value: total, icon: Users },
        { label: "Connected", value: connected, icon: UserPlus },
        { label: "Replies", value: replied, icon: Reply },
        { label: "Meetings", value: meetings, icon: MessageSquare },
      ].map((s) => (
        <Card key={s.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab({ campaign }: { campaign: any }) {
  const update = useUpdateLinkedinCampaign();
  const { data: accounts } = useLinkedinAccounts();
  const [form, setForm] = useState({
    name: campaign.name,
    description: campaign.description || "",
    status: campaign.status,
    linkedin_account_id: campaign.linkedin_account_id || "",
    daily_connect_limit: campaign.daily_connect_limit,
    daily_message_limit: campaign.daily_message_limit,
    sending_window_start: campaign.sending_window_start,
    sending_window_end: campaign.sending_window_end,
    timezone: campaign.timezone,
    stop_on_reply: campaign.stop_on_reply,
    exclude_existing_connections: campaign.exclude_existing_connections,
  });

  const handleSave = () => {
    update.mutate({ id: campaign.id, ...form, linkedin_account_id: form.linkedin_account_id || null });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 text-sm min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["draft","active","paused","completed","archived"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">LinkedIn Account</Label>
              <Select value={form.linkedin_account_id || "none"} onValueChange={(v) => setForm({ ...form, linkedin_account_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts?.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.profile_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Sending Limits</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Daily Connects</Label><Input type="number" value={form.daily_connect_limit} onChange={(e) => setForm({ ...form, daily_connect_limit: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Daily Messages</Label><Input type="number" value={form.daily_message_limit} onChange={(e) => setForm({ ...form, daily_message_limit: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Window Start</Label><Input type="time" value={form.sending_window_start} onChange={(e) => setForm({ ...form, sending_window_start: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Window End</Label><Input type="time" value={form.sending_window_end} onChange={(e) => setForm({ ...form, sending_window_end: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs">Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1 h-9 text-sm" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Behavior</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between"><div><p className="text-sm">Stop on reply</p><p className="text-[11px] text-muted-foreground">Pause lead when they reply.</p></div><Switch checked={form.stop_on_reply} onCheckedChange={(v) => setForm({ ...form, stop_on_reply: v })} /></div>
          <div className="flex items-center justify-between"><div><p className="text-sm">Exclude existing connections</p><p className="text-[11px] text-muted-foreground">Skip leads already connected on LinkedIn.</p></div><Switch checked={form.exclude_existing_connections} onCheckedChange={(v) => setForm({ ...form, exclude_existing_connections: v })} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={update.isPending} className="gap-1.5">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
