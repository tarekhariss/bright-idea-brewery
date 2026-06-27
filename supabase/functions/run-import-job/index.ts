/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const BATCH_SIZE = 250;
const RETRY_SUB_BATCH = 50;
const MAX_RETRIES = 2;
const MAX_TIMING_BATCHES = 30;
// Self-continuation: edge functions have a CPU-time limit (not just wall clock) that kills
// long-running invocations with WORKER_RESOURCE_LIMIT. Bail out aggressively and re-invoke
// ourselves so each invocation stays well under the per-request CPU budget.
const MAX_WALL_CLOCK_MS = 25_000; // 25s — keeps per-invocation CPU usage safe
const MAX_BATCHES_PER_INVOCATION = 4; // hard cap so CPU never trips the worker limit

const RequestSchema = z.object({ job_id: z.string().uuid() });

type ExistingContact = {
  id: string; email: string | null; secondary_email: string | null;
  tertiary_email: string | null; linkedin_url: string | null;
  external_contact_id: string | null; first_name: string | null;
  last_name: string | null; company_name_raw: string | null; phone: string | null;
};
type ExistingCompany = {
  id: string; name: string; normalized_name: string | null;
  domain: string | null; external_account_id: string | null; website: string | null;
  normalized_domain?: string | null; company_linkedin_url?: string | null;
};
type ImportMode = "enrich" | "skip" | "review";
type ImportSettings = {
  duplicate_strategy: string; skip_exact_duplicates: boolean;
  update_missing_fields: boolean; review_likely_duplicates: boolean;
  review_company_conflicts: boolean; create_if_no_strong_match: boolean;
  unmapped_columns: string[]; excluded_columns?: string[];
  import_tag: string; source: string; list_id: string | null;
  import_mode?: ImportMode; // enterprise: default 'enrich'
};

function nowIso() { return new Date().toISOString(); }

function isEmptyLike(v: string): boolean {
  const lower = v.trim().toLowerCase();
  return lower === "" || lower === "n/a" || lower === "na" || lower === "null" ||
    lower === "undefined" || lower === "none" || lower === "-" || lower === "--" ||
    lower === "not available" || lower === "not provided" || lower === "#n/a";
}
function normalizeEmail(val: string): string {
  return val.normalize("NFKC").toLowerCase().trim().replace(/^mailto:/i, "").replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}
function normalizeLinkedIn(val: string): string {
  let url = val.normalize("NFKC").trim().toLowerCase(); url = url.split("?")[0].split("#")[0];
  url = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  if (!url.startsWith("linkedin.com")) {
    const idx = url.indexOf("linkedin.com");
    if (idx >= 0) url = url.substring(idx); else url = "linkedin.com/in/" + url;
  }
  return "https://www." + url;
}
function normalizeDomain(val: string): string {
  let d = val.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return d.split("/")[0].split("?")[0];
}
function normalizeWebsite(val: string): string {
  let url = val.trim().toLowerCase();
  if (!url.startsWith("http")) url = "https://" + url;
  return url.replace(/\/+$/, "");
}
function normalizePhone(val: string): string {
  const trimmed = val.trim(); const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? "+" + digits : digits;
}
function normalizeCompanyName(val: string): string {
  let name = val.trim().toLowerCase();
  name = name.replace(/\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|sas|sarl|bv|nv|pty\.?\s*ltd\.?|pvt\.?\s*ltd\.?)\s*\.?\s*$/gi, "");
  name = name.replace(/\s+/g, " ").trim().replace(/[,.\-]+$/, "").trim();
  return name;
}
function titleCase(val: string): string {
  return val.trim().replace(/\s+/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

const FIELD_TYPES: Record<string, "string" | "number" | "array" | "date"> = {
  first_name:"string",last_name:"string",email:"string",secondary_email:"string",
  tertiary_email:"string",personal_email:"string",job_title:"string",seniority_level:"string",
  department:"string",headline:"string",bio:"string",persona:"string",linkedin_url:"string",
  twitter_url:"string",facebook_url:"string",github_url:"string",photo_url:"string",
  years_experience:"number",skills:"array",languages:"array",job_change_date:"date",
  current_role_start_date:"date",phone:"string",work_direct_phone:"string",mobile_phone:"string",
  corporate_phone:"string",home_phone:"string",other_phone:"string",country:"string",
  city:"string",state:"string",address:"string",postal_code:"string",timezone:"string",
  company_name_raw:"string",domain:"string",website:"string",industry:"string",
  employee_count:"number",employee_range:"string",revenue_range:"string",company_address:"string",
  company_city:"string",company_state:"string",company_country:"string",company_phone:"string",
  company_linkedin_url:"string",annual_revenue:"number",total_funding:"number",
  latest_funding:"string",latest_funding_amount:"number",last_raised_at:"date",
  funding_stage:"string",founded_year:"number",company_type:"string",headquarters:"string",
  technologies:"array",keywords:"array",specialties:"array",market_segments:"array",
  territories:"array",sic_code:"string",naics_code:"string",stock_ticker:"string",
  headcount_growth_pct:"number",external_source:"string",external_contact_id:"string",
  external_account_id:"string",
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
function isValidForField(fieldKey: string, v: string): boolean {
  if (!v || !v.trim()) return true;
  if (["email","secondary_email","tertiary_email","personal_email"].includes(fieldKey)) return EMAIL_RE.test(v.trim());
  if (fieldKey === "linkedin_url") return /linkedin\.com\/(in|pub|company)\//i.test(v) || /^[a-z0-9][a-z0-9-]{2,}$/i.test(v.trim());
  if (fieldKey === "company_linkedin_url") return /linkedin\.com\/(company|school)\//i.test(v);
  if (fieldKey === "website") return URL_RE.test(v.trim().replace(/\s+/g, ""));
  if (fieldKey === "domain") return DOMAIN_RE.test(v.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]);
  if (fieldKey.includes("phone")) return (v.match(/\d/g)?.length ?? 0) >= 7;
  if (fieldKey === "company_name_raw") { const t = v.trim(); return t.length <= 120 && !/[!?]$/.test(t) && t.split(/\s+/).length <= 20; }
  return true;
}

/**
 * Decide whether an unmapped CSV header is company-level or contact-level so we
 * can preserve it in the right .custom_fields bucket. Conservative: defaults to
 * contact when unsure (matches the spec).
 */
function classifyCustomFieldScope(header: string): "contact" | "company" {
  const h = header.toLowerCase().trim().replace(/[_\-\/\\.]+/g, " ").replace(/\s+/g, " ");
  if (/^(company|organization|organisation|org|account|employer|firm|business)\b/.test(h)) return "company";
  if (/^(contact|person|lead|prospect|recipient|attendee)\b/.test(h)) return "contact";
  if (/\b(employees|headcount|revenue|funding|founded|industry|sic|naics|ticker|hq|headquarters|domain|website|technologies|tech stack|specialties|segments|territories|name for emails)\b/.test(h)) return "company";
  return "contact";
}

function normalizeRow(raw: Record<string, string>, mapping: Record<string, string>, excluded: Set<string> = new Set()) {
  const normalized: Record<string, unknown> = {};
  const contactCustom: Record<string, string> = {};
  const companyCustom: Record<string, string> = {};
  const invalidFields: Record<string, string> = {};

  // Preserve EVERY unmapped (and not user-excluded) column as a custom field,
  // routed by header semantics. Nothing is silently dropped.
  for (const [csvCol, rawVal] of Object.entries(raw)) {
    if (mapping[csvCol]) continue;
    if (excluded.has(csvCol)) continue;
    const t = (rawVal ?? "").trim();
    if (!t || isEmptyLike(t)) continue;
    const scope = classifyCustomFieldScope(csvCol);
    if (scope === "company") companyCustom[csvCol] = t;
    else contactCustom[csvCol] = t;
  }

  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const rawVal = raw[csvCol] ?? "";
    let val = rawVal.trim().replace(/\s+/g, " ");
    if (isEmptyLike(val)) { normalized[fieldKey] = null; continue; }

    if (!isValidForField(fieldKey, val)) {
      invalidFields[fieldKey] = val;
      normalized[fieldKey] = null;
      continue;
    }

    if (fieldKey === "email" || fieldKey === "secondary_email" || fieldKey === "tertiary_email" || fieldKey === "personal_email") val = normalizeEmail(val);
    else if (fieldKey === "linkedin_url" || fieldKey === "company_linkedin_url") val = normalizeLinkedIn(val);
    else if (fieldKey === "domain") val = normalizeDomain(val);
    else if (fieldKey === "website") val = normalizeWebsite(val);
    else if (fieldKey.includes("phone")) val = normalizePhone(val);
    else if (["country","city","state","company_city","company_state","company_country"].includes(fieldKey)) val = titleCase(val);
    const type = FIELD_TYPES[fieldKey] ?? "string";
    if (type === "number") { const num = Number(String(val).replace(/[,$\s]/g, "")); normalized[fieldKey] = Number.isNaN(num) ? null : num; continue; }
    if (type === "array") { normalized[fieldKey] = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean); continue; }
    normalized[fieldKey] = val;
  }

  if (Object.keys(contactCustom).length > 0) (normalized as any)._contact_custom_fields = contactCustom;
  if (Object.keys(companyCustom).length > 0) (normalized as any)._company_custom_fields = companyCustom;
  if (Object.keys(invalidFields).length > 0) (normalized as any)._invalid_values = invalidFields;
  return normalized;
}



