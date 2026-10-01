/**
 * Job title normalisation.
 *
 * Searching a profile pool by job title only works if "CEO" also finds "Chief
 * Executive Officer", "Group CEO" and "Founder & CEO". Titles arrive as free
 * text from vendors and CSVs in hundreds of spellings, so the raw string is
 * useless as a filter.
 *
 * This maps a raw title onto four things a query can actually use:
 *
 *   seniority      — a label, plus an ordered rank so "VP and above" is a range
 *   department     — the function the person sits in
 *   canonicalTitle — a stable label for grouping and display
 *   rawTitle       — never discarded; the original is what a human recognises
 *
 * Gulf-specific weighting is deliberate. In Saudi, UAE and Qatar "General
 * Manager" and "Managing Director" are usually the top of a country operation
 * rather than middle management, and owner-operator titles are common in an
 * SME-heavy market. A ladder built only on US-tech conventions ranks those far
 * too low and quietly hides the actual decision maker.
 */

export type Seniority =
  | "board"
  | "founder"
  | "c_suite"
  | "vp"
  | "director"
  | "head"
  | "manager"
  | "senior"
  | "mid"
  | "entry"
  | "intern"
  | "unknown";

/**
 * Ordered so range filters work: `seniority_rank >= 80` means "VP and above".
 * Gaps are intentional — new levels can be inserted without a migration.
 */
export const SENIORITY_RANK: Record<Seniority, number> = {
  board: 100,
  founder: 95,
  c_suite: 90,
  vp: 80,
  director: 70,
  head: 65,
  manager: 50,
  senior: 40,
  mid: 30,
  entry: 20,
  intern: 10,
  unknown: 0,
};

export type Department =
  | "executive"
  | "sales"
  | "marketing"
  | "finance"
  | "hr"
  | "operations"
  | "engineering"
  | "product"
  | "it"
  | "legal"
  | "procurement"
  | "supply_chain"
  | "customer_success"
  | "data"
  | "design"
  | "medical"
  | "real_estate"
  | "education"
  | "other";

export interface NormalizedTitle {
  rawTitle: string;
  canonicalTitle: string;
  seniority: Seniority;
  seniorityRank: number;
  department: Department;
  /** True when the raw string yielded neither seniority nor department. */
  unmatched: boolean;
}

/** Expanded before matching, so abbreviations and full forms behave alike. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bceo\b/g, "chief executive officer"],
  [/\bcfo\b/g, "chief financial officer"],
  [/\bcto\b/g, "chief technology officer"],
  [/\bcoo\b/g, "chief operating officer"],
  [/\bcmo\b/g, "chief marketing officer"],
  [/\bcro\b/g, "chief revenue officer"],
  [/\bchro\b/g, "chief human resources officer"],
  [/\bciso\b/g, "chief information security officer"],
  [/\bcio\b/g, "chief information officer"],
  [/\bcpo\b/g, "chief product officer"],
  [/\bcdo\b/g, "chief data officer"],
  [/\bmd\b/g, "managing director"],
  [/\bgm\b/g, "general manager"],
  [/\bevp\b/g, "executive vice president"],
  [/\bsvp\b/g, "senior vice president"],
  [/\bavp\b/g, "assistant vice president"],
  [/\bvp\b/g, "vice president"],
  [/\bsr\.?\b/g, "senior"],
  [/\bjr\.?\b/g, "junior"],
  [/\bhr\b/g, "human resources"],
  [/\bit\b/g, "information technology"],
  [/\bqa\b/g, "quality assurance"],
  [/\bpm\b/g, "product manager"],
  [/\bba\b/g, "business analyst"],
  [/\bbd\b/g, "business development"],
  [/\bcs\b/g, "customer success"],
  [/\bswe\b/g, "software engineer"],
];

/** Regions, tenure and noise that say nothing about the role itself. */
const NOISE =
  /\b(emea|apac|mena|gcc|ksa|uae|qatar|kuwait|bahrain|oman|middle east|north africa|europe|asia|americas|global|international|regional|worldwide|remote|contract|freelance|part[- ]time|full[- ]time|interim|acting|designate|elect|ex|former|retired)\b/g;

