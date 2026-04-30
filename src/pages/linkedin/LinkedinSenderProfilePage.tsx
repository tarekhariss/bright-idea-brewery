import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Linkedin, Mail, Zap, Settings as SettingsIcon, Loader2, Save,
  ShieldAlert, Activity, UserPlus, MessageSquare, Eye, ThumbsUp, Award, MessageCircle, Send, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSenderProfile, useUpdateSenderProfile } from "@/hooks/use-linkedin-platform";

const ACTION_FIELDS: Array<{ key: string; label: string; icon: any; }> = [
  { key: "daily_connect_limit", label: "Send Connection Request", icon: UserPlus },
  { key: "daily_message_limit", label: "Send Message", icon: MessageSquare },
  { key: "daily_inmail_limit", label: "Send InMail", icon: Send },
  { key: "daily_view_limit", label: "Visit Profile", icon: Eye },
  { key: "daily_like_limit", label: "Like Latest Post", icon: ThumbsUp },
  { key: "daily_endorse_limit", label: "Endorse Skills", icon: Award },
  { key: "daily_comment_limit", label: "Comment Latest Post", icon: MessageCircle },
  { key: "daily_withdraw_limit", label: "Withdraw Connection Request", icon: Undo2 },
];

export default function LinkedinSenderProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useSenderProfile(id ?? null);
  const update = useUpdateSenderProfile();

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const health = profile?.linkedin_account_health?.[0];
  const healthScore = form.health_score ?? 100;

  const usagePct = useMemo(() => ({
    connects: health ? Math.round(((health.connects_sent_today ?? 0) / Math.max(form.daily_connect_limit || 1, 1)) * 100) : 0,
    messages: health ? Math.round(((health.messages_sent_today ?? 0) / Math.max(form.daily_message_limit || 1, 1)) * 100) : 0,
  }), [health, form]);

  const save = () => {
    if (!profile?.id) return;
    update.mutate({ id: profile.id, ...form });
  };

  if (isLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!profile) {
    return <div className="p-10 text-sm text-muted-foreground">Sender profile not found.</div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/linkedin/accounts")} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Accounts</Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Linkedin className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{profile.profile_name}</h1>
            <p className="text-xs text-muted-foreground">{profile.profile_url || "No profile URL set"}</p>
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={update.isPending} className="gap-1.5">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </Button>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>LinkedIn execution is <b>pending activation</b>. Settings persist and will be enforced once a LinkedIn provider is connected.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Health Score</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-semibold ${healthScore >= 80 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-600" : "text-destructive"}`}>{healthScore}</p>
            <Progress value={healthScore} className="flex-1 h-1.5" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Warmup Level</p>
          <p className="text-2xl font-semibold mt-1">{form.warmup_level ?? 1}/5</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connects Today</p>
          <p className="text-2xl font-semibold mt-1">{health?.connects_sent_today ?? 0} <span className="text-xs text-muted-foreground">/ {form.daily_connect_limit ?? 0}</span></p>
          <Progress value={usagePct.connects} className="mt-1.5 h-1" />
          <p className="text-[10px] text-muted-foreground mt-1">Market median: {form.market_median_connects ?? 25}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Messages Today</p>
          <p className="text-2xl font-semibold mt-1">{health?.messages_sent_today ?? 0} <span className="text-xs text-muted-foreground">/ {form.daily_message_limit ?? 0}</span></p>
          <Progress value={usagePct.messages} className="mt-1.5 h-1" />
          <p className="text-[10px] text-muted-foreground mt-1">Market median: {form.market_median_messages ?? 60}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="linkedin">
        <TabsList>
          <TabsTrigger value="linkedin" className="text-xs gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
          <TabsTrigger value="autotasks" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Auto Tasks</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5"><SettingsIcon className="h-3.5 w-3.5" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="linkedin" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Schedule & Proxy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Sending Window Start</Label>
                  <Input type="time" value={form.sending_window_start ?? "09:00"} onChange={(e) => setForm({ ...form, sending_window_start: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Sending Window End</Label>
                  <Input type="time" value={form.sending_window_end ?? "17:00"} onChange={(e) => setForm({ ...form, sending_window_end: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Timezone</Label>
                  <Input value={form.timezone ?? "UTC"} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Active Days</Label>
                <div className="mt-2 flex gap-2">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => {
                    const day = i + 1;
                    const active = (form.schedule_days_of_week ?? []).includes(day);
                    return (
                      <button key={d} type="button" onClick={() => {
                        const current: number[] = form.schedule_days_of_week ?? [];
                        const next = active ? current.filter(x => x !== day) : [...current, day].sort();
                        setForm({ ...form, schedule_days_of_week: next });
                      }} className={`h-8 w-10 text-xs rounded border ${active ? "bg-sky-500 text-white border-sky-500" : "bg-background text-muted-foreground hover:bg-accent"}`}>{d}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs">Proxy Label</Label>
                <Input value={form.proxy_label ?? ""} onChange={(e) => setForm({ ...form, proxy_label: e.target.value })} placeholder="e.g. residential-eu-1 (placeholder until provider activated)" className="mt-1 h-9 text-sm" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Email sender configuration is managed in <b>Engage → Email Accounts</b>. This tab will be linked to the matching mailbox once provider connections are wired.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="autotasks" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Smart Limits
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <Switch checked={!!form.smart_limits_enabled} onCheckedChange={(v) => setForm({ ...form, smart_limits_enabled: v })} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">When enabled, daily limits auto-adjust based on warmup level and account health to stay within LinkedIn's safe thresholds.</p>
              <Separator />
              {ACTION_FIELDS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-3">
                  <div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</div>
                  <Input type="number" value={form[key] ?? 0} onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })} className="h-8 text-sm text-right" />
                </div>
              ))}
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Min Delay Between Actions (sec)</Label>
                  <Input type="number" value={form.min_action_delay_seconds ?? 45} onChange={(e) => setForm({ ...form, min_action_delay_seconds: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Max Delay Between Actions (sec)</Label>
                  <Input type="number" value={form.max_action_delay_seconds ?? 180} onChange={(e) => setForm({ ...form, max_action_delay_seconds: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Account Settings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Profile Name</Label>
                  <Input value={form.profile_name ?? ""} onChange={(e) => setForm({ ...form, profile_name: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Profile URL</Label>
                  <Input value={form.profile_url ?? ""} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Warmup Level (1-5)</Label>
                  <Input type="number" min={1} max={5} value={form.warmup_level ?? 1} onChange={(e) => setForm({ ...form, warmup_level: parseInt(e.target.value) || 1 })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Health Score (0-100)</Label>
                  <Input type="number" min={0} max={100} value={form.health_score ?? 100} onChange={(e) => setForm({ ...form, health_score: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Market Median Connects/Day</Label>
                  <Input type="number" value={form.market_median_connects ?? 25} onChange={(e) => setForm({ ...form, market_median_connects: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Market Median Messages/Day</Label>
                  <Input type="number" value={form.market_median_messages ?? 60} onChange={(e) => setForm({ ...form, market_median_messages: parseInt(e.target.value) || 0 })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Account Active</p>
                  <p className="text-xs text-muted-foreground">When off, this account is excluded from queue execution.</p>
                </div>
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-[80px] text-sm" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