function buildContactIndex(contacts: ExistingContact[]) {
  const emailMap = new Map<string, ExistingContact>();
  const linkedinMap = new Map<string, ExistingContact>();
  const extIdMap = new Map<string, ExistingContact>();
  const phoneMap = new Map<string, ExistingContact>();
  const nameCompanyMap = new Map<string, ExistingContact>();
  for (const c of contacts) {
    if (c.email) emailMap.set(normalizeEmail(c.email), c);
    if (c.secondary_email) emailMap.set(normalizeEmail(c.secondary_email), c);
    if (c.tertiary_email) emailMap.set(normalizeEmail(c.tertiary_email), c);
    if (c.linkedin_url) linkedinMap.set(normalizeLinkedIn(c.linkedin_url), c);
    if (c.external_contact_id) extIdMap.set(c.external_contact_id, c);
    if (c.phone) phoneMap.set(normalizePhone(c.phone), c);
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().trim();
    const companyKey = c.company_name_raw ? normalizeCompanyName(c.company_name_raw) : "";
    if (fullName && companyKey) nameCompanyMap.set(`${fullName}|${companyKey}`, c);
  }
  return { emailMap, linkedinMap, extIdMap, phoneMap, nameCompanyMap };
}

function buildCompanyIndex(companies: ExistingCompany[]) {
  const domainMap = new Map<string, ExistingCompany>();
  const extIdMap = new Map<string, ExistingCompany>();
  const nameMap = new Map<string, ExistingCompany>();
  const linkedinMap = new Map<string, ExistingCompany>();
  for (const c of companies) {
    // Prefer the DB-computed normalized_domain; fall back to local normalization
    const nd = (c.normalized_domain && c.normalized_domain.trim())
      ? c.normalized_domain.trim().toLowerCase()
      : (c.domain ? normalizeDomain(c.domain) : (c.website ? normalizeDomain(c.website) : ""));
    if (nd) domainMap.set(nd, c);
    if (c.external_account_id) extIdMap.set(c.external_account_id, c);
    if (c.normalized_name) nameMap.set(c.normalized_name.toLowerCase(), c);
    else if (c.name) nameMap.set(normalizeCompanyName(c.name), c);
    if (c.company_linkedin_url) linkedinMap.set(normalizeLinkedIn(c.company_linkedin_url), c);
  }
  return { domainMap, extIdMap, nameMap, linkedinMap };
}

/**
 * Derive a normalized domain identity for an inbound row by checking the strongest
 * signals in order: explicit domain → website → email host → company LinkedIn URL.
 */
function deriveRowDomain(r: Record<string, unknown>): string {
  if (r.domain) {
    const d = normalizeDomain(String(r.domain));
    if (d && DOMAIN_RE.test(d)) return d;
  }
  if (r.website) {
    const d = normalizeDomain(String(r.website));
    if (d && DOMAIN_RE.test(d)) return d;
  }
  if (r.email) {
    const parts = String(r.email).toLowerCase().split("@");
    if (parts.length === 2) {
      const host = parts[1].trim();
      // Skip generic / free-mail hosts so we don't merge unrelated people
      const generic = new Set([
        "gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com",
        "me.com","mac.com","live.com","msn.com","proton.me","protonmail.com",
        "googlemail.com","yandex.com","gmx.com","zoho.com","fastmail.com","mail.com",
      ]);
      if (host && DOMAIN_RE.test(host) && !generic.has(host)) return host;
    }
  }
  return "";
}


function checkDuplicatesAdvanced(
  rows: Record<string, unknown>[],
  contactIndex: ReturnType<typeof buildContactIndex>,
  companyIndex: ReturnType<typeof buildCompanyIndex>
) {
  const details: Array<{ classification: string; matchedContactId: string | null; matchedCompanyId: string | null; reason: string | null }> = [];
  for (const row of rows) {
    const r = row as Record<string, string | null | undefined>;
    const email = String(r.email ?? "").toLowerCase().trim();
    const secEmail = String(r.secondary_email ?? "").toLowerCase().trim();
    const terEmail = String(r.tertiary_email ?? "").toLowerCase().trim();
    const linkedin = r.linkedin_url ? normalizeLinkedIn(String(r.linkedin_url)) : "";
    const extId = String(r.external_contact_id ?? "").trim();
    const phone = r.phone ? normalizePhone(String(r.phone)) : "";
    const firstName = String(r.first_name ?? "").toLowerCase().trim();
    const lastName = String(r.last_name ?? "").toLowerCase().trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const companyRaw = String(r.company_name_raw ?? "").trim();
    const companyNorm = companyRaw ? normalizeCompanyName(companyRaw) : "";
    const domain = deriveRowDomain(r);
    const companyLinkedin = r.company_linkedin_url ? normalizeLinkedIn(String(r.company_linkedin_url)) : "";
    const extAccountId = String(r.external_account_id ?? "").trim();

    if (!email && !secEmail && !firstName && !lastName) {
      details.push({ classification: "invalid", matchedContactId: null, matchedCompanyId: null, reason: "Missing email and name" });
      continue;
    }

    let match: ExistingContact | undefined;
    let confidence = 0;
    let matchType: string | null = null;
    for (const e of [email, secEmail, terEmail].filter(Boolean)) {
      const found = contactIndex.emailMap.get(e);
      if (found) { match = found; confidence = 100; matchType = `Exact email: ${e}`; break; }
    }
    if (!match && linkedin) { const found = contactIndex.linkedinMap.get(linkedin); if (found) { match = found; confidence = 95; matchType = "Exact LinkedIn URL"; } }
    if (!match && extId) { const found = contactIndex.extIdMap.get(extId); if (found) { match = found; confidence = 95; matchType = `External ID: ${extId}`; } }
    if (!match && fullName && domain) {
      const companyMatch = companyIndex.domainMap.get(domain);
      if (companyMatch) {
        const found = contactIndex.nameCompanyMap.get(`${fullName}|${(companyMatch.normalized_name || normalizeCompanyName(companyMatch.name)).toLowerCase()}`);
        if (found) { match = found; confidence = 80; matchType = "Name + company domain match"; }
      }
    }
    if (!match && fullName && companyNorm) {
      const found = contactIndex.nameCompanyMap.get(`${fullName}|${companyNorm}`);
      if (found) { match = found; confidence = 70; matchType = "Name + company name match"; }
    }
    if (!match && phone && phone.length >= 7) {
      const found = contactIndex.phoneMap.get(phone);
      if (found) { match = found; confidence = 55; matchType = "Phone number match"; }
    }

    let companyMatch: ExistingCompany | undefined;
    if (domain) companyMatch = companyIndex.domainMap.get(domain);
    if (!companyMatch && extAccountId) companyMatch = companyIndex.extIdMap.get(extAccountId);
    if (!companyMatch && companyLinkedin) companyMatch = companyIndex.linkedinMap.get(companyLinkedin);
    if (!companyMatch && companyNorm) companyMatch = companyIndex.nameMap.get(companyNorm);


    if (match) {
      details.push({
        classification: confidence >= 90 ? "exact_duplicate" : confidence >= 65 ? "likely_duplicate" : "review_required",
        matchedContactId: match.id, matchedCompanyId: companyMatch?.id ?? null, reason: matchType,
      });
    } else {
      details.push({ classification: "new", matchedContactId: null, matchedCompanyId: companyMatch?.id ?? null, reason: null });
    }
  }
  return details;
}

