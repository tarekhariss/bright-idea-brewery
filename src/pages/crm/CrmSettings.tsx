import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ComingSoonBanner } from "@/components/config";

interface CrmSettings {
  workspace_id: string;
  default_pipeline_id: string | null;
  default_stale_days: number;
  auto_create_deal_on_proposal: boolean;
  hide_closed_in_active_views: boolean;
  auto_detect_positive_replies: boolean;
  positive_reply_confidence_threshold: number;
  default_owner_strategy: string;
}

export default function CrmSettingsPage() {
  const { workspaceId, canManage } = useAuth();
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      // Ensure pipeline + settings row exist
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
      default_owner_strategy: settings.default_owner_strategy,
    }).eq("workspace_id", workspaceId);
    setSaving(false);
    if (error) { toast.error(`Failed to save: ${error.message}`); return; }
    toast.success("CRM settings updated");
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!settings) return <div className="p-6 text-sm text-muted-foreground">No settings available.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">CRM Settings</h1>
          <p className="text-sm text-muted-foreground">Default behaviour for opportunities in this workspace.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Stale threshold (days)">
            <Input
              type="number"
              min={1}
              value={settings.default_stale_days}
              onChange={(e) => setSettings({ ...settings, default_stale_days: Number(e.target.value) || 14 })}
              className="w-32"
              disabled={!canManage}
            />
          </Field>
          <Toggle
            label="Hide closed opportunities in active views"
            description="Won / Lost / Not Fit / Bad Timing are hidden unless you toggle 'Include closed'."
            checked={settings.hide_closed_in_active_views}
            onChange={(v) => setSettings({ ...settings, hide_closed_in_active_views: v })}
            disabled={!canManage}
          />
          <Toggle
            label="Auto-create a deal when status reaches Proposal / RFQ"
            description="If off (recommended), creating a deal stays an explicit choice in the Push to CRM modal."
            checked={settings.auto_create_deal_on_proposal}
            onChange={(v) => setSettings({ ...settings, auto_create_deal_on_proposal: v })}
            disabled={!canManage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI &amp; Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ComingSoonBanner
            title="Auto positive-reply detection — Coming soon"
            description="Phase 2 will classify inbound email + LinkedIn replies and push high-confidence positives into the CRM. Toggle below is saved but not active yet."
          />
          <Toggle
            label="Auto-detect positive replies (Phase 2)"
            description="Opt-in. Will require a confidence threshold before any opportunity is created automatically."
            checked={settings.auto_detect_positive_replies}
            onChange={(v) => setSettings({ ...settings, auto_detect_positive_replies: v })}
            disabled={!canManage}
          />
          <Field label="Confidence threshold (0.5 – 1.0)">
            <Input
              type="number" step={0.05} min={0.5} max={1}
              value={settings.positive_reply_confidence_threshold}
              onChange={(e) => setSettings({ ...settings, positive_reply_confidence_threshold: Number(e.target.value) || 0.8 })}
              className="w-32"
              disabled={!canManage}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !canManage}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border rounded-md p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
