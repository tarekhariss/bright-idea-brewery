// Historical verification dataset importer.
// Accepts a payload of rows (already parsed client-side) and column mapping.
// Populates email_history, verification_events, domain_intelligence,
// provider_behavior, bounce_intelligence — marked as historical / imported_legacy.
// Never marks records as live truth; freshness/decay logic decides campaign safety.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Row = Record<string, string | number | boolean | null | undefined>;

interface Payload {
  import_id: string;
  workspace_id: string;
  rows: Row[];
  column_mapping: Record<string, string>; // canonical -> source column name
  source_label?: string;
}

const STATUS_MAP: Record<string, string> = {
  ok: "valid", valid: "valid", deliverable: "valid", good: "valid",
  ok_for_all: "valid", "ok for all": "valid",
  invalid: "invalid", bad: "invalid", undeliverable: "invalid",
  invalid_syntax: "invalid", invalid_mx: "invalid",
  dead_server: "invalid", email_disabled: "invalid",
  disposable: "disposable",
  catch_all: "catch_all", "catch-all": "catch_all", accept_all: "catch_all",
  role_based: "role_based", role: "role_based",
  spamtrap: "risky", risky: "risky",
  antispam_system: "risky", smtp_protocol: "risky",
  greylisted: "unknown", temporary_failure: "unknown",
  unknown: "unknown", "unknown - timeout": "unknown",
  provider_blocked: "risky", suppressed: "suppressed",
};

function normStatus(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  return STATUS_MAP[s] ?? (["valid","invalid","risky","catch_all","unknown","disposable","role_based","suppressed","failed"].includes(s) ? s : null);
}

function pick(row: Row, mapping: Record<string,string>, key: string): any {
  const src = mapping[key];
  if (!src) return null;
  const v = row[src];
  return v === "" || v === undefined ? null : v;
}

function parseBool(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase().trim();
  if (["true","1","yes","y","t"].includes(s)) return true;
  if (["false","0","no","n","f",""].includes(s)) return false;
  return null;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function inferProvider(domain: string | null, mx: any): string {
  const d = (domain ?? "").toLowerCase();
  const m = String(mx ?? "").toLowerCase();
  if (m.includes("google") || d === "gmail.com" || d.endsWith(".gmail.com")) return "google";
  if (m.includes("outlook") || m.includes("microsoft") || ["outlook.com","hotmail.com","live.com","msn.com"].includes(d)) return "microsoft";
  if (m.includes("yahoo") || d.endsWith("yahoo.com")) return "yahoo";
  if (m.includes("zoho")) return "zoho";
  if (m.includes("protonmail") || m.includes("proton.me")) return "proton";
  if (m.includes("yandex")) return "yandex";
  if (m.includes("mimecast")) return "mimecast";
  if (m.includes("proofpoint")) return "proofpoint";
  return "custom";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as Payload;
    if (!body?.import_id || !body?.workspace_id || !Array.isArray(body.rows)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supa.from("historical_imports").update({
      status: "processing", started_at: new Date().toISOString(),
    }).eq("id", body.import_id);

    let processed = 0; let failed = 0;
    const mapping = body.column_mapping;
    const providerCounts = new Map<string, { total: number; bounces: number; catch_all: number }>();
    const domainCounts = new Map<string, { seen: number; provider: string }>();
    const ehRows: any[] = [];
    const evRows: any[] = [];

    for (const row of body.rows) {
      try {
        const email = String(pick(row, mapping, "email") ?? "").toLowerCase().trim();
        if (!email || !email.includes("@")) { failed++; continue; }
        const domain = email.split("@")[1] ?? null;
        const status = normStatus(pick(row, mapping, "status") ?? pick(row, mapping, "result"));
        const confidenceRaw = pick(row, mapping, "confidence");
        const confidence = confidenceRaw === null ? null : Number(confidenceRaw);
        const lastVerifiedAt = parseDate(pick(row, mapping, "date"));
        const provider = String(pick(row, mapping, "provider") ?? inferProvider(domain, pick(row, mapping, "mx")));
        const isDisposable = parseBool(pick(row, mapping, "disposable"));
        const isRole = parseBool(pick(row, mapping, "role_based"));
        const isCatchAll = parseBool(pick(row, mapping, "catch_all"));
        const bounce = parseBool(pick(row, mapping, "bounce"));

        ehRows.push({
          workspace_id: body.workspace_id,
          email_normalized: email,
          domain, provider_type: provider,
          historical_status: status,
          current_status: status,
          is_disposable: isDisposable, is_role_based: isRole, is_catch_all: isCatchAll,
          last_verified_at: lastVerifiedAt,
          last_bounce_at: bounce ? lastVerifiedAt : null,
          verification_count: 1,
          bounce_count: bounce ? 1 : 0,
          verification_source: "imported_legacy",
          metadata: { source: body.source_label ?? "import", reason: pick(row, mapping, "reason") ?? null },
        });

        evRows.push({
          workspace_id: body.workspace_id,
          email_normalized: email,
          event_type: "verified",
          status,
          source: "imported_legacy",
          smtp_response: pick(row, mapping, "smtp_response"),
          provider_type: provider,
          details: { import_id: body.import_id, raw_status: pick(row, mapping, "status"), reason: pick(row, mapping, "reason") },
        });

        const pc = providerCounts.get(provider) ?? { total: 0, bounces: 0, catch_all: 0 };
        pc.total++; if (bounce) pc.bounces++; if (isCatchAll) pc.catch_all++;
        providerCounts.set(provider, pc);

        if (domain) {
          const dc = domainCounts.get(domain) ?? { seen: 0, provider };
          dc.seen++; domainCounts.set(domain, dc);
        }
        processed++;
      } catch (e) {
        failed++;
      }
    }

    // Bulk insert in chunks
    const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length/n) }, (_, i) => arr.slice(i*n, i*n+n));

    for (const c of chunk(ehRows, 500)) {
      await supa.from("email_history").upsert(c, { onConflict: "workspace_id,email_normalized", ignoreDuplicates: false });
    }
    for (const c of chunk(evRows, 1000)) {
      await supa.from("verification_events").insert(c);
    }

    // Provider behavior aggregation
    for (const [provider, c] of providerCounts) {
      await supa.from("provider_behavior").upsert({
        provider_type: provider,
        total_verifications: c.total,
        bounces: c.bounces,
        catch_all_count: c.catch_all,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "provider_type" });
    }

    // Domain intelligence aggregation
    const diRows = Array.from(domainCounts.entries()).map(([domain, c]) => ({
      domain, provider_type: c.provider, total_emails_seen: c.seen,
      last_seen_at: new Date().toISOString(),
    }));
    for (const c of chunk(diRows, 500)) {
      await supa.from("domain_intelligence").upsert(c, { onConflict: "domain" });
    }

    await supa.from("historical_imports").update({
      status: failed === 0 ? "completed" : (processed > 0 ? "partial" : "failed"),
      processed_count: processed, failed_count: failed,
      row_count: body.rows.length,
      completed_at: new Date().toISOString(),
    }).eq("id", body.import_id);

    return new Response(JSON.stringify({ ok: true, processed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
