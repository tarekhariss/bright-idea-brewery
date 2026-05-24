// Historical verification dataset importer.
// Ingests EmailListVerify / ZeroBounce / MillionVerifier exports into the
// Historical Intelligence Learning System. Writes to imported_datasets +
// verification_cache (historical_only) + email_history + verification_events,
// then aggregates into domain_intelligence, provider_behavior,
// confidence_learning, smtp_learning, bounce_intelligence so future
// verification decisions can benefit from history without blindly trusting it.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Row = Record<string, string | number | boolean | null | undefined>;

interface Payload {
  dataset_id?: string;             // imported_datasets row, pre-created by client
  import_id?: string;              // legacy: historical_imports id (kept for backward compat)
  workspace_id: string;
  rows: Row[];
  column_mapping: Record<string, string>;
  source_label?: string;
  is_final_chunk?: boolean;        // when true, run aggregation pass
}

const STATUS_MAP: Record<string, string> = {
  ok: "valid", valid: "valid", deliverable: "valid", good: "valid",
  ok_for_all: "valid", "ok for all": "valid", passed: "valid",
  invalid: "invalid", bad: "invalid", undeliverable: "invalid",
  invalid_syntax: "invalid", invalid_mx: "invalid", hardbounce: "invalid",
  hard_bounce: "invalid", dead_server: "invalid", email_disabled: "invalid",
  disposable: "disposable",
  catch_all: "catch_all", "catch-all": "catch_all", accept_all: "catch_all", acceptall: "catch_all",
  role_based: "role_based", role: "role_based", rolebased: "role_based",
  spamtrap: "risky", risky: "risky", "do_not_mail": "risky",
  antispam_system: "risky", smtp_protocol: "risky",
  greylisted: "unknown", temporary_failure: "unknown", softbounce: "unknown",
  soft_bounce: "unknown", unknown: "unknown", "unknown - timeout": "unknown",
  provider_blocked: "risky", suppressed: "suppressed",
};

function normStatus(raw: unknown): string {
  if (raw === null || raw === undefined) return "unknown";
  const s = String(raw).toLowerCase().trim().replace(/\s+/g, "_");
  return STATUS_MAP[s] ??
    (["valid","invalid","risky","catch_all","unknown","disposable","role_based","suppressed","failed"].includes(s) ? s : "unknown");
}

// Granular subtype detection for richer reporting.
function detectSubtype(rawStatus: unknown, reason: unknown, smtp: unknown): string | null {
  const blob = `${rawStatus ?? ""} ${reason ?? ""} ${smtp ?? ""}`.toLowerCase();
  if (/spam[\s_-]?trap|honeypot/.test(blob)) return "spamtrap";
  if (/dead[\s_-]?server|server[\s_-]?down|no[\s_-]?such[\s_-]?host/.test(blob)) return "dead_server";
  if (/invalid[\s_-]?mx|no[\s_-]?mx|mx[\s_-]?missing|mx[\s_-]?error/.test(blob)) return "invalid_mx";
  if (/email[\s_-]?disabled|account[\s_-]?disabled|mailbox[\s_-]?disabled|suspended/.test(blob)) return "email_disabled";
  if (/blocked|denied|reject(ed)?[\s_-]?by[\s_-]?provider|reputation|policy/.test(blob)) return "provider_blocked";
  if (/grey[\s_-]?list|^421|^451|temporary|try[\s_-]?later/.test(blob)) return "greylisted";
  if (/disposable|temp[\s_-]?mail/.test(blob)) return "disposable";
  if (/catch[\s_-]?all|accept[\s_-]?all/.test(blob)) return "catch_all";
  if (/role[\s_-]?based|role[\s_-]?account/.test(blob)) return "role_based";
  return null;
}

function pick(row: Row, mapping: Record<string,string>, key: string): unknown {
  const src = mapping[key];
  if (!src) return null;
  const v = row[src];
  return v === "" || v === undefined ? null : v;
}

function parseBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase().trim();
  if (["true","1","yes","y","t"].includes(s)) return true;
  if (["false","0","no","n","f"].includes(s)) return false;
  return null;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  // Excel sometimes serializes as serial number; handle ISO + common formats
  const s = String(v).trim();
  const n = Number(s);
  if (Number.isFinite(n) && n > 25000 && n < 80000) {
    // Excel serial date (days since 1899-12-30)
    const ms = (n - 25569) * 86400 * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function inferProvider(domain: string | null, mx: unknown): string {
  const d = (domain ?? "").toLowerCase();
  const m = String(mx ?? "").toLowerCase();
  if (m.includes("google") || d === "gmail.com" || d === "googlemail.com" || d.endsWith(".gmail.com")) return "google";
  if (m.includes("outlook") || m.includes("microsoft") || ["outlook.com","hotmail.com","live.com","msn.com"].includes(d)) return "microsoft";
  if (m.includes("yahoo") || d.endsWith("yahoo.com") || d === "ymail.com") return "yahoo";
  if (m.includes("zoho")) return "zoho";
  if (m.includes("protonmail") || m.includes("proton.me")) return "proton";
  if (m.includes("yandex")) return "yandex";
  if (m.includes("mimecast")) return "mimecast";
  if (m.includes("proofpoint")) return "proofpoint";
  return "custom";
}

function ageBucket(days: number | null): "fresh" | "aging" | "stale" | "expired" {
  if (days === null) return "expired";
  if (days < 30) return "fresh";
  if (days < 90) return "aging";
  if (days < 180) return "stale";
  return "expired";
}

function freshnessState(days: number | null): "fresh" | "aging" | "stale" | "expired" {
  return ageBucket(days);
}

// Trust score (0-100): combines status determinism, age decay, confidence.
function computeTrustScore(status: string, ageDays: number | null, confidence: number | null): number {
  const base: Record<string, number> = {
    valid: 80, invalid: 90, disposable: 95, role_based: 85,
    catch_all: 40, risky: 25, unknown: 15, suppressed: 95, failed: 20,
  };
  let score = base[status] ?? 25;
  if (confidence !== null && !isNaN(confidence)) {
    // confidence may be 0-1 or 0-100
    const c = confidence > 1.5 ? confidence : confidence * 100;
    score = (score * 0.6) + (c * 0.4);
  }
  if (ageDays !== null) {
    const decay = Math.min(0.6, ageDays / 365 * 0.5); // up to -60% over a year+
    score = score * (1 - decay);
  } else {
    score = score * 0.5;
  }
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

// Bounce probability (0-1)
function computeBounceProbability(status: string, ageDays: number | null, isCatchAll: boolean | null): number {
  let p: number;
  switch (status) {
    case "invalid": p = 0.95; break;
    case "disposable": p = 0.85; break;
    case "risky": p = 0.55; break;
    case "catch_all": p = 0.35; break;
    case "unknown": p = 0.30; break;
    case "role_based": p = 0.15; break;
    case "valid": p = 0.04; break;
    case "suppressed": p = 0.99; break;
    default: p = 0.25;
  }
  if (isCatchAll && status === "valid") p = Math.max(p, 0.25);
  if (ageDays !== null) {
    // older data → slightly higher bounce probability (decay of confidence)
    const drift = Math.min(0.25, ageDays / 365 * 0.2);
    p = Math.min(0.99, p + drift);
  }
  return Math.round(p * 10000) / 10000;
}

// Safe-to-send score: 0-100, higher = safer to include in a campaign
function computeSafeToSend(status: string, trust: number, bounceProb: number): number {
  if (["invalid","disposable","suppressed","failed"].includes(status)) return 0;
  const raw = Math.max(0, trust * (1 - bounceProb));
  return Math.round(raw * 100) / 100;
}

function safetyTier(safeScore: number, status: string, bounceProb: number): "safe" | "recommended" | "risky" | "unsafe" {
  if (["invalid","disposable","suppressed","failed"].includes(status)) return "unsafe";
  if (safeScore >= 75 && bounceProb < 0.10) return "safe";
  if (safeScore >= 50 && bounceProb < 0.25) return "recommended";
  if (safeScore >= 25) return "risky";
  return "unsafe";
}

function needsRecheck(status: string, ageDays: number | null, confidence: number | null, isCatchAll: boolean | null): boolean {
  if (["unknown","risky","catch_all","failed"].includes(status)) return true;
  if (isCatchAll) return true;
  if (confidence !== null && !isNaN(confidence)) {
    const c = confidence > 1.5 ? confidence : confidence * 100;
    if (c < 60) return true;
  }
  if (ageDays !== null && ageDays >= 180) return true;
  return false;
}

// ---- Prospect seeding helpers ----

const PROSPECT_CANONICAL_KEYS = [
  "first_name","last_name","full_name","company","company_domain","title","job_title",
  "linkedin","phone","country","city","state","industry","website","employee_count",
  "revenue","seniority","department","headline",
];

function guessProspectColumn(rawKeys: string[], target: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\.]/g, "");
  const aliases: Record<string, string[]> = {
    first_name: ["firstname","fname","given","givenname"],
    last_name: ["lastname","lname","surname","familyname"],
    full_name: ["fullname","name","contactname"],
    company: ["company","companyname","organization","organisation","account","employer"],
    company_domain: ["companydomain","companywebsite","corporatedomain"],
    title: ["title","jobtitle","position","role"],
    job_title: ["jobtitle","title","position"],
    linkedin: ["linkedin","linkedinurl","linkedinprofile","li"],
    phone: ["phone","phonenumber","mobile","tel","telephone"],
    country: ["country","countrycode"],
    city: ["city","town"],
    state: ["state","region","province"],
    industry: ["industry","vertical","sector"],
    website: ["website","site","url","homepage"],
    employee_count: ["employeecount","employees","companysize","headcount"],
    revenue: ["revenue","annualrevenue","companyrevenue"],
    seniority: ["seniority","senioritylevel"],
    department: ["department","dept"],
    headline: ["headline","tagline"],
  };
  const candidates = [norm(target), ...(aliases[target] ?? [])];
  for (const k of rawKeys) if (candidates.includes(norm(k))) return k;
  return null;
}

