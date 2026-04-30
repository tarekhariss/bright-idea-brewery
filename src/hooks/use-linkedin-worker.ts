import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

export type WorkerRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  claimed: number;
  succeeded: number;
  failed: number;
  blocked: number;
  skipped: number;
  notes: unknown[];
  error: string | null;
};

export type QueueHealthRow = {
  workspace_id: string | null;
  status: string;
  count: number;
  oldest_scheduled_at: string | null;
  last_updated_at: string | null;
};

export function useLinkedinWorkerRuns(limit = 25) {
  return useQuery({
    queryKey: ["linkedin-worker-runs", limit],
    queryFn: async (): Promise<WorkerRun[]> => {
      const { data, error } = await supabase
        .from("linkedin_worker_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WorkerRun[];
    },
    refetchInterval: 15_000,
  });
}

export function useLinkedinQueueHealth() {
  const workspaceId = useActiveWorkspaceId();
  return useQuery({
    queryKey: ["linkedin-queue-health", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<QueueHealthRow[]> => {
      const { data, error } = await supabase
        .from("linkedin_queue_health_v" as never)
        .select("*")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as QueueHealthRow[];
    },
    refetchInterval: 15_000,
  });
}

export async function triggerLinkedinWorker(): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke("process-linkedin-queue", {
    body: { source: "manual" },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: JSON.stringify(data) };
}
