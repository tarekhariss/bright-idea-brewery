// Export verification results preserving the user's original uploaded CSV/XLSX
// EXACTLY (same columns, same order, no dropped rows). Always prepends a single
// `verification_status` column as the FIRST column. Optionally appends extra
// intelligence columns at the end.
//
// Filters operate on ROWS, never on COLUMNS — original structure is preserved.

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

type Mode = "safe_to_send" | "recommended" | "all" | "custom";
type Fmt = "csv" | "xlsx" | "json";

interface CustomFilters {
  min_deliverability?: number;
  max_bounce_risk?: number;
  statuses?: string[];
  risk_levels?: string[];
  freshness?: string[];
  exclude_catch_all?: boolean;
  exclude_role_based?: boolean;
}

// Intelligence columns appended AT THE END (after original columns).
const INTEL_COLUMNS = [
  "confidence_score",
  "deliverability_score",
  "bounce_risk",
  "provider_detected",
  "freshness_state",
  "last_verified_at",
  "verification_reason",
  "unknown_subclass",
  "safe_to_send_score",
] as const;

// Map internal status -> human-friendly label (FIRST column).
function statusLabel(r: any): string {
  if (!r) return "Unknown";
  const s = String(r.status ?? "").toLowerCase();
  const subs = String(r.unknown_subclass ?? "").toLowerCase();
  const reason = String(r.verification_reason ?? r.error_message ?? "").toLowerCase();
  if (s === "valid" || s === "safe" || s === "ok") {
    if (r.is_catch_all) return "OK for All";
    return "OK";
  }
  if (s === "invalid") {
    if (reason.includes("disabled") || subs.includes("disabled")) return "Email Disabled";
    if (reason.includes("disposable")) return "Disposable";
    if (reason.includes("spamtrap")) return "Spamtrap";
    if (reason.includes("dead")) return "Dead Server";
    if (reason.includes("mx")) return "Invalid MX";
    return "Invalid";
  }
  if (s === "disposable") return "Disposable";
  if (s === "role_based") return "Role-based";
  if (s === "catch_all") return "Catch-all";
  if (s === "risky") {
    if (reason.includes("spamtrap")) return "Spamtrap";
    return "Risky";
  }
  if (s === "suppressed") return "Suppressed";
  if (s === "failed") return "Failed";
  return "Unknown";
}

function intelValues(r: any): Record<string, any> {
  if (!r) return {};
  return {
    confidence_score: r.confidence ?? "",
    deliverability_score: r.deliverability_score ?? "",
    bounce_risk: r.bounce_risk_score ?? "",
    provider_detected: r.provider_detected ?? r.provider_type ?? r.mx_provider ?? "",
    freshness_state: r.freshness_label ?? "",
    last_verified_at: r.last_verified_at ?? r.verified_at ?? "",
    verification_reason: r.verification_reason ?? r.error_message ?? "",
    unknown_subclass: r.unknown_subclass ?? "",
    safe_to_send_score: r.safe_to_send_score ?? "",
  };
}

function passesFilter(r: any, mode: Mode, custom: CustomFilters): boolean {
  if (mode === "all") return true;
  if (!r) return mode === "all";
  const dv = Number(r.deliverability_score ?? 0);
  const br = Number(r.bounce_risk_score ?? 100);
  switch (mode) {
    case "safe_to_send":
      return (
        dv >= 75 && br <= 25 &&
        r.risk_level === "low" &&
        ["fresh", "reverified"].includes(String(r.freshness_label ?? "")) &&
        r.recheck_required !== true && r.is_disposable !== true
      );
    case "recommended":
      return dv >= 60 && br <= 50 &&
        ["low", "medium"].includes(String(r.risk_level ?? "")) && r.is_disposable !== true;
    case "custom": {
      if (custom.min_deliverability != null && dv < custom.min_deliverability) return false;
      if (custom.max_bounce_risk != null && br > custom.max_bounce_risk) return false;
      if (custom.statuses?.length && !custom.statuses.includes(String(r.status))) return false;
      if (custom.risk_levels?.length && !custom.risk_levels.includes(String(r.risk_level))) return false;
      if (custom.freshness?.length && !custom.freshness.includes(String(r.freshness_label))) return false;
      if (custom.exclude_catch_all && r.is_catch_all) return false;
      if (custom.exclude_role_based && r.is_role_based) return false;
      return true;
    }
  }
  return true;
}

// RFC 4180 CSV parser
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
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
  return { headers, rows };
}

