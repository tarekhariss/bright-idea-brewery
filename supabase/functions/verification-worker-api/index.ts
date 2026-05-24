// External email verification engine API.
// Worker actions authenticate via x-worker-secret. Dashboard/admin reads via JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("VERIFICATION_WORKER_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function logWorkerEvent(action: string, details: Record<string, unknown> = {}) {
  console.log(`[verification-worker-api:${action}]`, {
    ...details,
    backend_ref: new URL(SUPABASE_URL).hostname.split(".")[0],
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function workerOk(req: Request) {
  return WORKER_SECRET && req.headers.get("x-worker-secret") === WORKER_SECRET;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() || "";

  try {
    const workerActions = ["claim", "submit", "retry", "bounce", "heartbeat", "dead-letter", "quota", "fail"];
    if (workerActions.includes(action)) {
      if (!workerOk(req)) {
        logWorkerEvent("secret-mismatch", {
          action,
          has_configured_secret: WORKER_SECRET.length > 0,
          has_header: req.headers.has("x-worker-secret"),
          user_agent: req.headers.get("user-agent") ?? null,
        });
        return json({ error: "Worker secret required" }, 401);
      }
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

      if (action === "claim") {
        const limit = Math.min(Number(body.limit ?? 50), 200);
        logWorkerEvent("claim:start", { requested_limit: body.limit ?? null, limit });
        const { data, error } = await admin.rpc("claim_verification_batch", { _limit: limit });
        if (error) throw error;
        logWorkerEvent("claim:done", { claimed_count: data?.length ?? 0 });
        return json({ batch: data ?? [] });
      }

      if (action === "submit") {
        const r = body || {};
        logWorkerEvent("submit:start", {
          result_id: r.result_id ?? null,
          status: r.status ?? null,
          source_engine: r.source_engine ?? null,
        });
        const { data, error } = await admin.rpc("record_verification_result", {
          _result_id: r.result_id,
          _status: r.status,
          _confidence: r.confidence ?? null,
          _risk_reasons: r.risk_reasons ?? [],
          _is_disposable: r.is_disposable ?? null,
          _is_role_based: r.is_role_based ?? null,
          _is_catch_all: r.is_catch_all ?? null,
          _is_free_provider: r.is_free_provider ?? null,
          _mx_provider: r.mx_provider ?? null,
          _mx_record: r.mx_record ?? null,
          _smtp_response: r.smtp_response ?? null,
          _smtp_code: r.smtp_code ?? null,
          _source_engine: r.source_engine ?? "external",
          _engine_version: r.engine_version ?? null,
          _did_you_mean: r.did_you_mean ?? null,
          _raw: r.raw ?? {},
          _error: r.error ?? null,
        });
        if (error) throw error;
        logWorkerEvent("submit:done", { result_id: r.result_id ?? null });
        return json({ ok: true, result: data });
      }

      if (action === "retry") {
        const { error } = await admin.rpc("retry_verification_result", {
          _result_id: body.result_id,
          _error: body.error ?? "transient",
        });
        if (error) throw error;
        return json({ ok: true });
      }

      if (action === "bounce") {
        const { error } = await admin.rpc("ingest_bounce_feedback", {
          _workspace_id: body.workspace_id,
          _email: body.email,
          _bounce_type: body.bounce_type ?? "hard",
          _smtp_code: body.smtp_code ?? null,
          _smtp_response: body.smtp_response ?? null,
          _source: body.source ?? "smtp",
          _raw: body.raw ?? {},
        });
        if (error) throw error;
        return json({ ok: true });
      }

      if (action === "heartbeat") {
        if (!body.worker_id) return json({ error: "worker_id required" }, 400);
        logWorkerEvent("heartbeat:start", {
          worker_id: body.worker_id,
          status: body.status ?? "online",
          in_flight: body.in_flight ?? 0,
          host: body.host ?? null,
          version: body.version ?? null,
        });
        const { error } = await admin.rpc("worker_heartbeat", {
          _worker_id: body.worker_id,
          _status: body.status ?? "online",
          _in_flight: body.in_flight ?? 0,
          _batch_size: body.batch_size ?? 0,
          _avg_latency: body.avg_latency ?? null,
          _version: body.version ?? null,
          _host: body.host ?? null,
          _last_error: body.last_error ?? null,
          _metadata: body.metadata ?? {},
        });
        if (error) throw error;
        logWorkerEvent("heartbeat:done", { worker_id: body.worker_id });
        return json({ ok: true });
      }

      if (action === "dead-letter") {
        // Report a permanently failed verification → push to DLQ
        if (!body.workspace_id || !body.email) return json({ error: "workspace_id + email required" }, 400);
        logWorkerEvent("dead-letter:start", {
          workspace_id: body.workspace_id,
          result_id: body.result_id ?? null,
          job_id: body.job_id ?? null,
          email_domain: typeof body.email === "string" ? body.email.split("@")[1] ?? null : null,
          reason: body.reason ?? "max_retries_exceeded",
        });
        const { error } = await admin.from("verification_dead_letter").insert({
          workspace_id: body.workspace_id,
          result_id: body.result_id ?? null,
          job_id: body.job_id ?? null,
          email: body.email,
          reason: body.reason ?? "max_retries_exceeded",
          attempt_count: body.attempt_count ?? 0,
          last_error: body.last_error ?? null,
          payload: body.payload ?? {},
        });
        if (error) throw error;
        if (body.result_id) {
          await admin.from("verification_results").update({ dead_letter: true }).eq("id", body.result_id);
        }
        logWorkerEvent("dead-letter:done", { result_id: body.result_id ?? null });
        return json({ ok: true });
      }

      if (action === "fail") {
        // Report failed job state without DLQ escalation (transient worker errors)
        if (!body.result_id) return json({ error: "result_id required" }, 400);
        logWorkerEvent("fail:start", { result_id: body.result_id, error: body.error ?? "worker_failure" });
        const { error } = await admin.from("verification_results").update({
          processing_started_at: null,
          last_attempt_at: new Date().toISOString(),
          error_message: body.error ?? "worker_failure",
        }).eq("id", body.result_id);
        if (error) throw error;
        logWorkerEvent("fail:done", { result_id: body.result_id });
        return json({ ok: true });
      }

      if (action === "quota") {
        if (!body.workspace_id) return json({ error: "workspace_id required" }, 400);
        logWorkerEvent("quota:start", {
          workspace_id: body.workspace_id,
          consume: !!body.consume,
          count: body.count ?? 1,
        });
        if (body.consume) {
          const { data, error } = await admin.rpc("consume_verification_quota", {
            _workspace_id: body.workspace_id,
            _count: body.count ?? 1,
          });
          if (error) throw error;
          logWorkerEvent("quota:done", { workspace_id: body.workspace_id, allowed: data });
          return json({ ok: true, allowed: data });
        }
        const { data, error } = await admin.from("verification_quotas").select("*").eq("workspace_id", body.workspace_id).maybeSingle();
        if (error) throw error;
        logWorkerEvent("quota:done", { workspace_id: body.workspace_id, has_quota: !!data });
        return json({ quota: data });
      }
    }

    // Health endpoint for dashboard — requires authenticated user (any workspace member)
    if (action === "health") {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: authErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

      const { count: pending } = await admin
        .from("verification_results")
        .select("id", { count: "exact", head: true })
        .is("verified_at", null)
        .eq("from_cache", false);
      const { count: dlq } = await admin
        .from("verification_dead_letter")
        .select("id", { count: "exact", head: true })
        .is("recovered_at", null);
      const { count: workers } = await admin
        .from("verification_workers")
        .select("id", { count: "exact", head: true })
        .in("status", ["online", "idle"]);
      return json({
        adapter_configured: WORKER_SECRET.length > 0,
        pending_results: pending ?? 0,
        dead_letter_open: dlq ?? 0,
        workers_online: workers ?? 0,
      });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (e: any) {
    console.error("verification-worker-api error", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