/**
 * Seniority patterns, most specific first. Order matters: "chief of staff" must
 * not match the "chief" that means C-suite, and "senior manager" must resolve to
 * manager rather than senior.
 */
const SENIORITY_PATTERNS: Array<[RegExp, Seniority]> = [
  // Board and ownership
  [/\b(board member|board of directors|non[- ]executive director|chairman|chairwoman|chairperson|chair of the board)\b/, "board"],
  [/\b(founder|co[- ]?founder|owner|proprietor|partner|managing partner|shareholder)\b/, "founder"],

  // C-suite. "chief of staff" excluded explicitly — it is not an officer role.
  [/\bchief (?!of staff)[a-z ]*officer\b/, "c_suite"],
  // "president" must not match inside "vice president" — otherwise every VP
  // ranks as C-suite, which is how a search for CEOs fills up with VPs.
  [/\b((?<!vice )(?<!deputy )president|managing director|general manager|country manager|country head|vice chairman)\b/, "c_suite"],

  // VP band
  [/\b(executive vice president|senior vice president|assistant vice president|vice president)\b/, "vp"],

  // Director band — "director of" before bare "director"
  [/\b(senior director|associate director|deputy director|director of|director,|^director$|\bdirector\b)\b/, "director"],

  // Head band
  [/\b(head of|global head|group head|department head)\b/, "head"],

  // Manager band — checked before "senior" so "senior manager" lands here
  [/\b(senior manager|general supervisor|manager|supervisor|team lead|team leader|lead)\b/, "manager"],

  // Individual contributor bands
  [/\b(senior|principal|staff|lead specialist|expert)\b/, "senior"],
  [/\b(junior|associate|assistant|graduate|trainee)\b/, "entry"],
  [/\b(intern|internship|apprentice)\b/, "intern"],
];

/** Department keywords, most specific first. */
const DEPARTMENT_PATTERNS: Array<[RegExp, Department]> = [
  [/\b(chief executive officer|(?<!vice )(?<!deputy )president|managing director|general manager|chief of staff|board|chairman|founder|owner)\b/, "executive"],
  [/\b(sales|account executive|account manager|business development|revenue|commercial)\b/, "sales"],
  [/\b(marketing|brand|growth|demand generation|communications|public relations|content|seo)\b/, "marketing"],
  [/\b(finance|financial|accounting|accountant|controller|treasury|audit|tax|fp&a)\b/, "finance"],
  [/\b(human resources|people|talent|recruit|recruiting|recruitment|hiring)\b/, "hr"],
  [/\b(procurement|purchasing|sourcing|vendor management)\b/, "procurement"],
  [/\b(supply chain|logistics|warehouse|distribution|fleet|shipping)\b/, "supply_chain"],
  [/\b(software engineer|engineering|developer|programmer|devops|architect|sre|backend|frontend|full[- ]?stack)\b/, "engineering"],
  [/\b(information technology|systems|network|infrastructure|helpdesk|sysadmin|information security|cyber)\b/, "it"],
  [/\b(product manager|product owner|product)\b/, "product"],
  [/\b(data|analytics|analyst|business intelligence|machine learning|scientist)\b/, "data"],
  [/\b(design|designer|ux|ui|creative)\b/, "design"],
  [/\b(legal|counsel|compliance|regulatory|contracts)\b/, "legal"],
  [/\b(customer success|customer support|client service|account support)\b/, "customer_success"],
  [/\b(operations|operating|operational|process improvement)\b/, "operations"],
  [/\b(medical|clinical|physician|doctor|nurse|pharmac|health)\b/, "medical"],
  [/\b(real estate|property|facilities|leasing)\b/, "real_estate"],
  [/\b(education|teacher|professor|lecturer|academic|training)\b/, "education"],
];

