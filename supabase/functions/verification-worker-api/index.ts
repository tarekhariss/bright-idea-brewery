// External email verification engine API
// The open-source verifier (AfterShip email-verifier, truemail-go, etc.) calls
// this function with the VERIFICATION_WORKER_SECRET header to claim batches and
// post results. End-user routes (job status) authenticate via JWT.

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() || "";

  try {
    // Worker-authenticated actions
    if (["claim", "submit", "retry", "bounce"].includes(action)) {
      if (!WORKER_SECRET || req.headers.get("x-worker-secret") !== WORKER_SECRET) {
        return json({ error: "Worker secret required" }, 401);
      }
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

      if (action === "claim") {
        const limit = Math.min(Number(body.limit ?? 50), 200);
        const { data, error } = await admin.rpc("claim_verification_batch", {
          _limit: limit,
        });
        if (error) throw error;
        return json({ batch: data ?? [] });
      }

      if (action === "submit") {
        const r = body || {};
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
    }

    // Health for the dashboard
    if (action === "health") {
      const { data: pending } = await admin
        .from("verification_results")
        .select("id", { count: "exact", head: true })
        .is("verified_at", null)
        .eq("from_cache", false);
      const adapterConfigured = WORKER_SECRET.length > 0;
      return json({
        adapter_configured: adapterConfigured,
        pending_results: pending ?? 0,
      });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (e: any) {
    console.error("verification-worker-api error", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
