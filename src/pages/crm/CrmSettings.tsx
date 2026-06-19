import { useEffect, useState } from "react";
import { Settings as SettingsIcon, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CrmSettings {
  workspace_id: string;
  default_pipeline_id: string | null;
  default_stale_days: number;
  auto_create_deal_on_proposal: boolean;
  hide_closed_in_active_views: boolean;
  auto_detect_positive_replies: boolean;
  positive_reply_confidence_threshold: number;
  positive_reply_review_mode: boolean;
  auto_push_high_confidence: boolean;
  default_owner_strategy: string;
  stale_sweeper_enabled: boolean;
  last_stale_sweep_at: string | null;
  last_reply_detection_at: string | null;
  automation_rules: Record<string, { enabled: boolean; days?: number }>;
}

export default function CrmSettingsPage() {
  const { workspaceId, canManage } = useAuth();
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      await (supabase as any).rpc("ensure_crm_pipeline", { _workspace_id: workspaceId });
      const { data } = await (supabase as any).from("crm_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
      setSettings(data as CrmSettings);
      setLoading(false);
    })();
  }, [workspaceId]);

  async function save() {
    if (!workspaceId || !settings) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_settings").update({
      default_stale_days: settings.default_stale_days,
      auto_create_deal_on_proposal: settings.auto_create_deal_on_proposal,
      hide_closed_in_active_views: settings.hide_closed_in_active_views,
      auto_detect_positive_replies: settings.auto_detect_positive_replies,
      positive_reply_confidence_threshold: settings.positive_reply_confidence_threshold,
      positive_reply_review_mode: settings.positive_reply_review_mode,
      auto_push_high_confidence: settings.auto_push_high_confidence,
      default_owner_strategy: settings.default_owner_strategy,
      stale_sweeper_enabled: settings.stale_sweeper_enabled,
      automation_rules: settings.automation_rules,
    }).eq("workspace_id", workspaceId);
    setSaving(false);
    if (error) { toast.error(`Failed to save: ${error.message}`); return; }
    toast.success("CRM settings updated");
  }

  async function runSweeper() {
    if (!workspaceId) return;
    setSweeping(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-stale-sweeper", { body: { workspace_id: workspaceId } });
      if (error) throw error;
      const r = data as any;
      toast.success(`Sweep done · ${r.newly_stale ?? 0} flagged · ${r.cleared ?? 0} cleared`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSweeping(false); }
  }

  function setRule(key: string, patch: any) {
    if (!settings) return;
    setSettings({ ...settings, automation_rules: { ...settings.automation_rules, [key]: { ...settings.automation_rules[key], ...patch } } });
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!settings) return <div className="p-6 text-sm text-muted-foreground">No settings available.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><SettingsIcon className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">CRM Settings</h1>
          <p className="text-sm text-muted-foreground">Default behaviour and automations for opportunities in this workspace.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Stale threshold (days)">
            <Input type="number" min={1} className="w-32" disabled={!canManage}
              value={settings.default_stale_days}
              onChange={(e) => setSettings({ ...settings, default_stale_days: Number(e.target.value) || 14 })} />
          </Field>
          <Toggle label="Hide closed opportunities in active views"
            description="Won / Lost / Not Fit / Bad Timing are hidden unless you toggle 'Include closed'."
            checked={settings.hide_closed_in_active_views} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, hide_closed_in_active_views: v })} />
          <Toggle label="Auto-create a deal when status reaches Proposal / RFQ"
            description="If off (recommended), creating a deal stays an explicit choice in the Push to CRM modal."
            checked={settings.auto_create_deal_on_proposal} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, auto_create_deal_on_proposal: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Auto positive-reply detection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Enable auto-detection"
            description="Opt-in. Scans inbound email + LinkedIn replies and classifies intent. Disabled by default."
            checked={settings.auto_detect_positive_replies} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, auto_detect_positive_replies: v })} />
          <Field label="Confidence threshold (0.5 – 1.0)">
            <Input type="number" step={0.05} min={0.5} max={1} className="w-32" disabled={!canManage}
              value={settings.positive_reply_confidence_threshold}
              onChange={(e) => setSettings({ ...settings, positive_reply_confidence_threshold: Number(e.target.value) || 0.8 })} />
          </Field>
          <Toggle label="Review mode (recommended)"
            description="Detected positives go to the Review Queue. Disable to allow auto-push of high-confidence positives."
            checked={settings.positive_reply_review_mode} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, positive_reply_review_mode: v })} />
          <Toggle label="Auto-push high-confidence positives"
            description="Only takes effect when Review mode is OFF and confidence ≥ threshold."
            checked={settings.auto_push_high_confidence} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, auto_push_high_confidence: v })} />
          {settings.last_reply_detection_at && (
            <div className="text-xs text-muted-foreground">Last detection run: {new Date(settings.last_reply_detection_at).toLocaleString()}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stale sweeper</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Enable scheduled stale sweeper"
            description="Flags open opportunities with no activity past the stale threshold. Never auto-closes anything."
            checked={settings.stale_sweeper_enabled} disabled={!canManage}
            onChange={(v) => setSettings({ ...settings, stale_sweeper_enabled: v })} />
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={runSweeper} disabled={sweeping}>
              <PlayCircle className="h-4 w-4 mr-2" />{sweeping ? "Sweeping…" : "Run sweep now"}
            </Button>
            {settings.last_stale_sweep_at && <span className="text-xs text-muted-foreground">Last sweep: {new Date(settings.last_stale_sweep_at).toLocaleString()}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Automation rules</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <RuleToggle name="Create follow-up task when opportunity is created"
            rule={settings.automation_rules.create_followup_task_on_opp}
            onChange={(p) => setRule("create_followup_task_on_opp", p)} disabled={!canManage} showDays />
          <RuleToggle name="Owner fallback (contact → company → campaign → current user)"
            rule={settings.automation_rules.assign_owner_fallback}
            onChange={(p) => setRule("assign_owner_fallback", p)} disabled={!canManage} />
          <RuleToggle name="Move to Meeting Booked when a meeting is linked"
            rule={settings.automation_rules.move_to_meeting_booked_on_meeting}
            onChange={(p) => setRule("move_to_meeting_booked_on_meeting", p)} disabled={!canManage} />
          <RuleToggle name="Flag stale after X days (uses stale threshold above)"
            rule={settings.automation_rules.flag_stale_after_days}
            onChange={(p) => setRule("flag_stale_after_days", p)} disabled={!canManage} />
          <RuleToggle name="Auto-push high-confidence positive replies"
            rule={settings.automation_rules.auto_push_high_confidence_replies}
            onChange={(p) => setRule("auto_push_high_confidence_replies", p)} disabled={!canManage} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !canManage}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border rounded-md p-3">
      <div><div className="text-sm font-medium">{label}</div>{description && <div className="text-xs text-muted-foreground">{description}</div>}</div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function RuleToggle({ name, rule, onChange, disabled, showDays }: { name: string; rule?: { enabled: boolean; days?: number }; onChange: (p: any) => void; disabled?: boolean; showDays?: boolean }) {
  const r = rule ?? { enabled: false };
  return (
    <div className="flex items-center justify-between gap-3 border rounded-md p-3">
      <div className="text-sm">{name}</div>
      <div className="flex items-center gap-2">
        {showDays && (
          <Input type="number" min={1} className="w-20 h-8"
            value={r.days ?? 2} disabled={disabled || !r.enabled}
            onChange={(e) => onChange({ days: Number(e.target.value) || 2 })} />
        )}
        <Switch checked={r.enabled} onCheckedChange={(v) => onChange({ enabled: v })} disabled={disabled} />
      </div>
    </div>
  );
}