function findEmailIdx(headers: string[]): number {
  const lower = headers.map((h) => String(h ?? "").toLowerCase().trim());
  const exact = lower.findIndex((h) => h === "email" || h === "email_address" || h === "e-mail");
  if (exact >= 0) return exact;
  return lower.findIndex((h) => h.includes("email") || h.includes("e-mail"));
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function loadSource(filePath: string | null): Promise<
  { headers: string[]; rows: string[][]; emailIdx: number } | null
> {
  if (!filePath) return null;
  try {
    const { data, error } = await admin.storage.from("verification-uploads").download(filePath);
    if (error || !data) return null;
    const isXlsx = /\.xlsx?$/i.test(filePath);
    if (isXlsx) {
      const buf = new Uint8Array(await data.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as any[][];
      const headers = (aoa.shift() ?? []).map((h) => String(h ?? ""));
      const rows = aoa.map((r) => headers.map((_, i) => String(r[i] ?? "")));
      return { headers, rows, emailIdx: findEmailIdx(headers) };
    }
    const text = await data.text();
    const { headers, rows } = parseCsv(text);
    return { headers, rows, emailIdx: findEmailIdx(headers) };
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
    const { data: ud, error: authErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !ud?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = ud.user.id;

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const jobId: string | null = body.job_id ?? url.searchParams.get("job_id");
    const mode = (body.mode ?? url.searchParams.get("mode") ?? "all") as Mode;
    const format = (body.format ?? url.searchParams.get("format") ?? "csv") as Fmt;
    const includeIntel = body.include_intelligence !== false;
    const custom: CustomFilters = body.custom ?? {};

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job } = await admin
      .from("verification_jobs")
      .select("id,workspace_id,name,source_file_name,source_file_path,uploaded_file_path,original_columns_json,source_columns")
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

    // Load ALL results for this job (paginate; supabase caps at 1000/call).
    const allResults: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await admin
        .from("verification_results")
        .select(
          "email,email_normalized,status,confidence,deliverability_score,bounce_risk_score,risk_level,freshness_label,is_disposable,is_role_based,is_catch_all,is_free_provider,mx_provider,provider_type,provider_detected,last_verified_at,verified_at,smtp_response,smtp_code,recheck_required,unknown_subclass,verification_reason,error_message,historical_status",
        )
        .eq("job_id", jobId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = data ?? [];
      allResults.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }

    // Index by normalized email
    const resByEmail = new Map<string, any>();
    for (const r of allResults) {
      const k = String(r.email_normalized ?? r.email ?? "").toLowerCase().trim();
      if (k) resByEmail.set(k, r);
    }

    // Build records: ALWAYS preserve every original uploaded row, in order.
    const source = await loadSource(job.uploaded_file_path ?? job.source_file_path ?? null);

    const originalHeaders: string[] = source?.headers
      ?? (Array.isArray(job.original_columns_json) && job.original_columns_json.length
            ? (job.original_columns_json as string[])
            : (Array.isArray(job.source_columns) ? (job.source_columns as string[]) : []));

    const finalHeaders: string[] = ["verification_status", ...originalHeaders];
    if (!originalHeaders.length) finalHeaders.push("email"); // minimum guarantee
    if (includeIntel) finalHeaders.push(...INTEL_COLUMNS);

    type Row = (string | number | null)[];
    const aoa: Row[] = [finalHeaders];

    if (source && source.rows.length) {
      const emailIdx = source.emailIdx;
      for (const orig of source.rows) {
        // Skip blank lines
        if (!orig.some((v) => String(v ?? "").trim() !== "")) continue;
        const emailRaw = emailIdx >= 0 ? String(orig[emailIdx] ?? "") : "";
        const key = emailRaw.toLowerCase().trim();
        const r = key ? resByEmail.get(key) : null;
        if (!passesFilter(r, mode, custom)) continue;
        const row: Row = [statusLabel(r)];
        for (let i = 0; i < originalHeaders.length; i++) row.push(orig[i] ?? "");
        if (includeIntel) {
          const iv = intelValues(r);
          for (const k of INTEL_COLUMNS) row.push(iv[k] ?? "");
        }
        aoa.push(row);
      }
    } else {
      // Fallback: no source file — emit results directly. Email column only.
      for (const r of allResults) {
        if (!passesFilter(r, mode, custom)) continue;
        const row: Row = [statusLabel(r), r.email ?? r.email_normalized ?? ""];
        if (includeIntel) {
          const iv = intelValues(r);
          for (const k of INTEL_COLUMNS) row.push(iv[k] ?? "");
        }
        aoa.push(row);
      }
    }

    const safeName = (job.name ?? job.source_file_name ?? `verification_${jobId.slice(0, 8)}`)
      .replace(/[^a-z0-9_\-\.]+/gi, "_");
    const baseName = `${safeName}_${mode}`;

    if (format === "json") {
      const [hdr, ...rest] = aoa;
      const jsonRows = rest.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ""])));
      return new Response(JSON.stringify({ rows: jsonRows, count: jsonRows.length, headers: hdr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (format === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      return new Response(out, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    // CSV (default)
    const csv = aoa.map((row) => row.map(csvEscape).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  } catch (e: any) {
    console.error("export-verification-results error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
