/**
 * Per-domain email pattern learning and address generation.
 *
 * This is the module that replaces buying contact data.
 *
 * The vendors do not hold a verified address for most of the people they sell.
 * They learn how a company builds its addresses — `first.last@`, `flast@` —
 * generate a candidate for a person they discovered elsewhere, verify it, and
 * sell the result. The database is manufactured, not owned.
 *
 * We can do the same, and start from a better position: ~1.2M existing contacts
 * carry real verification outcomes, so the patterns are learned from confirmed
 * deliveries rather than from another vendor's guesses.
 *
 * TWO DIRECTIONS
 *
 *   infer      email + name    → which template(s) produced it
 *   render     template + name → an address
 *
 * They are deliberately symmetric: inference works by rendering every template
 * and comparing, never by parsing the local part with its own regex. A template
 * that inference reports as matching will, when rendered, reproduce that exact
 * local part. Two independent implementations would drift; this cannot.
 *
 * EVIDENCE QUALITY IS THE WHOLE GAME
 *
 * A naive version of this counts local-part shapes and reports a winner. It is
 * confidently wrong on two very common cases:
 *
 *   Catch-all domains accept every address, so an unbounced `first.last@` there
 *   proves nothing — `asdfgh@` would have been accepted too. Patterns learned
 *   on a catch-all domain carry a hard confidence ceiling.
 *
 *   Unverified rows record what whoever exported them believed. Treating those
 *   as evidence launders a vendor's guess into our own confidence score.
 *
 * So observations are weighted by how they were verified, bounces count as
 * evidence *against* a template, and a domain with no confirmed delivery can
 * never report high confidence no matter how many rows it has.
 *
 * Pure: no I/O, no database, no network. Runs in the browser and in Deno.
 */

import {
  nameVariants,
  normalizeLocalPart,
  normalizeName,
  splitFullName,
} from "./email-name-match";
import { GENERIC_EMAIL_HOSTS } from "./import-normalizers";

// ─── Templates ───────────────────────────────────────────────

export type EmailPattern =
  | "first.last"
  | "firstlast"
  | "first_last"
  | "first-last"
  | "f.last"
  | "flast"
  | "f_last"
  | "first.l"
  | "firstl"
  | "last.first"
  | "lastfirst"
  | "last_first"
  | "last.f"
  | "lastf"
  | "f.l"
  | "fl"
  | "first"
  | "last";

/**
 * Placeholders: {first} {last} full names, {f} {l} their initials.
 *
 * `prior` is the rough share of corporate domains using each shape. It only
 * orders candidates for a domain we have never seen and breaks ties between
 * otherwise equal evidence — it never inflates a learned confidence.
 */
interface PatternTemplate {
  id: EmailPattern;
  template: string;
  prior: number;
}

export const PATTERN_TEMPLATES: readonly PatternTemplate[] = [
  { id: "first.last", template: "{first}.{last}", prior: 34 },
  { id: "flast", template: "{f}{last}", prior: 19 },
  { id: "firstlast", template: "{first}{last}", prior: 11 },
  { id: "first", template: "{first}", prior: 8 },
  { id: "f.last", template: "{f}.{last}", prior: 5 },
  { id: "first_last", template: "{first}_{last}", prior: 4 },
  { id: "firstl", template: "{first}{l}", prior: 3 },
  { id: "last.first", template: "{last}.{first}", prior: 2 },
  { id: "lastf", template: "{last}{f}", prior: 2 },
  { id: "first-last", template: "{first}-{last}", prior: 2 },
  { id: "last", template: "{last}", prior: 2 },
  { id: "first.l", template: "{first}.{l}", prior: 2 },
  { id: "lastfirst", template: "{last}{first}", prior: 1 },
  { id: "last.f", template: "{last}.{f}", prior: 1 },
  { id: "f_last", template: "{f}_{last}", prior: 1 },
  { id: "last_first", template: "{last}_{first}", prior: 1 },
  { id: "f.l", template: "{f}.{l}", prior: 1 },
  { id: "fl", template: "{f}{l}", prior: 1 },
];

const TEMPLATE_BY_ID = new Map<EmailPattern, PatternTemplate>(
  PATTERN_TEMPLATES.map((t) => [t.id, t]),
);

export function patternPrior(id: EmailPattern): number {
  return TEMPLATE_BY_ID.get(id)?.prior ?? 0;
}

// ─── Evidence ────────────────────────────────────────────────

/**
 * Mirrors the `email_canonical_status` enum on contacts, plus `bounced` which
 * arrives from campaign feedback rather than from a verification run.
 */
