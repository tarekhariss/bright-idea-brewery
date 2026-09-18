/**
 * Email ↔ name coherence scoring.
 *
 * A contact row claiming "John Johnstone <patrickwhite@acme.com>" is not a
 * contact — it is two different people stapled together by a bad vendor export.
 * Importing it poisons deliverability (the greeting won't match the recipient),
 * wastes sending reputation, and makes every downstream metric lie.
 *
 * This module answers one question: does this email plausibly belong to this
 * person? It is deliberately pure and dependency-free so it can run identically
 * in the browser (import preview) and in the import edge function.
 *
 * It is conservative by design. A false "mismatch" discards a real lead, so
 * anything ambiguous lands on `partial` or `unknown` for human review rather than
 * being thrown away.
 */

export type EmailNameVerdict =
  /** The local part clearly derives from this person's name. */
  | "match"
  /** One name component matches; the other is absent or unrecognised. */
  | "partial"
  /** A function mailbox (info@, sales@) — nobody's personal address. */
  | "role_based"
  /** The local part names a different person. */
  | "mismatch"
  /** Not enough information to judge. */
  | "unknown";

export interface EmailNameAssessment {
  verdict: EmailNameVerdict;
  /** 0–100 confidence that this email belongs to this person. */
  score: number;
  /** Human-readable justification, shown in the import review queue. */
  reason: string;
  /** Which naming pattern matched, when one did (e.g. "first.last"). */
  pattern?: string;
}

export interface EmailNameInput {
  firstName?: string | null;
  lastName?: string | null;
  /** Used when first/last are not separately available. */
  fullName?: string | null;
  email?: string | null;
}

// ─── Role accounts ───────────────────────────────────────────
// Function mailboxes. Not a quality failure in itself — but it is never a
// specific person, so name matching cannot apply and outreach should treat it
// differently.
const ROLE_ACCOUNTS = new Set([
  "info", "sales", "support", "contact", "contactus", "hello", "hi", "hey",
  "admin", "administrator", "office", "team", "hr", "jobs", "careers", "career",
  "recruiting", "recruitment", "talent", "hiring", "people",
  "marketing", "billing", "accounts", "accounting", "finance", "invoices",
  "payments", "payroll", "ar", "ap", "legal", "compliance", "privacy", "security",
  "press", "media", "pr", "communications", "comms",
  "noreply", "no-reply", "donotreply", "do-not-reply", "bounce", "bounces",
  "enquiries", "enquiry", "inquiries", "inquiry", "help", "helpdesk", "servicedesk",
  "service", "services", "customerservice", "customersuccess", "success", "care",
  "mail", "email", "general", "reception", "frontdesk", "front", "desk",
  "orders", "order", "purchasing", "procurement", "supplier", "suppliers",
  "vendor", "vendors", "partners", "partnerships", "business", "biz", "bd",
  "ops", "operations", "it", "tech", "support1", "dev", "developers", "engineering",
  "design", "studio", "agency", "bookings", "booking", "events", "training",
  "education", "research", "data", "analytics", "newsletter", "subscribe",
  "unsubscribe", "feedback", "demo", "trial", "quote", "quotes", "rfp", "rfq",
  "tenders", "webmaster", "postmaster", "abuse", "hostmaster", "root", "test",
  "main", "corporate", "corp", "hq", "global", "international", "world",
]);

