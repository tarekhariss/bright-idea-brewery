import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ── Campaigns ──
export function useLinkedinCampaigns() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["linkedin_campaigns", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_campaigns")
        .select("*, linkedin_accounts(id, profile_name)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLinkedinCampaign(id: string | null) {
  return useQuery({
    queryKey: ["linkedin_campaign", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await from("linkedin_campaigns")
        .select("*, linkedin_accounts(id, profile_name, profile_url)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCreateLinkedinCampaign() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vals: { name: string; description?: string; linkedin_account_id?: string | null }) => {
      const { data, error } = await from("linkedin_campaigns")
        .insert({ ...vals, workspace_id: workspaceId, created_by: user?.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_campaigns"] }); toast.success("Campaign created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLinkedinCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_campaigns").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["linkedin_campaigns"] });
      qc.invalidateQueries({ queryKey: ["linkedin_campaign", vars.id] });
      toast.success("Campaign updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteLinkedinCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("linkedin_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_campaigns"] }); toast.success("Campaign deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Steps ──
export function useLinkedinCampaignSteps(campaignId: string | null) {
  return useQuery({
    queryKey: ["linkedin_campaign_steps", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_campaign_steps")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("step_order");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateLinkedinStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { campaign_id: string; step_order: number; step_type: string; delay_days?: number; delay_hours?: number; message_body?: string; task_title?: string; task_description?: string }) => {
      const { error } = await from("linkedin_campaign_steps").insert(vals);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_steps", vars.campaign_id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLinkedinStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id, ...vals }: { id: string; campaign_id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_campaign_steps").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_steps", vars.campaign_id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteLinkedinStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id }: { id: string; campaign_id: string }) => {
      const { error } = await from("linkedin_campaign_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_steps", vars.campaign_id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Leads ──
export function useLinkedinCampaignLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ["linkedin_campaign_leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_campaign_leads")
        .select("*, contacts(id, first_name, last_name, email, linkedin_url, title, companies(name))")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAddLinkedinLeads() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ campaign_id, contact_ids }: { campaign_id: string; contact_ids: string[] }) => {
      if (!contact_ids.length) return;
      const rows = contact_ids.map((cid) => ({
        campaign_id, contact_id: cid, workspace_id: workspaceId, added_by: user?.id,
      }));
      const { error } = await from("linkedin_campaign_leads").upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads", vars.campaign_id] }); toast.success("Leads added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLinkedinLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id, ...vals }: { id: string; campaign_id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_campaign_leads").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads", vars.campaign_id] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRemoveLinkedinLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id }: { id: string; campaign_id: string }) => {
      const { error } = await from("linkedin_campaign_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads", vars.campaign_id] }); toast.success("Lead removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Inbox ──
export function useLinkedinInboxThreads(filter?: { category?: string; campaignId?: string | null }) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["linkedin_inbox_threads", workspaceId, filter?.category, filter?.campaignId],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = from("linkedin_inbox_threads")
        .select("*, contacts(id, first_name, last_name, email), linkedin_campaigns(id, name)")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (filter?.category) q = q.eq("category", filter.category);
      if (filter?.campaignId) q = q.eq("campaign_id", filter.campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLinkedinInboxMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["linkedin_inbox_messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await from("linkedin_inbox_messages")
        .select("*").eq("thread_id", threadId!).order("sent_at");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdateLinkedinThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_inbox_threads").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_inbox_threads"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Tasks ──
export function useLinkedinTasks(filter?: { status?: string }) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["linkedin_tasks", workspaceId, filter?.status],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = from("linkedin_tasks")
        .select("*, contacts(id, first_name, last_name, email), linkedin_campaigns(id, name)")
        .eq("workspace_id", workspaceId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200);
      if (filter?.status) q = q.eq("status", filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdateLinkedinTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [k: string]: any }) => {
      const { error } = await from("linkedin_tasks").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin_tasks"] }); toast.success("Task updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}
