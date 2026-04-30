import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame, Settings as SettingsIcon, Megaphone, CheckCircle2,
  AlertTriangle, Copy, ExternalLink, ShieldCheck, Globe2, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUpdateMailbox } from "@/hooks/use-deliverability";
import {
  useMailboxWarmupSettings, useUpsertMailboxWarmupSettings,
  useMailboxHealth, useMailboxCampaigns,
} from "@/hooks/use-mailbox-detail";

interface Props {
  mailbox: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EmailAccountDetailDrawer({ mailbox, open, onOpenChange }: Props) {
  if (!mailbox) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-2xl"
      >
        <DrawerInner mailbox={mailbox} />
      </SheetContent>
    </Sheet>
  );
}

function DrawerInner({ mailbox }: { mailbox: any }) {
  const status = mailbox.connection_status || "disconnected";
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader className="space-y-2 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 text-sm font-semibold">
            {mailbox.email?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base">{mailbox.email}</SheetTitle>
            <SheetDescription className="text-xs">
              {mailbox.from_name || mailbox.sender_name || mailbox.display_name || "—"} · {mailbox.provider_type || "smtp"}
            </SheetDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px] capitalize",
              status === "active" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
              status === "paused" && "border-amber-500/30 bg-amber-500/10 text-amber-700",
              status === "warming" && "border-blue-500/30 bg-blue-500/10 text-blue-700",
              status === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-700",
            )}
          >
            {status === "active" && <CheckCircle2 className="h-2.5 w-2.5" />}
            {status === "error" && <AlertTriangle className="h-2.5 w-2.5" />}
            {status}
          </Badge>
        </div>
      </SheetHeader>

      {/* Tabs */}
      <Tabs defaultValue="warmup" className="flex flex-1 flex-col">
        <TabsList className="mx-6 mt-3 grid w-auto grid-cols-3">
          <TabsTrigger value="warmup" className="gap-1.5 text-xs">
            <Flame className="h-3.5 w-3.5" /> Warmup
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" /> Campaigns
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="warmup" className="m-0">
            <WarmupTab mailbox={mailbox} />
          </TabsContent>
          <TabsContent value="settings" className="m-0">
            <SettingsTab mailbox={mailbox} />
          </TabsContent>
          <TabsContent value="campaigns" className="m-0">
            <CampaignsTab mailbox={mailbox} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ─────────── Warmup Tab ─────────── */