// Enterprise Identity Resolution: every row is classified into one of seven outcomes.
// Outcome → (DB row status, action_taken string, review flag).
type RowOutcome =
  | "inserted_new" | "updated_existing" | "enriched_existing" | "duplicate_linked"
  | "skipped_duplicate" | "conflict" | "review_required" | "error";

function classifyRowAction(classification: string, settings: ImportSettings):
  { status: string; action: string | null; reviewRequired: boolean; outcome: RowOutcome } {
  const mode: ImportMode = (settings.import_mode as ImportMode) || "enrich";
  if (classification === "invalid") {
    return { status: "error", action: null, reviewRequired: false, outcome: "error" };
  }
  if (classification === "new") {
    return { status: "success", action: "create_new", reviewRequired: false, outcome: "inserted_new" };
  }
  // Any duplicate-ish classification: exact_duplicate | likely_duplicate | review_required
  if (mode === "skip") {
    return { status: "skipped", action: "skipped_duplicate", reviewRequired: false, outcome: "skipped_duplicate" };
  }
  if (mode === "review") {
    return { status: "review", action: "review_pending", reviewRequired: true, outcome: "review_required" };
  }
  // mode === "enrich" (default). Try to enrich; the runner may downgrade to
  // duplicate_linked (no fields filled) or conflict (true value clash).
  return { status: "success", action: "enriched_existing", reviewRequired: false, outcome: "enriched_existing" };
}

const CONTACT_FIELDS = new Set([
  "first_name","last_name","email","secondary_email","tertiary_email","personal_email",
  "job_title","seniority_level","department","headline","bio","persona","linkedin_url",
  "twitter_url","facebook_url","github_url","photo_url","years_experience","skills",
  "languages","job_change_date","current_role_start_date","phone","work_direct_phone",
  "mobile_phone","corporate_phone","home_phone","other_phone","country","city","state",
  "address","postal_code","timezone","company_name_raw","source","external_source",
  "external_contact_id",
]);
const COMPANY_FIELDS = new Set([
  "domain","website","industry","employee_count","employee_range","revenue_range",
  "annual_revenue","total_funding","latest_funding","latest_funding_amount","funding_stage",
  "founded_year","company_type","headquarters","company_address","company_city",
  "company_state","company_country","company_phone","company_linkedin_url",
  "technologies","keywords","specialties","market_segments","territories",
  "sic_code","naics_code","stock_ticker","headcount_growth_pct","external_account_id",
]);

/** Update import_job_rows status in bulk using individual updates grouped by status */
async function updateRowStatuses(
  supabase: ReturnType<typeof createClient>,
  rowUpdates: any[],
  jobId: string,
): Promise<number> {
  let failCount = 0;
  // Process in chunks to avoid payload limits
  for (let i = 0; i < rowUpdates.length; i += 100) {
    const chunk = rowUpdates.slice(i, i + 100);
    // Use individual updates for each row to avoid upsert NOT NULL issues
    const promises = chunk.map((u: any) => {
      const updatePayload: any = {
        status: u.status,
        normalized_data: u.normalized_data ?? null,
        error_message: u.error_message ?? null,
        duplicate_match_reason: u.duplicate_match_reason ?? null,
        action_taken: u.action_taken ?? null,
        review_required: u.review_required ?? false,
        company_id: u.company_id ?? null,
        contact_id: u.contact_id ?? null,
      };
      return supabase
        .from("import_job_rows")
        .update(updatePayload)
        .eq("id", u.id)
        .eq("import_job_id", jobId);
    });
    const results = await Promise.all(promises);
    for (const r of results) {
      if ((r as any).error) {
        failCount++;
        console.error(`[import] Row update error: ${(r as any).error.message}`);
      }
    }
  }
  return failCount;
}

/** Insert contacts with automatic sub-batch retry on failure */
async function insertContactsWithRetry(
  supabase: ReturnType<typeof createClient>,
  contacts: Array<{ rowId: string; rowUpdate: any; contact: Record<string, unknown> }>,
  contactIndex: ReturnType<typeof buildContactIndex>,
  accessibleWorkspaceIds: string[],
): Promise<{ inserted: ExistingContact[]; failedEntries: typeof contacts }> {
  if (contacts.length === 0) return { inserted: [], failedEntries: [] };

  const payload = contacts.map((e) => e.contact);
  const { data, error } = await supabase
    .from("contacts")
    .insert(payload as any)
    .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone");

  if (!error && data) {
    data.forEach((contact: any, idx: number) => {
      if (contacts[idx]) contacts[idx].rowUpdate.contact_id = contact.id;
    });
    return { inserted: data as ExistingContact[], failedEntries: [] };
  }

  console.warn(`Bulk insert of ${contacts.length} contacts failed: ${error?.message}. Retrying in sub-batches of ${RETRY_SUB_BATCH}.`);
  const allInserted: ExistingContact[] = [];
  const allFailed: typeof contacts = [];

  for (let i = 0; i < contacts.length; i += RETRY_SUB_BATCH) {
    const subBatch = contacts.slice(i, i + RETRY_SUB_BATCH);
    const subPayload = subBatch.map((e) => e.contact);

    let retrySuccess = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: subData, error: subErr } = await supabase
        .from("contacts")
        .insert(subPayload as any)
        .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone");

      if (!subErr && subData) {
        subData.forEach((contact: any, idx: number) => {
          if (subBatch[idx]) subBatch[idx].rowUpdate.contact_id = contact.id;
        });
        allInserted.push(...(subData as ExistingContact[]));
        retrySuccess = true;
        break;
      }

      if (attempt === MAX_RETRIES - 1) {
        for (const entry of subBatch) {
          const { data: singleData, error: singleErr } = await supabase
            .from("contacts")
            .insert(entry.contact as any)
            .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
            .single();

          if (!singleErr && singleData) {
            entry.rowUpdate.contact_id = singleData.id;
            allInserted.push(singleData as ExistingContact);
          } else if (singleErr && ((singleErr as any).code === "23505" || /duplicate key|unique/i.test(singleErr.message || ""))) {
            // Unique-constraint hit (race with another import or pre-existing).
            // Look up the surviving contact and mark this row as a duplicate skip — not an error.
            const emailVal = String(entry.contact.email ?? "").toLowerCase().trim();
            let matched: any = null;
            if (emailVal) {
              let lookup = supabase.from("contacts")
                .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
                .eq("email_normalized", emailVal)
                .is("merged_into", null)
                .limit(1);
              if (accessibleWorkspaceIds.length > 0) lookup = lookup.in("workspace_id", accessibleWorkspaceIds);
              else if (entry.contact.workspace_id) lookup = lookup.eq("workspace_id", entry.contact.workspace_id as string);
              else lookup = lookup.is("workspace_id", null);
              const { data: m } = await lookup;
              matched = m?.[0] ?? null;
            }
            entry.rowUpdate.status = "skipped";
            entry.rowUpdate.action_taken = "skipped_exact_duplicate";
            entry.rowUpdate.review_required = false;
            entry.rowUpdate.duplicate_match_reason = `Exact email already exists: ${emailVal}`;
            entry.rowUpdate.error_message = null;
            if (matched) {
              entry.rowUpdate.contact_id = matched.id;
              addToContactIndex(contactIndex, [matched as ExistingContact]);
            }
          } else {
            entry.rowUpdate.status = "error";
            entry.rowUpdate.error_message = singleErr?.message || "Insert failed after retries";
            entry.rowUpdate.action_taken = null;
            allFailed.push(entry);
          }
        }
        retrySuccess = true;
      }
    }

    if (!retrySuccess) {
      for (const entry of subBatch) {
        entry.rowUpdate.status = "error";
        entry.rowUpdate.error_message = "Insert failed after retries";
        entry.rowUpdate.action_taken = null;
        allFailed.push(entry);
      }
    }
  }

  return { inserted: allInserted, failedEntries: allFailed };
}

