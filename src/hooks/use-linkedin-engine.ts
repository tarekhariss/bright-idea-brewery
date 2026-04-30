import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const rpc = (fn: string, args: any) => (supabase as any).rpc(fn, args);
const from = (t: string) => (supabase as any).from(t);

// ── Execution Adapters ──
export function useLinkedinExecutionAdapters() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_exec_adapters", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_execution_adapters")
        .select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useHasActiveLinkedinAdapter() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_has_adapter", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await rpc("linkedin_has_active_adapter", { _workspace_id: workspaceId });
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function useUpsertLinkedinAdapter() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { id?: string; provider: string; name: string; is_active?: boolean; config?: any; credentials_secret_name?: string }) => {
      if (vals.id) {
        const { error } = await from("linkedin_execution_adapters").update({
          provider: vals.provider, name: vals.name, is_active: vals.is_active ?? false,
          config: vals.config ?? {}, credentials_secret_name: vals.credentials_secret_name ?? null,
        }).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await from("linkedin_execution_adapters").insert({
          workspace_id: workspaceId, created_by: user?.id,
          provider: vals.provider, name: vals.name, is_active: vals.is_active ?? false,
          config: vals.config ?? {}, credentials_secret_name: vals.credentials_secret_name ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["li_exec_adapters"] });
      qc.invalidateQueries({ queryKey: ["li_has_adapter"] });
      toast.success("Execution adapter saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteLinkedinAdapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_execution_adapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["li_exec_adapters"] });
      qc.invalidateQueries({ queryKey: ["li_has_adapter"] });
      toast.success("Adapter removed");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Lead enrollment & transitions (RPC) ──
export function useEnrollLeadsInLinkedinCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaign_id, contact_ids }: { campaign_id: string; contact_ids: string[] }) => {
      if (!contact_ids.length) return { added: 0, skipped: 0 };
      const { data, error } = await rpc("linkedin_enroll_leads", { _campaign_id: campaign_id, _contact_ids: contact_ids });
      if (error) throw error;
      return data as { added: number; skipped: number };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads", vars.campaign_id] });
      qc.invalidateQueries({ queryKey: ["linkedin_action_queue_full"] });
      toast.success(`${res?.added ?? 0} added, ${res?.skipped ?? 0} skipped`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useTransitionLinkedinLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_id, action, reason }: { lead_id: string; action: "pause" | "resume" | "complete" | "remove"; reason?: string }) => {
      const { error } = await rpc("linkedin_transition_lead", { _lead_id: lead_id, _action: action, _reason: reason ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads"] });
      qc.invalidateQueries({ queryKey: ["linkedin_action_queue_full"] });
      toast.success("Lead updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useScheduleNextLinkedinAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead_id: string) => {
      const { data, error } = await rpc("linkedin_schedule_next_action", { _lead_id: lead_id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads"] });
      qc.invalidateQueries({ queryKey: ["linkedin_action_queue_full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Campaign stats view ──
export function useLinkedinCampaignStats(campaignId?: string | null) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_campaign_stats", workspaceId, campaignId ?? "all"],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = from("linkedin_campaign_stats_v").select("*").eq("workspace_id", workspaceId);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── LinkedIn-scoped contacts ──
export interface LinkedinContactsFilter {
  search?: string;
  connectionStatus?: string; // not_connected | pending | connected | declined | withdrawn
  inCampaign?: boolean;
  hasLinkedinUrl?: boolean;
}

export function useLinkedinContacts(filter: LinkedinContactsFilter = {}) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["li_contacts", workspaceId, filter],
    enabled: !!workspaceId,
    queryFn: async () => {
      // Pull contacts then left-join state in JS (RLS-friendly, paginated up to 200 for now)
      let q = from("contacts")
        .select("id, first_name, last_name, email, title, linkedin_url, company_id, companies(id, name), outreach_status, lifecycle_status")
        .eq("workspace_id", workspaceId)
        .limit(200)
        .order("updated_at", { ascending: false });
      if (filter.search) q = q.or(`first_name.ilike.%${filter.search}%,last_name.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
      if (filter.hasLinkedinUrl) q = q.not("linkedin_url", "is", null);
      const { data: contacts, error } = await q;
      if (error) throw error;
      const ids = (contacts || []).map((c: any) => c.id);
      if (!ids.length) return [];
      const { data: states } = await from("linkedin_contact_state")
        .select("*").eq("workspace_id", workspaceId).in("contact_id", ids);
      const map = new Map<string, any>((states || []).map((s: any) => [s.contact_id, s]));
      let merged = (contacts || []).map((c: any) => ({ ...c, li_state: map.get(c.id) || null }));
      if (filter.connectionStatus) merged = merged.filter((c: any) => (c.li_state?.connection_status || "not_connected") === filter.connectionStatus);
      return merged;
    },
  });
}
