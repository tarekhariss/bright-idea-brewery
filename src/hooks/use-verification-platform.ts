import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const sb = supabase as any;

// ----- Platform admin check (used to gate admin-only UI) -----
export function useIsPlatformAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_platform_admin", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("is_platform_admin", { _user_id: user!.id });
      if (error) return false;
      return !!data;
    },
  });
}

// ----- Overview / KPIs -----
export function useVerificationOverview() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_overview", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("workspace_verification_overview", { _workspace_id: workspaceId });
      if (error) throw error;
      return data as Record<string, any>;
    },
    refetchInterval: 15_000,
  });
}

// ----- Jobs -----
export function useVerificationJobs(opts: { source?: string | null; limit?: number } = {}) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_jobs_v2", workspaceId, opts.source, opts.limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = sb.from("verification_jobs").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(opts.limit ?? 200);
      if (opts.source) q = q.eq("source", opts.source);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 15_000,
  });
}

// ----- Queue Monitor -----
export function useVerificationQueue() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_queue", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_results")
        .select("status, dead_letter, processing_started_at, next_retry_at, created_at, engine_latency_ms")
        .eq("workspace_id", workspaceId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const summary = { pending: 0, processing: 0, completed: 0, invalid: 0, risky: 0, dead_letter: 0, retry_scheduled: 0 };
      rows.forEach((r) => {
        if (r.dead_letter) summary.dead_letter++;
        else if (r.processing_started_at && !r.verified_at) summary.processing++;
        else if (r.next_retry_at && new Date(r.next_retry_at) > new Date()) summary.retry_scheduled++;
        else if (r.status === "unknown") summary.pending++;
        else if (r.status === "invalid") summary.invalid++;
        else if (r.status === "risky" || r.status === "catch_all") summary.risky++;
        else summary.completed++;
      });
      return { rows, summary };
    },
    refetchInterval: 10_000,
  });
}

// ----- Workers -----
export function useVerificationWorkers() {
  return useQuery({
    queryKey: ["verification_workers"],
    queryFn: async () => {
      const { data, error } = await sb.from("verification_workers").select("*").order("last_heartbeat_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 5_000,
  });
}

// ----- Engines -----
export function useVerificationEngines() {
  return useQuery({
    queryKey: ["verification_engines"],
    queryFn: async () => {
      const { data, error } = await sb.from("verification_engines").select("*").order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30_000,
  });
}

export function useToggleEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; is_active: boolean }) => {
      const { error } = await sb.from("verification_engines").update({ is_active: vars.is_active }).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["verification_engines"] }); toast.success("Engine updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ----- Domain Intelligence -----
export function useDomainReputation(limit = 200) {
  return useQuery({
    queryKey: ["domain_reputation", limit],
    queryFn: async () => {
      const { data, error } = await sb.from("domain_reputation").select("*")
        .order("total_verifications", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Provider rules -----
export function useProviderRules() {
  return useQuery({
    queryKey: ["provider_behavior_rules"],
    queryFn: async () => {
      const { data, error } = await sb.from("provider_behavior_rules").select("*").order("provider_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useUpsertProviderRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const { error } = await sb.from("provider_behavior_rules").upsert(row, { onConflict: "provider_type,rule_key" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider_behavior_rules"] }); toast.success("Rule saved"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteProviderRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("provider_behavior_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider_behavior_rules"] }); toast.success("Rule deleted"); },
  });
}

// ----- Bounces -----
export function useBounceFeedback() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["bounce_feedback", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("bounce_feedback").select("*")
        .eq("workspace_id", workspaceId).order("received_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Catch-all domains -----
export function useCatchAllDomains() {
  return useQuery({
    queryKey: ["catch_all_domains"],
    queryFn: async () => {
      const { data, error } = await sb.from("domain_reputation").select("*")
        .eq("is_catch_all", true).order("total_verifications", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Retry pipeline -----
export function useRetryPipeline() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["retry_pipeline", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_results")
        .select("id, email, status, attempt_count, retry_count, next_retry_at, last_attempt_at, error_message, last_error:error_message")
        .eq("workspace_id", workspaceId)
        .eq("dead_letter", false)
        .not("next_retry_at", "is", null)
        .order("next_retry_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 15_000,
  });
}

// ----- Dead Letter -----
export function useDeadLetter() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_dead_letter", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_dead_letter").select("*")
        .eq("workspace_id", workspaceId).order("escalated_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- History -----
export function useVerificationHistory(filters: { status?: string; q?: string; limit?: number } = {}) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_history", workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = sb.from("verification_results")
        .select("id, email, status, confidence, source_engine, engine_latency_ms, verified_at, from_cache, is_disposable, is_catch_all, domain, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 500);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.q) q = q.ilike("email", `%${filters.q}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Quotas -----
export function useVerificationQuota() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_quota", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_quotas").select("*").eq("workspace_id", workspaceId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 30_000,
  });
}

export function useUpdateQuota() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vars: { daily_limit?: number; monthly_limit?: number }) => {
      const { error } = await sb.from("verification_quotas").upsert({ workspace_id: workspaceId, ...vars });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["verification_quota"] }); toast.success("Quota updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ----- Audit log -----
export function useVerificationAuditLog(limit = 200) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_audit_log", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_audit_log").select("*")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- List health -----
export function useListHealth(jobId: string | null) {
  return useQuery({
    queryKey: ["list_health", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("compute_list_health", { _job_id: jobId });
      if (error) throw error;
      return data as Record<string, any>;
    },
  });
}

// ----- Campaign safety -----
export function useCampaignSafety(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_safety", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("check_campaign_list_safety", { _campaign_id: campaignId });
      if (error) throw error;
      return data as Record<string, any>;
    },
  });
}

// ----- Mutations -----
export function useRequeueDeadLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("verification_dead_letter").update({ recovered_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["verification_dead_letter"] }); toast.success("Marked recovered"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRetryNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("verification_results")
        .update({ next_retry_at: new Date().toISOString(), processing_started_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retry_pipeline"] }); toast.success("Retry scheduled"); },
    onError: (e: any) => toast.error(e.message),
  });
}
