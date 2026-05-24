// Export verification results with Intelligence Engine filtering.
// Modes: safe_to_send | recommended | simplified | all | custom
// Output: CSV (default) or XLSX. Always preserves all original uploaded
// columns and order, with intelligence columns prepended at the beginning.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

// --- intelligence columns prepended to every export ---
const INTEL_COLUMNS = [
  "status",
  "confidence_score",
  "deliverability_score",
  "risk_level",
  "freshness_label",
  "verification_date",
  "last_verified_at",
  "domain_reputation",
  "recheck_required",
  "bounce_risk",
  "provider_type",
  "mx_status",
  "smtp_result",
  "historical_status",
  "verification_reason",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function intelRow(r: any) {
  return {
    status: r.status,
    confidence_score: r.confidence,
    deliverability_score: r.deliverability_score,
    risk_level: r.risk_level,
    freshness_label: r.freshness_label,
    verification_date: r.verified_at,
    last_verified_at: r.last_verified_at,
    domain_reputation: r.domain_reputation_score,
    recheck_required: r.recheck_required,
    bounce_risk: r.bounce_risk_score,
    provider_type: r.provider_type ?? r.mx_provider,
    mx_status: r.mx_status,
    smtp_result: r.smtp_result ?? r.smtp_response,
    historical_status: r.historical_status,
    verification_reason: r.verification_reason ?? r.error_message,
  };
}

function buildQuery(jobId: string, mode: Mode, custom: CustomFilters) {
  let q = admin
    .from("verification_results")
    .select(
      "email,email_normalized,domain,status,confidence,deliverability_score,bounce_risk_score,risk_level,freshness_label,catch_all_probability,is_disposable,is_role_based,is_catch_all,is_free_provider,mx_provider,mx_status,provider_type,provider_reputation_score,domain_reputation_score,last_verified_at,verified_at,smtp_response,smtp_result,smtp_code,recheck_required,historical_status,verification_reason,error_message",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(200000);

  switch (mode) {
    case "safe_to_send":
      q = q.gte("deliverability_score", 75).lte("bounce_risk_score", 25)
        .in("risk_level", ["low"]).in("freshness_label", ["fresh", "reverified"])
        .eq("recheck_required", false).eq("is_disposable", false);
      break;
    case "recommended":
      q = q.gte("deliverability_score", 60).lte("bounce_risk_score", 50)
        .in("risk_level", ["low", "medium"]).eq("is_disposable", false);
      break;
    case "simplified":
      q = q.in("status", ["valid", "ok", "catch_all", "ok_for_all"]);
      break;
    case "all": break;
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

// --- Minimal robust CSV parser (RFC 4180-ish) ---
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const headers = rows.shift() ?? [];
  const out = rows.filter((r) => r.length && r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { headers, rows: out };
}

function findEmailColumn(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  const exact = lower.findIndex((h) => h === "email" || h === "email_address" || h === "e-mail");
  if (exact >= 0) return headers[exact];
  const partial = lower.findIndex((h) => h.includes("email") || h.includes("e-mail"));
  return partial >= 0 ? headers[partial] : null;
}

async function loadSourceCsv(filePath: string | null): Promise<{ headers: string[]; rows: Record<string, string>[]; emailKey: string | null } | null> {
  if (!filePath) return null;
  try {
    const { data, error } = await admin.storage.from("verification-uploads").download(filePath);
    if (error || !data) return null;
    const text = await data.text();
    const { headers, rows } = parseCsv(text);
    const emailKey = findEmailColumn(headers);
    return { headers, rows, emailKey };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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
    const format = (body.format ?? url.searchParams.get("format") ?? "csv") as "csv" | "xlsx" | "json";
    const custom: CustomFilters = body.custom ?? {};
    const preserveOriginal = body.preserve_original_columns !== false;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await admin
      .from("verification_jobs")
      .select("id,workspace_id,source_file_name,source_file_path,source_columns")
      .eq("id", jobId).maybeSingle();
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

    // Try to load original CSV to merge columns. If unavailable, just emit intel + email.
    const source = preserveOriginal ? await loadSourceCsv(job.source_file_path) : null;

    // Build records: intel columns first, then original columns in original order.
    let originalHeaders: string[] = [];
    let originalByEmail = new Map<string, Record<string, string>>();
    if (source && source.emailKey) {
      originalHeaders = source.headers;
      for (const row of source.rows) {
        const email = (row[source.emailKey] ?? "").trim().toLowerCase();
        if (email) originalByEmail.set(email, row);
      }
    }

    const records = (rows ?? []).map((r) => {
      const intel = intelRow(r);
      const orig = originalByEmail.get((r.email_normalized || r.email || "").toLowerCase()) ?? {};
      const merged: Record<string, any> = { ...intel };
      // ensure original email column is present even if no source CSV
      if (!originalHeaders.length) merged.email = r.email;
      for (const h of originalHeaders) merged[h] = orig[h] ?? "";
      return merged;
    });

    const finalHeaders: string[] = [
      ...INTEL_COLUMNS,
      ...(originalHeaders.length ? originalHeaders : ["email"]),
    ];

    if (format === "json") {
      return new Response(JSON.stringify({ rows: records, count: records.length, mode, headers: finalHeaders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(records, { header: finalHeaders });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const filename = `verification_${mode}_${jobId.slice(0, 8)}.xlsx`;
      return new Response(out, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV (default)
    const headerLine = finalHeaders.map(csvEscape).join(",");
    const lines = records.map((rec) => finalHeaders.map((h) => csvEscape(rec[h])).join(","));
    const csv = [headerLine, ...lines].join("\n");
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