function splitFullName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function preferStronger<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  // Never overwrite stronger/newer data with weaker/older data.
  if (existing !== null && existing !== undefined && existing !== "") return existing;
  return incoming ?? existing ?? null;
}

function isSafeToSeed(status: string, trust: number, bounceProb: number, isCatchAll: boolean | null): boolean {
  if (status !== "valid") return false;
  if (isCatchAll) return false;
  if (trust < 55) return false;
  if (bounceProb > 0.15) return false;
  return true;
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
    if (!body?.workspace_id || !Array.isArray(body.rows)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const datasetId = body.dataset_id ?? null;
    const importId = body.import_id ?? null;

    let autoSeedProspects = true;
    if (datasetId) {
      const { data: ds } = await supa.from("imported_datasets")
        .select("auto_seed_prospects").eq("id", datasetId).maybeSingle();
      autoSeedProspects = ds?.auto_seed_prospects !== false;
      await supa.from("imported_datasets").update({ status: "processing" }).eq("id", datasetId);
    }
    if (importId) {
      await supa.from("historical_imports").update({
        status: "processing", started_at: new Date().toISOString(),
      }).eq("id", importId);
    }

    const mapping = body.column_mapping;
    const datasetTags: string[] = Array.isArray((mapping as any)?._tags) ? (mapping as any)._tags : [];
    const now = Date.now();
    let processed = 0, failed = 0;
    let prospectsCreated = 0, prospectsMerged = 0;

    const cacheRows: any[] = [];
    const ehRows: any[] = [];
    const evRows: any[] = [];

    type ProspectCandidate = {
      email: string; domain: string | null; status: string;
      trust: number; confidence: number | null; bounceProb: number;
      safe: number; tier: string; fresh: string; provider: string;
      lastVerifiedAt: string | null; rawRow: Row;
    };
    const prospectCandidates: ProspectCandidate[] = [];
    const historyRows: any[] = [];

    const providerAgg = new Map<string, { total: number; bounces: number; catch_all: number; valid: number; greylists: number; rejects: number }>();
    const domainAgg = new Map<string, { provider: string; seen: number; valid: number; bounces: number; catch_all: number; unknown: number }>();
    const confidenceAgg = new Map<string, { sample: number; match: number; conf_sum: number }>();
    const smtpAgg = new Map<string, { provider: string; code: number | null; pattern: string | null; count: number }>();
    const bounceAgg = new Map<string, { domain: string; provider: string; code: number | null; category: string }>();

    const stats = { valid: 0, invalid: 0, catch_all: 0, unknown: 0, risky: 0, role_based: 0, disposable: 0, suppressed: 0, failed: 0 };
    const subtypeStats: Record<string, number> = {
      spamtrap: 0, dead_server: 0, invalid_mx: 0, email_disabled: 0,
      provider_blocked: 0, greylisted: 0,
    };
    const tierStats = { safe: 0, recommended: 0, risky: 0, unsafe: 0 };
    const freshStats = { fresh: 0, aging: 0, stale: 0, expired: 0 };
    let safeToSendCount = 0, riskyCount = 0;
    let confSum = 0, confN = 0, bounceSum = 0, bounceN = 0, safeSum = 0, safeN = 0;
    const seenEmailsChunk = new Set<string>();
    let skippedDuplicates = 0;
    const industryTop = new Map<string, number>();
    const countryTop = new Map<string, number>();
    const providerTop = new Map<string, number>();
    const companyTop = new Map<string, number>();
    const riskyDomainTop = new Map<string, number>();
    const safeDomainTop = new Map<string, number>();

    for (const row of body.rows) {
      try {
        const email = String(pick(row, mapping, "email") ?? "").toLowerCase().trim();
        if (!email || !email.includes("@")) { failed++; continue; }
        if (seenEmailsChunk.has(email)) { skippedDuplicates++; continue; }
        seenEmailsChunk.add(email);
        const domain = email.split("@")[1] ?? null;

        const rawStatus = pick(row, mapping, "status") ?? pick(row, mapping, "result");
        const status = normStatus(rawStatus);
        (stats as any)[status] = ((stats as any)[status] ?? 0) + 1;

        const confidenceRaw = pick(row, mapping, "confidence");
        const confidence = confidenceRaw === null ? null : Number(confidenceRaw);
        const lastVerifiedAt = parseDate(pick(row, mapping, "date"));
        const provider = String(pick(row, mapping, "provider") ?? inferProvider(domain, pick(row, mapping, "mx")));
        const isDisposable = parseBool(pick(row, mapping, "disposable"));
        const isRole = parseBool(pick(row, mapping, "role_based"));
        const isCatchAll = parseBool(pick(row, mapping, "catch_all")) ?? (status === "catch_all");
        const bounce = parseBool(pick(row, mapping, "bounce")) ?? (status === "invalid");
        const smtpResponse = pick(row, mapping, "smtp_response") as string | null;
        const reason = pick(row, mapping, "reason");

        const ageDays = lastVerifiedAt ? Math.floor((now - new Date(lastVerifiedAt).getTime()) / 86400000) : null;
        const fresh = freshnessState(ageDays);
        const trust = computeTrustScore(status, ageDays, confidence);
        const bounceProb = computeBounceProbability(status, ageDays, isCatchAll);
        const safe = computeSafeToSend(status, trust, bounceProb);
        const tier = safetyTier(safe, status, bounceProb);
        const recheck = needsRecheck(status, ageDays, confidence, isCatchAll);

        // Granular subtype + tier + freshness + averages + top maps.
        const subtype = detectSubtype(rawStatus, reason, smtpResponse);
        if (subtype) subtypeStats[subtype] = (subtypeStats[subtype] ?? 0) + 1;
        if (isDisposable === true && !subtype) subtypeStats.disposable = (subtypeStats.disposable ?? 0);
        (tierStats as any)[tier]++;
        (freshStats as any)[fresh]++;
        if (tier === "safe" || tier === "recommended") safeToSendCount++;
        if (tier === "risky" || status === "risky") riskyCount++;
        if (confidence !== null && !isNaN(confidence)) {
          const c = confidence > 1.5 ? confidence : confidence * 100;
          confSum += c; confN++;
        }
        bounceSum += bounceProb; bounceN++;
        safeSum += safe; safeN++;

        const industry = String(pick(row, mapping, "industry") ?? "").trim();
        if (industry) industryTop.set(industry, (industryTop.get(industry) ?? 0) + 1);
        const country = String(pick(row, mapping, "country") ?? "").trim();
        if (country) countryTop.set(country, (countryTop.get(country) ?? 0) + 1);
        if (provider) providerTop.set(provider, (providerTop.get(provider) ?? 0) + 1);
        const companyName = String(pick(row, mapping, "company") ?? "").trim();
        if (companyName) companyTop.set(companyName, (companyTop.get(companyName) ?? 0) + 1);
        if (domain) {
          if (bounce || status === "invalid" || status === "risky") {
            riskyDomainTop.set(domain, (riskyDomainTop.get(domain) ?? 0) + 1);
          } else if (status === "valid" && !isCatchAll) {
            safeDomainTop.set(domain, (safeDomainTop.get(domain) ?? 0) + 1);
          }
        }


        cacheRows.push({
          email_normalized: email, domain,
          status,
          confidence: confidence !== null && !isNaN(confidence) ? Math.min(100, confidence > 1.5 ? confidence : confidence * 100) : null,
          is_disposable: isDisposable, is_role_based: isRole, is_catch_all: isCatchAll,
          mx_provider: provider,
          smtp_response: smtpResponse,
          source: "historical_import",
          source_engine: body.source_label ?? "EmailListVerify",
          imported_at: new Date().toISOString(),
          historical_only: true,
          imported_dataset_id: datasetId,
          original_status: pick(row, mapping, "status") ? String(pick(row, mapping, "status")) : null,
          original_reason: reason !== null ? String(reason) : null,
          original_provider: provider,
          original_verification_date: lastVerifiedAt,
          age_in_days: ageDays,
          freshness_state: fresh,
          trust_score: trust,
          recheck_required: recheck,
          last_transition: null,
          safe_to_send_score: safe,
          estimated_bounce_probability: bounceProb,
          campaign_safety_tier: tier,
          verified_at: lastVerifiedAt ?? new Date().toISOString(),
          cached_until: new Date(now + (fresh === "expired" ? 0 : fresh === "stale" ? 7 : fresh === "aging" ? 30 : 60) * 86400000).toISOString(),
          raw_response: { source: body.source_label, reason, original_row_status: pick(row, mapping, "status") },
        });

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
          metadata: { source: body.source_label ?? "EmailListVerify", reason, dataset_id: datasetId, trust, safe, tier },
        });

        evRows.push({
          workspace_id: body.workspace_id,
          email_normalized: email,
          event_type: "verified",
          status,
          source: "imported_legacy",
          smtp_response: smtpResponse,
          provider_type: provider,
          details: { dataset_id: datasetId, import_id: importId, raw_status: pick(row, mapping, "status"), reason, trust, safe, tier },
        });

        // Per-prospect verification history (workspace-scoped longitudinal record).
        historyRows.push({
          workspace_id: body.workspace_id,
          email, domain, status,
          confidence: confidence !== null && !isNaN(confidence)
            ? Math.min(100, confidence > 1.5 ? confidence : confidence * 100) : null,
          trust_score: trust,
          freshness_state: fresh,
          safe_to_send_score: safe,
          estimated_bounce_probability: bounceProb,
          campaign_safety_tier: tier,
          provider,
          source: body.source_label ?? "EmailListVerify",
          dataset_id: datasetId,
          verified_at: lastVerifiedAt,
          raw: { reason, raw_status: pick(row, mapping, "status"), smtp_response: smtpResponse },
        });

        // Queue prospect seeding for safe verified emails.
        if (autoSeedProspects && isSafeToSeed(status, trust, bounceProb, isCatchAll)) {
          prospectCandidates.push({
            email, domain, status, trust, confidence, bounceProb,
            safe, tier, fresh, provider, lastVerifiedAt, rawRow: row,
          });
        }



        const pa = providerAgg.get(provider) ?? { total: 0, bounces: 0, catch_all: 0, valid: 0, greylists: 0, rejects: 0 };
        pa.total++;
        if (bounce) pa.bounces++;
        if (isCatchAll) pa.catch_all++;
        if (status === "valid") pa.valid++;
        if (status === "unknown") pa.greylists++;
        if (status === "invalid") pa.rejects++;
        providerAgg.set(provider, pa);

        if (domain) {
          const da = domainAgg.get(domain) ?? { provider, seen: 0, valid: 0, bounces: 0, catch_all: 0, unknown: 0 };
          da.seen++;
          if (status === "valid") da.valid++;
          if (bounce) da.bounces++;
          if (isCatchAll) da.catch_all++;
          if (status === "unknown") da.unknown++;
          domainAgg.set(domain, da);
        }

        const cKey = `${provider}|${status}|${ageBucket(ageDays)}`;
        const ca = confidenceAgg.get(cKey) ?? { sample: 0, match: 0, conf_sum: 0 };
        ca.sample++;
        if (status === "valid" && !bounce) ca.match++;
        if (confidence !== null && !isNaN(confidence)) ca.conf_sum += (confidence > 1.5 ? confidence : confidence * 100);
        confidenceAgg.set(cKey, ca);

        if (smtpResponse) {
          const code = (() => { const m = /^\s*(\d{3})/.exec(String(smtpResponse)); return m ? parseInt(m[1], 10) : null; })();
          const pattern = String(smtpResponse).slice(0, 64).toLowerCase();
          const sKey = `${provider}|${code ?? 0}|${pattern}`;
          const sa = smtpAgg.get(sKey) ?? { provider, code, pattern, count: 0 };
          sa.count++;
          smtpAgg.set(sKey, sa);

          if (bounce && domain) {
            const cat = code && code >= 500 ? "permanent" : code && code >= 400 ? "transient" : "unknown";
            bounceAgg.set(`${domain}|${provider}|${code ?? 0}|${cat}`, { domain, provider, code, category: cat });
          }
        }

        processed++;
      } catch {
        failed++;
      }
    }

    const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length/n) }, (_, i) => arr.slice(i*n, i*n+n));

    // Cache: upsert per email
    for (const c of chunk(cacheRows, 500)) {
      const { error } = await supa.from("verification_cache").upsert(c, { onConflict: "email_normalized" });
      if (error) console.error("cache upsert", error);
    }
    for (const c of chunk(ehRows, 500)) {
      const { error } = await supa.from("email_history").upsert(c, { onConflict: "workspace_id,email_normalized", ignoreDuplicates: false });
      if (error) console.error("email_history upsert", error);
    }
    for (const c of chunk(evRows, 1000)) {
      const { error } = await supa.from("verification_events").insert(c);
      if (error) console.error("verification_events insert", error);
    }

    // ---- Prospect Search seeding (safe verified emails only) ----
    if (prospectCandidates.length) {
      const rawKeys = Object.keys(prospectCandidates[0].rawRow ?? {});
      const resolveCol = (k: string): string | null =>
        (mapping[k] && rawKeys.includes(mapping[k])) ? mapping[k] : guessProspectColumn(rawKeys, k);
      const colMap: Record<string, string | null> = {};
      for (const k of PROSPECT_CANONICAL_KEYS) colMap[k] = resolveCol(k);

      const emails = Array.from(new Set(prospectCandidates.map(p => p.email)));
      for (const batch of chunk(emails, 200)) {
        const { data: existing } = await supa.from("contacts")
          .select("id,email,first_name,last_name,company_name_raw,job_title,phone,linkedin_url,country,city,state,enrichment_data,custom_fields,source,source_file,data_quality_score,import_tag,email_validity_status,last_verified_at")
          .eq("workspace_id", body.workspace_id)
          .in("email", batch);
        const byEmail = new Map<string, any>((existing ?? []).map((c: any) => [String(c.email).toLowerCase(), c]));

        for (const p of prospectCandidates.filter(pc => batch.includes(pc.email))) {
          // Build raw + canonical attributes from the original CSV row.
          const raw = p.rawRow ?? {};
          const get = (k: string) => {
            const c = colMap[k]; if (!c) return null;
            const v = raw[c]; return (v === "" || v === undefined) ? null : v;
          };
          let first = get("first_name") as string | null;
          let last = get("last_name") as string | null;
          const full = get("full_name") as string | null;
          if ((!first || !last) && full) {
            const parts = splitFullName(String(full));
            first = first ?? parts.first;
            last = last ?? parts.last;
          }
          const company = (get("company") ?? null) as string | null;
          const title = (get("title") ?? get("job_title") ?? null) as string | null;
          const linkedin = get("linkedin") as string | null;
          const phone = get("phone") as string | null;
          const country = get("country") as string | null;
          const city = get("city") as string | null;
          const state = get("state") as string | null;
          const industry = get("industry") as string | null;
          const website = get("website") as string | null;
          const companyDomain = (get("company_domain") as string | null) ?? p.domain;
          const employeeCount = get("employee_count");
          const revenue = get("revenue");
          const department = get("department") as string | null;
          const seniority = get("seniority") as string | null;
          const headline = get("headline") as string | null;

          // Preserve ALL original CSV columns inside custom_fields under
          // a dataset-scoped namespace so nothing is ever lost.
          const usedRawCols = new Set(Object.values(colMap).filter(Boolean) as string[]);
          // Email column should not also be duplicated as a "custom field".
          if (mapping.email) usedRawCols.add(mapping.email);
          const importedColumns: Record<string, any> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (v === "" || v === null || v === undefined) continue;
            importedColumns[k] = v;
          }

          const intelligence = {
            status: p.status, trust_score: p.trust, confidence: p.confidence,
            freshness_state: p.fresh, safe_to_send_score: p.safe,
            estimated_bounce_probability: p.bounceProb, campaign_safety_tier: p.tier,
            provider: p.provider, verified_at: p.lastVerifiedAt,
            dataset_id: datasetId, source: body.source_label ?? "EmailListVerify",
          };

          const existingContact = byEmail.get(p.email);
          let contactId: string | null = null;

          if (existingContact) {
            // Merge — never weaken stronger data.
            const prevEnrich = (existingContact.enrichment_data as any) ?? {};
            const prevCustom = (existingContact.custom_fields as any) ?? {};
            const prevSources: any[] = Array.isArray(prevEnrich.source_history) ? prevEnrich.source_history : [];
            const prevDatasets: any[] = Array.isArray(prevEnrich.imported_datasets) ? prevEnrich.imported_datasets : [];
            const prevVerificationHistory: any[] = Array.isArray(prevEnrich.verification_history) ? prevEnrich.verification_history : [];

            const newEnrich = {
              ...prevEnrich,
              company_domain: preferStronger(prevEnrich.company_domain, companyDomain),
              industry: preferStronger(prevEnrich.industry, industry),
              website: preferStronger(prevEnrich.website, website),
              employee_count: preferStronger(prevEnrich.employee_count, employeeCount),
              revenue: preferStronger(prevEnrich.revenue, revenue),
              headline: preferStronger(prevEnrich.headline, headline),
              source_history: [...prevSources, { source: body.source_label ?? "EmailListVerify", at: new Date().toISOString(), dataset_id: datasetId }].slice(-50),
              imported_datasets: Array.from(new Set([...prevDatasets, datasetId].filter(Boolean))),
              verification_history: [...prevVerificationHistory, intelligence].slice(-50),
              verification_intelligence: intelligence, // latest snapshot
            };

            const prevImportedCols = (prevCustom.imported_columns as any) ?? {};
            const newCustom = {
              ...prevCustom,
              imported_columns: { ...importedColumns, ...prevImportedCols }, // existing wins
              tags: Array.from(new Set([...(prevCustom.tags ?? []), ...datasetTags])),
            };

            const update: any = {
              first_name: preferStronger(existingContact.first_name, first),
              last_name: preferStronger(existingContact.last_name, last),
              company_name_raw: preferStronger(existingContact.company_name_raw, company),
              job_title: preferStronger(existingContact.job_title, title),
              linkedin_url: preferStronger(existingContact.linkedin_url, linkedin),
              phone: preferStronger(existingContact.phone, phone),
              country: preferStronger(existingContact.country, country),
              city: preferStronger(existingContact.city, city),
              state: preferStronger(existingContact.state, state),
              department: preferStronger((existingContact as any).department, department),
              seniority_level: preferStronger((existingContact as any).seniority_level, seniority),
              enrichment_data: newEnrich,
              custom_fields: newCustom,
              source_file: preferStronger(existingContact.source_file, body.source_label ?? "EmailListVerify"),
              source: preferStronger(existingContact.source, "historical_import"),
              email_validity_status: "valid",
              last_verified_at: new Date().toISOString(),
              data_quality_score: Math.max(existingContact.data_quality_score ?? 0, Math.round(p.safe)),
              updated_at: new Date().toISOString(),
            };
            const { error: updErr } = await supa.from("contacts").update(update).eq("id", existingContact.id);
            if (updErr) { console.error("contact merge", updErr); continue; }
            contactId = existingContact.id;
            prospectsMerged++;
          } else {
            const insert: any = {
              workspace_id: body.workspace_id,
              email: p.email,
              first_name: first, last_name: last,
              company_name_raw: company,
              job_title: title,
              linkedin_url: linkedin,
              phone, country, city, state,
              department, seniority_level: seniority,
              email_validity_status: "valid",
              last_verified_at: new Date().toISOString(),
              data_quality_score: Math.round(p.safe),
              source: "historical_import",
              source_file: body.source_label ?? "EmailListVerify",
              import_tag: datasetTags[0] ?? null,
              lifecycle_status: "new",
              outreach_status: "not_contacted",
              enrichment_data: {
                company_domain: companyDomain, industry, website,
                employee_count: employeeCount, revenue, headline,
                source_history: [{ source: body.source_label ?? "EmailListVerify", at: new Date().toISOString(), dataset_id: datasetId }],
                imported_datasets: datasetId ? [datasetId] : [],
                verification_history: [intelligence],
                verification_intelligence: intelligence,
              },
              custom_fields: {
                imported_columns: importedColumns,
                tags: datasetTags,
              },
            };
            const { data: created, error: insErr } = await supa.from("contacts").insert(insert).select("id").single();
            if (insErr) { console.error("contact insert", insErr); continue; }
            contactId = created?.id ?? null;
            prospectsCreated++;
          }

          // Back-link contact_id on the just-queued history row(s) for this email.
          for (const h of historyRows) {
            if (h.email === p.email && !h.contact_id) h.contact_id = contactId;
          }
        }
      }
    }

    // Insert prospect verification history (with contact_id where resolved).
    for (const c of chunk(historyRows, 500)) {
      const { error } = await supa.from("prospect_verification_history").insert(c);
      if (error) console.error("pvh insert", error);
    }


    // Provider behavior: read-modify-write with running totals
    for (const [provider, a] of providerAgg) {
      const { data: existing } = await supa.from("provider_behavior").select("*").eq("provider_type", provider).maybeSingle();
      const totals = {
        total_verifications: (existing?.total_verifications ?? 0) + a.total,
        accepts: (existing?.accepts ?? 0) + a.valid,
        rejects: (existing?.rejects ?? 0) + a.rejects,
        greylists: (existing?.greylists ?? 0) + a.greylists,
        catch_all_count: (existing?.catch_all_count ?? 0) + a.catch_all,
        bounces: (existing?.bounces ?? 0) + a.bounces,
      };
      const accept_rate = totals.total_verifications ? totals.accepts / totals.total_verifications : null;
      const bounce_rate = totals.total_verifications ? totals.bounces / totals.total_verifications : null;
      const greylist_rate = totals.total_verifications ? totals.greylists / totals.total_verifications : null;
      const reliability_score = accept_rate !== null ? Math.round((accept_rate * 100 - (bounce_rate ?? 0) * 50) * 100) / 100 : null;
      await supa.from("provider_behavior").upsert({
        provider_type: provider, ...totals,
        accept_rate, bounce_rate, greylist_rate, reliability_score,
        last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "provider_type" });
    }

    // Domain intelligence: read-modify-write
    for (const [domain, a] of domainAgg) {
      const { data: existing } = await supa.from("domain_intelligence").select("*").eq("domain", domain).maybeSingle();
      const total = (existing?.total_emails_seen ?? 0) + a.seen;
      const bounces = (existing?.total_bounces ?? 0) + a.bounces;
      const valid = (existing?.total_valid ?? 0) + a.valid;
      const catch_all = (existing?.total_catch_all ?? 0) + a.catch_all;
      const unknown = (existing?.total_unknown ?? 0) + a.unknown;
      const bounce_rate = total ? bounces / total : null;
      const catch_all_rate = total ? catch_all / total : null;
      const reputation_score = total ? Math.max(0, Math.min(100,
        Math.round((100 * (valid / total) - 50 * (bounces / total) - 20 * (catch_all / total)) * 100) / 100
      )) : null;
      await supa.from("domain_intelligence").upsert({
        domain, provider_type: a.provider,
        total_emails_seen: total, total_bounces: bounces, total_valid: valid,
        total_catch_all: catch_all, total_unknown: unknown,
        bounce_rate, catch_all_rate, reputation_score,
        last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "domain" });
    }

    // Confidence learning
    for (const [key, a] of confidenceAgg) {
      const [provider_key, original_status, age_b] = key.split("|");
      const { data: existing } = await supa.from("confidence_learning")
        .select("*").eq("provider_key", provider_key).eq("original_status", original_status).eq("age_bucket", age_b).maybeSingle();
      const sample = (existing?.sample_count ?? 0) + a.sample;
      const match = (existing?.match_count ?? 0) + a.match;
      const suggested = sample ? Math.round((match / sample) * 10000) / 100 : 0;
      await supa.from("confidence_learning").upsert({
        provider_key, original_status, age_bucket: age_b,
        sample_count: sample, match_count: match,
        suggested_confidence: suggested,
        last_evaluated_at: new Date().toISOString(),
      }, { onConflict: "provider_key,original_status,age_bucket" });
    }

    // SMTP learning
    for (const [, s] of smtpAgg) {
      const { data: existing } = await supa.from("smtp_learning")
        .select("*").eq("provider_key", s.provider).eq("smtp_code", s.code ?? 0).eq("response_pattern", s.pattern ?? "").maybeSingle();
      const total = (existing?.total_count ?? 0) + s.count;
      await supa.from("smtp_learning").upsert({
        provider_key: s.provider, smtp_code: s.code, response_pattern: s.pattern,
        total_count: total,
        success_after_retry: existing?.success_after_retry ?? 0,
        avg_retry_delay_s: existing?.avg_retry_delay_s ?? 60,
        recommended_strategy: s.code && s.code >= 500 ? "drop" : s.code === 421 || s.code === 451 ? "retry_later" : "retry_once",
        last_evaluated_at: new Date().toISOString(),
      }, { onConflict: "provider_key,smtp_code,response_pattern" });
    }

    // Bounce intelligence
    for (const [, b] of bounceAgg) {
      const { data: existing } = await supa.from("bounce_intelligence")
        .select("*").eq("domain", b.domain).eq("provider_type", b.provider).eq("smtp_code", b.code ?? 0).eq("bounce_category", b.category).maybeSingle();
      await supa.from("bounce_intelligence").upsert({
        domain: b.domain, provider_type: b.provider, smtp_code: b.code, bounce_category: b.category,
        occurrences: (existing?.occurrences ?? 0) + 1,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "domain,provider_type,smtp_code,bounce_category" });
    }

    // Update dataset / legacy import progress
    if (datasetId) {
      const { data: ds } = await supa.from("imported_datasets").select("processed_count,failed_count,stats").eq("id", datasetId).maybeSingle();
      const newStats: any = { ...(ds?.stats ?? {}) };
      // status counters
      for (const k of Object.keys(stats)) newStats[k] = (newStats[k] ?? 0) + (stats as any)[k];
      // subtype counters
      newStats.subtypes = newStats.subtypes ?? {};
      for (const [k, v] of Object.entries(subtypeStats)) newStats.subtypes[k] = (newStats.subtypes[k] ?? 0) + v;
      // tier + freshness
      newStats.tiers = newStats.tiers ?? {};
      for (const [k, v] of Object.entries(tierStats)) newStats.tiers[k] = (newStats.tiers[k] ?? 0) + v;
      newStats.freshness = newStats.freshness ?? {};
      for (const [k, v] of Object.entries(freshStats)) newStats.freshness[k] = (newStats.freshness[k] ?? 0) + v;
      newStats.safe_to_send = (newStats.safe_to_send ?? 0) + safeToSendCount;
      newStats.risky_total = (newStats.risky_total ?? 0) + riskyCount;
      // running averages via sums + counts
      newStats.conf_sum = (newStats.conf_sum ?? 0) + confSum;
      newStats.conf_n = (newStats.conf_n ?? 0) + confN;
      newStats.bounce_sum = (newStats.bounce_sum ?? 0) + bounceSum;
      newStats.bounce_n = (newStats.bounce_n ?? 0) + bounceN;
      newStats.safe_sum = (newStats.safe_sum ?? 0) + safeSum;
      newStats.safe_n = (newStats.safe_n ?? 0) + safeN;
      newStats.avg_confidence = newStats.conf_n ? Math.round((newStats.conf_sum / newStats.conf_n) * 100) / 100 : null;
      newStats.avg_bounce_probability = newStats.bounce_n ? Math.round((newStats.bounce_sum / newStats.bounce_n) * 10000) / 10000 : null;
      newStats.avg_safe_to_send_score = newStats.safe_n ? Math.round((newStats.safe_sum / newStats.safe_n) * 100) / 100 : null;
      // learning impact
      newStats.domains_learned = (newStats.domains_learned ?? 0) + domainAgg.size;
      newStats.providers_learned_set = Array.from(new Set([...(newStats.providers_learned_set ?? []), ...providerAgg.keys()]));
      newStats.providers_learned = newStats.providers_learned_set.length;
      newStats.greylisted_patterns = (newStats.greylisted_patterns ?? 0) + (subtypeStats.greylisted ?? 0);
      // duplicates
      newStats.skipped_duplicates = (newStats.skipped_duplicates ?? 0) + skippedDuplicates;
      newStats.prospects_created = (newStats.prospects_created ?? 0) + prospectsCreated;
      newStats.prospects_merged = (newStats.prospects_merged ?? 0) + prospectsMerged;
      // top-N maps (merge then trim to top 25)
      const mergeTop = (existingObj: any, incoming: Map<string, number>) => {
        const m = new Map<string, number>(Object.entries(existingObj ?? {}).map(([k, v]) => [k, Number(v)]));
        for (const [k, v] of incoming) m.set(k, (m.get(k) ?? 0) + v);
        return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25));
      };
      newStats.top_industries = mergeTop(newStats.top_industries, industryTop);
      newStats.top_countries = mergeTop(newStats.top_countries, countryTop);
      newStats.top_providers = mergeTop(newStats.top_providers, providerTop);
      newStats.top_companies = mergeTop(newStats.top_companies, companyTop);
      newStats.top_risky_domains = mergeTop(newStats.top_risky_domains, riskyDomainTop);
      newStats.top_safe_domains = mergeTop(newStats.top_safe_domains, safeDomainTop);

      await supa.from("imported_datasets").update({
        processed_count: (ds?.processed_count ?? 0) + processed,
        failed_count: (ds?.failed_count ?? 0) + failed,
        stats: newStats,
        status: body.is_final_chunk ? (failed === 0 ? "completed" : processed > 0 ? "partial" : "failed") : "processing",
        finished_at: body.is_final_chunk ? new Date().toISOString() : null,
      }).eq("id", datasetId);
    }

    if (importId) {
      await supa.from("historical_imports").update({
        status: body.is_final_chunk ? (failed === 0 ? "completed" : processed > 0 ? "partial" : "failed") : "processing",
        processed_count: processed, failed_count: failed,
        row_count: body.rows.length,
        completed_at: body.is_final_chunk ? new Date().toISOString() : null,
      }).eq("id", importId);
    }

    return new Response(JSON.stringify({
      ok: true, processed, failed, stats,
      prospects_created: prospectsCreated, prospects_merged: prospectsMerged,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("import error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