function WarmupTab({ mailbox }: { mailbox: any }) {
  const { data: settings, isLoading } = useMailboxWarmupSettings(mailbox.id);
  const { data: health } = useMailboxHealth(mailbox.id);
  const upsert = useUpsertMailboxWarmupSettings();
  const updateMailbox = useUpdateMailbox();

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    setForm({
      warmup_enabled: settings?.warmup_enabled ?? mailbox.warmup_enabled ?? false,
      warmup_filter_tag: settings?.warmup_filter_tag ?? "",
      increase_per_day: settings?.increase_per_day ?? 2,
      disable_slow_warmup: settings?.disable_slow_warmup ?? false,
      daily_warmup_limit: settings?.daily_warmup_limit ?? 5,
      reply_rate_target: settings?.reply_rate_target ?? 30,
      open_rate_target: settings?.open_rate_target ?? 60,
      spam_protection_rate: settings?.spam_protection_rate ?? 95,
      mark_important_rate: settings?.mark_important_rate ?? 30,
      weekdays_only: settings?.weekdays_only ?? true,
      read_emulation: settings?.read_emulation ?? true,
      warm_custom_tracking_domain: settings?.warm_custom_tracking_domain ?? false,
    });
  }, [settings, mailbox.id, mailbox.warmup_enabled]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    await upsert.mutateAsync({ mailbox_id: mailbox.id, ...form });
    if (form.warmup_enabled !== mailbox.warmup_enabled) {
      await updateMailbox.mutateAsync({
        id: mailbox.id,
        warmup_enabled: form.warmup_enabled,
        ...(form.warmup_enabled && !mailbox.warmup_started_at
          ? { warmup_started_at: new Date().toISOString() } as any
          : {}),
      } as any);
    }
  };

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const sentWeek = settings?.warmup_emails_sent_week ?? 0;
  const recvWeek = settings?.warmup_emails_received_week ?? 0;
  const savedWeek = settings?.saved_from_spam_week ?? 0;
  const chart: any[] = (settings?.weekly_chart as any[]) ?? [];

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            form.warmup_enabled ? "bg-orange-500/10 text-orange-600" : "bg-muted text-muted-foreground",
          )}>
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{form.warmup_enabled ? "Warmup Active" : "Warmup Disabled"}</p>
            <p className="text-[11px] text-muted-foreground">
              {mailbox.warmup_started_at
                ? `Started ${new Date(mailbox.warmup_started_at).toLocaleDateString()}`
                : "Not started yet"} · Configuration ready, pending activation
            </p>
          </div>
        </div>
        <Switch checked={form.warmup_enabled} onCheckedChange={(v) => set("warmup_enabled", v)} />
      </Card>

      {/* Weekly summary */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past 7 Days</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Sent", value: sentWeek, color: "text-blue-600" },
            { label: "Received", value: recvWeek, color: "text-emerald-600" },
            { label: "Saved from spam", value: savedWeek, color: "text-amber-600" },
          ].map((m) => (
            <Card key={m.label} className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground">{m.label}</p>
              <p className={cn("mt-0.5 text-lg font-semibold", m.color)}>{m.value}</p>
            </Card>
          ))}
        </div>
        {/* mini chart */}
        <Card className="mt-2 p-3">
          <div className="flex items-end gap-1.5 h-20">
            {(chart.length ? chart : Array.from({ length: 7 }).map((_, i) => ({ day: i, value: 0 }))).map((d: any, i: number) => {
              const max = Math.max(1, ...((chart.length ? chart : []).map((x: any) => x.value || 0)), 1);
              const h = Math.max(4, ((d.value || 0) / max) * 80);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end">
                    <div
                      className="w-full rounded-t bg-orange-500/70"
                      style={{ height: `${h}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {["M","T","W","T","F","S","S"][i] || ""}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Separator />

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warmup Settings</h3>

        <FieldRow label="Warmup filter tag" hint="Tag added to warmup emails (BCC/header)">
          <Input value={form.warmup_filter_tag || ""} onChange={(e) => set("warmup_filter_tag", e.target.value)} placeholder="e.g. [warmup]" className="h-8 text-xs" />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Increase per day">
            <Input type="number" min={0} value={form.increase_per_day} onChange={(e) => set("increase_per_day", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Daily warmup limit">
            <Input type="number" min={0} value={form.daily_warmup_limit} onChange={(e) => set("daily_warmup_limit", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Reply rate %">
            <Input type="number" min={0} max={100} value={form.reply_rate_target} onChange={(e) => set("reply_rate_target", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Open rate %">
            <Input type="number" min={0} max={100} value={form.open_rate_target} onChange={(e) => set("open_rate_target", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Spam protection %">
            <Input type="number" min={0} max={100} value={form.spam_protection_rate} onChange={(e) => set("spam_protection_rate", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Mark important %">
            <Input type="number" min={0} max={100} value={form.mark_important_rate} onChange={(e) => set("mark_important_rate", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
        </div>

        <ToggleRow label="Disable slow warmup" desc="Skip the gradual ramp-up phase" checked={form.disable_slow_warmup} onChange={(v) => set("disable_slow_warmup", v)} />
        <ToggleRow label="Weekdays only" desc="Send warmup emails Mon–Fri only" checked={form.weekdays_only} onChange={(v) => set("weekdays_only", v)} />
        <ToggleRow label="Read emulation" desc="Simulate reading time to look human" checked={form.read_emulation} onChange={(v) => set("read_emulation", v)} />
        <ToggleRow label="Warm custom tracking domain" desc="Include tracking domain links in warmup emails" checked={form.warm_custom_tracking_domain} onChange={(v) => set("warm_custom_tracking_domain", v)} />
      </div>

      <div className="sticky bottom-0 -mx-6 mt-4 flex justify-end border-t bg-card/95 px-6 py-3 backdrop-blur">
        <Button size="sm" className="h-8 text-xs" onClick={save} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save warmup settings"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────── Settings Tab ─────────── */
function SettingsTab({ mailbox }: { mailbox: any }) {
  const updateMailbox = useUpdateMailbox();
  const [form, setForm] = useState<any>({});
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setForm({
      first_name: mailbox.first_name ?? "",
      last_name: mailbox.last_name ?? "",
      sender_name: mailbox.sender_name ?? mailbox.from_name ?? mailbox.display_name ?? "",
      signature: mailbox.signature ?? "",
      tags: mailbox.tags ?? [],
      reply_to_email: mailbox.reply_to_email ?? "",
      daily_campaign_limit: mailbox.daily_campaign_limit ?? mailbox.daily_sending_limit ?? 50,
      min_wait_seconds: mailbox.min_wait_seconds ?? 60,
      slow_ramp_enabled: mailbox.slow_ramp_enabled ?? true,
      daily_inbox_placement_test_limit: mailbox.daily_inbox_placement_test_limit ?? 0,
      tracking_domain: mailbox.tracking_domain ?? "",
      tracking_subdomain: mailbox.tracking_subdomain ?? "track",
      tracking_cname_target: mailbox.tracking_cname_target ?? "open.tlbg.cloud",
    });
  }, [mailbox]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    await updateMailbox.mutateAsync({ id: mailbox.id, ...form } as any);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => set("tags", form.tags.filter((x: string) => x !== t));

  const cnameHost = `${form.tracking_subdomain || "track"}.${form.tracking_domain || "yourdomain.com"}`;

  return (
    <div className="space-y-5">
      <Section title="Sender Profile">
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="First name">
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Last name">
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="h-8 text-xs" />
          </FieldRow>
        </div>
        <FieldRow label="Sender name" hint="What recipients see in their inbox">
          <Input value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} className="h-8 text-xs" />
        </FieldRow>
        <FieldRow label="Reply-to address">
          <Input type="email" value={form.reply_to_email} onChange={(e) => set("reply_to_email", e.target.value)} placeholder={mailbox.email} className="h-8 text-xs" />
        </FieldRow>
        <FieldRow label="Signature">
          <Textarea
            value={form.signature}
            onChange={(e) => set("signature", e.target.value)}
            rows={4}
            className="text-xs"
            placeholder="Best,\nYour Name"
          />
        </FieldRow>
        <FieldRow label="Tags">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {form.tags?.map((t: string) => (
                <Badge key={t} variant="secondary" className="gap-1 text-[10px]">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag…"
                className="h-7 text-xs"
              />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTag}>Add</Button>
            </div>
          </div>
        </FieldRow>
      </Section>

      <Section title="Sending Limits">
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Daily campaign limit" hint="Max outbound per day">
            <Input type="number" min={0} value={form.daily_campaign_limit} onChange={(e) => set("daily_campaign_limit", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Min wait between sends (sec)" hint="Across all campaigns">
            <Input type="number" min={0} value={form.min_wait_seconds} onChange={(e) => set("min_wait_seconds", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Inbox placement tests / day">
            <Input type="number" min={0} value={form.daily_inbox_placement_test_limit} onChange={(e) => set("daily_inbox_placement_test_limit", Number(e.target.value))} className="h-8 text-xs" />
          </FieldRow>
        </div>
        <ToggleRow
          label="Slow ramp"
          desc="Gradually increase sending volume to protect deliverability"
          checked={form.slow_ramp_enabled}
          onChange={(v) => set("slow_ramp_enabled", v)}
        />
      </Section>

      <Section
        title="Custom Tracking Domain"
        right={
          <Badge variant="outline" className="text-[10px]">
            {mailbox.tracking_cname_verified && mailbox.tracking_ssl_verified ? (
              <span className="flex items-center gap-1 text-emerald-600"><ShieldCheck className="h-2.5 w-2.5" /> Verified</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-2.5 w-2.5" /> Pending verification</span>
            )}
          </Badge>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Root domain">
            <Input value={form.tracking_domain} onChange={(e) => set("tracking_domain", e.target.value)} placeholder="yourdomain.com" className="h-8 text-xs" />
          </FieldRow>
          <FieldRow label="Tracking subdomain">
            <Input value={form.tracking_subdomain} onChange={(e) => set("tracking_subdomain", e.target.value)} placeholder="track" className="h-8 text-xs" />
          </FieldRow>
        </div>

        <Card className="space-y-2 bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium">
            <Globe2 className="h-3 w-3" /> Add this CNAME at your DNS provider
          </p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <DnsField label="Type" value="CNAME" />
            <DnsField label="Host" value={cnameHost} copy />
            <DnsField label="Value" value={form.tracking_cname_target} copy />
          </div>
          <div className="flex gap-2 pt-1">
            <StatusPill ok={!!mailbox.tracking_cname_verified} label="CNAME" />
            <StatusPill ok={!!mailbox.tracking_ssl_verified} label="SSL" />
            {mailbox.tracking_last_checked_at && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                Last checked {new Date(mailbox.tracking_last_checked_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Verification runs automatically once real tracking infrastructure is activated.
          </p>
        </Card>
      </Section>

      <div className="sticky bottom-0 -mx-6 flex justify-end border-t bg-card/95 px-6 py-3 backdrop-blur">
        <Button size="sm" className="h-8 text-xs" onClick={save} disabled={updateMailbox.isPending}>
          {updateMailbox.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────── Campaigns Tab ─────────── */
function CampaignsTab({ mailbox }: { mailbox: any }) {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useMailboxCampaigns(mailbox.id);

  if (isLoading) return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  if (!campaigns || campaigns.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center border-dashed py-14">
        <Megaphone className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Not used in any campaign</p>
        <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
          Add this mailbox to a campaign from the campaign Options tab to start sending.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {campaigns.map((c: any) => (
        <Card key={c.id} className="flex items-center justify-between p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{c.name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] capitalize",
                  c.status === "active" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                  c.status === "paused" && "border-amber-500/30 bg-amber-500/10 text-amber-700",
                  c.status === "draft" && "border-muted-foreground/20 bg-muted text-muted-foreground",
                )}
              >
                {c.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Daily limit {c.daily_limit ?? "—"}
              </span>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
            onClick={() => navigate(`/engage/campaigns/${c.id}`)}
          >
            View <ExternalLink className="h-3 w-3" />
          </Button>
        </Card>
      ))}
    </div>
  );
}

/* ─────────── Helpers ─────────── */
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2.5">
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function DnsField({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1 rounded border bg-background px-2 py-1">
        <code className="flex-1 truncate text-[10px]">{value}</code>
        {copy && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
      ok ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700",
    )}>
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
      {label} {ok ? "verified" : "pending"}
    </span>
  );
}
