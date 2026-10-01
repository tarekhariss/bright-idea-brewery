/**
 * PostgREST filter-string escaping.
 *
 * Values passed to `.eq()`, `.ilike()` and friends are sent as separate URL
 * parameters and are safe. Values interpolated into an `.or(...)` / `.and(...)`
 * *string*, however, are parsed by PostgREST itself: commas separate conditions,
 * dots separate field / operator / value, and parentheses delimit groups.
 *
 * So raw interpolation does not merely break on a comma — it lets user input add
 * or replace conditions. Searching for `a,email.neq.null` injects a second
 * condition. Row Level Security still bounds what can be read, but results can be
 * manipulated and ordinary input (`"Smith, John"`, `"Dept. of Energy"`,
 * `"Acme (UK)"`) silently returns wrong rows.
 *
 * PostgREST's documented escape is to wrap the value in double quotes, escaping
 * backslashes and double quotes inside. `*` wildcards keep working inside quotes,
 * so `ilike."*smith, john*"` is both safe and correct.
 */

/** Characters that terminate or restructure a value inside a filter string. */
const RESERVED = /[,.:()"\\ ]/;

function quote(raw: string): string {
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Escape a scalar value for embedding in a PostgREST filter string.
 * Numbers and booleans are emitted bare so numeric columns still compare
 * numerically; strings are quoted only when they need it, keeping URLs readable.
 */
export function pgrstValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const raw = String(value);
  if (raw === "") return '""';
  return RESERVED.test(raw) ? quote(raw) : raw;
}

export type PatternMode = "contains" | "starts_with" | "ends_with";

/**
 * Build an escaped ILIKE pattern for a filter string.
 * `*` is PostgREST's alias for SQL `%`, and survives quoting.
 */
export function pgrstPattern(value: unknown, mode: PatternMode = "contains"): string {
  const raw = String(value ?? "");
  const body =
    mode === "contains" ? `*${raw}*` : mode === "starts_with" ? `${raw}*` : `*${raw}`;

  // Always quote: free-text search terms routinely contain spaces and punctuation.
  return quote(body);
}

/**
 * Build a safe multi-column OR search fragment.
 *
 * `buildOrSearch(["first_name", "last_name"], "Smith, John")`
 *   → `first_name.ilike."*Smith, John*",last_name.ilike."*Smith, John*"`
 *
 * Returns null for an empty term so callers can skip the filter entirely.
 */
export function buildOrSearch(columns: string[], term: string): string | null {
  const trimmed = term?.trim();
  if (!trimmed) return null;

  const pattern = pgrstPattern(trimmed, "contains");
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
