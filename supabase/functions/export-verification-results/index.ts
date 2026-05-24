// Export verification results with Intelligence Engine filtering.
// Modes: safe_to_send | recommended | simplified | all | custom
// Output: CSV (default) or JSON for previews.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Mode = "safe_to_send" | "recommended" | "simplified" | "all" | "custom";

interface CustomFilters {
  min_deliverability?: number;
  max_bounce_risk?: number;
  statuses?: string[];
  risk_levels?: string[];
  freshness?: string[];
  exclude_catch_all?: boolean;
  exclude_role_based?: boolean;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildQuery(jobId: string, mode: Mode, custom: CustomFilters) {
  let q = admin
    .from("verification_results")
    .select(
      "email,domain,status,confidence,deliverability_score,bounce_risk_score,risk_level,freshness_label,catch_all_probability,is_disposable,is_role_based,is_catch_all,is_free_provider,mx_provider,provider_type,provider_reputation_score,domain_reputation_score,last_verified_at,verified_at,smtp_response,smtp_code,recheck_required",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(50000);

  switch (mode) {
    case "safe_to_send":
      q = q
        .gte("deliverability_score", 75)
        .lte("bounce_risk_score", 25)
        .in("risk_level", ["low"])
        .in("freshness_label", ["fresh", "reverified"])
        .eq("recheck_required", false)
        .eq("is_disposable", false);
      break;
    case "recommended":
      q = q
        .gte("deliverability_score", 60)
        .lte("bounce_risk_score", 50)
        .in("risk_level", ["low", "medium"])
        .eq("is_disposable", false);
      break;
    case "simplified":
      q = q.in("status", ["valid", "ok", "catch_all", "ok_for_all"]);
      break;
    case "all":
      break;
    case "custom":
      if (custom.min_deliverability != null) q = q.gte("deliverability_score", custom.min_deliverability);
      if (custom.max_bounce_risk != null) q = q.lte("bounce_risk_score", custom.max_bounce_risk);
      if (custom.statuses?.length) q = q.in("status", custom.statuses);
      if (custom.risk_levels?.length) q = q.in("risk_level", custom.risk_levels);
      if (custom.freshness?.length) q = q.in("freshness_label", custom.freshness);
      if (custom.exclude_catch_all) q = q.eq("is_catch_all", false);
      if (custom.exclude_role_based) q = q.eq("is_role_based", false);
      break;
  }
  return q;
}

const INTEL_COLUMNS = [
  "email", "domain", "intel_status", "deliverability_score", "confidence",
  "bounce_risk_score", "risk_level", "freshness", "catch_all_probability",
  "is_disposable", "is_role_based", "is_catch_all", "is_free_provider",
  "provider_type", "provider_reputation_score", "domain_reputation_score",
  "mx_provider", "smtp_code", "smtp_response", "last_verified_at",
  "recheck_required", "recommendation",
] as const;

function recommendation(r: any): string {
  if (r.is_disposable) return "do_not_send";
  if (r.risk_level === "critical") return "do_not_send";
  if ((r.bounce_risk_score ?? 0) > 70) return "do_not_send";
  if ((r.deliverability_score ?? 0) >= 75 && r.risk_level === "low") return "safe_to_send";
  if ((r.deliverability_score ?? 0) >= 60) return "send_with_warmed_inbox";
  if (r.recheck_required) return "revalidate";
  return "review";
}

function rowToCsv(r: any): string {
  return INTEL_COLUMNS.map((c) => {
    switch (c) {
      case "intel_status": return csvEscape(r.status);
      case "freshness": return csvEscape(r.freshness_label);
      case "recommendation": return csvEscape(recommendation(r));
      default: return csvEscape((r as any)[c]);
    }
  }).join(",");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: workspace member or platform admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const jobId = body.job_id ?? url.searchParams.get("job_id");
    const mode = (body.mode ?? url.searchParams.get("mode") ?? "recommended") as Mode;
    const format = (body.format ?? url.searchParams.get("format") ?? "csv") as "csv" | "json";
    const custom: CustomFilters = body.custom ?? {};

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: user must be a member of the job's workspace or platform admin
    const { data: job } = await admin
      .from("verification_jobs")
      .select("id,workspace_id,source_file_name")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isMember } = await admin.rpc("is_workspace_member_or_admin", {
      _user_id: userId, _workspace_id: job.workspace_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await buildQuery(jobId, mode, custom);
    if (error) throw error;

    if (format === "json") {
      const enriched = (rows ?? []).map((r) => ({ ...r, recommendation: recommendation(r) }));
      return new Response(JSON.stringify({ rows: enriched, count: enriched.length, mode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const header = INTEL_COLUMNS.join(",");
    const csv = [header, ...(rows ?? []).map(rowToCsv)].join("\n");
    const filename = `verification_${mode}_${jobId.slice(0, 8)}.csv`;

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("export-verification-results error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
