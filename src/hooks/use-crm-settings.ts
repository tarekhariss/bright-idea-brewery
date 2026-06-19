/**
 * use-crm-settings — reads the workspace's crm_settings row.
 * Falls back to sensible defaults when no row exists yet.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CrmSettings {
  default_stale_days: number;
  auto_create_deal_on_proposal: boolean;
  hide_closed_in_active_views: boolean;
  auto_detect_positive_replies: boolean;
  default_owner_strategy: string;
}

const DEFAULTS: CrmSettings = {
  default_stale_days: 14,
  auto_create_deal_on_proposal: false,
  hide_closed_in_active_views: true,
  auto_detect_positive_replies: false,
  default_owner_strategy: "smart_fallback",
};

export function useCrmSettings() {
  const { workspaceId } = useAuth();
  const [settings, setSettings] = useState<CrmSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("crm_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
      if (data) setSettings({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
  }, [workspaceId]);

  return { ...settings, staleDays: settings.default_stale_days, loading };
}
