/**
 * Identity normalisation for imports and dedup.
 *
 * These functions decide whether two records are the same person or the same
 * company. They previously lived inside the import edge function, untested, and
 * the same class of bug appeared in four separate places: a SQL generated column
 * and the JavaScript normalizer disagreeing about what a key looks like, so an
 * index was built with one spelling and queried with another. No error — just a
 * duplicate record, every time.
 *
 * The mismatches are documented on each function below, because they are not
 * obvious from either side alone. The rule that prevents recurrence: never key an
 * index on a `normalized_*` column directly. Always pass it through the matching
 * function here first.
 *
 * Kept dependency-free so the edge function runs byte-identical logic — see
 * scripts/sync-shared-modules.mjs, enforced by a test.
 */

/** Vendor exports spell "no value" a dozen ways. Treat them all as empty. */
export function isEmptyLike(v: string): boolean {
  const lower = v.trim().toLowerCase();
  return lower === "" || lower === "n/a" || lower === "na" || lower === "null" ||
    lower === "undefined" || lower === "none" || lower === "-" || lower === "--" ||
    lower === "not available" || lower === "not provided" || lower === "#n/a";
}

/**
 * SQL counterpart: contacts.normalized_email is
 *   NULLIF(lower(regexp_replace(coalesce(email,''), '\s', '', 'g')), '')
 * Equivalent for values that passed through here on the way in. This function
 * additionally strips a "mailto:" prefix and zero-width characters, which the
 * column does not — so a raw value written by another code path could differ.
 */
export function normalizeEmail(val: string): string {
  return val.normalize("NFKC").toLowerCase().trim().replace(/^mailto:/i, "").replace(/[\s​-‍﻿]/g, "");
}

/**
 * Canonical LinkedIn profile URL.
 *
 * NOTE: contacts.normalized_linkedin_url is NOT the SQL counterpart of this. It
 * is generated with a `'[/?#].*$'` strip, which removes everything after the
 * first slash — so it evaluates to the bare host "linkedin.com" for every row in
 * the table and cannot identify anybody. Never key on that column.
 */
export function normalizeLinkedIn(val: string): string {
  let url = val.normalize("NFKC").trim().toLowerCase(); url = url.split("?")[0].split("#")[0];
  url = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  if (!url.startsWith("linkedin.com")) {
    const idx = url.indexOf("linkedin.com");
    if (idx >= 0) url = url.substring(idx); else url = "linkedin.com/in/" + url;
  }
  return "https://www." + url;
}

/**
 * Bare registrable host.
 *
 * SQL counterpart: companies.normalized_domain is lower(coalesce(domain,'')),
 * which lowercases but does NOT strip the scheme, "www." or a path. A row stored
 * as "www.acme.com" therefore holds that verbatim while this returns "acme.com".
 * Route the column through companyDomainKey rather than trusting it.
 */
export function normalizeDomain(val: string): string {
  let d = val.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return d.split("/")[0].split("?")[0];
}

export function normalizeWebsite(val: string): string {
  let url = val.trim().toLowerCase();
  if (!url.startsWith("http")) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

/** Digits only, preserving a leading + so country codes survive. */
export function normalizePhone(val: string): string {
  const trimmed = val.trim(); const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? "+" + digits : digits;
}

/**
 * Company name with its legal suffix removed, so "Acme Inc" and "Acme" are one
 * company.
 *
 * SQL counterpart: companies.normalized_name is lower(trim(name)), which KEEPS
 * the suffix. Keying an index on that column while looking up with this function
 * is why companies with Inc/Ltd/LLC/GmbH in their names were never deduped.
 */
export function normalizeCompanyName(val: string): string {
  let name = val.trim().toLowerCase();
  name = name.replace(/\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|sas|sarl|bv|nv|pty\.?\s*ltd\.?|pvt\.?\s*ltd\.?)\s*\.?\s*$/gi, "");
  name = name.replace(/\s+/g, " ").trim().replace(/[,.\-]+$/, "").trim();
  return name;
}

export function titleCase(val: string): string {
  return val.trim().replace(/\s+/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

export const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

/**
 * Free-mail hosts. A shared consumer domain says nothing about which company
 * someone works for, so matching on it would merge unrelated people.
 */
export const GENERIC_EMAIL_HOSTS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com",
  "me.com", "mac.com", "live.com", "msn.com", "proton.me", "protonmail.com",
  "googlemail.com", "yandex.com", "gmx.com", "zoho.com", "fastmail.com", "mail.com",
]);

/** The company domain an imported row implies, preferring explicit fields. */
export function deriveRowDomain(r: Record<string, unknown>): string {
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
      if (host && DOMAIN_RE.test(host) && !GENERIC_EMAIL_HOSTS.has(host)) return host;
    }
  }
  return "";
}

/**
 * The single definition of a company's domain identity.
 *
 * Everything that keys on domain — the in-memory index, the cross-batch cache,
 * newly created companies — goes through here, so the stored column and the
 * lookup can never drift apart again.
 */
export function companyDomainKey(c: {
  normalized_domain?: string | null;
  domain?: string | null;
  website?: string | null;
}): string {
  const source = (c.normalized_domain && c.normalized_domain.trim())
    || (c.domain && c.domain.trim())
    || (c.website && c.website.trim())
    || "";
  return source ? normalizeDomain(source) : "";
}

/**
 * The single definition of a company's name identity. Mirrors companyDomainKey:
 * take whatever the row holds and normalise it here rather than trusting the
 * generated column.
 */
export function companyNameKey(c: { normalized_name?: string | null; name?: string | null }): string {
  return normalizeCompanyName(c.normalized_name || c.name || "");
}
