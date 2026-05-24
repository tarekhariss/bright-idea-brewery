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
    const workerActions = [
      "claim", "submit", "retry", "bounce", "heartbeat",
      "dead-letter", "quota", "fail", "recheck", "intelligence", "decide",
      "recovery-claim", "recovery-submit",
    ];
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
          latency_ms: r.latency_ms ?? null,
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

        // Persist SMTP intelligence + execution-trace fields the RPC doesn't accept.
        try {
          const patch: Record<string, unknown> = {};
          if (r.smtp_banner != null) patch.smtp_banner = String(r.smtp_banner).slice(0, 1000);
          if (r.tls_supported != null) patch.tls_supported = !!r.tls_supported;
          if (r.disconnect_reason != null) patch.disconnect_reason = String(r.disconnect_reason).slice(0, 300);
          if (r.probe_metadata != null) patch.probe_metadata = r.probe_metadata;
          if (r.provider_type != null) patch.provider_type = String(r.provider_type).slice(0, 80);
          if (r.engine_latency_ms != null) patch.engine_latency_ms = Number(r.engine_latency_ms);
          if (r.deliverability_score != null) patch.deliverability_score = Number(r.deliverability_score);
          if (r.bounce_risk_score != null) patch.bounce_risk_score = Number(r.bounce_risk_score);
          if (r.unknown_confidence != null) patch.unknown_confidence = String(r.unknown_confidence);
          if (r.unknown_subclass != null) patch.unknown_subclass = String(r.unknown_subclass).slice(0, 60);
          if (r.confidence_breakdown != null) patch.confidence_breakdown = r.confidence_breakdown;
          if (r.confidence_score != null) patch.confidence_score = Number(r.confidence_score);
          if (r.risk_level != null) patch.risk_level = String(r.risk_level).slice(0, 20);

          // Execution trace
          const traceSource = r.result_source ?? "live_smtp";
          patch.result_source = String(traceSource).slice(0, 40);
          if (r.claimed_by_worker != null) patch.claimed_by_worker = String(r.claimed_by_worker).slice(0, 80);
          else if (r.worker_id != null) patch.claimed_by_worker = String(r.worker_id).slice(0, 80);
          if (r.worker_version != null) patch.worker_version = String(r.worker_version).slice(0, 40);
          if (r.pass_number != null) patch.pass_number = Number(r.pass_number);
          if (r.smtp_attempt_count != null) patch.smtp_attempt_count = Number(r.smtp_attempt_count);
          if (r.recovery_attempt_count != null) patch.recovery_attempt_count = Number(r.recovery_attempt_count);
          if (r.provider_detected != null) patch.provider_detected = String(r.provider_detected).slice(0, 80);
          else if (r.provider_type != null) patch.provider_detected = String(r.provider_type).slice(0, 80);
          if (r.used_probe != null) patch.used_probe = !!r.used_probe;
          if (r.finalization_reason != null) patch.finalization_reason = String(r.finalization_reason).slice(0, 200);

          if (r.result_id) {
            await admin.from("verification_results").update(patch).eq("id", r.result_id);
          }

          // Bump job-level counters for live vs recovery results
          if (r.job_id) {
            const kind = traceSource === "recovery" ? "recovery" : "live_smtp";
            await admin.rpc("bump_job_trace_counters", { _job_id: r.job_id, _kind: kind });
          }
        } catch (patchErr) {
          console.warn("[verification-worker-api:submit] trace patch failed", patchErr);
        }


        // Continuous learning: feed provider behavior + SMTP pattern + domain/score
        try {
          if (r.provider_type || r.mx_provider) {
            await admin.rpc("bump_provider_behavior", {
              _provider: r.provider_type ?? r.mx_provider,
              _status: r.status,
              _latency_ms: r.latency_ms ?? r.engine_latency_ms ?? null,
              _smtp_response: r.smtp_response ?? null,
            });
          }
          if (r.smtp_code || r.smtp_response) {
            await admin.rpc("record_smtp_pattern", {
              _provider: r.provider_type ?? r.mx_provider ?? "unknown",
              _smtp_code: r.smtp_code ?? null,
              _response: (r.smtp_response ?? "").toString().slice(0, 300),
              _inferred: r.status,
            });
          }
          if (r.status === "invalid" && r.workspace_id && r.email) {
            await admin.rpc("record_bounce_outcome", {
              _workspace_id: r.workspace_id,
              _email: r.email,
              _smtp_code: r.smtp_code ?? null,
              _category: r.bounce_category ?? "hard_bounce",
              _provider: r.provider_type ?? r.mx_provider ?? null,
            });
          }
        } catch (learnErr) {
          console.warn("[verification-worker-api:submit] learning hook failed", learnErr);
        }


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

      if (action === "recheck") {
        if (!body.result_id) return json({ error: "result_id required" }, 400);
        logWorkerEvent("recheck:start", { result_id: body.result_id, reason: body.reason });
        const { data, error } = await admin.rpc("schedule_recheck", {
          _result_id: body.result_id,
          _reason: body.reason ?? "unknown",
        });
        if (error) throw error;
        logWorkerEvent("recheck:done", { result_id: body.result_id, plan: data });
        return json({ ok: true, plan: data });
      }

      if (action === "decide") {
        if (!body.workspace_id || !body.email) return json({ error: "workspace_id+email required" }, 400);
        const { data, error } = await admin.rpc("decide_verification_strategy", {
          _workspace_id: body.workspace_id,
          _email: body.email,
        });
        if (error) throw error;
        return json({ decision: data });
      }

      if (action === "intelligence") {
        // Aggregated hints to let worker self-tune
        const [{ data: providers }, { data: domains }] = await Promise.all([
          admin.from("provider_behavior")
            .select("provider_type,reliability_score,recommended_concurrency,avg_retry_delay_seconds,greylist_rate,bounce_rate")
            .order("total_verifications", { ascending: false }).limit(50),
          admin.from("domain_intelligence")
            .select("domain,reputation_score,bounce_rate,catch_all_rate,is_blocked")
            .order("total_emails_seen", { ascending: false }).limit(100),
        ]);
        return json({ providers: providers ?? [], domains: domains ?? [] });
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
          throughput: body.throughput ?? null,
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

        // Activity log for ops dashboard
        try {
          await admin.from("worker_activity_logs").insert({
            worker_id: body.worker_id,
            event_type: "heartbeat",
            throughput: body.throughput ?? null,
            in_flight: body.in_flight ?? 0,
            version: body.version ?? null,
            host: body.host ?? null,
            cpu_pct: body.cpu_pct ?? null,
            mem_mb: body.mem_mb ?? null,
            error_message: body.last_error ?? null,
            details: body.metadata ?? {},
          });
        } catch (logErr) {
          console.warn("[verification-worker-api:heartbeat] activity log failed", logErr);
        }

        logWorkerEvent("heartbeat:done", { worker_id: body.worker_id });
        return json({ ok: true });
      }

      if (action === "dead-letter") {
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
        if (!body.result_id) return json({ error: "result_id required" }, 400);
        logWorkerEvent("fail:start", { result_id: body.result_id, error: body.error ?? "worker_failure" });

        // If reason looks transient → smart recheck. Else just mark and let the standard retry path handle.
        const transient = ["greylisted", "temporary_failure", "antispam_system", "smtp_protocol", "unknown"];
        const reason = (body.reason ?? body.error ?? "").toString().toLowerCase();
        const isTransient = transient.some((k) => reason.includes(k));

        if (isTransient) {
          const { data, error } = await admin.rpc("schedule_recheck", {
            _result_id: body.result_id,
            _reason: transient.find((k) => reason.includes(k)) ?? "unknown",
          });
          if (error) throw error;
          logWorkerEvent("fail:recheck-scheduled", { result_id: body.result_id, plan: data });
          return json({ ok: true, recheck: data });
        }

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

      if (action === "recovery-claim") {
        const limit = Math.min(Number(body.limit ?? 25), 100);
        const workerId = body.worker_id ?? "unknown-worker";
        logWorkerEvent("recovery-claim:start", { worker_id: workerId, limit });
        const { data, error } = await admin.rpc("claim_recovery_batch", {
          _worker_id: workerId, _limit: limit,
        });
        if (error) throw error;
        logWorkerEvent("recovery-claim:done", { worker_id: workerId, claimed: data?.length ?? 0 });
        return json({ batch: data ?? [] });
      }

      if (action === "recovery-submit") {
        const r = body || {};
        if (!r.recovery_id) return json({ error: "recovery_id required" }, 400);
        logWorkerEvent("recovery-submit:start", {
          recovery_id: r.recovery_id, status: r.status, smtp_code: r.smtp_code ?? null,
        });
        const { data, error } = await admin.rpc("complete_recovery", {
          _id: r.recovery_id,
          _status: r.status ?? "unknown",
          _smtp_code: r.smtp_code ?? null,
          _smtp_text: r.smtp_text ?? r.smtp_response ?? null,
          _latency: r.latency_ms ?? null,
          _banner: r.banner ?? null,
          _mx_host: r.mx_host ?? null,
          _helo_used: r.helo_used ?? null,
          _tls_used: r.tls_used ?? null,
          _disconnect_reason: r.disconnect_reason ?? null,
        });
        if (error) throw error;
        logWorkerEvent("recovery-submit:done", { recovery_id: r.recovery_id, plan: data });
        return json({ ok: true, plan: data });
      }
    }

    // Public-ish metrics for ops dashboard (auth user)
    if (action === "recovery-metrics") {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: authErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
      const { data, error } = await admin.rpc("recovery_metrics");
      if (error) throw error;
      return json({ metrics: data ?? {} });
    }
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
      const { count: pendingRechecks } = await admin
        .from("verification_results")
        .select("id", { count: "exact", head: true })
        .eq("recheck_required", true);
      return json({
        adapter_configured: WORKER_SECRET.length > 0,
        pending_results: pending ?? 0,
        pending_rechecks: pendingRechecks ?? 0,
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
