// Phase 1A — Email Verification Memory ingestion.
// Accepts a batch of verification rows (parsed client-side from CSV),
// normalizes emails, maps provider statuses → canonical, and inserts into
// email_status_history. Backward-matching of existing contacts and forward-
// matching for future contacts is handled by DB triggers + the
// recompute_email_status_projection function.
//
// Safety:
//   - never creates or deletes contacts
//   - never overwrites contact rows directly (projection only)
//   - precedence/staleness rules live in the DB function, so old uploads
//     cannot beat newer/stronger evidence
//   - idempotent: same (workspace_id, normalized_email, provider, verified_at,
//     provider_status) is deduped via a content fingerprint

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Row = Record<string, unknown>;

interface Payload {
  workspace_id: string;
  provider: string;                          // "emaillistverify" | "zerobounce" | "generic" | etc.
  source_label?: string;                     // e.g. file name
  upload_token?: string;                     // client-generated, used for idempotency across chunks
  rows: Row[];
  column_mapping: {                          // canonical key → source column name
    email: string;
    status?: string;
    verified_at?: string;
    reason?: string;
    smtp_code?: string;
    mx?: string;
    domain?: string;
    catch_all?: string;
    disposable?: string;
    role_based?: string;
    free_email?: string;
  };
  preserve_columns?: string[];               // extra source columns to keep in raw_payload
  is_final_chunk?: boolean;
}

const FLAG_KEYS = [
  "is_role_based","is_disposable","is_free_email","is_catch_all",
  "is_syntax_invalid","is_mx_missing","is_temporary_failure",
] as const;

type Flags = Record<typeof FLAG_KEYS[number], boolean>;

function emptyFlags(): Flags {
  return {
    is_role_based: false, is_disposable: false, is_free_email: false,
    is_catch_all: false, is_syntax_invalid: false, is_mx_missing: false,
    is_temporary_failure: false,
  };
}

function normalizeEmail(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // very lenient — only reject obvious non-emails (no @)
  if (!s.includes("@")) return null;
  return s;
}

