import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ── Campaign Steps ──
export function useCampaignSteps(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_steps", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("campaign_steps")
        .select("*, email_templates(id, name, subject)")
        .eq("campaign_id", campaignId!)
        .order("step_order");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAddCampaignStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { campaign_id: string; step_order: number; step_type: string; delay_days?: number; delay_hours?: number; email_template_id?: string; task_description?: string }) => {
      const { data, error } = await from("campaign_steps").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["campaign_steps", d.campaign_id] }); toast.success("Step added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCampaignStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId, ...vals }: { id: string; campaignId: string; [key: string]: any }) => {
      const { error } = await from("campaign_steps").update(vals).eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId: string) => { qc.invalidateQueries({ queryKey: ["campaign_steps", campaignId] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteCampaignStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await from("campaign_steps").delete().eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId: string) => { qc.invalidateQueries({ queryKey: ["campaign_steps", campaignId] }); toast.success("Step removed"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useReorderCampaignSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, steps }: { campaignId: string; steps: { id: string; step_order: number }[] }) => {
      for (const s of steps) {
        await from("campaign_steps").update({ step_order: s.step_order }).eq("id", s.id);
      }
      return campaignId;
    },
    onSuccess: (campaignId: string) => qc.invalidateQueries({ queryKey: ["campaign_steps", campaignId] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Campaign Enrollments ──
export function useCampaignEnrollments(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_enrollments", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await from("campaign_enrollments")
        .select("*, contacts(id, first_name, last_name, email, company_name_raw), campaign_steps(id, step_order, step_type)")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useEnrollContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, contactIds }: { campaignId: string; contactIds: string[] }) => {
      // Try bulk first — fast path
      const rows = contactIds.map(cid => ({ campaign_id: campaignId, contact_id: cid, status: "pending" }));
      const bulk = await from("campaign_enrollments")
        .upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true })
        .select();
      if (!bulk.error) return { enrolled: bulk.data?.length ?? 0, blocked: 0, blocked_messages: [] as string[] };

      // Fallback: per-row to isolate guard violations (intelligence_v2 mode)
      let enrolled = 0; let blocked = 0; const messages: string[] = [];
      for (const r of rows) {
        const { error, data } = await from("campaign_enrollments")
          .upsert([r], { onConflict: "campaign_id,contact_id", ignoreDuplicates: true })
          .select();
        if (error) {
          blocked++;
          if (messages.length < 5) messages.push(error.message);
        } else enrolled += data?.length ?? 0;
      }
      return { enrolled, blocked, blocked_messages: messages };
    },
    onSuccess: (res: any, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_enrollments", vars.campaignId] });
      if (res.blocked > 0) {
        toast.warning(`${res.enrolled} enrolled · ${res.blocked} blocked by email targeting guardrails`);
      } else {
        toast.success(`${res.enrolled} contacts enrolled`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId, ...vals }: { id: string; campaignId: string; [key: string]: any }) => {
      const { error } = await from("campaign_enrollments").update(vals).eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId: string) => qc.invalidateQueries({ queryKey: ["campaign_enrollments", campaignId] }),
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Step Executions ──
export function useStepExecutions(enrollmentId: string | null) {
  return useQuery({
    queryKey: ["campaign_step_executions", enrollmentId],
    enabled: !!enrollmentId,
    queryFn: async () => {
      const { data, error } = await from("campaign_step_executions")
        .select("*, campaign_steps(step_order, step_type)")
        .eq("enrollment_id", enrollmentId!)
        .order("scheduled_at");
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── Outreach History ──
export function useContactOutreachHistory(contactId: string | null) {
  return useQuery({
    queryKey: ["contact_outreach_history", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await from("contact_outreach_history")
        .select("*, campaigns(id, name)")
        .eq("contact_id", contactId!);
      if (error) throw error;
      return data as any[];
    },
  });
}

// ── Safety Rules ──
export function useSequenceSafetyRules() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["sequence_safety_rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("sequence_safety_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpsertSafetyRules() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vals: { max_emails_per_contact: number; max_emails_per_domain: number; cooldown_days: number }) => {
      const { data: existing } = await from("sequence_safety_rules").select("id").eq("workspace_id", workspaceId).limit(1).maybeSingle();
      if (existing) {
        const { error } = await from("sequence_safety_rules").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await from("sequence_safety_rules").insert({ ...vals, workspace_id: workspaceId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequence_safety_rules"] }); toast.success("Safety rules saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Email Templates (for step selection) ──
export function useEmailTemplatesList() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["email_templates_list", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await from("email_templates")
        .select("id, name, subject")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; subject: string | null }[];
    },
  });
}
