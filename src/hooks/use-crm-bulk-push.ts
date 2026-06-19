/**
 * use-crm-bulk-push — creates a crm_bulk_push_jobs row and triggers
 * the crm-bulk-push-runner edge function. Returns the job id so callers
 * can navigate to /crm/bulk-jobs to watch progress.
 */
import { supabase } from "@/integrations/supabase/client";

export interface BulkPushArgs {
  workspaceId: string;
  sourceKind: "contacts" | "companies" | "search" | "list";
  selectedIds: string[];
  filters?: Record<string, any>;
  defaults?: { source_channel?: string; status?: string; priority?: string; note?: string };
}

export async function createBulkPushJob(args: BulkPushArgs): Promise<{ id: string } | null> {
  const { data, error } = await (supabase as any)
    .from("crm_bulk_push_jobs")
    .insert({
      workspace_id: args.workspaceId,
      source_kind: args.sourceKind,
      selected_ids: args.selectedIds,
      filters: args.filters ?? {},
      push_defaults: args.defaults ?? {},
      total: args.selectedIds.length,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw error;
  // Fire and forget
  supabase.functions.invoke("crm-bulk-push-runner", { body: { job_id: data.id } }).catch(() => void 0);
  return data;
}
