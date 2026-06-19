/**
 * use-opportunities — Phase 1 CRM data layer.
 *
 * Lists opportunities in the current workspace, exposes Kanban + table shape,
 * and wraps the SECURITY DEFINER RPCs:
 *   - push_to_crm
 *   - transition_opportunity
 *   - assign_opportunity
 *
 * Workspace scope is always taken from useAuth().workspaceId.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type OpportunityStatus =
  | "interested" | "qualified" | "meeting_requested" | "meeting_booked"
  | "proposal_rfq" | "won" | "lost" | "not_fit" | "bad_timing";

export type OpportunityPriority = "low" | "normal" | "high" | "urgent";

export type OpportunitySourceChannel =
  | "email_reply" | "linkedin_reply" | "meeting_booked" | "manual_push"
  | "rfq" | "prospect_search" | "list" | "import" | "api";

export const TERMINAL_STATUSES: OpportunityStatus[] = ["won", "lost", "not_fit", "bad_timing"];

export interface OpportunityStage {
  id: string;
  pipeline_id: string;
  stage_name: string;
  stage_key: string;
  display_order: number;
  color: string | null;
  is_closed: boolean;
  is_won: boolean;
}

export interface Opportunity {
  id: string;
  workspace_id: string;
  owner_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  status: OpportunityStatus;
  priority: OpportunityPriority;
  source_channel: OpportunitySourceChannel;
  source_campaign_type: string | null;
  source_campaign_id: string | null;
  source_thread_type: string | null;
  source_thread_id: string | null;
  source_message_id: string | null;
  title: string | null;
  intent_signal: string | null;
  next_action_at: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  company?: { id: string; name: string | null } | null;
  owner?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface PushToCrmPayload {
  contact_id?: string | null;
  company_id?: string | null;
  source_channel?: OpportunitySourceChannel;
  source_thread_id?: string | null;
  source_thread_type?: "email" | "linkedin" | null;
  source_campaign_id?: string | null;
  source_campaign_type?: "email" | "linkedin" | null;
  source_message_id?: string | null;
  status?: OpportunityStatus;
  priority?: OpportunityPriority;
  owner_id?: string | null;
  stage_id?: string | null;
  pipeline_id?: string | null;
  title?: string | null;
  note?: string | null;
  next_task?: { title: string; due_at?: string | null } | null;
  deal?: { create: boolean; value?: number | null; name?: string | null } | null;
  force_create_new?: boolean;
}

export interface PushToCrmResult {
  opportunity_id: string;
  created: boolean;
  deal_id: string | null;
}

export function useOpportunities(opts?: { includeClosed?: boolean }) {
  const { workspaceId } = useAuth();
  const includeClosed = !!opts?.includeClosed;
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Ensure default CRM pipeline exists, then read stages.
      const { data: pid } = await (supabase as any).rpc("ensure_crm_pipeline", { _workspace_id: workspaceId });
      setPipelineId(pid ?? null);
      if (pid) {
        const { data: stageRows } = await (supabase as any)
          .from("pipeline_stages")
          .select("id, pipeline_id, stage_name, stage_key, display_order, color, is_closed, is_won")
          .eq("pipeline_id", pid)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        setStages((stageRows ?? []) as OpportunityStage[]);
      }

      let q = (supabase as any)
        .from("opportunities")
        .select(
          `id, workspace_id, owner_id, contact_id, company_id, deal_id, pipeline_id, stage_id,
           status, priority, source_channel, source_campaign_type, source_campaign_id,
           source_thread_type, source_thread_id, source_message_id, title, intent_signal,
           next_action_at, last_activity_at, closed_at, close_reason, created_at, updated_at,
           contact:contacts(id, first_name, last_name, email),
           company:companies(id, name)`
        )
        .eq("workspace_id", workspaceId)
        .order("last_activity_at", { ascending: false })
        .limit(500);

      if (!includeClosed) {
        q = q.not("status", "in", "(won,lost,not_fit,bad_timing)");
      }

      const { data: opps, error } = await q;
      if (error) {
        toast.error(`Failed to load opportunities: ${error.message}`);
        setOpportunities([]);
        return;
      }
      const rows = (opps ?? []) as Opportunity[];
      const ownerIds = Array.from(new Set(rows.map((o) => o.owner_id).filter(Boolean))) as string[];
      let owners: Record<string, Opportunity["owner"]> = {};
      if (ownerIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, full_name, email").in("id", ownerIds);
        (profs ?? []).forEach((p: any) => { owners[p.id] = p; });
      }
      setOpportunities(rows.map((o) => ({ ...o, owner: o.owner_id ? owners[o.owner_id] ?? null : null })));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, includeClosed]);

  useEffect(() => { load(); }, [load]);

  const byStage = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    stages.forEach((s) => map.set(s.id, []));
    const unstaged: Opportunity[] = [];
    opportunities.forEach((o) => {
      if (o.stage_id && map.has(o.stage_id)) map.get(o.stage_id)!.push(o);
      else unstaged.push(o);
    });
    return { map, unstaged };
  }, [opportunities, stages]);

  const transition = useCallback(
    async (id: string, newStageId: string | null, newStatus: OpportunityStatus | null, reason?: string) => {
      // Optimistic
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, stage_id: newStageId ?? o.stage_id, status: newStatus ?? o.status }
            : o
        )
      );
      const { error } = await (supabase as any).rpc("transition_opportunity", {
        _opportunity_id: id,
        _new_stage_id: newStageId,
        _new_status: newStatus,
        _reason: reason ?? null,
      });
      if (error) {
        toast.error(`Failed to update opportunity: ${error.message}`);
        await load();
        return false;
      }
      return true;
    },
    [load]
  );

  const assign = useCallback(
    async (id: string, ownerId: string | null) => {
      const { error } = await (supabase as any).rpc("assign_opportunity", {
        _opportunity_id: id,
        _owner_id: ownerId,
      });
      if (error) { toast.error(`Failed to assign: ${error.message}`); return false; }
      toast.success("Owner updated");
      await load();
      return true;
    },
    [load]
  );

  return { opportunities, stages, pipelineId, byStage, loading, reload: load, transition, assign };
}

export async function pushToCrm(workspaceId: string, payload: PushToCrmPayload): Promise<PushToCrmResult | null> {
  if (!workspaceId) { toast.error("No workspace selected"); return null; }
  const { data, error } = await (supabase as any).rpc("push_to_crm", {
    payload: { workspace_id: workspaceId, ...payload },
  });
  if (error) {
    toast.error(`Push to CRM failed: ${error.message}`);
    return null;
  }
  const result = data as PushToCrmResult;
  toast.success(result.created ? "Opportunity created in CRM" : "Opportunity updated in CRM");
  return result;
}
