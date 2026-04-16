/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const BATCH_SIZE = 1000;
const MAX_TIMING_BATCHES = 20;

const RequestSchema = z.object({
  job_id: z.string().uuid(),
});

type ExistingContact = {
  id: string;
  email: string | null;
  secondary_email: string | null;
  tertiary_email: string | null;
  linkedin_url: string | null;
  external_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name_raw: string | null;
  phone: string | null;
};

type ExistingCompany = {
  id: string;
  name: string;
  normalized_name: string | null;
  domain: string | null;
  external_account_id: string | null;
  website: string | null;
};

type ImportSettings = {
  duplicate_strategy: string;
  skip_exact_duplicates: boolean;
  update_missing_fields: boolean;
  review_likely_duplicates: boolean;
  review_company_conflicts: boolean;
  create_if_no_strong_match: boolean;
  unmapped_columns: string[];
  import_tag: string;
  source: string;
  list_id: string | null;
};

type Diagnostics = {
  phase?: string;
  last_progress_at?: string;
  uploaded_rows?: number;
  total_rows?: number;
  batch_size?: number;
  recent_batches?: Array<Record<string, unknown>>;
  timings?: Record<string, number>;
};

function nowIso() {
  return new Date().toISOString();
}

function isEmptyLike(v: string): boolean {
  const lower = v.trim().toLowerCase();
  return lower === "" || lower === "n/a" || lower === "na" || lower === "null" ||
    lower === "undefined" || lower === "none" || lower === "-" || lower === "--" ||
    lower === "not available" || lower === "not provided" || lower === "#n/a";
}

function normalizeEmail(val: string): string {
  return val.toLowerCase().trim().replace(/^mailto:/i, "").replace(/\s+/g, "");
}

function normalizeLinkedIn(val: string): string {
  let url = val.trim();
  url = url.split("?")[0].split("#")[0];
  url = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  url = url.replace(/\/+$/, "");
  if (!url.startsWith("linkedin.com")) {
    const idx = url.indexOf("linkedin.com");
    if (idx >= 0) url = url.substring(idx);
    else url = "linkedin.com/in/" + url;
  }
  return "https://www." + url;
}

function normalizeDomain(val: string): string {
  let d = val.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  return d;
}

function normalizeWebsite(val: string): string {
  let url = val.trim().toLowerCase();
  if (!url.startsWith("http")) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

function normalizePhone(val: string): string {
  const trimmed = val.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? "+" + digits : digits;
}

function normalizeCompanyName(val: string): string {
  let name = val.trim().toLowerCase();
  name = name.replace(/\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|sas|sarl|bv|nv|pty\.?\s*ltd\.?|pvt\.?\s*ltd\.?)\s*\.?\s*$/gi, "");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/[,.\-]+$/, "").trim();
  return name;
}