function parseBool(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).toLowerCase().trim();
  return ["true","1","yes","y","t"].includes(s);
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const n = Number(s);
  if (Number.isFinite(n) && n > 25000 && n < 80000) {
    const ms = (n - 25569) * 86400 * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function getCol(row: Row, col: string | undefined): unknown {
  if (!col) return undefined;
  const v = row[col];
  return v === "" || v === undefined ? undefined : v;
}

function applyFlagOverrides(flags: Flags, row: Row, mapping: Payload["column_mapping"]) {
  const d = getCol(row, mapping.disposable);
  const r = getCol(row, mapping.role_based);
  const f = getCol(row, mapping.free_email);
  const c = getCol(row, mapping.catch_all);
  if (d !== undefined) flags.is_disposable = flags.is_disposable || parseBool(d);
  if (r !== undefined) flags.is_role_based = flags.is_role_based || parseBool(r);
  if (f !== undefined) flags.is_free_email = flags.is_free_email || parseBool(f);
  if (c !== undefined) flags.is_catch_all  = flags.is_catch_all  || parseBool(c);
}

async function loadStatusMap(supa: any, workspaceId: string, provider: string) {
  const { data, error } = await supa
    .from("verification_status_map")
    .select("provider, provider_status, canonical_status, is_role_based, is_disposable, is_free_email, is_catch_all, is_syntax_invalid, is_mx_missing, is_temporary_failure, is_global, workspace_id")
    .or(`provider.eq.${provider},provider.eq.generic`)
    .or(`is_global.eq.true,workspace_id.eq.${workspaceId}`);
  if (error) throw error;
  // workspace overrides > global; provider match > generic
  const map = new Map<string, any>();
  const put = (rec: any) => {
    const key = `${rec.provider}::${String(rec.provider_status).toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, rec); return; }
    // prefer workspace-specific
    if (existing.is_global && !rec.is_global) map.set(key, rec);
  };
  (data ?? []).forEach(put);
  return map;
}

function resolveCanonical(statusMap: Map<string, any>, provider: string, providerStatus: string | null) {
  const flags = emptyFlags();
  if (!providerStatus) return { canonical: "unverified", flags };
  const norm = providerStatus.toLowerCase().trim().replace(/\s+/g, "_");
  const hit = statusMap.get(`${provider}::${norm}`) || statusMap.get(`generic::${norm}`);
  if (!hit) return { canonical: "unknown", flags };
  for (const k of FLAG_KEYS) flags[k] = !!hit[k];
  return { canonical: hit.canonical_status as string, flags };
}

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at < 0 ? null : email.slice(at + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userRes.user.id;

    const body = (await req.json()) as Payload;
    if (!body?.workspace_id || !Array.isArray(body.rows) || !body.column_mapping?.email) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.rows.length > 5000) {
      return new Response(JSON.stringify({ error: "chunk_too_large", max: 5000 }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // membership + feature flag check
    const { data: member } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", body.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: ws } = await admin
      .from("workspaces").select("intelligence_v2").eq("id", body.workspace_id).maybeSingle();
    if (!ws?.intelligence_v2) {
      return new Response(JSON.stringify({ error: "feature_disabled", hint: "Enable intelligence_v2 on workspace" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const provider = (body.provider || "generic").toLowerCase();
    const statusMap = await loadStatusMap(admin, body.workspace_id, provider);
    const mapping = body.column_mapping;
    const preserve = new Set(body.preserve_columns ?? []);
    const sourceLabel = body.source_label ?? "manual_upload";
    const uploadToken = body.upload_token ?? crypto.randomUUID();

    const counters = {
      total: body.rows.length,
      inserted: 0,
      skipped_invalid_email: 0,
      duplicates: 0,
      by_status: {} as Record<string, number>,
      modifiers: { role_based: 0, disposable: 0, free_email: 0, catch_all: 0 },
      matched_existing_contacts: 0,
      stored_for_future: 0,
    };

    // Build canonical rows
    const prepared: any[] = [];
    const seenInChunk = new Set<string>();
    for (const row of body.rows) {
      const email = normalizeEmail(getCol(row, mapping.email));
      if (!email) { counters.skipped_invalid_email++; continue; }
      const providerStatusRaw = getCol(row, mapping.status);
      const providerStatus = providerStatusRaw === undefined ? null : String(providerStatusRaw);
      const { canonical, flags } = resolveCanonical(statusMap, provider, providerStatus);
      applyFlagOverrides(flags, row, mapping);

      const verifiedAt = parseDate(getCol(row, mapping.verified_at)) ?? new Date().toISOString();
      const reason = getCol(row, mapping.reason); const smtp = getCol(row, mapping.smtp_code);
      const mx = getCol(row, mapping.mx); const domainCol = getCol(row, mapping.domain);

      // Preserve raw payload (unknown columns kept verbatim)
      const raw: Record<string, unknown> = {};
      const keep = new Set<string>([
        mapping.email, mapping.status, mapping.verified_at, mapping.reason,
        mapping.smtp_code, mapping.mx, mapping.domain, mapping.catch_all,
        mapping.disposable, mapping.role_based, mapping.free_email,
      ].filter(Boolean) as string[]);
      for (const [k, v] of Object.entries(row)) {
        if (v === "" || v === null || v === undefined) continue;
        if (keep.has(k) || preserve.has(k) || preserve.size === 0) raw[k] = v;
      }

      // idempotency fingerprint inside this upload + within recent rows
      const fp = `${email}|${provider}|${providerStatus ?? ""}|${verifiedAt}`;
      if (seenInChunk.has(fp)) { counters.duplicates++; continue; }
      seenInChunk.add(fp);

      prepared.push({
        workspace_id: body.workspace_id,
        normalized_email: email,
        canonical_status: canonical,
        ...flags,
        provider,
        provider_status: providerStatus,
        source: sourceLabel.startsWith("internal:") ? sourceLabel : `historical_upload:${uploadToken}`,
        verified_at: verifiedAt,
        smtp_code: smtp ? String(smtp) : null,
        reason: reason ? String(reason) : null,
        mx_record: mx ? String(mx) : null,
        domain: domainCol ? String(domainCol).toLowerCase() : domainOf(email),
        raw_payload: raw,
        created_by: userId,
      });

      counters.by_status[canonical] = (counters.by_status[canonical] ?? 0) + 1;
      if (flags.is_role_based) counters.modifiers.role_based++;
      if (flags.is_disposable) counters.modifiers.disposable++;
      if (flags.is_free_email) counters.modifiers.free_email++;
      if (flags.is_catch_all)  counters.modifiers.catch_all++;
    }

    // Cross-row idempotency: check existing history fingerprints in DB for this upload_token
    if (prepared.length) {
      const emails = Array.from(new Set(prepared.map(p => p.normalized_email)));
      const { data: existing } = await admin
        .from("email_status_history")
        .select("normalized_email, provider, provider_status, verified_at, source")
        .eq("workspace_id", body.workspace_id)
        .in("normalized_email", emails);
      const existingSet = new Set<string>();
      (existing ?? []).forEach((e: any) => {
        existingSet.add(`${e.normalized_email}|${e.provider}|${e.provider_status ?? ""}|${new Date(e.verified_at).toISOString()}`);
      });
      const toInsert = prepared.filter(p => {
        const fp = `${p.normalized_email}|${p.provider}|${p.provider_status ?? ""}|${new Date(p.verified_at).toISOString()}`;
        if (existingSet.has(fp)) { counters.duplicates++; return false; }
        return true;
      });

      if (toInsert.length) {
        // insert in batches of 500
        for (let i = 0; i < toInsert.length; i += 500) {
          const chunk = toInsert.slice(i, i + 500);
          const { error } = await admin.from("email_status_history").insert(chunk);
          if (error) throw error;
          counters.inserted += chunk.length;
        }
      }

      // backward matching report — how many emails already exist as contacts
      const { count: matched } = await admin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", body.workspace_id)
        .in("email_normalized", emails);
      counters.matched_existing_contacts = matched ?? 0;
      counters.stored_for_future = emails.length - (matched ?? 0);
    }

    return new Response(JSON.stringify({ ok: true, upload_token: uploadToken, counters }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ingest-verification-upload error", err);
    return new Response(JSON.stringify({ error: "internal_error", message: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