/** Human-readable label for a seniority band, used in canonical titles. */
const SENIORITY_LABEL: Record<Seniority, string> = {
  board: "Board", founder: "Founder", c_suite: "C-Suite", vp: "VP",
  director: "Director", head: "Head", manager: "Manager", senior: "Senior",
  mid: "Mid-Level", entry: "Entry", intern: "Intern", unknown: "Unknown",
};

const DEPARTMENT_LABEL: Record<Department, string> = {
  executive: "Executive", sales: "Sales", marketing: "Marketing",
  finance: "Finance", hr: "HR", operations: "Operations",
  engineering: "Engineering", product: "Product", it: "IT", legal: "Legal",
  procurement: "Procurement", supply_chain: "Supply Chain",
  customer_success: "Customer Success", data: "Data", design: "Design",
  medical: "Medical", real_estate: "Real Estate", education: "Education",
  other: "Other",
};

/** Lowercase, expand abbreviations, strip region and tenure noise. */
export function prepareTitle(raw: string): string {
  let t = (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Separators become spaces so "VP, Sales" and "VP - Sales" behave alike.
    .replace(/[|/\\]+/g, " ")
    .replace(/[^a-z0-9&,.\- ]/g, " ")
    // Periods are removed BEFORE abbreviation expansion, so "C.E.O." collapses
    // to "ceo" and matches. Stripping them afterwards leaves "c e o", which
    // matches nothing.
    .replace(/\./g, "");

  for (const [pattern, expansion] of ABBREVIATIONS) {
    t = t.replace(pattern, expansion);
  }

  return t.replace(NOISE, " ").replace(/[,.\-]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Normalise a raw job title.
 *
 * When several seniority patterns match — "Founder & CEO", "Managing Director
 * and Head of Sales" — the HIGHEST band wins. Someone who is both a founder and
 * a head of department should surface in a founder search.
 */
export function normalizeTitle(raw: string | null | undefined): NormalizedTitle {
  const rawTitle = (raw ?? "").trim();
  const prepared = prepareTitle(rawTitle);

  if (!prepared) {
    return {
      rawTitle, canonicalTitle: "", seniority: "unknown",
      seniorityRank: SENIORITY_RANK.unknown, department: "other", unmatched: true,
    };
  }

  let seniority: Seniority = "unknown";
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(prepared) && SENIORITY_RANK[level] > SENIORITY_RANK[seniority]) {
      seniority = level;
    }
  }

  let department: Department = "other";
  for (const [pattern, dept] of DEPARTMENT_PATTERNS) {
    if (pattern.test(prepared)) { department = dept; break; }
  }

  // A recognised role with no seniority signal is an individual contributor,
  // not an unknown. "Software Engineer" is mid-level by default.
  if (seniority === "unknown" && department !== "other") seniority = "mid";

  const unmatched = seniority === "unknown" && department === "other";

  const canonicalTitle = unmatched
    ? rawTitle
    : department === "executive" || department === "other"
      ? SENIORITY_LABEL[seniority]
      : `${SENIORITY_LABEL[seniority]} — ${DEPARTMENT_LABEL[department]}`;

  return {
    rawTitle,
    canonicalTitle,
    seniority,
    seniorityRank: SENIORITY_RANK[seniority],
    department,
    unmatched,
  };
}

/**
 * Expand a user's search term into the titles worth matching against.
 *
 * Typing "CEO" should reach every C-suite executive row, not just the literal
 * string. Returns the seniority and department a query should filter on, plus
 * the prepared text for a trigram fallback when the term is not a known role.
 */
export function expandTitleQuery(term: string): {
  seniority: Seniority | null;
  department: Department | null;
  text: string;
} {
  const n = normalizeTitle(term);
  return {
    seniority: n.seniority === "unknown" ? null : n.seniority,
    department: n.department === "other" ? null : n.department,
    text: prepareTitle(term),
  };
}
