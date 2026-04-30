import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const sb = supabase as any;

export type LinkedinNodeType =
  | "start" | "visit_profile" | "connect_request" | "wait_for_connection"
  | "message" | "inmail" | "like_post" | "comment_post" | "endorse_skills"
  | "withdraw_request" | "time_delay" | "manual_task" | "end";

export type LinkedinEdgeCondition =
  | "default" | "connected" | "not_connected" | "accepted" | "declined" | "timeout"
  | "replied" | "no_reply" | "opened" | "not_opened" | "success" | "failure";

export interface WfNode {
  id: string;
  campaign_id: string;
  workspace_id: string;
  node_type: LinkedinNodeType;
  label: string | null;
  delay_amount: number | null;
  delay_unit: "minutes" | "hours" | "days" | null;
  wait_timeout_days: number | null;
  withdraw_after_days: number | null;
  message_body: string | null;
  message_subject: string | null;
  connection_note: string | null;
  skip_note_if_too_long: boolean;
  send_always: boolean;
  task_title: string | null;
  task_description: string | null;
  position_x: number;
  position_y: number;
  config: any;
}

export interface WfEdge {
  id: string;
  campaign_id: string;
  from_node_id: string;
  to_node_id: string;
  condition: LinkedinEdgeCondition;
}

export interface WfVariant {
  id: string;
  node_id: string;
  campaign_id: string;
  label: string;
  body: string;
  subject: string | null;
  weight: number;
  sends_count: number;
  replies_count: number;
  accepted_count: number;
  positive_count: number;
  is_winner: boolean;
  is_active: boolean;
}

