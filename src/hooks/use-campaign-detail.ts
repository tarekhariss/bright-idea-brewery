import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ── Leads enrolled in a campaign (rich view: contact, company, status, mailbox) ──
export function useCampaignLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("campaign_enrollments")
        .select(`
          id,
          status,
          scheduled_start,
          last_step_executed_at,
          created_at,
          current_step_id,
          contacts (
            id, first_name, last_name, email, company_name_raw, company_id,
            companies ( id, name )
          ),
          campaign_steps:current_step_id ( id, step_order, step_type )
        `)
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── Campaign ↔ Mailbox links ──
export function useLinkCampaignMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, mailboxId }: { campaignId: string; mailboxId: string }) => {
      const { error } = await from("campaign_mailboxes").insert({
        campaign_id: campaignId,
        mailbox_id: mailboxId,
      });
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => {
      qc.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      toast.success("Mailbox linked");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUnlinkCampaignMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, mailboxId }: { campaignId: string; mailboxId: string }) => {
      const { error } = await from("campaign_mailboxes")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("mailbox_id", mailboxId);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => {
      qc.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      toast.success("Mailbox unlinked");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Workspace sending windows (for Schedule tab) ──
export function useWorkspaceSendingWindows() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["sending_windows_picker", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("sending_windows")
        .select("id, name, start_hour, end_hour, timezone, weekdays_only, is_active")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
