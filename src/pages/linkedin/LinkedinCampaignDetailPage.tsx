import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Users, GitBranch, Inbox, BarChart3, Settings, Plus, Trash2, Eye, UserPlus, MessageSquare, Reply, ListTodo, Clock, Save, Pause, Play, ShieldAlert, Plug, Rocket, UserCheck, Workflow, CheckCircle2 } from "lucide-react";
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
  useLinkedinCampaignLeads,
  useLinkedinInboxThreads,
} from "@/hooks/use-linkedin-campaigns";
import { useTransitionLinkedinLead, useHasActiveLinkedinAdapter, useLinkedinCampaignStats } from "@/hooks/use-linkedin-engine";
import { useEnrollLeadsV2, useCampaignSenders, useValidateWorkflow } from "@/hooks/use-linkedin-workflow";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { LinkedinWorkflowBuilder } from "@/components/linkedin/LinkedinWorkflowBuilder";
import { CampaignSendersTab } from "@/components/linkedin/CampaignSendersTab";
import { LaunchCampaignDialog } from "@/components/linkedin/LaunchCampaignDialog";
import { ConfigRequiredBanner } from "@/components/config";
import { cn } from "@/lib/utils";

export default function LinkedinCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useLinkedinCampaign(id || null);
  const [tab, setTab] = useState("build");
  const [launchOpen, setLaunchOpen] = useState(false);

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
        <CampaignAdapterBadge />
        <Badge className="text-[10px] capitalize">{campaign.status}</Badge>
        <Button size="sm" className="gap-1.5" onClick={() => setLaunchOpen(true)}>
          <Rocket className="h-3.5 w-3.5" /> Launch
        </Button>
      </header>

      <div className="px-6 pt-3">
        <ConfigRequiredBanner capabilities={["linkedin"]} title="Connect an active LinkedIn account before launch" />
      </div>



      {/* 4-step creation flow */}
      <CreationStepper campaignId={campaign.id} active={tab} onChange={setTab} />

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="build"><Workflow className="h-3.5 w-3.5 mr-1.5" />Build</TabsTrigger>
          <TabsTrigger value="senders"><UserCheck className="h-3.5 w-3.5 mr-1.5" />Senders</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-3.5 w-3.5 mr-1.5" />Contacts</TabsTrigger>
          <TabsTrigger value="launch"><Rocket className="h-3.5 w-3.5 mr-1.5" />Launch</TabsTrigger>
          <TabsTrigger value="inbox"><Inbox className="h-3.5 w-3.5 mr-1.5" />Inbox</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5 mr-1.5" />Settings</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="build" className="mt-0"><LinkedinWorkflowBuilder campaignId={campaign.id} /></TabsContent>
          <TabsContent value="senders" className="mt-0"><CampaignSendersTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="contacts" className="mt-0"><LeadsTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="launch" className="mt-0"><LaunchTab campaignId={campaign.id} onLaunchClick={() => setLaunchOpen(true)} /></TabsContent>
          <TabsContent value="inbox" className="mt-0"><InboxTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="analytics" className="mt-0"><AnalyticsTab campaignId={campaign.id} /></TabsContent>
          <TabsContent value="settings" className="mt-0"><SettingsTab campaign={campaign} /></TabsContent>
        </div>
      </Tabs>

      <LaunchCampaignDialog open={launchOpen} onOpenChange={setLaunchOpen} campaignId={campaign.id} />
    </div>
  );
}

