import { useState } from "react";
import { Plug, Plus, Trash2, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useLinkedinExecutionAdapters, useUpsertLinkedinAdapter, useDeleteLinkedinAdapter } from "@/hooks/use-linkedin-engine";

const PROVIDERS = [
  { value: "unipile", label: "Unipile (LinkedIn API)", help: "Hosted LinkedIn messaging/connections API. Requires Unipile API key." },
  { value: "heyreach", label: "HeyReach", help: "Connection requests + messaging via HeyReach API." },
  { value: "phantombuster", label: "Phantombuster", help: "Phantom containers; requires Phantombuster API key + agent IDs." },
  { value: "internal_extension", label: "Internal Chrome Extension", help: "Future — paired browser extension that polls the queue." },
  { value: "custom_webhook", label: "Custom webhook", help: "POST scheduled actions to a URL you control." },
];

export function LinkedinExecutionAdapterSection() {
  const { data: adapters, isLoading } = useLinkedinExecutionAdapters();
  const remove = useDeleteLinkedinAdapter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setOpen(true); };

  const hasActive = (adapters || []).some((a: any) => a.is_active);

  return (
    <div className="space-y-4">
      <div className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${hasActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
        {hasActive ? <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
        <span>
          {hasActive
            ? "An execution adapter is active. Queued LinkedIn actions can be processed automatically when the worker runs."
            : <>No execution adapter is configured. Actions will be <b>queued and persisted</b>, but no real LinkedIn work will happen until you connect a provider here. The system will not perform any unsafe scraping.</>}
        </span>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2"><Plug className="h-4 w-4 text-sky-600" /> Execution Adapters</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Connect a LinkedIn execution provider to actually send queued actions.</p>
          </div>
          <Button size="sm" className="text-xs gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Add adapter</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : !adapters?.length ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No execution adapters yet.</div>
          ) : (
            <div className="space-y-2">
              {adapters.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 rounded border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{a.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{a.provider.replace("_"," ")}</Badge>
                      {a.is_active ? <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                                   : <Badge className="text-[10px] bg-muted text-muted-foreground">Inactive</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Health: <span className="capitalize">{a.health_status}</span>
                      {a.credentials_secret_name && <> · Secret: <code className="text-[10px]">{a.credentials_secret_name}</code></>}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => openEdit(a)}>Edit</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remove this adapter?")) remove.mutate(a.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AdapterDialog open={open} onOpenChange={setOpen} adapter={editing} />
    </div>
  );
}

function AdapterDialog({ open, onOpenChange, adapter }: { open: boolean; onOpenChange: (v: boolean) => void; adapter: any }) {
  const upsert = useUpsertLinkedinAdapter();
  const [provider, setProvider] = useState(adapter?.provider ?? "unipile");
  const [name, setName] = useState(adapter?.name ?? "");
  const [isActive, setIsActive] = useState<boolean>(adapter?.is_active ?? false);
  const [secretName, setSecretName] = useState<string>(adapter?.credentials_secret_name ?? "");
  const [configJson, setConfigJson] = useState<string>(adapter?.config ? JSON.stringify(adapter.config, null, 2) : "{}");

  // reset on open
  useState(() => {
    if (adapter) {
      setProvider(adapter.provider); setName(adapter.name); setIsActive(adapter.is_active); setSecretName(adapter.credentials_secret_name ?? "");
      setConfigJson(JSON.stringify(adapter.config ?? {}, null, 2));
    }
  });

  const save = async () => {
    let config: any = {};
    try { config = JSON.parse(configJson || "{}"); } catch { return alert("Invalid JSON in config"); }
    await upsert.mutateAsync({ id: adapter?.id, provider, name: name.trim() || PROVIDERS.find(p => p.value === provider)?.label || provider, is_active: isActive, config, credentials_secret_name: secretName.trim() || undefined });
    onOpenChange(false);
  };

  const meta = PROVIDERS.find(p => p.value === provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{adapter ? "Edit adapter" : "Add execution adapter"}</DialogTitle>
          <DialogDescription className="text-xs">Adapters are how queued LinkedIn actions are actually executed. Lovable will not perform unsafe scraping — bring your own approved provider.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {meta?.help && <p className="text-[11px] text-muted-foreground mt-1">{meta.help}</p>}
          </div>
          <div>
            <Label className="text-xs">Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Unipile" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Credentials secret name</Label>
            <Input value={secretName} onChange={(e) => setSecretName(e.target.value)} placeholder="LI_UNIPILE_API_KEY" className="mt-1 h-9 text-sm" />
            <p className="text-[11px] text-muted-foreground mt-1">Add the secret separately under Backend → Edge Function Secrets. The adapter only stores the secret <em>name</em>.</p>
          </div>
          <div>
            <Label className="text-xs">Config (JSON)</Label>
            <Textarea value={configJson} onChange={(e) => setConfigJson(e.target.value)} className="mt-1 text-xs font-mono min-h-[120px]" />
          </div>
          <div className="flex items-center justify-between rounded border px-3 py-2">
            <div><p className="text-sm">Active</p><p className="text-[11px] text-muted-foreground">When active, the queue worker will use this adapter to execute actions.</p></div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
