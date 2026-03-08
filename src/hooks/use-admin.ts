import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlatformKpis() {
  return useQuery({
    queryKey: ["admin", "platform-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_platform_kpis")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkspaceSummaries() {
  return useQuery({
    queryKey: ["admin", "workspace-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workspace_summaries")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkspaceSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "workspace-summary", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workspace_summaries")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminMailboxSummaries() {
  return useQuery({
    queryKey: ["admin", "mailbox-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_mailbox_summaries")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminCampaignSummaries() {
  return useQuery({
    queryKey: ["admin", "campaign-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_campaign_summaries")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminLinkedinSummaries() {
  return useQuery({
    queryKey: ["admin", "linkedin-summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_linkedin_summaries")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminActivityFeed() {
  return useQuery({
    queryKey: ["admin", "activity-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_activity_feed")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