export type EmailEvidenceStatus =
  | "valid"
  | "valid_catch_all"
  | "risky"
  | "unknown"
  | "unverified"
  | "invalid"
  | "bounced"
  | "suppressed";

/**
 * How much one observation is worth.
 *
 *   valid           SMTP confirmed a mailbox exists. The only real proof.
 *   suppressed      Someone unsubscribed or complained — which means a human
 *                   read it, so the mailbox is real. Strong, if indirect.
 *   risky           The check was inconclusive.
 *   unknown /
 *   unverified      Nobody ever checked. This is a previous vendor's guess and
 *                   is weighted near zero on purpose.
 *   valid_catch_all The domain accepts everything, so acceptance is not
 *                   evidence about this particular address.
 *   invalid /
 *   bounced         Confirmed no mailbox. Evidence AGAINST the template that
 *                   produced it, which is how a wrong pattern gets unlearned.
 */
const EVIDENCE_WEIGHT: Record<EmailEvidenceStatus, number> = {
  valid: 3,
  suppressed: 1.5,
  risky: 0.5,
  unknown: 0.3,
  unverified: 0.3,
  valid_catch_all: 0.2,
  invalid: -2,
  bounced: -2.5,
};

/** Statuses that prove a mailbox exists, and so lift the quality ceiling. */
const CONFIRMING: ReadonlySet<EmailEvidenceStatus> = new Set<EmailEvidenceStatus>([
  "valid",
  "suppressed",
]);

export interface PatternObservation {
  email: string | null | undefined;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  status?: EmailEvidenceStatus | null;
  /** From contacts.email_is_catch_all. Caps confidence for the whole domain. */
  isCatchAll?: boolean | null;
  isRoleBased?: boolean | null;
  isFreeEmail?: boolean | null;
}

// ─── Name forms ──────────────────────────────────────────────

/**
 * Every spelling of a surname an address might legitimately use.
 *
 * "Al-Rashid" appears as `alrashid`, `al-rashid` and plain `rashid`; "van der
 * Berg" as `vanderberg` or `berg`. Offering only the stripped form would read
 * every one of those domains as having no discoverable pattern — which in a
 * dataset full of Arabic and Dutch surnames means silently losing them.
 */
function surnameForms(last: string | null | undefined): string[] {
  const raw = (last ?? "").trim().toLowerCase();
  if (!raw) return [];

  const forms = new Set<string>();

  const stripped = normalizeName(raw);
  if (stripped) forms.add(stripped);

  // Internal hyphens preserved, apostrophes dropped: "al-rashid", "obrien".
  const hyphenated = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z-]/g, "")
    .replace(/^-+|-+$/g, "");
  if (hyphenated) forms.add(hyphenated);

  // Final token, for particles that get dropped: "bin Saud" → "saud".
  const tokens = raw.split(/[\s'-]+/).map(normalizeName).filter(Boolean);
  if (tokens.length > 1) forms.add(tokens[tokens.length - 1]);

  forms.delete("");
  return [...forms];
}

/** First-name spellings, including nicknames a person may use themselves. */
function forenameForms(first: string | null | undefined, includeNicknames: boolean): string[] {
  const base = normalizeName(first);
  if (!base) return [];
  if (!includeNicknames) return [base];
  const variants = new Set<string>([base, ...nameVariants(first ?? "")]);
  variants.delete("");
  return [...variants];
}

interface ResolvedName {
  first: string;
  last: string;
}

/** first/last, falling back to splitting a full name. */
function resolveName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): ResolvedName {
  let first = input.firstName ?? "";
  let last = input.lastName ?? "";
  if (!normalizeName(first) && !normalizeName(last) && input.fullName) {
    const split = splitFullName(input.fullName);
    first = split.firstName;
    last = split.lastName;
  }
  return { first, last };
}

// ─── Rendering ───────────────────────────────────────────────

/**
 * Render one template, or null when the name lacks a part the template needs.
 *
 * Returning null rather than an empty substitution matters: `{first}.{last}`
 * with no surname would otherwise yield `john.`, which is not an address and
 * would pollute both inference and generation.
 */
export function renderPattern(
  pattern: EmailPattern,
  first: string,
  last: string,
): string | null {
  const template = TEMPLATE_BY_ID.get(pattern);
  if (!template) return null;

  const needsFirst = template.template.includes("{first}") || template.template.includes("{f}");
  const needsLast = template.template.includes("{last}") || template.template.includes("{l}");
  if (needsFirst && !first) return null;
  if (needsLast && !last) return null;

  return template.template
    .replace(/\{first\}/g, first)
    .replace(/\{last\}/g, last)
    .replace(/\{f\}/g, first.slice(0, 1))
    .replace(/\{l\}/g, last.slice(0, 1));
}