function titleCase(val: string): string {
  return val.trim().replace(/\s+/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

const FIELD_TYPES: Record<string, "string" | "number" | "array" | "date"> = {
  first_name: "string",
  last_name: "string",
  email: "string",
  secondary_email: "string",
  tertiary_email: "string",
  personal_email: "string",
  job_title: "string",
  seniority_level: "string",
  department: "string",
  headline: "string",
  bio: "string",
  persona: "string",
  linkedin_url: "string",
  twitter_url: "string",
  facebook_url: "string",
  github_url: "string",
  photo_url: "string",
  years_experience: "number",
  skills: "array",
  languages: "array",
  job_change_date: "date",
  current_role_start_date: "date",
  phone: "string",
  work_direct_phone: "string",
  mobile_phone: "string",
  corporate_phone: "string",
  home_phone: "string",
  other_phone: "string",
  country: "string",
  city: "string",
  state: "string",
  address: "string",
  postal_code: "string",
  timezone: "string",
  company_name_raw: "string",
  domain: "string",
  website: "string",
  industry: "string",
  employee_count: "number",
  employee_range: "string",
  revenue_range: "string",
  company_address: "string",
  company_city: "string",
  company_state: "string",
  company_country: "string",
  company_phone: "string",
  company_linkedin_url: "string",
  annual_revenue: "number",
  total_funding: "number",
  latest_funding: "string",
  latest_funding_amount: "number",
  last_raised_at: "date",
  funding_stage: "string",
  founded_year: "number",
  company_type: "string",
  headquarters: "string",
  technologies: "array",
  keywords: "array",
  specialties: "array",
  market_segments: "array",
  territories: "array",
  sic_code: "string",
  naics_code: "string",
  stock_ticker: "string",
  headcount_growth_pct: "number",
  external_source: "string",
  external_contact_id: "string",
  external_account_id: "string",
};

function normalizeRow(raw: Record<string, string>, mapping: Record<string, string>) {
  const normalized: Record<string, unknown> = {};
  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    const rawVal = raw[csvCol] ?? "";
    let val = rawVal.trim().replace(/\s+/g, " ");
    if (isEmptyLike(val)) {
      normalized[fieldKey] = null;
      continue;
    }

    if (fieldKey === "email" || fieldKey === "secondary_email" || fieldKey === "tertiary_email") {
      val = normalizeEmail(val);
    } else if (fieldKey === "linkedin_url" || fieldKey === "company_linkedin_url") {
      val = normalizeLinkedIn(val);
    } else if (fieldKey === "domain") {
      val = normalizeDomain(val);
    } else if (fieldKey === "website") {
      val = normalizeWebsite(val);
    } else if (fieldKey.includes("phone")) {
      val = normalizePhone(val);
    } else if (
      fieldKey === "country" || fieldKey === "city" || fieldKey === "state" ||
      fieldKey === "company_city" || fieldKey === "company_state" || fieldKey === "company_country"
    ) {
      val = titleCase(val);
    }

    const type = FIELD_TYPES[fieldKey] ?? "string";
    if (type === "number") {
      const num = Number(String(val).replace(/[,$\s]/g, ""));
      normalized[fieldKey] = Number.isNaN(num) ? null : num;
      continue;
    }
    if (type === "array") {
      normalized[fieldKey] = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      continue;
    }

    normalized[fieldKey] = val;
  }
  return normalized;
}

function buildContactIndex(contacts: ExistingContact[]) {
  const emailMap = new Map<string, ExistingContact>();
  const linkedinMap = new Map<string, ExistingContact>();
  const extIdMap = new Map<string, ExistingContact>();
  const phoneMap = new Map<string, ExistingContact>();
  const nameCompanyMap = new Map<string, ExistingContact>();

  for (const c of contacts) {
    if (c.email) emailMap.set(c.email.toLowerCase(), c);
    if (c.secondary_email) emailMap.set(c.secondary_email.toLowerCase(), c);
    if (c.tertiary_email) emailMap.set(c.tertiary_email.toLowerCase(), c);
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

  for (const c of companies) {
    if (c.domain) domainMap.set(normalizeDomain(c.domain), c);
    if (c.external_account_id) extIdMap.set(c.external_account_id, c);
    if (c.normalized_name) nameMap.set(c.normalized_name.toLowerCase(), c);
    else if (c.name) nameMap.set(normalizeCompanyName(c.name), c);
    if (c.website) domainMap.set(normalizeDomain(c.website), c);
  }

  return { domainMap, extIdMap, nameMap };
}

function checkDuplicatesAdvanced(
  rows: Record<string, unknown>[],
  contactIndex: ReturnType<typeof buildContactIndex>,
  companyIndex: ReturnType<typeof buildCompanyIndex>
) {
  const details: Array<{ classification: string; matchedContactId: string | null; matchedCompanyId: string | null; reason: string | null; }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string | null | undefined>;
    const email = String(row.email ?? "").toLowerCase().trim();
    const secEmail = String(row.secondary_email ?? "").toLowerCase().trim();
    const terEmail = String(row.tertiary_email ?? "").toLowerCase().trim();
    const linkedin = row.linkedin_url ? normalizeLinkedIn(String(row.linkedin_url)) : "";
    const extId = String(row.external_contact_id ?? "").trim();
    const phone = row.phone ? normalizePhone(String(row.phone)) : "";
    const firstName = String(row.first_name ?? "").toLowerCase().trim();
    const lastName = String(row.last_name ?? "").toLowerCase().trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const companyRaw = String(row.company_name_raw ?? "").trim();
    const companyNorm = companyRaw ? normalizeCompanyName(companyRaw) : "";
    const domain = row.domain ? normalizeDomain(String(row.domain)) : "";
    const extAccountId = String(row.external_account_id ?? "").trim();

    if (!email && !secEmail && !firstName && !lastName) {
      details.push({ classification: "invalid", matchedContactId: null, matchedCompanyId: null, reason: "Missing email and name" });
      continue;
    }

    let match: ExistingContact | undefined;
    let confidence = 0;
    let matchType: string | null = null;
    for (const e of [email, secEmail, terEmail].filter(Boolean)) {
      const found = contactIndex.emailMap.get(e);
      if (found) {
        match = found;
        confidence = 100;
        matchType = `Exact email: ${e}`;
        break;
      }
    }
    if (!match && linkedin) {
      const found = contactIndex.linkedinMap.get(linkedin);
      if (found) {
        match = found;
        confidence = 95;
        matchType = "Exact LinkedIn URL";
      }
    }
    if (!match && extId) {
      const found = contactIndex.extIdMap.get(extId);
      if (found) {
        match = found;
        confidence = 95;
        matchType = `External ID: ${extId}`;
      }
    }
    if (!match && fullName && domain) {
      const companyMatch = companyIndex.domainMap.get(domain);
      if (companyMatch) {
        const found = contactIndex.nameCompanyMap.get(`${fullName}|${(companyMatch.normalized_name || normalizeCompanyName(companyMatch.name)).toLowerCase()}`);
        if (found) {
          match = found;
          confidence = 80;
          matchType = "Name + company domain match";
        }
      }
    }
    if (!match && fullName && companyNorm) {
      const found = contactIndex.nameCompanyMap.get(`${fullName}|${companyNorm}`);
      if (found) {
        match = found;
        confidence = 70;
        matchType = "Name + company name match";
      }
    }
    if (!match && phone && phone.length >= 7) {
      const found = contactIndex.phoneMap.get(phone);
      if (found) {
        match = found;
        confidence = 55;
        matchType = "Phone number match";
      }
    }

    let companyMatch: ExistingCompany | undefined;
    if (domain) companyMatch = companyIndex.domainMap.get(domain);
    if (!companyMatch && extAccountId) companyMatch = companyIndex.extIdMap.get(extAccountId);
    if (!companyMatch && companyNorm) companyMatch = companyIndex.nameMap.get(companyNorm);

    if (match) {
      details.push({
        classification: confidence >= 90 ? "exact_duplicate" : confidence >= 65 ? "likely_duplicate" : "review_required",
        matchedContactId: match.id,
        matchedCompanyId: companyMatch?.id ?? null,
        reason: matchType,
      });
    } else {
      details.push({ classification: "new", matchedContactId: null, matchedCompanyId: companyMatch?.id ?? null, reason: null });
    }
  }

  return details;
}

function classifyRowAction(classification: string, settings: ImportSettings) {
  switch (classification) {
    case "invalid":
      return { status: "error", action: null, reviewRequired: false };
    case "exact_duplicate":
      if (settings.skip_exact_duplicates) return { status: "skipped", action: "skipped_exact_duplicate", reviewRequired: false };
      if (settings.update_missing_fields) return { status: "success", action: "update_missing_fields", reviewRequired: false };
      return { status: "review", action: "exact_duplicate_flagged", reviewRequired: true };
    case "likely_duplicate":
      if (settings.review_likely_duplicates) return { status: "review", action: "likely_duplicate_flagged", reviewRequired: true };
      if (settings.update_missing_fields) return { status: "success", action: "update_missing_fields", reviewRequired: false };
      return { status: "review", action: "likely_duplicate_flagged", reviewRequired: true };
    case "review_required":
      return { status: "review", action: "low_confidence_match", reviewRequired: true };
    default:
      return { status: "success", action: "create_new", reviewRequired: false };
  }
}

function getScopedQuery<T>(supabase: ReturnType<typeof createClient>, table: string, workspaceId: string | null, userId: string) {
  let query = supabase.from(table).select("*");
  if (workspaceId) return query.eq("workspace_id", workspaceId);
  return query.eq("created_by", userId);
}

function mergeDiagnostics(existing: any, incoming: Partial<Diagnostics>) {
  const prev = (existing && typeof existing === "object" && existing.diagnostics && typeof existing.diagnostics === "object")
    ? existing.diagnostics
    : {};
  const recentBatches = [...(prev.recent_batches ?? []), ...(incoming.recent_batches ?? [])].slice(-MAX_TIMING_BATCHES);
  const timings = { ...(prev.timings ?? {}) };
  for (const [key, value] of Object.entries(incoming.timings ?? {})) {
    timings[key] = Number((timings[key] ?? 0)) + Number(value ?? 0);
  }
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    diagnostics: {
      ...prev,
      ...incoming,
      recent_batches: recentBatches,
      timings,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  let job: any = null;
  let diagnosticsEnvelope: any = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = authData.user.id;

    const parsedBody = RequestSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = parsedBody.data;
    const { data: fetchedJob, error: jobErr } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !fetchedJob) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }
    job = fetchedJob;

    if (job.workspace_id) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("user_id", userId)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    } else if (job.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    diagnosticsEnvelope = mergeDiagnostics(job.error_summary, {
      phase: "loading_existing_records",
      last_progress_at: nowIso(),
      total_rows: job.total_rows,
      batch_size: BATCH_SIZE,
    });

    await supabase.from("import_jobs").update({
      status: "processing",
      started_at: job.started_at ?? nowIso(),
      error_summary: diagnosticsEnvelope,
    }).eq("id", job_id);

    const preloadStart = performance.now();
    const scopedContactsQuery = getScopedQuery(supabase, "contacts", job.workspace_id, userId)
      .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone")
      .limit(100000) as any;
    const scopedCompaniesQuery = getScopedQuery(supabase, "companies", job.workspace_id, userId)
      .select("id, name, normalized_name, domain, external_account_id, website")
      .limit(100000) as any;

    const [{ data: existingContacts }, { data: existingCompanies }] = await Promise.all([
      scopedContactsQuery,
      scopedCompaniesQuery,
    ]);

    const contactIndex = buildContactIndex((existingContacts ?? []) as ExistingContact[]);
    const companyIndex = buildCompanyIndex((existingCompanies ?? []) as ExistingCompany[]);
    const companyCache = new Map<string, string>();
    for (const c of (existingCompanies ?? []) as ExistingCompany[]) {
      companyCache.set(normalizeCompanyName(c.name), c.id);
    }

    diagnosticsEnvelope = mergeDiagnostics(diagnosticsEnvelope, {
      timings: { preload_existing_ms: Math.round(performance.now() - preloadStart) },
    });

    const settings = (job.settings ?? {}) as ImportSettings;
    const mapping = (job.column_mapping ?? {}) as Record<string, string>;
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

    let processedRows = Number(job.processed_rows ?? 0);
    let successRows = Number(job.success_rows ?? 0);
    let insertedRows = Number(job.inserted_rows ?? 0);
    let errorRows = Number(job.error_rows ?? 0);
    let duplicateRows = Number(job.duplicate_rows ?? 0);
    let reviewRows = Number(job.review_rows ?? 0);
    let batchIndex = 0;

    while (true) {
      const batchFetchStart = performance.now();
      const { data: pendingRows, error: pendingErr } = await supabase
        .from("import_job_rows")
        .select("id, row_number, raw_data")
        .eq("import_job_id", job_id)
        .eq("status", "pending")
        .order("row_number", { ascending: true })
        .limit(BATCH_SIZE);

      if (pendingErr) throw pendingErr;
      if (!pendingRows || pendingRows.length === 0) break;

      batchIndex += 1;
      const normalizeStart = performance.now();
      const normalizedRows = pendingRows.map((row: any) => normalizeRow(row.raw_data ?? {}, mapping));
      const duplicateDetails = checkDuplicatesAdvanced(normalizedRows, contactIndex, companyIndex);

      const rowUpdates: any[] = [];
      const pendingContacts: Array<{ rowId: string; rowUpdate: any; contact: Record<string, unknown>; companyData: Record<string, unknown>; companyKey: string; companyName: string; }> = [];
      const readyContacts: Array<{ rowId: string; rowUpdate: any; contact: Record<string, unknown>; }> = [];

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
            workspace_id: job.workspace_id ?? null,
            created_by: userId,
            import_tag: settings.import_tag || null,
            source: settings.source || null,
            source_file: job.file_name,
          };
          const companyData: Record<string, unknown> = {};
          let hasCompanyFields = false;
          for (const [key, value] of Object.entries(normalized)) {
            if (value === null || value === undefined) continue;
            if (CONTACT_FIELDS.has(key)) contact[key] = value;
            if (COMPANY_FIELDS.has(key)) {
              companyData[key] = value;
              hasCompanyFields = true;
            }
          }
          if (!contact.city && normalized.company_city) contact.city = normalized.company_city;
          if (!contact.state && normalized.company_state) contact.state = normalized.company_state;
          if (!contact.country && normalized.company_country) contact.country = normalized.company_country;

          const companyName = String(contact.company_name_raw ?? "").trim();
          const companyKey = companyName ? normalizeCompanyName(companyName) : "";
          const matchedCompanyId = rowUpdate.company_id ?? (companyKey ? companyCache.get(companyKey) : null);
          if (matchedCompanyId) {
            contact.company_id = matchedCompanyId;
            rowUpdate.company_id = matchedCompanyId;
          }

          if (companyName && hasCompanyFields && !rowUpdate.company_id) {
            pendingContacts.push({ rowId: row.id, rowUpdate, contact, companyData, companyKey, companyName });
          } else if (contact.email || contact.first_name || contact.last_name) {
            readyContacts.push({ rowId: row.id, rowUpdate, contact });
          } else {
            rowUpdate.status = "error";
            rowUpdate.error_message = "Missing required identity fields after normalization";
          }
        }

        rowUpdates.push(rowUpdate);
      }

      const normalizeMs = Math.round(performance.now() - normalizeStart);

      const companyStart = performance.now();
      if (pendingContacts.length > 0) {
        const uniqueCompanies = new Map<string, { companyData: Record<string, unknown>; companyName: string }>();
        for (const pending of pendingContacts) {
          if (!pending.companyKey || companyCache.has(pending.companyKey) || uniqueCompanies.has(pending.companyKey)) continue;
          uniqueCompanies.set(pending.companyKey, { companyData: pending.companyData, companyName: pending.companyName });
        }

        if (uniqueCompanies.size > 0) {
          const companiesToCreate = Array.from(uniqueCompanies.entries()).map(([companyKey, value]) => ({
            name: value.companyName,
            normalized_name: companyKey,
            normalized_domain: value.companyData.domain ? normalizeDomain(String(value.companyData.domain)) : null,
            workspace_id: job.workspace_id ?? null,
            created_by: userId,
            ...value.companyData,
          }));

          const { data: createdCompanies, error: companyErr } = await (supabase.from("companies") as any)
            .insert(companiesToCreate)
            .select("id, name, normalized_name, domain, external_account_id, website");

          if (!companyErr) {
            for (const company of (createdCompanies ?? []) as ExistingCompany[]) {
              const key = company.normalized_name || normalizeCompanyName(company.name);
              companyCache.set(key, company.id);
              companyIndex.nameMap.set(key, company);
              if (company.domain) companyIndex.domainMap.set(normalizeDomain(company.domain), company);
              if (company.website) companyIndex.domainMap.set(normalizeDomain(company.website), company);
              if (company.external_account_id) companyIndex.extIdMap.set(company.external_account_id, company);
            }
          }
        }

        for (const pending of pendingContacts) {
          const companyId = pending.companyKey ? companyCache.get(pending.companyKey) : null;
          if (companyId) {
            pending.contact.company_id = companyId;
            pending.rowUpdate.company_id = companyId;
          }
          if (pending.contact.email || pending.contact.first_name || pending.contact.last_name) {
            readyContacts.push({ rowId: pending.rowId, rowUpdate: pending.rowUpdate, contact: pending.contact });
          } else {
            pending.rowUpdate.status = "error";
            pending.rowUpdate.error_message = "Missing required identity fields after normalization";
          }
        }
      }
      const companyMs = Math.round(performance.now() - companyStart);

      const insertStart = performance.now();
      let insertedContacts: any[] = [];
      if (readyContacts.length > 0) {
        const payload = readyContacts.map((entry) => entry.contact);
        const { data, error } = await supabase
          .from("contacts")
          .insert(payload as any)
          .select("id, email, secondary_email, tertiary_email, linkedin_url, external_contact_id, first_name, last_name, company_name_raw, phone");

        if (error) {
          for (const entry of readyContacts) {
            entry.rowUpdate.status = "error";
            entry.rowUpdate.error_message = error.message;
            entry.rowUpdate.action_taken = null;
          }
        } else {
          insertedContacts = data ?? [];
          insertedContacts.forEach((contact, index) => {
            const entry = readyContacts[index];
            if (!entry) return;
            entry.rowUpdate.contact_id = contact.id;
            const indexedContact = contact as ExistingContact;
            if (indexedContact.email) contactIndex.emailMap.set(indexedContact.email.toLowerCase(), indexedContact);
            if (indexedContact.secondary_email) contactIndex.emailMap.set(indexedContact.secondary_email.toLowerCase(), indexedContact);
            if (indexedContact.tertiary_email) contactIndex.emailMap.set(indexedContact.tertiary_email.toLowerCase(), indexedContact);
            if (indexedContact.linkedin_url) contactIndex.linkedinMap.set(normalizeLinkedIn(indexedContact.linkedin_url), indexedContact);
            if (indexedContact.external_contact_id) contactIndex.extIdMap.set(indexedContact.external_contact_id, indexedContact);
            if (indexedContact.phone) contactIndex.phoneMap.set(normalizePhone(indexedContact.phone), indexedContact);
            const fullName = [indexedContact.first_name, indexedContact.last_name].filter(Boolean).join(" ").toLowerCase().trim();
            const companyKey = indexedContact.company_name_raw ? normalizeCompanyName(indexedContact.company_name_raw) : "";
            if (fullName && companyKey) contactIndex.nameCompanyMap.set(`${fullName}|${companyKey}`, indexedContact);
          });
        }
      }
      const insertMs = Math.round(performance.now() - insertStart);

      const listStart = performance.now();
      if (settings.list_id && insertedContacts.length > 0) {
        await (supabase.from("list_contacts") as any).upsert(
          insertedContacts.map((contact) => ({
            list_id: settings.list_id,
            contact_id: contact.id,
            added_by: userId,
          })),
          { onConflict: "list_id,contact_id" }
        );
      }
      const listMs = Math.round(performance.now() - listStart);

      const finalizeStart = performance.now();
      let batchSuccess = 0;
      let batchError = 0;
      let batchDuplicate = 0;
      let batchReview = 0;

      for (const update of rowUpdates) {
        if (update.status === "success") batchSuccess += 1;
        else if (update.status === "error") batchError += 1;
        else if (update.status === "review") batchReview += 1;
        else if (update.status === "skipped" || update.status === "duplicate") batchDuplicate += 1;
      }

      const { error: rowUpdateErr } = await (supabase.from("import_job_rows") as any).upsert(rowUpdates, { onConflict: "id" });
      if (rowUpdateErr) throw rowUpdateErr;

      processedRows += rowUpdates.length;
      successRows += batchSuccess;
      errorRows += batchError;
      duplicateRows += batchDuplicate;
      reviewRows += batchReview;
      insertedRows += insertedContacts.length;

      diagnosticsEnvelope = mergeDiagnostics(diagnosticsEnvelope, {
        phase: "processing_batch",
        last_progress_at: nowIso(),
        timings: {
          batch_fetch_ms: Math.round(performance.now() - batchFetchStart),
          normalize_ms: normalizeMs,
          company_match_ms: companyMs,
          contact_insert_ms: insertMs,
          list_assign_ms: listMs,
          finalize_batch_ms: Math.round(performance.now() - finalizeStart),
        },
        recent_batches: [{
          batch: batchIndex,
          rows: rowUpdates.length,
          processed_rows: processedRows,
          success_rows: successRows,
          inserted_rows: insertedRows,
          error_rows: errorRows,
          duplicate_rows: duplicateRows,
          review_rows: reviewRows,
          phase: "processing_batch",
          at: nowIso(),
        }],
      });

      await supabase.from("import_jobs").update({
        status: "processing",
        processed_rows: processedRows,
        success_rows: successRows,
        inserted_rows: insertedRows,
        error_rows: errorRows,
        duplicate_rows: duplicateRows,
        review_rows: reviewRows,
        error_summary: diagnosticsEnvelope,
      }).eq("id", job_id);
    }

    const [{ count: pendingCount }, { count: totalJobRowsCount }] = await Promise.all([
      (supabase.from("import_job_rows") as any)
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", job_id)
        .eq("status", "pending"),
      (supabase.from("import_job_rows") as any)
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", job_id),
    ]);

    if ((pendingCount ?? 0) === 0 && (totalJobRowsCount ?? 0) < Number(job.total_rows ?? 0)) {
      diagnosticsEnvelope = mergeDiagnostics(diagnosticsEnvelope, {
        phase: "failed_incomplete_upload",
        last_progress_at: nowIso(),
      });
      await supabase.from("import_jobs").update({
        status: "failed",
        processed_rows: processedRows,
        success_rows: successRows,
        inserted_rows: insertedRows,
        error_rows: errorRows,
        duplicate_rows: duplicateRows,
        review_rows: reviewRows,
        completed_at: nowIso(),
        error_summary: {
          ...diagnosticsEnvelope,
          reason: `Import stopped before all raw rows were staged. Expected ${job.total_rows} rows but found only ${totalJobRowsCount ?? 0}.`,
        },
      }).eq("id", job_id);

      return new Response(JSON.stringify({ success: false, job_id, reason: "incomplete_upload" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    diagnosticsEnvelope = mergeDiagnostics(diagnosticsEnvelope, {
      phase: "completed",
      last_progress_at: nowIso(),
    });

    await supabase.from("import_jobs").update({
      status: "completed",
      processed_rows: processedRows,
      success_rows: successRows,
      inserted_rows: insertedRows,
      error_rows: errorRows,
      duplicate_rows: duplicateRows,
      review_rows: reviewRows,
      completed_at: nowIso(),
      error_summary: diagnosticsEnvelope,
    }).eq("id", job_id);

    return new Response(JSON.stringify({
      success: true,
      job_id,
      processed_rows: processedRows,
      inserted_rows: insertedRows,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (job?.id) {
      const failedEnvelope = mergeDiagnostics(diagnosticsEnvelope ?? job.error_summary, {
        phase: "failed",
        last_progress_at: nowIso(),
      });
      await supabase.from("import_jobs").update({
        status: "failed",
        completed_at: nowIso(),
        error_summary: {
          ...failedEnvelope,
          reason: err?.message || "Import processor failed unexpectedly",
        },
      }).eq("id", job.id);
    }

    return new Response(JSON.stringify({ error: err?.message || "Import processor failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});