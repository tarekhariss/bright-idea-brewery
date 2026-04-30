import { Settings, Save, Loader2, ShieldAlert, Plus, Trash2, Copy, Check, Webhook, KeyRound, ListX, Filter, Brain, Plug } from "lucide-react";
import { LinkedinExecutionAdapterSection } from "@/components/linkedin/LinkedinExecutionAdapterSection";
import { useHasActiveLinkedinAdapter } from "@/hooks/use-linkedin-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useLinkedinSafetyRules, useUpsertLinkedinSafetyRules } from "@/hooks/use-linkedin";
import {
  useLinkedinWebhooks, useCreateLinkedinWebhook, useUpdateLinkedinWebhook, useDeleteLinkedinWebhook,
  useLinkedinApiKeys, useCreateLinkedinApiKey, useDeleteLinkedinApiKey,
  useLinkedinStoplist, useAddStoplistEntry, useDeleteStoplistEntry,
  useLinkedinFilterPresets, useSaveFilterPreset, useDeleteFilterPreset,
  useLinkedinLlmIntegrations, useUpsertLinkedinLlm, useDeleteLinkedinLlm,
} from "@/hooks/use-linkedin-platform";
import { toast } from "sonner";

export default function LinkedinSettingsPage() {
  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Settings className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Workspace-wide configuration for LinkedIn Outreach.</p>
        </div>
      </div>

      <AdapterBanner />

      <Tabs defaultValue="execution">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="execution" className="text-xs gap-1.5"><Plug className="h-3.5 w-3.5" /> Execution</TabsTrigger>
          <TabsTrigger value="safety" className="text-xs gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Safety</TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs gap-1.5"><Webhook className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
          <TabsTrigger value="apikeys" className="text-xs gap-1.5"><KeyRound className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="stoplist" className="text-xs gap-1.5"><ListX className="h-3.5 w-3.5" /> Stoplist</TabsTrigger>
          <TabsTrigger value="filters" className="text-xs gap-1.5"><Filter className="h-3.5 w-3.5" /> Filter Presets</TabsTrigger>
          <TabsTrigger value="llm" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" /> LLM</TabsTrigger>
        </TabsList>

        <TabsContent value="execution" className="pt-4"><LinkedinExecutionAdapterSection /></TabsContent>
        <TabsContent value="safety" className="pt-4"><SafetyTab /></TabsContent>
        <TabsContent value="webhooks" className="pt-4"><WebhooksTab /></TabsContent>
        <TabsContent value="apikeys" className="pt-4"><ApiKeysTab /></TabsContent>
        <TabsContent value="stoplist" className="pt-4"><StoplistTab /></TabsContent>
        <TabsContent value="filters" className="pt-4"><FilterPresetsTab /></TabsContent>
        <TabsContent value="llm" className="pt-4"><LlmTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── Safety ─────────
function SafetyTab() {
  const { data: rules, isLoading } = useLinkedinSafetyRules();
  const upsert = useUpsertLinkedinSafetyRules();
  const [form, setForm] = useState({ max_connects_per_day: 20, max_messages_per_day: 50, min_delay_minutes: 2, max_delay_minutes: 10 });
  useEffect(() => { if (rules) setForm({ max_connects_per_day: rules.max_connects_per_day, max_messages_per_day: rules.max_messages_per_day, min_delay_minutes: rules.min_delay_minutes, max_delay_minutes: rules.max_delay_minutes }); }, [rules]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Workspace Daily Safety Limits</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Max Connects / Day</Label><Input type="number" value={form.max_connects_per_day} onChange={(e) => setForm({ ...form, max_connects_per_day: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Max Messages / Day</Label><Input type="number" value={form.max_messages_per_day} onChange={(e) => setForm({ ...form, max_messages_per_day: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Min Delay (min)</Label><Input type="number" value={form.min_delay_minutes} onChange={(e) => setForm({ ...form, min_delay_minutes: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Max Delay (min)</Label><Input type="number" value={form.max_delay_minutes} onChange={(e) => setForm({ ...form, max_delay_minutes: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" /></div>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={() => upsert.mutate(form)} disabled={upsert.isPending} className="gap-1.5">
            {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────── Webhooks ─────────
function WebhooksTab() {
  const { data: hooks, isLoading } = useLinkedinWebhooks();
  const create = useCreateLinkedinWebhook();
  const update = useUpdateLinkedinWebhook();
  const remove = useDeleteLinkedinWebhook();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: "connection_accepted,reply_received", secret: "" });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">Webhooks</CardTitle>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Webhook</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !hooks?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No webhooks configured.</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{h.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">{(h.events || []).map((e: string) => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}</div>
                </div>
                <Switch checked={h.is_active} onCheckedChange={(v) => update.mutate({ id: h.id, is_active: v })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-base">New Webhook</DialogTitle><DialogDescription>Receive HTTP POST notifications for LinkedIn events.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhooks/linkedin" className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Events (comma-separated)</Label><Input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Signing Secret (optional)</Label><Input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className="mt-1 h-9 text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!form.name || !form.url) return toast.error("Name and URL required");
              await create.mutateAsync({ name: form.name, url: form.url, events: form.events.split(",").map(s => s.trim()).filter(Boolean), secret: form.secret || undefined });
              setOpen(false); setForm({ name: "", url: "", events: "connection_accepted,reply_received", secret: "" });
            }} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ───────── API Keys ─────────
function ApiKeysTab() {
  const { data: keys, isLoading } = useLinkedinApiKeys();
  const create = useCreateLinkedinApiKey();
  const remove = useDeleteLinkedinApiKey();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">API Keys</CardTitle>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setOpen(true); setIssued(null); setName(""); }}><Plus className="h-3.5 w-3.5" /> Generate Key</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !keys?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No API keys generated yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}…</p>
                  <p className="text-[10px] text-muted-foreground">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-base">{issued ? "API Key Generated" : "Generate API Key"}</DialogTitle></DialogHeader>
          {issued ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Copy this key now — it will not be shown again.</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 font-mono text-xs break-all">
                {issued}
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(issued); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ) : (
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" /></div>
          )}
          <DialogFooter>
            {issued ? <Button size="sm" onClick={() => setOpen(false)}>Done</Button> : (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={async () => {
                  if (!name) return toast.error("Name required");
                  const key = await create.mutateAsync({ name });
                  setIssued(key);
                  toast.success("API key generated");
                }} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ───────── Stoplist ─────────
function StoplistTab() {
  const { data, isLoading } = useLinkedinStoplist();
  const add = useAddStoplistEntry();
  const remove = useDeleteStoplistEntry();
  const [form, setForm] = useState({ match_type: "linkedin_url", match_value: "", reason: "" });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Do-Not-Contact Stoplist</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[150px_1fr_1fr_auto] gap-2">
          <Select value={form.match_type} onValueChange={(v) => setForm({ ...form, match_type: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin_url">LinkedIn URL</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="domain">Domain</SelectItem>
              <SelectItem value="company_name">Company Name</SelectItem>
              <SelectItem value="keyword">Keyword</SelectItem>
            </SelectContent>
          </Select>
          <Input value={form.match_value} onChange={(e) => setForm({ ...form, match_value: e.target.value })} placeholder="Value" className="h-9 text-sm" />
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (optional)" className="h-9 text-sm" />
          <Button size="sm" disabled={!form.match_value || add.isPending} onClick={async () => { await add.mutateAsync(form); setForm({ match_type: form.match_type, match_value: "", reason: "" }); }}>Add</Button>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Stoplist is empty.</p>
        ) : (
          <div className="space-y-1.5">
            {data.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 rounded-md border p-2.5 text-xs">
                <Badge variant="secondary" className="text-[10px]">{s.match_type}</Badge>
                <span className="font-mono">{s.match_value}</span>
                {s.reason && <span className="text-muted-foreground">— {s.reason}</span>}
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────── Filter Presets ─────────
function FilterPresetsTab() {
  const { data, isLoading } = useLinkedinFilterPresets();
  const save = useSaveFilterPreset();
  const remove = useDeleteFilterPreset();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [json, setJson] = useState("{}");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">LinkedIn Filter Presets</CardTitle>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setOpen(true); setName(""); setJson("{}"); }}><Plus className="h-3.5 w-3.5" /> New Preset</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No filter presets yet.</p>
        ) : (
          <div className="space-y-2">
            {data.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate max-w-md">{JSON.stringify(p.filters)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-base">New Filter Preset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" /></div>
            <div><Label className="text-xs">Filters (JSON)</Label><Textarea value={json} onChange={(e) => setJson(e.target.value)} className="mt-1 min-h-[140px] text-xs font-mono" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              try {
                const filters = JSON.parse(json);
                await save.mutateAsync({ name, filters });
                setOpen(false);
              } catch (e: any) { toast.error("Invalid JSON: " + e.message); }
            }} disabled={!name || save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ───────── LLM ─────────
function LlmTab() {
  const { data, isLoading } = useLinkedinLlmIntegrations();
  const upsert = useUpsertLinkedinLlm();
  const remove = useDeleteLinkedinLlm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provider: "lovable_ai", model: "google/gemini-2.5-flash", is_default: false });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">LLM Integrations</CardTitle>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Integration</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No LLM integrations configured. Lovable AI is used by default for AI personalization.</p>
        ) : (
          <div className="space-y-2">
            {data.map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{i.provider}</p>
                  <p className="text-xs font-mono text-muted-foreground">{i.model}</p>
                </div>
                {i.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-base">Add LLM Integration</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable_ai">Lovable AI (default)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1 h-9 text-sm" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} /><Label className="text-xs">Use as workspace default</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => { await upsert.mutateAsync(form); setOpen(false); }} disabled={upsert.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