// ─── Inference ───────────────────────────────────────────────

export interface InferenceResult {
  /** Every template that reproduces this local part exactly. */
  patterns: EmailPattern[];
  /** True when a nickname rather than the given first name was needed. */
  usedNickname: boolean;
  localPart: string;
}

/**
 * Which template(s) produced this address for this person.
 *
 * Returns all matches, not a best guess. `j.smith@` for "J Smith" genuinely is
 * both `{first}.{last}` and `{f}.{last}`, and collapsing that to one answer
 * here would invent certainty that the aggregate is better placed to resolve.
 */
export function inferPatterns(observation: {
  email: string | null | undefined;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): InferenceResult {
  const local = normalizeLocalPart(observation.email);
  const { first, last } = resolveName(observation);

  const result: InferenceResult = { patterns: [], usedNickname: false, localPart: local };
  if (!local) return result;

  const givenFirst = normalizeName(first);
  const firstForms = forenameForms(first, true);
  const lastForms = surnameForms(last);

  const matched = new Set<EmailPattern>();
  let nicknameOnly = true;

  for (const template of PATTERN_TEMPLATES) {
    for (const f of firstForms.length ? firstForms : [""]) {
      for (const l of lastForms.length ? lastForms : [""]) {
        if (renderPattern(template.id, f, l) !== local) continue;
        matched.add(template.id);
        if (f === givenFirst || !f) nicknameOnly = false;
      }
    }
  }

  result.patterns = PATTERN_TEMPLATES.filter((t) => matched.has(t.id)).map((t) => t.id);
  result.usedNickname = result.patterns.length > 0 && nicknameOnly;
  return result;
}

// ─── Aggregation ─────────────────────────────────────────────

export interface PatternScore {
  pattern: EmailPattern;
  /** Weighted positive support. */
  score: number;
  /** Weighted evidence against, from bounces and invalid addresses. */
  against: number;
  /** Observations that confirmed a live mailbox for this template. */
  confirmed: number;
}

export type PatternVerdict =
  | "learned"
  | "ambiguous"
  | "insufficient_evidence"
  | "not_applicable";

export interface DomainPatternProfile {
  domain: string;
  pattern: EmailPattern | null;
  /** 0-100. Capped when nothing at this domain was ever confirmed. */
  confidence: number;
  verdict: PatternVerdict;
  /** Observations that contributed, after role and free-mail exclusions. */
  observations: number;
  /** How many of those proved a live mailbox. */
  confirmedObservations: number;
  isCatchAll: boolean;
  runnerUp: EmailPattern | null;
  distribution: PatternScore[];
  reason: string;
}

/** Ceiling when no observation at the domain ever confirmed a live mailbox. */
const UNCONFIRMED_CEILING = 50;
/** Ceiling on a catch-all domain, where acceptance proves nothing. */
const CATCH_ALL_CEILING = 60;
/** Below this share of support, the domain is reported as using several shapes. */
const DOMINANCE_FOR_LEARNED = 0.6;
/**
 * No learned pattern may report 100.
 *
 * Six unanimous confirmed addresses round to a flat 100 under the formula, which
 * reads as "certain" — and it is not. Any company can have an exception, and a
 * caller that special-cases 100 to skip verification would be wrong on exactly
 * the domains we were most sure about. Leaving one point of doubt keeps that
 * shortcut from ever looking justified.
 */
const MAX_LEARNED_CONFIDENCE = 99;

const emptyProfile = (
  domain: string,
  verdict: PatternVerdict,
  reason: string,
  extra: Partial<DomainPatternProfile> = {},
): DomainPatternProfile => ({
  domain,
  pattern: null,
  confidence: 0,
  verdict,
  observations: 0,
  confirmedObservations: 0,
  isCatchAll: false,
  runnerUp: null,
  distribution: [],
  reason,
  ...extra,
});

/**
 * Running evidence for one domain.
 *
 * Observations are folded in one at a time and not retained: what survives is a
 * score per candidate template. That is what lets the miner stream ~1.2M
 * contacts in arbitrary order — holding every observation until its domain is
 * complete would need the input sorted by domain, or hundreds of megabytes.
 */
export interface DomainEvidence {
  scores: Map<EmailPattern, PatternScore>;
  /** Observations that resolved to at least one template. */
  used: number;
  /** Of those, how many proved a live mailbox. */
  confirmed: number;
  catchAll: boolean;
  skippedRole: number;
}

export function createEvidence(): DomainEvidence {
  return { scores: new Map(), used: 0, confirmed: 0, catchAll: false, skippedRole: 0 };
}

/** Fold one observation into a domain's running evidence. */
export function addObservation(evidence: DomainEvidence, observation: PatternObservation): void {
  if (observation.isCatchAll) evidence.catchAll = true;
  if (observation.isFreeEmail) return;
  if (observation.isRoleBased) {
    evidence.skippedRole++;
    return;
  }

  const status: EmailEvidenceStatus = observation.status ?? "unverified";
  const weight = EVIDENCE_WEIGHT[status] ?? 0;
  if (weight === 0) return;

  const inference = inferPatterns(observation);
  if (inference.patterns.length === 0) return;

  evidence.used++;
  const confirming = CONFIRMING.has(status);
  if (confirming) evidence.confirmed++;

  // An observation matching several templates supports their disjunction, not
  // each of them fully. Splitting the weight keeps an ambiguous address from
  // counting as strongly as an unambiguous one.
  const share = weight / inference.patterns.length;

  for (const pattern of inference.patterns) {
    const entry = evidence.scores.get(pattern) ?? { pattern, score: 0, against: 0, confirmed: 0 };
    if (share >= 0) entry.score += share;
    else entry.against += -share;
    if (confirming) entry.confirmed++;
    evidence.scores.set(pattern, entry);
  }
}

/**
 * Turn accumulated evidence into a verdict.
 *
 * Confidence combines three things, because any one of them alone misleads:
 *
 *   dominance  the winner's share of all support. Guards against a domain that
 *              genuinely uses two shapes being reported as if it used one.
 *   volume     saturating in the amount of support, so one confirmed address
 *              gives a usable-but-modest score and five give near-certainty.
 *   quality    a hard ceiling unless something here was actually confirmed.
 *
 * Multiply dominance by volume, then apply the ceilings. A high score therefore
 * requires agreement AND evidence AND verification, and no amount of one
 * substitutes for the others.
 */
export function finalizeDomainPattern(
  domain: string,
  evidence: DomainEvidence,
): DomainPatternProfile {
  const host = domain.trim().toLowerCase();

  if (GENERIC_EMAIL_HOSTS.has(host)) {
    return emptyProfile(
      host,
      "not_applicable",
      "Free-mail host: addresses here are chosen by individuals, so there is no company pattern to learn.",
    );
  }

  const { scores, used, confirmed: confirmedTotal, catchAll, skippedRole } = evidence;

  if (used === 0) {
    return emptyProfile(
      host,
      "insufficient_evidence",
      skippedRole > 0
        ? `No usable observations: ${skippedRole} role mailbox(es) excluded, nothing else resolved to a known pattern.`
        : "No address at this domain could be matched to a known pattern.",
      { isCatchAll: catchAll },
    );
  }

  // Net support: a template its own domain bounced is not a candidate.
  const ranked = [...scores.values()]
    .map((entry) => ({ ...entry, net: entry.score - entry.against }))
    .sort((a, b) => b.net - a.net || patternPrior(b.pattern) - patternPrior(a.pattern));

  const distribution: PatternScore[] = ranked.map(({ pattern, score, against, confirmed }) => ({
    pattern,
    score: Math.round(score * 100) / 100,
    against: Math.round(against * 100) / 100,
    confirmed,
  }));

  const winner = ranked[0];
  const positiveTotal = ranked.reduce((sum, e) => sum + Math.max(e.net, 0), 0);

  if (!winner || winner.net <= 0 || positiveTotal <= 0) {
    return emptyProfile(
      host,
      "insufficient_evidence",
      "Every candidate pattern at this domain has as much evidence against it as for it.",
      {
        isCatchAll: catchAll,
        observations: used,
        confirmedObservations: confirmedTotal,
        distribution,
      },
    );
  }

  const dominance = winner.net / positiveTotal;
  const volume = 1 - Math.exp(-winner.net / 3);
  let confidence = Math.min(
    Math.round(100 * dominance * volume),
    MAX_LEARNED_CONFIDENCE,
  );

  // Caveats are reported whenever they hold, not only when the ceiling binds.
  // A weak catch-all domain scores below its own ceiling, so tying the message
  // to the cap firing would leave the operator reading a low number with no
  // explanation for it — and the explanation is the most important part.
  const caveats: string[] = [];
  let capped = false;

  if (confirmedTotal === 0) {
    caveats.push("never confirmed deliverable at this domain");
    if (confidence > UNCONFIRMED_CEILING) {
      confidence = UNCONFIRMED_CEILING;
      capped = true;
    }
  }
  if (catchAll) {
    caveats.push("catch-all domain, so acceptance does not prove a mailbox exists");
    if (confidence > CATCH_ALL_CEILING) {
      confidence = CATCH_ALL_CEILING;
      capped = true;
    }
  }

  const second = ranked[1];
  const runnerUp = second && second.net > 0 ? second.pattern : null;
  const verdict: PatternVerdict = dominance >= DOMINANCE_FOR_LEARNED ? "learned" : "ambiguous";

  const parts = [
    `${winner.pattern} from ${used} observation(s), ${confirmedTotal} confirmed`,
    `${Math.round(dominance * 100)}% of weighted support`,
  ];
  if (runnerUp) parts.push(`runner-up ${runnerUp}`);
  if (winner.against > 0) parts.push(`${winner.against.toFixed(1)} weight of evidence against`);
  if (caveats.length) {
    parts.push(`${capped ? "capped" : "caveat"}: ${caveats.join("; ")}`);
  }

  return {
    domain: host,
    pattern: winner.pattern,
    confidence,
    verdict,
    observations: used,
    confirmedObservations: confirmedTotal,
    isCatchAll: catchAll,
    runnerUp,
    distribution,
    reason: parts.join("; "),
  };
}

/**
 * Learn a domain's pattern from a complete set of observations.
 *
 * Convenience wrapper over the accumulator, for callers that already hold every
 * address for a domain. Built on the same fold the miner uses, so the batch and
 * streaming paths cannot produce different answers.
 */
export function learnDomainPattern(
  domain: string,
  observations: readonly PatternObservation[],
): DomainPatternProfile {
  const evidence = createEvidence();
  for (const observation of observations) addObservation(evidence, observation);
  return finalizeDomainPattern(domain, evidence);
}

// ─── Generation ──────────────────────────────────────────────

export interface CandidateAddress {
  email: string;
  pattern: EmailPattern;
  /** Expected likelihood this address is the person's, 0-100. */
  confidence: number;
  /** `learned` from this domain's own history, `prior` from global frequency. */
  basis: "learned" | "prior";
  usedNickname: boolean;
}

export interface GenerateOptions {
  /** Cap the list — every extra candidate costs a verification credit. */
  limit?: number;
  /** Also try nickname spellings. Off by default: low yield, real cost. */
  includeNicknames?: boolean;
}

/** Highest confidence a guess may report, so it never looks like knowledge. */
const MAX_PRIOR_CONFIDENCE = 34;

/**
 * Candidate addresses for a person at a domain, best first.
 *
 * With a learned profile the learned pattern leads and the rest follow on
 * global frequency, so the verifier usually succeeds on its first attempt.
 * Without one this degrades to frequency order, which is what a vendor with no
 * history at the domain is doing too.
 *
 * Ordering is the entire point: the caller verifies in sequence and stops at
 * the first hit, so a good order is the difference between one credit and eight.
 */
export function generateCandidates(
  input: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    domain: string;
    profile?: DomainPatternProfile | null;
  },
  options: GenerateOptions = {},
): CandidateAddress[] {
  const limit = options.limit ?? 6;
  const host = input.domain.trim().toLowerCase().replace(/^@/, "");
  if (!host || GENERIC_EMAIL_HOSTS.has(host)) return [];

  const { first, last } = resolveName(input);
  const firstForms = forenameForms(first, options.includeNicknames ?? false);
  const lastForms = surnameForms(last);
  if (firstForms.length === 0 && lastForms.length === 0) return [];

  const givenFirst = normalizeName(first);
  const learned = input.profile?.pattern ?? null;
  const learnedConfidence = input.profile?.confidence ?? 0;

  const ordered = [...PATTERN_TEMPLATES].sort((a, b) => {
    if (a.id === learned) return -1;
    if (b.id === learned) return 1;
    return b.prior - a.prior;
  });

  const seen = new Set<string>();
  const out: CandidateAddress[] = [];

  for (const template of ordered) {
    for (const f of firstForms.length ? firstForms : [""]) {
      for (const l of lastForms.length ? lastForms : [""]) {
        const local = renderPattern(template.id, f, l);
        if (!local) continue;

        const email = `${local}@${host}`;
        if (seen.has(email)) continue;
        seen.add(email);

        const isLearned = template.id === learned;
        out.push({
          email,
          pattern: template.id,
          // A learned pattern reports the domain's measured confidence.
          // Everything else reports its global prior, which is deliberately much
          // lower — a guess should never look like knowledge.
          confidence: isLearned ? learnedConfidence : Math.min(template.prior, MAX_PRIOR_CONFIDENCE),
          basis: isLearned ? "learned" : "prior",
          usedNickname: Boolean(f) && f !== givenFirst,
        });
      }
    }
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}
