import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const sb = supabase as any;

// ----- Overview / KPIs -----
export function useVerificationOverview() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_overview", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("workspace_verification_overview", {
        _workspace_id: workspaceId,
      });
      if (error) throw error;
      return data as Record<string, any>;
    },
    refetchInterval: 15_000,
  });
}

// ----- Queue Monitor (counts by status from verification_results) -----
export function useVerificationQueue() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_queue", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("verification_results")
        .select("status, dead_letter, processing_started_at, next_retry_at, created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const summary = {
        pending: 0,
        processing: 0,
        completed: 0,
        invalid: 0,
        risky: 0,
        dead_letter: 0,
        retry_scheduled: 0,
      };
      rows.forEach((r) => {
        if (r.dead_letter) summary.dead_letter++;
        if (r.processing_started_at) summary.processing++;
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
      const { data, error } = await sb
        .from("verification_workers")
        .select("*")
        .order("last_heartbeat_at", { ascending: false });
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
      const { data, error } = await sb
        .from("verification_engines")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30_000,
  });
}

// ----- Domain Intelligence -----
export function useDomainReputation(limit = 100) {
  return useQuery({
    queryKey: ["domain_reputation", limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from("domain_reputation")
        .select("*")
        .order("total_verifications", { ascending: false })
        .limit(limit);
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
      const { data, error } = await sb
        .from("provider_behavior_rules")
        .select("*")
        .order("provider_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Bounces -----
export function useBounceFeedback() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["bounce_feedback", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("bounce_feedback")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- Dead Letter -----
export function useDeadLetter() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_dead_letter", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("verification_dead_letter")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("escalated_at", { ascending: false })
        .limit(500);
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
      const { data, error } = await sb
        .from("verification_quotas")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 30_000,
  });
}

// ----- Audit log -----
export function useVerificationAuditLog(limit = 100) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_audit_log", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("verification_audit_log")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- List health for a job -----
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

// ----- Mutations -----
export function useRequeueDeadLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("verification_dead_letter")
        .update({ recovered_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification_dead_letter"] });
      toast.success("Marked recovered");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateQuota() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vars: { daily_limit?: number; monthly_limit?: number }) => {
      const { error } = await sb
        .from("verification_quotas")
        .upsert({
          workspace_id: workspaceId,
          ...vars,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification_quota"] });
      toast.success("Quota updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