function CreationStepper({ campaignId, active, onChange }: { campaignId: string; active: string; onChange: (v: string) => void }) {
  const { data: validation } = useValidateWorkflow(campaignId);
  const { data: senders } = useCampaignSenders(campaignId);
  const { data: leads } = useLinkedinCampaignLeads(campaignId);
  const steps = [
    { id: "build", label: "Build", done: !!validation?.valid, icon: Workflow },
    { id: "senders", label: "Add Sender Profiles", done: (senders ?? []).filter((s: any) => s.is_active).length > 0, icon: UserCheck },
    { id: "contacts", label: "Add Contacts", done: (leads?.length ?? 0) > 0, icon: Users },
    { id: "launch", label: "Launch", done: false, icon: Rocket },
  ];
  return (
    <div className="border-b bg-card/50 px-6 py-2">
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => onChange(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition",
                active === s.id ? "bg-primary text-primary-foreground" : s.done ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              <span className="font-medium">{i + 1}. {s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function LaunchTab({ campaignId, onLaunchClick }: { campaignId: string; onLaunchClick: () => void }) {
  const { data: validation } = useValidateWorkflow(campaignId);
  const { data: senders } = useCampaignSenders(campaignId);
  const { data: leads } = useLinkedinCampaignLeads(campaignId);
  const { data: hasAdapter } = useHasActiveLinkedinAdapter();

  const items = [
    { ok: !!validation?.valid, label: "Workflow validated", detail: validation?.errors?.join(", ") || "Build a flow with Start → Action(s) → End" },
    { ok: ((senders ?? []) as any[]).filter((s) => s.is_active).length > 0, label: "Sender profiles attached", detail: `${(senders ?? []).length} attached` },
    { ok: (leads?.length ?? 0) > 0, label: "Contacts added", detail: `${leads?.length ?? 0} leads` },
    { ok: !!hasAdapter, label: "Execution provider configured", detail: hasAdapter ? "Adapter active" : "Settings → Execution. Actions will be queued and marked blocked until configured." },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Rocket className="h-4 w-4" /> Pre-flight checklist</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className={`flex items-start gap-2 rounded p-2 text-sm ${it.ok ? "bg-emerald-500/5" : "bg-amber-500/5"}`}>
              <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[10px] text-white ${it.ok ? "bg-emerald-600" : "bg-amber-600"}`}>{it.ok ? "✓" : "!"}</div>
              <div className="flex-1">
                <p className="font-medium">{it.label}</p>
                <p className="text-[11px] text-muted-foreground">{it.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Button onClick={onLaunchClick} className="gap-1.5"><Rocket className="h-3.5 w-3.5" /> Launch Campaign</Button>
    </div>
  );
}

function CampaignAdapterBadge() {
  const { data: hasAdapter } = useHasActiveLinkedinAdapter();
  if (hasAdapter) return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><Plug className="h-3 w-3" /> Adapter active</Badge>;
  return <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1" title="Configure under Settings → Execution"><ShieldAlert className="h-3 w-3" /> Execution provider required</Badge>;
}

// ── Leads Tab ──
function LeadsTab({ campaignId }: { campaignId: string }) {
  const { data: leads, isLoading } = useLinkedinCampaignLeads(campaignId);
  const transition = useTransitionLinkedinLead();
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
                    <div className="flex gap-1 justify-end" data-stop>
                      {l.status === "paused" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => transition.mutate({ lead_id: l.id, action: "resume" })} title="Resume"><Play className="h-3.5 w-3.5" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => transition.mutate({ lead_id: l.id, action: "pause" })} title="Pause"><Pause className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => transition.mutate({ lead_id: l.id, action: "remove" })} title="Remove">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
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
  const enroll = useEnrollLeadsV2();

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
    await enroll.mutateAsync({ campaign_id: campaignId, contact_ids: Array.from(selected) });
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
          <Button size="sm" disabled={!selected.size || enroll.isPending} onClick={handleAdd}>
            {enroll.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Enroll {selected.size} lead{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Legacy SequenceTab removed — replaced by LinkedinWorkflowBuilder.

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
  const { data: stats } = useLinkedinCampaignStats(campaignId);
  const s = stats?.[0] || {};
  const cards = [
    { label: "Total Leads", value: s.leads_total ?? 0, icon: Users },
    { label: "Connected", value: s.connected ?? 0, icon: UserPlus },
    { label: "Connects Sent", value: s.connects_sent ?? 0, icon: UserPlus },
    { label: "Messages Sent", value: s.messages_sent ?? 0, icon: MessageSquare },
    { label: "Replies", value: s.replies ?? 0, icon: Reply },
    { label: "Meetings", value: s.meetings ?? 0, icon: MessageSquare },
    { label: "Queued", value: s.queued_actions ?? 0, icon: Clock },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-semibold mt-1">{c.value}</p>
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
