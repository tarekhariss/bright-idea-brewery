import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const from = (table: string) => (supabase as any).from(table);

// ── Research Profiles ──
export function useResearchProfile(contactId?: string | null, companyId?: string | null) {
  return useQuery({
    queryKey: ["research_profile", contactId, companyId],
    enabled: !!(contactId || companyId),
    queryFn: async () => {
      let q = from("prospect_research_profiles").select("*, prospect_research_sources(*)");
      if (contactId) q = q.eq("contact_id", contactId);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCreateResearchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { contact_id?: string; company_id?: string; workspace_id?: string; summary?: string; pain_points?: string; value_props?: string; recent_signals?: string; research_status?: string }) => {
      const { data, error } = await from("prospect_research_profiles").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["research_profile", d.contact_id, d.company_id] });
      toast.success("Research profile created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateResearchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { data, error } = await from("prospect_research_profiles").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["research_profile"] });
      toast.success("Research updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Research Sources ──
export function useAddResearchSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { research_profile_id: string; source_type: string; source_title?: string; source_url?: string; source_content?: string }) => {
      const { data, error } = await from("prospect_research_sources").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research_profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Personalization Variables ──
export function usePersonalizationVariables(contactId?: string | null, companyId?: string | null) {
  return useQuery({
    queryKey: ["personalization_variables", contactId, companyId],
    enabled: !!(contactId || companyId),
    queryFn: async () => {
      let q = from("personalization_variables").select("*");
      if (contactId) q = q.eq("contact_id", contactId);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.order("variable_key");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpsertPersonalizationVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { workspace_id?: string; contact_id?: string; company_id?: string; variable_key: string; variable_value: string; confidence_score?: number; source?: string }) => {
      const { data, error } = await from("personalization_variables").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["personalization_variables"] });
      toast.success("Variable saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeletePersonalizationVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("personalization_variables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personalization_variables"] }); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Generated Content ──
export function useGeneratedContent(contactId?: string | null, companyId?: string | null) {
  return useQuery({
    queryKey: ["generated_content", contactId, companyId],
    enabled: !!(contactId || companyId),
    queryFn: async () => {
      let q = from("generated_content").select("*");
      if (contactId) q = q.eq("contact_id", contactId);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateGeneratedContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { workspace_id?: string; contact_id?: string; company_id?: string; campaign_id?: string; content_type: string; generated_text?: string; generation_status?: string }) => {
      const { data, error } = await from("generated_content").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["generated_content"] }); toast.success("Content saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Contact & Company Insights ──
export function useContactInsights(contactId?: string | null) {
  return useQuery({
    queryKey: ["contact_insights", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await from("contact_insights").select("*").eq("contact_id", contactId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCompanyInsights(companyId?: string | null) {
  return useQuery({
    queryKey: ["company_insights", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await from("company_insights").select("*").eq("company_id", companyId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

// ── AI Prompt Templates ──
export function useAIPromptTemplates() {
  return useQuery({
    queryKey: ["ai_prompt_templates"],
    queryFn: async () => {
      const { data, error } = await from("ai_prompt_templates").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateAIPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vals: { workspace_id?: string; name: string; prompt_type: string; system_prompt?: string; user_prompt_template?: string }) => {
      const { data, error } = await from("ai_prompt_templates").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_prompt_templates"] }); toast.success("Prompt template created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateAIPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...vals }: { id: string; [key: string]: any }) => {
      const { error } = await from("ai_prompt_templates").update(vals).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_prompt_templates"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteAIPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await from("ai_prompt_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_prompt_templates"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
}