// ── Nodes & Edges ─────────────────────────────────────────────
export function useWorkflowNodes(campaignId: string | null) {
  return useQuery({
    queryKey: ["li_wf_nodes", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await sb.from("linkedin_workflow_nodes")
        .select("*").eq("campaign_id", campaignId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as WfNode[];
    },
  });
}

export function useWorkflowEdges(campaignId: string | null) {
  return useQuery({
    queryKey: ["li_wf_edges", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await sb.from("linkedin_workflow_edges")
        .select("*").eq("campaign_id", campaignId!);
      if (error) throw error;
      return (data ?? []) as WfEdge[];
    },
  });
}

export function useCreateNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: Partial<WfNode> & { campaign_id: string; node_type: LinkedinNodeType }) => {
      const { data, error } = await sb.from("linkedin_workflow_nodes")
        .insert(vals).select().single();
      if (error) throw error;
      return data as WfNode;
    },
    onSuccess: (n) => qc.invalidateQueries({ queryKey: ["li_wf_nodes", n.campaign_id] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id, ...vals }: Partial<WfNode> & { id: string; campaign_id: string }) => {
      const { error } = await sb.from("linkedin_workflow_nodes").update(vals).eq("id", id);
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => qc.invalidateQueries({ queryKey: ["li_wf_nodes", cid] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id }: { id: string; campaign_id: string }) => {
      const { error } = await sb.from("linkedin_workflow_nodes").delete().eq("id", id);
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => {
      qc.invalidateQueries({ queryKey: ["li_wf_nodes", cid] });
      qc.invalidateQueries({ queryKey: ["li_wf_edges", cid] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { campaign_id: string; from_node_id: string; to_node_id: string; condition?: LinkedinEdgeCondition }) => {
      // Replace any existing edge from same node + condition
      await sb.from("linkedin_workflow_edges").delete()
        .eq("from_node_id", vals.from_node_id).eq("condition", vals.condition ?? "default");
      const { data, error } = await sb.from("linkedin_workflow_edges").insert(vals).select().single();
      if (error) throw error;
      return data as WfEdge;
    },
    onSuccess: (e) => qc.invalidateQueries({ queryKey: ["li_wf_edges", e.campaign_id] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id }: { id: string; campaign_id: string }) => {
      const { error } = await sb.from("linkedin_workflow_edges").delete().eq("id", id);
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => qc.invalidateQueries({ queryKey: ["li_wf_edges", cid] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Variants ─────────────────────────────────────────────────
export function useNodeVariants(nodeId: string | null) {
  return useQuery({
    queryKey: ["li_wf_variants", nodeId],
    enabled: !!nodeId,
    queryFn: async () => {
      const { data, error } = await sb.from("linkedin_message_variants")
        .select("*").eq("node_id", nodeId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as WfVariant[];
    },
  });
}

export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { node_id: string; campaign_id: string; label: string; body: string; subject?: string }) => {
      const { data, error } = await sb.from("linkedin_message_variants").insert(vals).select().single();
      if (error) throw error;
      return data as WfVariant;
    },
    onSuccess: (v) => qc.invalidateQueries({ queryKey: ["li_wf_variants", v.node_id] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, node_id, ...vals }: Partial<WfVariant> & { id: string; node_id: string }) => {
      const { error } = await sb.from("linkedin_message_variants").update(vals).eq("id", id);
      if (error) throw error;
      return node_id;
    },
    onSuccess: (nid) => qc.invalidateQueries({ queryKey: ["li_wf_variants", nid] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, node_id }: { id: string; node_id: string }) => {
      const { error } = await sb.from("linkedin_message_variants").delete().eq("id", id);
      if (error) throw error;
      return node_id;
    },
    onSuccess: (nid) => qc.invalidateQueries({ queryKey: ["li_wf_variants", nid] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Senders (campaign sender profiles) ───────────────────────
export function useCampaignSenders(campaignId: string | null) {
  return useQuery({
    queryKey: ["li_camp_senders", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await sb.from("linkedin_campaign_senders")
        .select("*, linkedin_accounts(id, profile_name, profile_url, connection_status, is_active)")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useAddCampaignSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaign_id, linkedin_account_id }: { campaign_id: string; linkedin_account_id: string }) => {
      const { error } = await sb.from("linkedin_campaign_senders")
        .insert({ campaign_id, linkedin_account_id, is_active: true });
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ["li_camp_senders", cid] }); toast.success("Sender added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useToggleCampaignSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id, is_active }: { id: string; campaign_id: string; is_active: boolean }) => {
      const { error } = await sb.from("linkedin_campaign_senders").update({ is_active }).eq("id", id);
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => qc.invalidateQueries({ queryKey: ["li_camp_senders", cid] }),
  });
}

export function useRemoveCampaignSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaign_id }: { id: string; campaign_id: string }) => {
      const { error } = await sb.from("linkedin_campaign_senders").delete().eq("id", id);
      if (error) throw error;
      return campaign_id;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ["li_camp_senders", cid] }); toast.success("Sender removed"); },
  });
}

// ── Validation, Launch, Enrollment v2 ───────────────────────
export function useValidateWorkflow(campaignId: string | null) {
  return useQuery({
    queryKey: ["li_wf_validate", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("linkedin_workflow_validate", { _campaign_id: campaignId });
      if (error) throw error;
      return data as { valid: boolean; errors: string[] };
    },
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaign_id, mode }: { campaign_id: string; mode: "enroll_existing" | "restart_all" | "only_new" }) => {
      const { data, error } = await sb.rpc("linkedin_launch_campaign", { _campaign_id: campaign_id, _mode: mode });
      if (error) throw error;
      return data as { ok: boolean; reason?: string; errors?: string[]; enrolled?: number };
    },
    onSuccess: (res, vars) => {
      if (res.ok) toast.success(`Campaign launched (${res.enrolled ?? 0} leads enrolled)`);
      else toast.error(`Launch blocked: ${res.reason}${res.errors ? " — " + res.errors.join(", ") : ""}`);
      qc.invalidateQueries({ queryKey: ["linkedin_campaign", vars.campaign_id] });
      qc.invalidateQueries({ queryKey: ["linkedin_campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useEnrollLeadsV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaign_id, contact_ids, only_new }: { campaign_id: string; contact_ids: string[]; only_new?: boolean }) => {
      const { data, error } = await sb.rpc("linkedin_enroll_leads_v2", {
        _campaign_id: campaign_id, _contact_ids: contact_ids, _only_new: only_new ?? false,
      });
      if (error) throw error;
      return data as { added: number; skipped: number };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["linkedin_campaign_leads", vars.campaign_id] });
      toast.success(`${res.added} added · ${res.skipped} skipped`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}
