import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/db-types";

type Tables = Database["public"]["Tables"];
type Campaign = Tables["campaigns"]["Row"];
type CampaignInsert = Tables["campaigns"]["Insert"];
type CampaignUpdate = Tables["campaigns"]["Update"];
type CampaignContact = Tables["campaign_contacts"]["Row"];
type CampaignStats = Tables["campaign_stats"]["Row"];

const from = (table: string) => (supabase as any).from(table);

export function useCampaigns() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["campaigns", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("campaigns")
        .select("*, campaign_stats(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Campaign & { campaign_stats: CampaignStats[] })[];
    },
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: ["campaigns", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await from("campaigns")
        .select("*, campaign_stats(*), campaign_mailboxes(mailbox_id)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Campaign & { campaign_stats: CampaignStats[]; campaign_mailboxes: { mailbox_id: string }[] };
    },
  });
}

export function useCampaignContacts(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_contacts", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("campaign_contacts")
        .select("*, contacts(id, first_name, last_name, email, company_name_raw)")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const { user, workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: Omit<CampaignInsert, "owner_id" | "created_by" | "workspace_id">) => {
      const { data, error } = await from("campaigns")
        .insert({ ...vals, owner_id: user?.id, created_by: user?.id, workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campaign created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string } & CampaignUpdate) => {
      const { data, error } = await from("campaigns")
        .update({ ...vals, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaigns", d.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campaign deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}
