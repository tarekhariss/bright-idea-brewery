import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const sb = supabase as any;

export type VerificationStatus =
  | "safe" | "valid" | "invalid" | "risky" | "catch_all"
  | "disposable" | "role_based" | "unknown" | "suppressed" | "failed";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function workerHealth() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verification-worker-api/health`);
  if (!res.ok) return { adapter_configured: false, pending_results: 0 };
  return res.json();
}

export function useVerificationHealth() {
  return useQuery({
    queryKey: ["verification_health"],
    queryFn: workerHealth,
    refetchInterval: 30_000,
  });
}

export function useVerificationJobs() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["verification_jobs", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });
}

export function useVerificationJob(id: string | null) {
  return useQuery({
    queryKey: ["verification_job", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_jobs").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useVerificationResults(jobId: string | null) {
  return useQuery({
    queryKey: ["verification_results", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await sb.from("verification_results")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEnqueueVerification() {
  const qc = useQueryClient();
  const { workspaceId } = useAuth();
  return useMutation({
    mutationFn: async (vars: {
      name?: string;
      emails: string[];
      source?: string;
      campaign_id?: string | null;
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await sb.rpc("enqueue_verification_job", {
        _workspace_id: workspaceId,
        _name: vars.name ?? null,
        _emails: vars.emails,
        _source: vars.source ?? "csv_upload",
        _campaign_id: vars.campaign_id ?? null,
        _list_id: null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification_jobs"] });
      toast.success("Verification job queued");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSuppressionList() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: ["suppression_list", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sb.from("suppression_list")
        .select("*").eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddSuppression() {
  const qc = useQueryClient();
  const { workspaceId, user } = useAuth();
  return useMutation({
    mutationFn: async (vars: { email: string; reason?: string; notes?: string }) => {
      const { error } = await sb.from("suppression_list").insert({
        workspace_id: workspaceId,
        email_normalized: vars.email.trim().toLowerCase(),
        reason: vars.reason ?? "manual",
        source: "manual",
        added_by: user?.id,
        notes: vars.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppression_list"] });
      toast.success("Added to suppression list");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRemoveSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("suppression_list").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppression_list"] });
      toast.success("Removed from suppression list");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export async function checkEmailEligibility(
  workspaceId: string,
  email: string
): Promise<{
  allowed: boolean;
  requires_approval?: boolean;
  reason?: string;
  status?: VerificationStatus;
  confidence?: number;
}> {
  const { data, error } = await sb.rpc("check_email_send_eligibility", {
    _workspace_id: workspaceId,
    _email: email,
  });
  if (error) throw error;
  return data;
}
