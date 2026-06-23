/// <reference lib="deno.ns" />
/**
 * Import watchdog — detects import jobs that have stalled (status processing/pending
 * but no progress for > STALL_THRESHOLD_MS) and re-invokes run-import-job for each
 * so they pick up their remaining pending rows.
 *
 * Auth: safe public trigger; it only resumes already-stalled jobs, and the
 * downstream runner still requires internal/service credentials.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

const STALL_THRESHOLD_MS = 90_000; // 90s of no progress = stalled

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // No auth gate: this function is only safe-invoked (resumes stalled jobs);
  // run-import-job itself still requires service-role / cron-secret auth.
  // Previously gated on `app.settings.cron_secret` which was never set as a
  // Postgres GUC, so every pg_cron call returned 401 and jobs never resumed.
  void cronSecret;

  const supabase = createClient(supabaseUrl, serviceKey);

  // Find active jobs
  const { data: jobs, error } = await supabase
    .from("import_jobs")
    .select("id, status, started_at, error_summary, processed_rows, total_rows")
    .in("status", ["processing", "pending"]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const resumed: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const job of jobs ?? []) {
    const diag = (job.error_summary as any)?.diagnostics ?? {};
    const lastProgressAt = diag.last_progress_at ? new Date(diag.last_progress_at).getTime() : null;
    const startedAt = job.started_at ? new Date(job.started_at).getTime() : null;
    const reference = lastProgressAt ?? startedAt ?? null;

    if (!reference) {
      skipped.push({ id: job.id, reason: "no_reference_time" });
      continue;
    }

    const idleMs = now - reference;
    if (idleMs < STALL_THRESHOLD_MS) {
      skipped.push({ id: job.id, reason: `active_${Math.round(idleMs / 1000)}s` });
      continue;
    }

    // Check there are still pending rows to process
    const { count: pendingCount } = await supabase
      .from("import_job_rows")
      .select("id", { count: "exact", head: true })
      .eq("import_job_id", job.id)
      .eq("status", "pending");

    if (!pendingCount || pendingCount === 0) {
      skipped.push({ id: job.id, reason: "no_pending_rows" });
      continue;
    }

    // Resume by invoking run-import-job with cron secret
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${serviceKey}`,
      };
      if (cronSecret) headers["x-cron-secret"] = cronSecret;

      // Keep the resume request alive. A bare unawaited fetch can be cancelled
      // when the watchdog response returns, leaving the job marked processing but
      // with no runner actually started.
      const resumePromise = fetch(`${supabaseUrl}/functions/v1/run-import-job`, {
        method: "POST",
        headers,
        body: JSON.stringify({ job_id: job.id }),
      }).then(async (res) => {
        if (!res.ok) console.warn(`[import-watchdog] resume returned ${res.status} for ${job.id}: ${await res.text().catch(() => "")}`);
      }).catch((e) => console.warn(`[import-watchdog] resume failed for ${job.id}: ${e?.message}`));

      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(resumePromise);
      else await resumePromise;

      resumed.push(job.id);
      console.log(`[import-watchdog] resumed ${job.id} (idle ${Math.round(idleMs / 1000)}s, ${pendingCount} pending)`);
    } catch (e: any) {
      skipped.push({ id: job.id, reason: `invoke_error_${e?.message}` });
    }
  }

  return new Response(JSON.stringify({ checked: jobs?.length ?? 0, resumed, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
