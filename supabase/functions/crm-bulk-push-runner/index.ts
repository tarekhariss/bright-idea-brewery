/// <reference lib="deno.ns" />
/**
 * crm-bulk-push-runner — processes a queued crm_bulk_push_jobs row.
 *
 * Accepts { job_id } from an authenticated workspace member. Validates
 * membership, then iterates selected_ids (resolving contact_id/company_id
 * per row), calls push_to_crm via RPC with caller_id, and writes per-row
 * outcomes to crm_bulk_push_job_rows while updating the parent job counters.
 *
 * Designed to run for one job per invocation. The UI re-invokes for retries.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({}));
  const jobId: string = body.job_id;
  const retryFailedOnly: boolean = !!body.retry_failed;
  if (!jobId) return json(400, { error: "job_id required" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from("crm_bulk_push_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return json(404, { error: "not_found" });
  const { data: member } = await admin.from("workspace_members").select("id").eq("workspace_id", job.workspace_id).eq("user_id", userData.user.id).maybeSingle();
  if (!member) return json(403, { error: "forbidden" });
  if (job.status === "running") return json(409, { error: "already_running" });

  let idsToProcess: string[] = job.selected_ids ?? [];

  // Filter-replay mode: derive ids from a saved filter snapshot.
  if (job.selection_mode === "filter" && job.filter_snapshot && !retryFailedOnly) {
    const snap = job.filter_snapshot as any;
    const table = job.source_kind === "companies" ? "companies"
                : job.source_kind === "list"      ? "list_contacts"
                : "contacts";
    let q = (admin as any).from(table).select("id").eq("workspace_id", job.workspace_id).limit(5000);
    if (job.source_kind === "list") {
      q = (admin as any).from("list_contacts").select("contact_id").eq("list_id", snap.list_id).limit(5000);
    } else {
      // Generic field filters: { eq:{col:val}, ilike:{col:val}, in:{col:[]} }
      for (const [col, val] of Object.entries(snap.eq ?? {})) q = q.eq(col, val);
      for (const [col, val] of Object.entries(snap.ilike ?? {})) q = q.ilike(col, `%${val}%`);
      for (const [col, arr] of Object.entries(snap.in ?? {})) q = q.in(col, arr as any[]);
    }
    const { data: rows } = await q;
    idsToProcess = (rows ?? []).map((r: any) => r.id ?? r.contact_id).filter(Boolean);
  }

  if (retryFailedOnly) {
    const { data: failed } = await admin.from("crm_bulk_push_job_rows").select("contact_id, company_id").eq("job_id", jobId).eq("outcome", "failed");
    idsToProcess = (failed ?? []).map((r: any) => r.contact_id ?? r.company_id).filter(Boolean);
  }

  await admin.from("crm_bulk_push_jobs").update({
    status: "running", started_at: new Date().toISOString(),
    total: idsToProcess.length, processed: retryFailedOnly ? job.processed : 0,
    created_count: retryFailedOnly ? job.created_count : 0,
    updated_count: retryFailedOnly ? job.updated_count : 0,
    failed_count: retryFailedOnly ? 0 : 0,
  }).eq("id", jobId);

  let created = retryFailedOnly ? job.created_count : 0;
  let updated = retryFailedOnly ? job.updated_count : 0;
  let failed = 0;
  let processed = retryFailedOnly ? job.processed : 0;

  const defaults = job.push_defaults ?? {};
  const kind = job.source_kind; // contacts | companies | search | list

  for (const rawId of idsToProcess) {
    let contactId: string | null = null;
    let companyId: string | null = null;
    if (kind === "companies") companyId = rawId;
    else { contactId = rawId; }

    try {
      const { data, error } = await admin.rpc("push_to_crm" as any, {
        payload: {
          workspace_id: job.workspace_id,
          contact_id: contactId, company_id: companyId,
          source_channel: defaults.source_channel ?? "manual_push",
          status: defaults.status ?? "interested",
          priority: defaults.priority ?? "normal",
          note: defaults.note ?? null,
          caller_id: userData.user.id,
        },
      });
      if (error) throw error;
      const wasCreated = !!(data as any)?.created;
      if (wasCreated) created++; else updated++;
      await admin.from("crm_bulk_push_job_rows").insert({
        job_id: jobId, workspace_id: job.workspace_id,
        contact_id: contactId, company_id: companyId,
        opportunity_id: (data as any)?.opportunity_id,
        outcome: wasCreated ? "created" : "updated",
        processed_at: new Date().toISOString(),
      });
    } catch (e: any) {
      failed++;
      await admin.from("crm_bulk_push_job_rows").insert({
        job_id: jobId, workspace_id: job.workspace_id,
        contact_id: contactId, company_id: companyId,
        outcome: "failed", error: String(e?.message ?? e),
        processed_at: new Date().toISOString(),
      });
    }
    processed++;
    if (processed % 25 === 0) {
      await admin.from("crm_bulk_push_jobs").update({
        processed, created_count: created, updated_count: updated, failed_count: failed,
      }).eq("id", jobId);
    }
  }

  await admin.from("crm_bulk_push_jobs").update({
    status: "completed", processed, created_count: created,
    updated_count: updated, failed_count: failed,
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);

  await admin.from("crm_job_runs").insert({
    workspace_id: job.workspace_id, job_name: "bulk_push",
    status: failed > 0 ? "error" : "ok",
    scanned: processed, queued: created, auto_pushed: updated, errors: failed,
    details: { job_id: jobId, source_kind: job.source_kind, selection_mode: job.selection_mode },
  });

  return json(200, { ok: true, processed, created, updated, failed });
});