// ─── Nicknames ───────────────────────────────────────────────
// Without this, "Robert Smith <bob.smith@…>" reads as a mismatch and a perfectly
// good lead gets discarded. Grouped by canonical name; matching is symmetric, so
// any member matches any other.
const NICKNAME_GROUPS: string[][] = [
  ["abigail", "abby", "abbie", "gail"],
  ["alexander", "alex", "al", "xander", "sasha", "lex"],
  ["alexandra", "alex", "alexa", "sandra", "sasha", "lexi"],
  ["andrew", "andy", "drew"],
  ["anthony", "tony", "ant"],
  ["arthur", "art", "artie"],
  ["barbara", "barb", "babs"],
  ["benjamin", "ben", "benji", "benny"],
  ["bernard", "bernie"],
  ["bradley", "brad"],
  ["catherine", "kate", "katie", "kathy", "cathy", "cate", "kat", "katharine", "katherine"],
  ["charles", "charlie", "chuck", "chas", "chip"],
  ["christopher", "chris", "topher", "kit"],
  ["christina", "chris", "chrissy", "tina", "christine"],
  ["daniel", "dan", "danny"],
  ["david", "dave", "davey"],
  ["deborah", "deb", "debbie", "debra"],
  ["donald", "don", "donnie"],
  ["douglas", "doug"],
  ["edward", "ed", "eddie", "ted", "teddy", "ned"],
  ["elizabeth", "liz", "beth", "betty", "eliza", "lizzie", "libby", "bess"],
  ["frederick", "fred", "freddie", "rick"],
  ["gregory", "greg"],
  ["jacob", "jake"],
  ["james", "jim", "jimmy", "jamie"],
  ["jennifer", "jen", "jenny"],
  ["jeffrey", "jeff", "geoff", "geoffrey"],
  ["john", "jon", "johnny", "jack"],
  ["jonathan", "jon", "jonny", "nathan"],
  ["joseph", "joe", "joey"],
  ["joshua", "josh"],
  ["katherine", "kate", "katie", "kathy", "kat", "kitty"],
  ["kenneth", "ken", "kenny"],
  ["lawrence", "larry", "laurence", "laurie"],
  ["leonard", "leo", "len", "lenny"],
  ["margaret", "maggie", "meg", "peggy", "marge", "greta"],
  ["matthew", "matt", "matty"],
  ["michael", "mike", "mick", "micky", "mikey"],
  ["nicholas", "nick", "nicky", "nico"],
  ["patricia", "pat", "patty", "trish", "tricia"],
  ["patrick", "pat", "paddy", "rick"],
  ["peter", "pete"],
  ["philip", "phil", "phillip"],
  ["rebecca", "becky", "becca"],
  ["richard", "rick", "dick", "rich", "richie", "ricky"],
  ["robert", "rob", "bob", "bobby", "robbie", "bert"],
  ["ronald", "ron", "ronnie"],
  ["samuel", "sam", "sammy"],
  ["stephen", "steve", "steven", "stevie"],
  ["susan", "sue", "susie", "suzy", "suzanne"],
  ["thomas", "tom", "tommy"],
  ["timothy", "tim", "timmy"],
  ["victoria", "vicky", "vicki", "tori"],
  ["william", "will", "bill", "billy", "willie", "liam"],
  ["zachary", "zach", "zack"],
];

const NICKNAME_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of NICKNAME_GROUPS) {
    for (const name of group) {
      const bucket = index.get(name) ?? new Set<string>();
      for (const other of group) bucket.add(other);
      index.set(name, bucket);
    }
  }
  return index;
})();

/** Every spelling a given first name might legitimately appear under. */
export function nameVariants(name: string): string[] {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  const variants = NICKNAME_INDEX.get(normalized);
  return variants ? Array.from(variants) : [normalized];
}

// ─── Normalisation ───────────────────────────────────────────

/**
 * A name split into its parts, normalised.
 *
 * Whole-name comparison is not enough: "Nguyen Van Minh <minhnv@>" puts the
 * given name last and abbreviates the rest, Spanish names carry two surnames,
 * and Arabic names carry particles. Comparing token by token handles all of
 * them without special-casing any locale.
 */
export function nameTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s._'\-]+/)
    .map(normalizeName)
    .filter((token) => token.length >= 2);
}

/** Lowercase, strip diacritics, drop everything that isn't a letter. */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks: José → Jose
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** The local part, stripped of plus-addressing and trailing digits. */
export function normalizeLocalPart(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  const local = (at === -1 ? email : email.slice(0, at)).trim().toLowerCase();
  return local
    .split("+")[0] // plus-addressing: john.smith+crm@ → john.smith
    .replace(/\d+$/, "") // disambiguating digits: jsmith2 → jsmith
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Local part reduced to letters only, for pattern comparison. */
function alphaOnly(value: string): string {
  return value.replace(/[^a-z]/g, "");
}

/** Levenshtein distance, capped — we only care about "close enough for a typo". */
function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Split a full name into first and last, ignoring middle names and suffixes. */
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "mba", "cpa"]);
const NAME_PREFIXES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sir"]);

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const bare = normalizeName(p);
      return bare && !NAME_PREFIXES.has(bare) && !NAME_SUFFIXES.has(bare);
    });

  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

// ─── Pattern generation ──────────────────────────────────────

interface Candidate {
  value: string;
  pattern: string;
  score: number;
}

/**
 * Every local part this person could reasonably have, with how much confidence
 * each shape carries. `first.last` is near-certain; a bare first name could be
 * any of a dozen Johns at the company.
 */