function addToContactIndex(contactIndex: ReturnType<typeof buildContactIndex>, contacts: ExistingContact[]) {
  for (const c of contacts) {
    if (c.email) contactIndex.emailMap.set(normalizeEmail(c.email), c);
    if (c.secondary_email) contactIndex.emailMap.set(normalizeEmail(c.secondary_email), c);
    if (c.tertiary_email) contactIndex.emailMap.set(normalizeEmail(c.tertiary_email), c);
    if (c.linkedin_url) contactIndex.linkedinMap.set(normalizeLinkedIn(c.linkedin_url), c);
    if (c.external_contact_id) contactIndex.extIdMap.set(c.external_contact_id, c);
    if (c.phone) contactIndex.phoneMap.set(normalizePhone(c.phone), c);
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().trim();
    const companyKey = c.company_name_raw ? normalizeCompanyName(c.company_name_raw) : "";
    if (fullName && companyKey) contactIndex.nameCompanyMap.set(`${fullName}|${companyKey}`, c);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);
  let job: any = null;
  let diag: any = {};
  let jobIdForCatch: string | null = null;

  function updateDiag(patch: Record<string, any>) {
    const prevDiag = diag.diagnostics ?? {};
    const batches = [...(prevDiag.recent_batches ?? []), ...(patch.recent_batches ?? [])].slice(-MAX_TIMING_BATCHES);
    const timings = { ...(prevDiag.timings ?? {}) };
    for (const [k, v] of Object.entries(patch.timings ?? {})) timings[k] = (timings[k] ?? 0) + Number(v ?? 0);
    diag = { ...diag, diagnostics: { ...prevDiag, ...patch, recent_batches: batches, timings } };
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const incomingCronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    const isServiceRole = bearerToken === serviceKey;
    const isInternal = isServiceRole || (!!cronSecret && incomingCronSecret === cronSecret);

    let userId: string | null = null;
    if (!isInternal) {
      if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authError } = await anonClient.auth.getUser(bearerToken!);
      if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      userId = authData.user.id;
    }

    const parsedBody = RequestSchema.safeParse(await req.json());
    if (!parsedBody.success) return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors }), { status: 400, headers: corsHeaders });
    const { job_id } = parsedBody.data;
    jobIdForCatch = job_id;

    const { data: fetchedJob, error: jobErr } = await supabase.from("import_jobs").select("*").eq("id", job_id).single();
    if (jobErr || !fetchedJob) return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    job = fetchedJob;
    if (isInternal && !userId && job.created_by) userId = job.created_by;

    // ─── Parent-job guard ────────────────────────────────────────────────────
    // Parent batched jobs (parent_job_id IS NULL AND batch_total > 0) own no staged
    // rows themselves — their counters are aggregated from children. The runner
    // must never process or auto-complete a parent; finalization happens via
    // try_claim_parent_finalize() when the last child completes.
    if (!job.parent_job_id && (job.batch_total ?? 0) > 0) {
      console.log(`[import] Skipping parent job ${job_id} — runner only processes children.`);
      return new Response(JSON.stringify({
        success: true, skipped: true, reason: "parent_job_no_op", job_id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Global pause guard (enterprise dedupe rollout) ────────────────────
    // Honors platform_settings.imports_paused. Internal cron + service role can
    // bypass via x-allow-paused header so admins can deliberately drain queues.
    {
      const { data: pauseRow } = await supabase
        .from("platform_settings").select("value").eq("key", "imports_paused").maybeSingle();
      const paused = (pauseRow?.value as any)?.paused === true;
      const allowPaused = req.headers.get("x-allow-paused") === "1" && isInternal;
      if (paused && !allowPaused) {
        const reason = (pauseRow?.value as any)?.reason ?? "Imports are temporarily paused.";
        console.log(`[import] Refusing job ${job_id} — imports paused: ${reason}`);
        return new Response(JSON.stringify({
          success: false, paused: true, reason, job_id,
        }), { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    if (!isInternal) {
      if (job.workspace_id) {
        const { data: membership } = await supabase.from("workspace_members").select("user_id").eq("user_id", userId).eq("workspace_id", job.workspace_id).maybeSingle();
        if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      } else if (job.created_by !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    // Detect continuation vs. fresh start: a resume case is when the job is already
    // marked processing and has staged rows still in flight (some processed, some pending).
    const prevDiag = (job.error_summary && typeof job.error_summary === "object" ? (job.error_summary as any).diagnostics : null) ?? null;
    const isResume = job.status === "processing" && (job.processed_rows ?? 0) > 0;

    const { data: memberRows } = userId
      ? await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId)
      : { data: [] as any[] };
    const accessibleWorkspaceIds = Array.from(new Set([
      ...((memberRows ?? []).map((m: any) => m.workspace_id).filter(Boolean)),
      ...(job.workspace_id ? [job.workspace_id] : []),
    ]));

    const settings = (job.settings ?? {}) as ImportSettings;
    const mapping = (job.column_mapping ?? {}) as Record<string, string>;
    if (settings.list_id) {
      const { data: targetList, error: listErr } = await supabase
        .from("lists")
        .select("id, workspace_id")
        .eq("id", settings.list_id)
        .maybeSingle();
      if (listErr || !targetList) throw new Error(`Target list not found: ${settings.list_id}`);
      if (targetList.workspace_id && !accessibleWorkspaceIds.includes(targetList.workspace_id)) {
        throw new Error("Target list is not in an accessible workspace for this account.");
      }
      if (job.workspace_id && targetList.workspace_id && targetList.workspace_id !== job.workspace_id) {
        throw new Error("Import workspace does not match the target list workspace. Start the import from the list workspace or use the repair flow for existing parent imports.");
      }
    }

    console.log(`[import] ${isResume ? "Resuming" : "Starting"} job ${job_id}, total_rows=${job.total_rows}, processed_so_far=${job.processed_rows ?? 0}`);

    if (isResume) {
      // Preserve prior diagnostics and counters; only refresh the heartbeat phase.
      diag = { diagnostics: { ...(prevDiag ?? {}), phase: "resuming", last_progress_at: nowIso() } };
      await supabase.from("import_jobs").update({
        status: "processing", error_summary: diag,
      }).eq("id", job_id);
    } else {
      // Fresh start — never carry over stale counters from a previous broken run.
      diag = {};
      updateDiag({ phase: "loading_existing_records", last_progress_at: nowIso(), total_rows: job.total_rows, batch_size: BATCH_SIZE });
      await supabase.from("import_jobs").update({
        status: "processing", started_at: nowIso(),
        processed_rows: 0, success_rows: 0, inserted_rows: 0,
        error_rows: 0, duplicate_rows: 0, review_rows: 0,
        error_summary: diag,
      }).eq("id", job_id);
    }

    // Count actual staged rows (source of truth)
    const { count: stagedRowCount } = await (supabase.from("import_job_rows") as any)
      .select("id", { count: "exact", head: true }).eq("import_job_id", job_id);
    const totalStagedRows = stagedRowCount ?? 0;

    console.log(`[import] Staged rows in DB: ${totalStagedRows}, declared total: ${job.total_rows}`);

    // Preload existing data for account-wide dedupe. Prospect Search is account-wide,
    // so imports must also detect duplicates across every workspace the actor can access.
    const preloadStart = performance.now();
    async function fetchPaged<T>(builder: () => any, pageSize = 5000, maxRows = 500000): Promise<T[]> {
      const out: T[] = [];
      for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await builder().range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as T[];
        out.push(...batch);
        if (batch.length < pageSize) break;
      }
      return out;
    }
    const workspaceScope = accessibleWorkspaceIds.length > 0
      ? accessibleWorkspaceIds
      : (job.workspace_id ? [job.workspace_id] : []);
    const existingContacts = await fetchPaged<ExistingContact>(() => {
      let q = supabase
        .from("contacts")
        .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
        .is("merged_into", null)
        .order("id");
      if (workspaceScope.length > 0) q = q.in("workspace_id", workspaceScope) as any;
      return q;
    });
    const existingCompanies = await fetchPaged<ExistingCompany>(() => {
      let q = supabase
        .from("companies")
        .select("id, name, normalized_name, domain, normalized_domain, external_account_id, website, company_linkedin_url")
        .is("merged_into", null)
        .order("id");
      if (workspaceScope.length > 0) q = q.in("workspace_id", workspaceScope) as any;
      return q;
    });

    const contactIndex = buildContactIndex((existingContacts ?? []) as ExistingContact[]);
    const companyIndex = buildCompanyIndex((existingCompanies ?? []) as ExistingCompany[]);
    // Domain-first cache so importer never duplicates a company that shares a normalized domain.
    const companyDomainCache = new Map<string, string>(); // normalized_domain -> company.id
    const companyNameCache = new Map<string, string>();   // normalized_name    -> company.id
    for (const c of (existingCompanies ?? []) as ExistingCompany[]) {
      const nd = (c.normalized_domain && c.normalized_domain.trim())
        ? c.normalized_domain.trim().toLowerCase()
        : (c.domain ? normalizeDomain(c.domain) : (c.website ? normalizeDomain(c.website) : ""));
      if (nd) companyDomainCache.set(nd, c.id);
      companyNameCache.set(c.normalized_name || normalizeCompanyName(c.name), c.id);
    }

    updateDiag({ timings: { preload_existing_ms: Math.round(performance.now() - preloadStart) } });
    console.log(`[import] Preloaded ${(existingContacts ?? []).length} contacts, ${(existingCompanies ?? []).length} companies across ${workspaceScope.length} workspace(s) in ${Math.round(performance.now() - preloadStart)}ms`);

    // Field mapping report tracker
    const fieldReport: Record<string, { inserted: number; blank: number; target: string }> = {};
    for (const [, fieldKey] of Object.entries(mapping)) {
      const target = CONTACT_FIELDS.has(fieldKey) ? "contacts" : COMPANY_FIELDS.has(fieldKey) ? "companies" : "metadata";
      fieldReport[fieldKey] = { inserted: 0, blank: 0, target };
    }

    // On resume, hydrate in-memory counters from persisted job state so progress doesn't reset.
    let processedRows = isResume ? (job.processed_rows ?? 0) : 0;
    let successRows = isResume ? (job.success_rows ?? 0) : 0;
    let insertedRows = isResume ? (job.inserted_rows ?? 0) : 0;
    let errorRows = isResume ? (job.error_rows ?? 0) : 0;
    let duplicateRows = isResume ? (job.duplicate_rows ?? 0) : 0;
    let reviewRows = isResume ? (job.review_rows ?? 0) : 0;
    // Enterprise outcome counters
    let insertedNew = isResume ? (job.inserted_new ?? 0) : 0;
    let updatedExisting = isResume ? (job.updated_existing ?? 0) : 0;
    let enrichedExisting = isResume ? (job.enriched_existing ?? 0) : 0;
    let duplicateLinked = isResume ? (job.duplicate_linked ?? 0) : 0;
    let skippedDuplicate = isResume ? (job.skipped_duplicate ?? 0) : 0;
    let conflictRows = isResume ? (job.conflict_rows ?? 0) : 0;
    let batchIndex = isResume ? (prevDiag?.total_batches ?? 0) : 0;
    const wallClockStart = performance.now();

    // Main processing loop — fetch only PENDING rows, ordered by row_number
    while (true) {
      // Self-continuation check: bail out before the platform kills us, and re-invoke ourselves
      // so the next invocation picks up the remaining pending rows seamlessly.
      const batchesThisInvocation = batchIndex - (isResume ? (prevDiag?.total_batches ?? 0) : 0);
      if (performance.now() - wallClockStart > MAX_WALL_CLOCK_MS || batchesThisInvocation >= MAX_BATCHES_PER_INVOCATION) {
        console.log(`[import] Resource budget reached after batch ${batchIndex} (${batchesThisInvocation} this invocation). Self-resuming.`);
        updateDiag({
          phase: "self_resume_scheduled",
          last_progress_at: nowIso(),
          self_resume_count: ((diag?.diagnostics?.self_resume_count ?? 0) + 1),
        });
        await supabase.from("import_jobs").update({
          status: "processing",
          processed_rows: processedRows, success_rows: successRows,
          inserted_rows: insertedRows, error_rows: errorRows,
          duplicate_rows: duplicateRows, review_rows: reviewRows,
          error_summary: diag,
        }).eq("id", job_id);
        // Schedule the next invocation before returning. Edge workers can cancel
        // bare unawaited promises after the response, so keep the fetch alive with
        // EdgeRuntime.waitUntil when available.
        try {
          const cronSecretEnv = Deno.env.get("CRON_SECRET");
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          };
          if (cronSecretEnv) headers["x-cron-secret"] = cronSecretEnv;
          const resumePromise = fetch(`${supabaseUrl}/functions/v1/run-import-job`, {
            method: "POST",
            headers,
            body: JSON.stringify({ job_id }),
          }).then(async (res) => {
            if (!res.ok) console.warn(`[import] Self-resume returned ${res.status}: ${await res.text().catch(() => "")}`);
          }).catch((e) => console.warn(`[import] Self-resume invoke failed: ${e?.message}`));
          const edgeRuntime = (globalThis as any).EdgeRuntime;
          if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(resumePromise);
          else await resumePromise;
        } catch (e: any) {
          console.warn(`[import] Self-resume could not be scheduled: ${e?.message}`);
        }
        return new Response(JSON.stringify({ success: true, job_id, resumed: true, processed_rows: processedRows }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pendingRows, error: pendingErr } = await supabase
        .from("import_job_rows")
        .select("id, row_number, raw_data")
        .eq("import_job_id", job_id)
        .eq("status", "pending")
        .order("row_number", { ascending: true })
        .limit(BATCH_SIZE);

      if (pendingErr) throw new Error(`Failed to fetch pending rows: ${pendingErr.message}`);
      if (!pendingRows || pendingRows.length === 0) break;

      batchIndex += 1;
      const firstRow = (pendingRows[0] as any)?.row_number;
      const lastRow = (pendingRows[pendingRows.length - 1] as any)?.row_number;
      console.log(`[import] Batch ${batchIndex}: processing ${pendingRows.length} rows (rows ${firstRow}-${lastRow})`);

      // INTEGRITY CHECK: if we've processed more rows than exist, something is wrong
      if (processedRows >= totalStagedRows) {
        console.error(`[import] INTEGRITY ERROR: processedRows (${processedRows}) >= totalStagedRows (${totalStagedRows}) but pending rows found. Aborting.`);
        throw new Error(`Counter integrity violation: processed ${processedRows} but only ${totalStagedRows} staged rows exist.`);
      }

      // Normalize + dedup
      const normalizeStart = performance.now();
      const excludedSet = new Set<string>(Array.isArray(settings.excluded_columns) ? settings.excluded_columns : []);
      const normalizedRows = pendingRows.map((row: any) => normalizeRow(row.raw_data ?? {}, mapping, excludedSet));
      const duplicateDetails = checkDuplicatesAdvanced(normalizedRows, contactIndex, companyIndex);
      const normalizeMs = Math.round(performance.now() - normalizeStart);

      // Track field population for this batch
      for (const normalized of normalizedRows) {
        for (const [fieldKey, report] of Object.entries(fieldReport)) {
          const val = (normalized as any)[fieldKey];
          if (val === null || val === undefined || val === "") report.blank++;
          else report.inserted++;
        }
      }

      const rowUpdates: any[] = [];
      const pendingContacts: Array<{ rowId: string; rowUpdate: any; contact: Record<string, unknown>; companyData: Record<string, unknown>; domainKey: string; nameKey: string; companyName: string }> = [];
      const readyContacts: Array<{ rowId: string; rowUpdate: any; contact: Record<string, unknown> }> = [];
      const mergeUpdates: Array<{ contactId: string; companyId: string | null; patch: Record<string, unknown>; contactCustom: Record<string, string>; companyCustom: Record<string, string> }> = [];


      for (let i = 0; i < pendingRows.length; i++) {
        const row = pendingRows[i] as any;
        const normalized = normalizedRows[i];
        const dupDetail = duplicateDetails[i];
        const rowAction = classifyRowAction(dupDetail.classification, settings);

        const rowUpdate: any = {
          id: row.id,
          status: rowAction.status,
          normalized_data: normalized,
          error_message: dupDetail.classification === "invalid" ? dupDetail.reason : null,
          duplicate_match_reason: dupDetail.reason,
          action_taken: rowAction.action,
          review_required: rowAction.reviewRequired,
          company_id: dupDetail.matchedCompanyId,
          contact_id: dupDetail.matchedContactId,
        };

        if (rowAction.status === "success" && rowAction.action === "create_new") {
          const contact: Record<string, unknown> = {
            workspace_id: job.workspace_id ?? null, created_by: userId,
            import_tag: settings.import_tag || null, source: settings.source || null,
            source_file: job.file_name,
          };
          const companyData: Record<string, unknown> = {};
          let hasCompanyFields = false;
          const contactCustom = (normalized as any)._contact_custom_fields ?? null;
          const companyCustom = (normalized as any)._company_custom_fields ?? null;
          for (const [key, value] of Object.entries(normalized)) {
            if (key.startsWith("_")) continue;
            if (value === null || value === undefined) continue;
            if (CONTACT_FIELDS.has(key)) contact[key] = value;
            if (COMPANY_FIELDS.has(key)) { companyData[key] = value; hasCompanyFields = true; }
          }
          if (contactCustom && Object.keys(contactCustom).length > 0) contact.custom_fields = contactCustom;
          // Promote a well-known company alias header into the dedicated column when present.
          if (companyCustom && companyCustom["Company Name for Emails"]) {
            (companyData as any).company_name_for_emails = companyCustom["Company Name for Emails"];
            delete companyCustom["Company Name for Emails"];
            hasCompanyFields = true;
          }
          if (companyCustom && Object.keys(companyCustom).length > 0) {
            companyData.custom_fields = companyCustom;
            hasCompanyFields = true;
          }
          // NOTE: Do NOT copy company_city/state/country onto the contact. Those are
          // company-level signals and belong on the company row only; the contact's
          // own city/state/country must come from the CSV's person-level fields.

          // Derive a strong company identity. Domain wins; fall back to name.
          const domainKey = deriveRowDomain(normalized as any);
          if (domainKey && !companyData.domain) companyData.domain = domainKey;
          const companyName = String(contact.company_name_raw ?? "").trim();
          const nameKey = companyName ? normalizeCompanyName(companyName) : "";

          let matchedCompanyId: string | null = rowUpdate.company_id ?? null;
          if (!matchedCompanyId && domainKey) matchedCompanyId = companyDomainCache.get(domainKey) ?? null;
          if (!matchedCompanyId && nameKey) matchedCompanyId = companyNameCache.get(nameKey) ?? null;
          if (matchedCompanyId) { contact.company_id = matchedCompanyId; rowUpdate.company_id = matchedCompanyId; }

          // Need to create a company only if we have at least an identity key (domain or name)
          // AND we couldn't resolve to an existing one.
          if (!rowUpdate.company_id && (domainKey || nameKey) && (companyName || domainKey)) {
            // Ensure the new company has a name even when only a domain was provided
            if (!companyName && domainKey) {
              (companyData as any).__derivedName = domainKey;
            }
            pendingContacts.push({
              rowId: row.id, rowUpdate, contact, companyData,
              domainKey, nameKey,
              companyName: companyName || domainKey,
            });
          } else if (contact.email || contact.first_name || contact.last_name) {
            readyContacts.push({ rowId: row.id, rowUpdate, contact });
          } else {
            rowUpdate.status = "error"; rowUpdate.error_message = "Missing required identity fields";
          }
        } else if (rowAction.action === "update_missing_fields" && dupDetail.matchedContactId) {
          // Merge import data into the existing contact WITHOUT overwriting non-empty values.
          // Custom fields are merged key-by-key (existing wins on conflict).
          const contactPatch: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(normalized)) {
            if (key.startsWith("_")) continue;
            if (value === null || value === undefined || value === "") continue;
            if (CONTACT_FIELDS.has(key)) contactPatch[key] = value;
          }
          const newContactCustom = (normalized as any)._contact_custom_fields ?? {};
          const newCompanyCustom = (normalized as any)._company_custom_fields ?? {};

          mergeUpdates.push({
            contactId: dupDetail.matchedContactId,
            companyId: dupDetail.matchedCompanyId,
            patch: contactPatch,
            contactCustom: newContactCustom,
            companyCustom: newCompanyCustom,
          });
        }
        rowUpdates.push(rowUpdate);
      }


      // Company creation (batch) — domain-first dedupe.
      // We collapse multiple pending rows that share a normalized_domain (or, lacking
      // that, a normalized name) into a single new company row.
      const companyStart = performance.now();
      if (pendingContacts.length > 0) {
        const uniqueCompanies = new Map<string, { companyData: Record<string, unknown>; companyName: string; domainKey: string; nameKey: string }>();
        for (const p of pendingContacts) {
          const dedupeKey = p.domainKey ? `d:${p.domainKey}` : (p.nameKey ? `n:${p.nameKey}` : "");
          if (!dedupeKey) continue;
          if (p.domainKey && companyDomainCache.has(p.domainKey)) continue;
          if (!p.domainKey && p.nameKey && companyNameCache.has(p.nameKey)) continue;
          if (uniqueCompanies.has(dedupeKey)) continue;
          uniqueCompanies.set(dedupeKey, {
            companyData: p.companyData, companyName: p.companyName,
            domainKey: p.domainKey, nameKey: p.nameKey,
          });
        }
        if (uniqueCompanies.size > 0) {
          const toCreate = Array.from(uniqueCompanies.values()).map((val) => {
            const cd = { ...val.companyData };
            delete (cd as any).__derivedName;
            // normalized_name AND normalized_domain are GENERATED columns — never
            // include them in the insert payload or Postgres rejects the row.
            delete (cd as any).normalized_name;
            delete (cd as any).normalized_domain;
            return {
              name: val.companyName,
              workspace_id: job.workspace_id ?? null, created_by: userId,
              ...cd,
            };
          });
          const { data: created, error: compErr } = await (supabase.from("companies") as any)
            .insert(toCreate).select("id, name, normalized_name, domain, normalized_domain, external_account_id, website, company_linkedin_url");
          if (!compErr && created) {
            for (const c of created as ExistingCompany[]) {
              const nameK = c.normalized_name || normalizeCompanyName(c.name);
              companyNameCache.set(nameK, c.id);
              companyIndex.nameMap.set(nameK, c);
              const nd = (c.normalized_domain && c.normalized_domain.trim())
                ? c.normalized_domain.trim().toLowerCase()
                : (c.domain ? normalizeDomain(c.domain) : (c.website ? normalizeDomain(c.website) : ""));
              if (nd) {
                companyDomainCache.set(nd, c.id);
                companyIndex.domainMap.set(nd, c);
              }
              if (c.external_account_id) companyIndex.extIdMap.set(c.external_account_id, c);
              if (c.company_linkedin_url) companyIndex.linkedinMap.set(normalizeLinkedIn(c.company_linkedin_url), c);
            }
          } else if (compErr) {
            console.warn(`[import] Company batch insert error: ${compErr.message}`);
          }
        }
        for (const p of pendingContacts) {
          let cid: string | undefined;
          if (p.domainKey) cid = companyDomainCache.get(p.domainKey);
          if (!cid && p.nameKey) cid = companyNameCache.get(p.nameKey);
          if (cid) { p.contact.company_id = cid; p.rowUpdate.company_id = cid; }
          if (p.contact.email || p.contact.first_name || p.contact.last_name) {
            readyContacts.push({ rowId: p.rowId, rowUpdate: p.rowUpdate, contact: p.contact });
          } else { p.rowUpdate.status = "error"; p.rowUpdate.error_message = "Missing identity fields"; }
        }
      }

      const companyMs = Math.round(performance.now() - companyStart);

      // Duplicate merge path: fill blank standard fields + merge custom_fields without overwriting.
      const mergeStart = performance.now();
      if (mergeUpdates.length > 0) {
        const ids = Array.from(new Set(mergeUpdates.map((m) => m.contactId)));
        const { data: existingForMerge } = await (supabase.from("contacts") as any)
          .select("id, company_id, custom_fields, " + Array.from(CONTACT_FIELDS).join(", "))
          .in("id", ids);
        const existingById = new Map<string, any>();
        for (const e of (existingForMerge ?? [])) existingById.set(e.id, e);

        const companyIdsForMerge = Array.from(new Set(mergeUpdates
          .map((m) => m.companyId || existingById.get(m.contactId)?.company_id)
          .filter(Boolean))) as string[];
        const existingCompaniesById = new Map<string, any>();
        if (companyIdsForMerge.length > 0) {
          const { data: ec } = await (supabase.from("companies") as any)
            .select("id, custom_fields").in("id", companyIdsForMerge);
          for (const c of (ec ?? [])) existingCompaniesById.set(c.id, c);
        }

        for (const m of mergeUpdates) {
          const existing = existingById.get(m.contactId);
          if (!existing) continue;
          // Only fill blanks for standard fields — never overwrite non-empty existing data.
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(m.patch)) {
            if (existing[k] === null || existing[k] === undefined || existing[k] === "") patch[k] = v;
          }
          // Merge contact custom_fields: existing wins on conflict.
          if (Object.keys(m.contactCustom).length > 0) {
            const merged = { ...(m.contactCustom), ...(existing.custom_fields || {}) };
            patch.custom_fields = merged;
          }
          if (Object.keys(patch).length > 0) {
            await (supabase.from("contacts") as any).update(patch).eq("id", m.contactId);
          }
          // Merge company custom_fields onto matched company (existing wins).
          const cid = m.companyId || existing.company_id;
          if (cid && Object.keys(m.companyCustom).length > 0) {
            const existingCo = existingCompaniesById.get(cid);
            const mergedCo = { ...(m.companyCustom), ...((existingCo?.custom_fields) || {}) };
            await (supabase.from("companies") as any).update({ custom_fields: mergedCo }).eq("id", cid);
          }
        }
      }
      const mergeMs = Math.round(performance.now() - mergeStart);

      // Contact insertion with retry
      const insertStart = performance.now();
      const { inserted, failedEntries } = await insertContactsWithRetry(supabase, readyContacts, contactIndex, workspaceScope);
      addToContactIndex(contactIndex, inserted);
      const insertMs = Math.round(performance.now() - insertStart);


      // List assignment
      const listStart = performance.now();
      if (settings.list_id) {
        const contactIdsForList = Array.from(new Set(
          rowUpdates
            .filter((u) => ["success", "skipped", "duplicate"].includes(u.status) && u.contact_id)
            .map((u) => u.contact_id as string)
        ));
        const listRows = contactIdsForList.map((contactId) => ({ list_id: settings.list_id, contact_id: contactId, added_by: userId }));
        for (let li = 0; li < listRows.length; li += 1000) {
          await (supabase.from("list_contacts") as any).upsert(listRows.slice(li, li + 1000), { onConflict: "list_id,contact_id" });
        }
      }
      const listMs = Math.round(performance.now() - listStart);

      // Count results
      let batchSuccess = 0, batchError = 0, batchDuplicate = 0, batchReview = 0;
      for (const u of rowUpdates) {
        if (u.status === "success") batchSuccess++;
        else if (u.status === "error") batchError++;
        else if (u.status === "review") batchReview++;
        else if (u.status === "skipped" || u.status === "duplicate") batchDuplicate++;
      }

      // FIX: Use update (not upsert) to avoid NOT NULL constraint on import_job_id
      const rowUpdateStart = performance.now();
      const updateFailCount = await updateRowStatuses(supabase, rowUpdates, job_id);
      const rowUpdateMs = Math.round(performance.now() - rowUpdateStart);

      if (updateFailCount > 0) {
        console.error(`[import] ${updateFailCount} row status updates failed in batch ${batchIndex}`);
      }

      processedRows += rowUpdates.length;
      successRows += batchSuccess;
      errorRows += batchError + failedEntries.length;
      duplicateRows += batchDuplicate;
      reviewRows += batchReview;
      insertedRows += inserted.length;

      // INTEGRITY CAP: counters must never exceed staged rows
      if (processedRows > totalStagedRows) {
        console.error(`[import] INTEGRITY VIOLATION: processedRows ${processedRows} > totalStagedRows ${totalStagedRows}. Capping and failing.`);
        processedRows = totalStagedRows;
        throw new Error(`Counter integrity violation: processed rows exceeded staged total (${totalStagedRows}).`);
      }

      updateDiag({
        phase: "processing_batch", last_progress_at: nowIso(),
        timings: { normalize_ms: normalizeMs, company_match_ms: companyMs, contact_insert_ms: insertMs, list_assign_ms: listMs, row_update_ms: rowUpdateMs },
        recent_batches: [{
          batch: batchIndex, rows: rowUpdates.length,
          range: `${firstRow}-${lastRow}`,
          processed: processedRows,
          inserted: insertedRows, errors: errorRows + failedEntries.length,
          dupes: duplicateRows, review: batchReview,
          at: nowIso(),
        }],
      });

      // Throttle progress updates: every batch for small jobs, every 3rd for large
      if (batchIndex <= 5 || batchIndex % 3 === 0 || pendingRows.length < BATCH_SIZE) {
        await supabase.from("import_jobs").update({
          status: "processing", processed_rows: processedRows, success_rows: successRows,
          inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
          review_rows: reviewRows, error_summary: diag,
        }).eq("id", job_id);
      }

      console.log(`[import] Batch ${batchIndex} done: +${rowUpdates.length} processed (${processedRows}/${totalStagedRows}), +${inserted.length} inserted, +${batchError + failedEntries.length} errors, +${batchDuplicate} dupes`);
    }

    // ── Final reconciliation ──────────────────────────────────
    // Query actual row-status counts from the DB (source of truth)
    const [
      { count: pendingCount },
      { count: totalJobRowsCount },
      { count: dbSuccess },
      { count: dbError },
      { count: dbSkipped },
      { count: dbReview },
    ] = await Promise.all([
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id).eq("status", "pending"),
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id),
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id).eq("status", "success"),
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id).eq("status", "error"),
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id).in("status", ["skipped", "duplicate"]),
      (supabase.from("import_job_rows") as any).select("id", { count: "exact", head: true }).eq("import_job_id", job_id).eq("status", "review"),
    ]);

    const actualTotal = totalJobRowsCount ?? 0;
    const reconSuccess = dbSuccess ?? 0;
    const reconError = dbError ?? 0;
    const reconDupes = dbSkipped ?? 0;
    const reconReview = dbReview ?? 0;
    const reconPending = pendingCount ?? 0;
    const reconSum = reconSuccess + reconError + reconDupes + reconReview + reconPending;

    // Use DB-authoritative counts instead of in-memory accumulators
    processedRows = reconSuccess + reconError + reconDupes + reconReview;
    successRows = reconSuccess;
    errorRows = reconError;
    duplicateRows = reconDupes;
    reviewRows = reconReview;

    // Planned rows = what the wizard told us to expect for this job/child.
    // If staged rows < planned rows, the browser upload aborted mid-stream and we
    // MUST NOT mark this job completed — surface it as incomplete_staging instead.
    const plannedTotal = Number(job.total_rows ?? 0);
    const missingStaged = Math.max(0, plannedTotal - actualTotal);
    const isIncompleteStaging = plannedTotal > 0 && actualTotal < plannedTotal;

    const reconciliation = {
      planned: plannedTotal,
      staged: actualTotal,
      missing_staged: missingStaged,
      success: reconSuccess,
      errors: reconError,
      duplicates: reconDupes,
      review: reconReview,
      pending: reconPending,
      sum: reconSum,
      matches_staged: reconSum === actualTotal,
      matches_planned: actualTotal === plannedTotal,
    };

    console.log(`[import] Reconciliation: planned=${plannedTotal}, staged=${actualTotal}, success=${reconSuccess}, errors=${reconError}, dupes=${reconDupes}, review=${reconReview}, pending=${reconPending}, sum=${reconSum}`);

    // RULE: staged rows must equal planned rows. Empty/short children become incomplete_staging, not completed.
    if (isIncompleteStaging) {
      const reason = `incomplete_staging`;
      console.error(`[import] Incomplete staging: planned ${plannedTotal} rows, only ${actualTotal} staged (${missingStaged} missing).`);
      updateDiag({ phase: "incomplete_staging", last_progress_at: nowIso(), reconciliation });
      await supabase.from("import_jobs").update({
        status: "failed", processed_rows: processedRows, success_rows: successRows,
        inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
        review_rows: reviewRows, completed_at: nowIso(),
        error_summary: {
          ...diag,
          reason,
          incomplete_staging: true,
          planned_rows: plannedTotal,
          staged_rows: actualTotal,
          missing_staged_rows: missingStaged,
          note: "Browser-side row upload did not stage all planned rows. Use Repair missing staged rows.",
          reconciliation,
          field_report: fieldReport,
        },
      }).eq("id", job_id);
      return new Response(JSON.stringify({ success: false, job_id, reason, reconciliation }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RULE: sum of all statuses must equal staged total
    if (reconSum !== actualTotal) {
      const reason = `Reconciliation failure: status sum (${reconSum}) ≠ staged rows (${actualTotal}). success=${reconSuccess}, errors=${reconError}, dupes=${reconDupes}, review=${reconReview}, pending=${reconPending}`;
      console.error(`[import] ${reason}`);
      updateDiag({ phase: "failed_reconciliation", last_progress_at: nowIso(), reconciliation });
      await supabase.from("import_jobs").update({
        status: "failed", processed_rows: processedRows, success_rows: successRows,
        inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
        review_rows: reviewRows, completed_at: nowIso(),
        error_summary: { ...diag, reason, reconciliation, field_report: fieldReport },
      }).eq("id", job_id);
      return new Response(JSON.stringify({ success: false, job_id, reason, reconciliation }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RULE: no pending rows allowed
    if (reconPending > 0) {
      const reason = `${reconPending} rows still pending after all batches processed.`;
      console.error(`[import] ${reason}`);
      updateDiag({ phase: "failed_pending_remaining", last_progress_at: nowIso(), reconciliation });
      await supabase.from("import_jobs").update({
        status: "failed", processed_rows: processedRows, success_rows: successRows,
        inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
        review_rows: reviewRows, completed_at: nowIso(),
        error_summary: { ...diag, reason, reconciliation, field_report: fieldReport },
      }).eq("id", job_id);
      return new Response(JSON.stringify({ success: false, job_id, reason, reconciliation }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RULE: processed must not exceed staged
    if (processedRows > actualTotal) {
      const reason = `Counter integrity failure: processed (${processedRows}) > staged (${actualTotal})`;
      console.error(`[import] ${reason}`);
      updateDiag({ phase: "failed_integrity", last_progress_at: nowIso(), reconciliation });
      await supabase.from("import_jobs").update({
        status: "failed", processed_rows: processedRows, success_rows: successRows,
        inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
        review_rows: reviewRows, completed_at: nowIso(),
        error_summary: { ...diag, reason, reconciliation, field_report: fieldReport },
      }).eq("id", job_id);
      return new Response(JSON.stringify({ success: false, job_id, reason, reconciliation }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify inserted count in DB
    let verifiedCount = 0;
    if (job.workspace_id) {
      const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true })
        .eq("workspace_id", job.workspace_id).eq("source_file", job.file_name);
      verifiedCount = count ?? 0;
    }

    updateDiag({
      phase: "completed", last_progress_at: nowIso(),
      total_batches: batchIndex,
      verified_db_count: verifiedCount,
      total_staged_rows: actualTotal,
      expected_rows: Number(job.total_rows ?? 0),
      reconciliation,
    });

    const mismatchWarning = verifiedCount > 0 && verifiedCount !== insertedRows
      ? `Verification: ${insertedRows} inserted vs ${verifiedCount} found in DB.`
      : null;

    console.log(`[import] Job ${job_id} completed: ${processedRows} processed, ${insertedRows} inserted, ${errorRows} errors, ${duplicateRows} dupes${mismatchWarning ? '. ' + mismatchWarning : ''}`);

    // Mark this job (child or standalone) completed FIRST so the parent finalize
    // claim can correctly see all siblings as done.
    await supabase.from("import_jobs").update({
      status: "completed", processed_rows: processedRows, success_rows: successRows,
      inserted_rows: insertedRows, error_rows: errorRows, duplicate_rows: duplicateRows,
      review_rows: reviewRows, completed_at: nowIso(),
      error_summary: {
        ...diag,
        ...(mismatchWarning ? { verification_warning: mismatchWarning } : {}),
        reconciliation,
        field_report: fieldReport,
      },
    }).eq("id", job_id);

    // Post-processing: company-domain dedupe.
    //  - For a child of a parent batch import: only run once at the parent level,
    //    after all siblings are completed. Uses try_claim_parent_finalize() for
    //    atomic idempotency so concurrent child completions can't double-fire.
    //  - For a standalone import: kick off the workspace dedupe in the background
    //    so it never blocks job completion (and never trips a statement timeout).
    try {
      const parentId = (job as any).parent_job_id as string | null | undefined;
      if (parentId) {
        const { data: claimed, error: claimErr } = await (supabase as any).rpc(
          "try_claim_parent_finalize", { p_parent_job_id: parentId }
        );
        if (claimErr) {
          console.warn(`[import] try_claim_parent_finalize warning: ${claimErr.message}`);
        } else if (claimed === true) {
          console.log(`[import] Won parent finalize claim for ${parentId} — invoking run-company-dedupe`);
          // Fire-and-forget; the edge function runs in background via waitUntil.
          void supabase.functions.invoke("run-company-dedupe", {
            body: {
              workspace_id: job.workspace_id,
              parent_job_id: parentId,
              chunk: 15,
            },
          }).catch((e) => console.warn(`[import] run-company-dedupe (parent) invoke failed:`, e));
        } else {
          console.log(`[import] Parent ${parentId} not ready to finalize yet (siblings pending or already claimed)`);
        }
      } else if (job.workspace_id) {
        // Standalone import → background dedupe sweep
        void supabase.functions.invoke("run-company-dedupe", {
          body: { workspace_id: job.workspace_id, chunk: 15 },
        }).catch((e) => console.warn(`[import] run-company-dedupe (standalone) invoke failed:`, e));
      }
    } catch (e) {
      console.warn(`[import] post-processing dispatch failed:`, e);
    }

    return new Response(JSON.stringify({
      success: true, job_id, processed_rows: processedRows, inserted_rows: insertedRows,
      verified_db_count: verifiedCount, batches: batchIndex, field_report: fieldReport,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[import] Fatal error: ${err?.message}`, err?.stack);
    if (job?.id && jobIdForCatch) {
      updateDiag({ phase: "failed", last_progress_at: nowIso() });
      await supabase.from("import_jobs").update({
        status: "failed", completed_at: nowIso(),
        error_summary: { ...diag, reason: err?.message },
      }).eq("id", jobIdForCatch);
    }
    return new Response(JSON.stringify({ error: err?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
