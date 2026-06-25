import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ============ Sender Profile (extended linkedin_accounts) ============
export function useSenderProfile(accountId: string | null) {
  return useQuery({
    queryKey: ["sender_profile", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_accounts")
        .select("*, linkedin_account_health(*)")
        .eq("id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpdateSenderProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_accounts")
        .update({ ...vals, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sender_profile", vars.id] });
      qc.invalidateQueries({ queryKey: ["linkedin_accounts"] });
      toast.success("Sender profile saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ Action Queue ============
export interface ActionQueueFilter {
  accountId?: string;
  campaignId?: string;
  actionType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export function useLinkedinActionQueue(filter: ActionQueueFilter = {}) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["linkedin_action_queue_full", workspaceId, filter],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = from("linkedin_action_queue")
        .select("*, linkedin_accounts(id, profile_name), contacts(id, first_name, last_name, linkedin_url), linkedin_campaigns(id, name)")
        .eq("workspace_id", workspaceId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(500);
      if (filter.accountId) q = q.eq("linkedin_account_id", filter.accountId);
      if (filter.campaignId) q = q.eq("campaign_id", filter.campaignId);
      if (filter.actionType) q = q.eq("action_type", filter.actionType);
      if (filter.status) q = q.eq("status", filter.status);
      if (filter.fromDate) q = q.gte("scheduled_at", filter.fromDate);
      if (filter.toDate) q = q.lte("scheduled_at", filter.toDate);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdateQueueAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_action_queue")
        .update({ ...vals, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linkedin_action_queue_full"] });
      toast.success("Queue updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteQueueAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_action_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linkedin_action_queue_full"] });
      toast.success("Action removed");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ LinkedIn Contact State ============
export function useLinkedinContactState(contactId: string | null) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_contact_state", workspaceId, contactId],
    enabled: !!workspaceId && !!contactId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_contact_state")
        .select("*").eq("workspace_id", workspaceId).eq("contact_id", contactId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpsertLinkedinContactState() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async ({ contact_id, ...vals }: { contact_id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_contact_state").upsert(
        { workspace_id: workspaceId, contact_id, ...vals, updated_at: new Date().toISOString() },
        { onConflict: "workspace_id,contact_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_contact_state"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ Webhooks ============
export function useLinkedinWebhooks() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_webhooks", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_webhooks")
        .select("id, workspace_id, name, url, events, is_active, created_by, created_at, updated_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
export function useCreateLinkedinWebhook() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; url: string; events?: string[]; secret?: string }) => {
      const { error } = await from("linkedin_webhooks").insert({ ...vals, workspace_id: workspaceId, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_webhooks"] }); toast.success("Webhook created"); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useUpdateLinkedinWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_webhooks").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_webhooks"] }); toast.success("Webhook updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useDeleteLinkedinWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_webhooks"] }); toast.success("Webhook removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ API Keys ============
export function useLinkedinApiKeys() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_api_keys", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_api_keys")
        .select("id, name, key_prefix, scopes, last_used_at, is_active, created_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
function genKey() {
  // crypto-strong base64url random
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "li_" + btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, "").slice(0, 40);
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function useCreateLinkedinApiKey() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; scopes?: string[] }) => {
      const fullKey = genKey();
      const hash = await sha256(fullKey);
      const { error } = await from("linkedin_api_keys").insert({
        workspace_id: workspaceId, created_by: user?.id,
        name: vals.name, scopes: vals.scopes ?? ["read"],
        key_prefix: fullKey.slice(0, 7),
        key_hash: hash,
      });
      if (error) throw error;
      return fullKey;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_api_keys"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useDeleteLinkedinApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_api_keys"] }); toast.success("API key revoked"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ Stoplist ============
export function useLinkedinStoplist() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_stoplist", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_stoplist")
        .select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
export function useAddStoplistEntry() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { match_type: string; match_value: string; reason?: string }) => {
      const { error } = await from("linkedin_stoplist").insert({ ...vals, workspace_id: workspaceId, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_stoplist"] }); toast.success("Added to stoplist"); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useDeleteStoplistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_stoplist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_stoplist"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ Filter Presets ============
export function useLinkedinFilterPresets() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_filter_presets", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_filter_presets")
        .select("*").eq("workspace_id", workspaceId).order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}
export function useSaveFilterPreset() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { id?: string; name: string; filters: any }) => {
      if (vals.id) {
        const { error } = await from("linkedin_filter_presets").update({ name: vals.name, filters: vals.filters, updated_at: new Date().toISOString() }).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await from("linkedin_filter_presets").insert({ workspace_id: workspaceId, created_by: user?.id, name: vals.name, filters: vals.filters });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_filter_presets"] }); toast.success("Filter preset saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useDeleteFilterPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_filter_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_filter_presets"] }); toast.success("Preset deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ============ LLM Integrations ============
export function useLinkedinLlmIntegrations() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_llm", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_llm_integrations")
        .select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
export function useUpsertLinkedinLlm() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: { id?: string; provider: string; model: string; is_default?: boolean; config?: any }) => {
      if (vals.id) {
        const { error } = await from("linkedin_llm_integrations").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await from("linkedin_llm_integrations").insert({ ...vals, workspace_id: workspaceId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_llm"] }); toast.success("LLM integration saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}
export function useDeleteLinkedinLlm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_llm_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["li_llm"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}