function buildCandidates(first: string, last: string): Candidate[] {
  const candidates: Candidate[] = [];
  const firstForms = first ? nameVariants(first) : [];
  const lastN = normalizeName(last);

  for (const f of firstForms) {
    const fi = f[0];
    if (lastN) {
      const li = lastN[0];
      candidates.push({ value: f + lastN, pattern: "first.last", score: 100 });
      candidates.push({ value: lastN + f, pattern: "last.first", score: 96 });
      candidates.push({ value: fi + lastN, pattern: "flast", score: 92 });
      candidates.push({ value: lastN + fi, pattern: "lastf", score: 90 });
      candidates.push({ value: f + li, pattern: "firstl", score: 88 });
      candidates.push({ value: li + f, pattern: "lfirst", score: 86 });
      candidates.push({ value: fi + li, pattern: "initials", score: 55 });
    }
    candidates.push({ value: f, pattern: "first", score: 80 });
  }

  if (lastN) candidates.push({ value: lastN, pattern: "last", score: 78 });

  return candidates;
}

/**
 * Does the local part look like some *other* person's name? Used to separate
 * "an alias I don't recognise" from "this is Patrick White's mailbox".
 */
function namesSomeoneElse(localAlpha: string, first: string, last: string): boolean {
  if (localAlpha.length < 6) return false;

  for (const [known] of NICKNAME_INDEX) {
    if (known.length < 4) continue;
    if (!localAlpha.startsWith(known)) continue;

    // A known first name at the start, and it isn't ours.
    const ourVariants = new Set([...nameVariants(first), normalizeName(first)]);
    if (ourVariants.has(known)) continue;

    // Something follows it — a surname — so this reads as a full human name.
    const remainder = localAlpha.slice(known.length);
    if (remainder.length >= 3 && remainder !== normalizeName(last)) return true;
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────

const UNKNOWN = (reason: string): EmailNameAssessment => ({
  verdict: "unknown",
  score: 50,
  reason,
});

/**
 * Score whether `email` plausibly belongs to the named person.
 *
 * Returns `unknown` (a neutral 50) rather than guessing when either side is
 * missing — absent data is not evidence of a bad lead.
 */
export function assessEmailNameMatch(input: EmailNameInput): EmailNameAssessment {
  const email = input.email?.trim();
  if (!email || !email.includes("@")) {
    return UNKNOWN("No email address to check against.");
  }

  let first = input.firstName ?? "";
  let last = input.lastName ?? "";
  if (!normalizeName(first) && !normalizeName(last) && input.fullName) {
    const split = splitFullName(input.fullName);
    first = split.firstName;
    last = split.lastName;
  }

  const firstN = normalizeName(first);
  const lastN = normalizeName(last);
  if (!firstN && !lastN) {
    return UNKNOWN("No contact name to check the email against.");
  }

  const local = normalizeLocalPart(email);
  const localAlpha = alphaOnly(local);

  if (!localAlpha) {
    return UNKNOWN("Email local part contains no letters to compare.");
  }

  // Role mailboxes are a category, not a mismatch.
  const localSegments = local.split(/[._\-]/).filter(Boolean);
  if (ROLE_ACCOUNTS.has(local) || ROLE_ACCOUNTS.has(localAlpha) ||
      (localSegments.length > 0 && ROLE_ACCOUNTS.has(localSegments[0]) && localSegments[0].length >= 3)) {
    return {
      verdict: "role_based",
      score: 35,
      reason: `"${localSegments[0] ?? local}@" is a role mailbox, not a personal address.`,
      pattern: "role",
    };
  }

  // Exact pattern match — the common, happy case.
  const candidates = buildCandidates(first, last);
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (candidate.value === localAlpha && (!best || candidate.score > best.score)) {
      best = candidate;
    }
  }
  if (best) {
    return {
      verdict: best.score >= 70 ? "match" : "partial",
      score: best.score,
      reason: `Email matches the ${best.pattern} pattern for ${first} ${last}`.trim() + ".",
      pattern: best.pattern,
    };
  }

  // Near match — tolerate a transliteration slip or a single typo on longer names.
  for (const candidate of candidates) {
    if (candidate.value.length < 6 || candidate.pattern === "initials") continue;
    if (editDistance(candidate.value, localAlpha, 1) <= 1) {
      return {
        verdict: "match",
        score: Math.max(60, candidate.score - 15),
        reason: `Email is within one character of the ${candidate.pattern} pattern for ${first} ${last}`.trim() + ".",
        pattern: `${candidate.pattern}~`,
      };
    }
  }

  // Token containment. Compound and non-Western names rarely appear whole in the
  // local part, but their parts do — "Van Minh" shows up as "minh".
  const firstTokens = nameTokens(first);
  const lastTokens = nameTokens(last);
  const present = (token: string) => token.length >= 3 && localAlpha.includes(token);
  const matchedFirst = firstTokens.filter(present);
  const matchedLast = lastTokens.filter(present);

  if (matchedFirst.length > 0 && matchedLast.length > 0) {
    return {
      verdict: "match",
      score: 85,
      reason: "Email contains both the first and last name.",
      pattern: "contains-both",
    };
  }

  // A segment of the local part matching a full pattern — "js.consulting" for
  // John Smith. The extra segment is unexplained, so confidence is reduced.
  const segmentBest = localSegments
    .flatMap((segment) => {
      const segmentAlpha = alphaOnly(segment);
      return candidates.filter((candidate) => candidate.value === segmentAlpha);
    })
    .sort((a, b) => b.score - a.score)[0];

  if (segmentBest) {
    const score = Math.max(45, segmentBest.score - 12);
    return {
      verdict: score >= 70 ? "match" : "partial",
      score,
      reason: `Part of the email matches the ${segmentBest.pattern} pattern for ${`${first} ${last}`.trim()}, alongside other text.`,
      pattern: `segment:${segmentBest.pattern}`,
    };
  }

  const matchedAny = [...matchedLast, ...matchedFirst];
  if (matchedAny.length >= 2) {
    return {
      verdict: "match",
      score: 82,
      reason: "Email contains multiple parts of the contact's name.",
      pattern: "contains-tokens",
    };
  }
  if (matchedLast.length === 1) {
    return {
      verdict: "partial",
      score: matchedLast[0].length >= 4 ? 62 : 48,
      reason: `Email contains part of the last name but not the first ("${first}").`,
      pattern: "contains-last",
    };
  }
  if (matchedFirst.length === 1) {
    return {
      verdict: "partial",
      score: matchedFirst[0].length >= 4 ? 55 : 45,
      reason: `Email contains part of the first name but not the last ("${last}").`,
      pattern: "contains-first",
    };
  }

  // Nothing matched. Distinguish "unrecognised alias" from "different person".
  if (namesSomeoneElse(localAlpha, first, last)) {
    return {
      verdict: "mismatch",
      score: 5,
      reason: `Email "${local}@" appears to belong to a different person, not ${`${first} ${last}`.trim()}.`,
      pattern: "other-person",
    };
  }

  // Short or opaque local parts (jd@, xk9@) are unreadable rather than wrong.
  if (localAlpha.length <= 3) {
    return {
      verdict: "partial",
      score: 45,
      reason: `Email local part "${local}" is too short to verify against the name.`,
      pattern: "opaque",
    };
  }

  return {
    verdict: "mismatch",
    score: 20,
    reason: `Email "${local}@" does not match ${`${first} ${last}`.trim()} under any common naming pattern.`,
    pattern: "no-pattern",
  };
}

// ─── Import policy ───────────────────────────────────────────

export type LeadQualityAction = "accept" | "review" | "reject";

export interface LeadQualityPolicy {
  /** Below this score the row is rejected outright. Default 25. */
  rejectBelow: number;
  /** Below this score the row goes to the review queue. Default 70. */
  reviewBelow: number;
  /** Treat role mailboxes as reviewable rather than accepted. Default true. */
  reviewRoleAccounts: boolean;
}

export const DEFAULT_LEAD_QUALITY_POLICY: LeadQualityPolicy = {
  rejectBelow: 25,
  reviewBelow: 70,
  reviewRoleAccounts: true,
};

/**
 * Turn an assessment into an import decision.
 *
 * `unknown` never rejects: a missing name is a gap in the vendor's data, not
 * evidence that the email is wrong.
 */
export function decideLeadQuality(
  assessment: EmailNameAssessment,
  policy: LeadQualityPolicy = DEFAULT_LEAD_QUALITY_POLICY,
): LeadQualityAction {
  if (assessment.verdict === "unknown") return "accept";
  if (assessment.verdict === "role_based") {
    return policy.reviewRoleAccounts ? "review" : "accept";
  }
  if (assessment.score < policy.rejectBelow) return "reject";
  if (assessment.score < policy.reviewBelow) return "review";
  return "accept";
}
