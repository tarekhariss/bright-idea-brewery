import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ── LinkedIn Accounts ──
export function useLinkedinAccounts() {
  return useQuery({
    queryKey: ["linkedin_accounts"],
    queryFn: async () => {
      const { data, error } = await from("linkedin_accounts")
        .select("*, linkedin_account_health(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateLinkedinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { profile_name: string; profile_url?: string; daily_connect_limit?: number; daily_message_limit?: number; workspace_id?: string }) => {
      const { data, error } = await from("linkedin_accounts").insert(vals).select().single();
      if (error) throw error;
      // Create health record
      await from("linkedin_account_health").insert({ account_id: data.id });
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_accounts"] }); toast.success("LinkedIn account added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLinkedinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("linkedin_accounts").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_accounts"] }); toast.success("Account updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteLinkedinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_accounts"] }); toast.success("Account removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── LinkedIn Message Templates ──
export function useLinkedinMessageTemplates() {
  return useQuery({
    queryKey: ["linkedin_message_templates"],
    queryFn: async () => {
      const { data, error } = await from("linkedin_message_templates").select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateLinkedinMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { name: string; message_body?: string; variables?: any; workspace_id?: string }) => {
      const { data, error } = await from("linkedin_message_templates").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_message_templates"] }); toast.success("Template created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLinkedinMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("linkedin_message_templates").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_message_templates"] }); toast.success("Template updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteLinkedinMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_message_templates"] }); toast.success("Template deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Campaign LinkedIn Accounts ──
export function useCampaignLinkedinAccounts(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_linkedin_accounts", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("campaign_linkedin_accounts")
        .select("*, linkedin_accounts(id, profile_name, profile_url, connection_status)")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLinkLinkedinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, linkedinAccountId }: { campaignId: string; linkedinAccountId: string }) => {
      const { error } = await from("campaign_linkedin_accounts").insert({ campaign_id: campaignId, linkedin_account_id: linkedinAccountId });
      if (error) throw error;
    },
    onSuccess: (_d: any, vars) => { qc.invalidateQueries({ queryKey: ["campaign_linkedin_accounts", vars.campaignId] }); toast.success("LinkedIn account linked"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUnlinkLinkedinAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, linkedinAccountId }: { campaignId: string; linkedinAccountId: string }) => {
      const { error } = await from("campaign_linkedin_accounts").delete().eq("campaign_id", campaignId).eq("linkedin_account_id", linkedinAccountId);
      if (error) throw error;
    },
    onSuccess: (_d: any, vars) => { qc.invalidateQueries({ queryKey: ["campaign_linkedin_accounts", vars.campaignId] }); toast.success("Account unlinked"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── LinkedIn Safety Rules ──
export function useLinkedinSafetyRules() {
  return useQuery({
    queryKey: ["linkedin_safety_rules"],
    queryFn: async () => {
      const { data, error } = await from("linkedin_safety_rules").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpsertLinkedinSafetyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { max_connects_per_day: number; max_messages_per_day: number; min_delay_minutes: number; max_delay_minutes: number }) => {
      const { data: existing } = await from("linkedin_safety_rules").select("id").limit(1).maybeSingle();
      if (existing) {
        const { error } = await from("linkedin_safety_rules").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await from("linkedin_safety_rules").insert(vals);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_safety_rules"] }); toast.success("Safety rules saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── LinkedIn Action Queue (read-only for now) ──
export function useLinkedinActionQueue(accountId?: string) {
  return useQuery({
    queryKey: ["linkedin_action_queue", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_action_queue")
        .select("*, contacts(id, first_name, last_name, email, linkedin_url)")
        .eq("linkedin_account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
}
