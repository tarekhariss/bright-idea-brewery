// GENERATED FILE — DO NOT EDIT.
// Mirrored from src/lib/error-reporting.ts by scripts/sync-shared-modules.mjs.
// Edit the source there and re-run the script; `npm test` fails on drift.

/**
 * Operational error reporting.
 *
 * Three rules, in order of importance:
 *
 * 1. **Reporting an error must never fail the operation being reported on.**
 *    Observability that can break production is worse than none.
 * 2. **Secrets never reach the database.** Metadata is sanitised here, once, so
 *    no call site can forget.
 * 3. **No recursive reporting.** A failure inside the reporter is logged
 *    locally and dropped; it is never itself reported.
 *
 * Aggregation happens server-side in `record_error_event()`, keyed on a
 * fingerprint that normalises away uuids, timestamps and long digit runs. One
 * row per distinct fault, with an occurrence counter — because the signal is a
 * new error class appearing, not volume.
 */

export type ErrorSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface ErrorEventInput {
  /** 'edge_function' | 'cron' | 'queue' | 'client' */
  source: string;
  /** The function or module, e.g. 'run-import-job'. */
  component: string;
  /** The unit of work, e.g. 'enrich_contact'. */
  operation?: string;
  severity?: ErrorSeverity;
  workspaceId?: string | null;
  jobId?: string | null;
  entityId?: string | null;
  /** The thrown value, or a message. */
  error: unknown;
  /** Overrides the code derived from `error`. */
  errorCode?: string | null;
  /** Diagnostic fields only — never a whole request payload. */
  metadata?: Record<string, unknown>;
}

/** Keys whose values are never stored, matched case-insensitively. */
const SECRET_KEY = /(^|[_\-.])(key|secret|token|password|passwd|pwd|auth|authorization|credential|cookie|session|bearer|signature|dsn)($|[_\-.])|api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|webhook[_-]?secret|worker[_-]?secret/i;

/** Values that look like credentials regardless of their key. */
const SECRET_VALUE = [
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/,    // provider-style keys
  /\bBearer\s+[A-Za-z0-9._-]{12,}/i,
  /postgres(ql)?:\/\/[^\s]*:[^\s]*@/i,           // connection string with credentials
  /\bsmtps?:\/\/[^\s]*:[^\s]*@/i,
];

const REDACTED = "[redacted]";
const MAX_STRING = 500;
const MAX_KEYS = 40;
const MAX_DEPTH = 3;

/** Redact anything in a string that looks like a credential. */
export function scrubString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUE) {
    out = out.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`), REDACTED);
  }
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…[truncated]` : out;
}

/**
 * Strip secrets and bound the size of a metadata object.
 *
 * Deliberately conservative: an unrecognised nested structure is summarised
 * rather than serialised, because "dump the payload" is how credentials end up
 * in logs.
 */
export function sanitizeMetadata(
  input: unknown,
  depth = 0,
): Record<string, unknown> | unknown {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") return scrubString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;

  if (Array.isArray(input)) {
    if (depth >= MAX_DEPTH) return `[array(${input.length})]`;
    return input.slice(0, 20).map((v) => sanitizeMetadata(v, depth + 1));
  }

  if (typeof input === "object") {
    if (depth >= MAX_DEPTH) return "[object]";
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (count >= MAX_KEYS) {
        out["…"] = "[truncated]";
        break;
      }
      count++;
      out[key] = SECRET_KEY.test(key) ? REDACTED : sanitizeMetadata(value, depth + 1);
    }
    return out;
  }

  return String(input);
}

/** A human-readable message and a code, derived from whatever was thrown. */
export function describeError(error: unknown): { message: string; code: string | null } {
  if (error instanceof Error) {
    return { message: scrubString(error.message || error.name), code: error.name || null };
  }
  if (typeof error === "string") return { message: scrubString(error), code: null };
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown };
    const message = typeof e.message === "string" ? e.message : JSON.stringify(error).slice(0, MAX_STRING);
    const code = typeof e.code === "string" ? e.code : null;
    return { message: scrubString(message), code };
  }
  return { message: scrubString(String(error)), code: null };
}

/** Minimal client shape, so this works with any Supabase client instance. */
interface RpcCapable {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error?: { message?: string } | null }>;
}

/** Guards against a reporter failure being reported, recursively. */
let reporting = false;

/**
 * Record an operational error. Resolves to true when stored.
 *
 * **Never throws and never rejects.** A caller may `await` it or not; either way
 * the operation it is reporting on proceeds.
 */
export async function recordErrorEvent(
  client: RpcCapable,
  input: ErrorEventInput,
): Promise<boolean> {
  if (reporting) {
    // Already inside a report. Dropping this one is correct — the alternative
    // is an unbounded loop of failures about failures.
    return false;
  }

  reporting = true;
  try {
    const { message, code } = describeError(input.error);
    const metadata = sanitizeMetadata(input.metadata ?? {}) as Record<string, unknown>;

    const result = await client.rpc("record_error_event", {
      p_source: input.source,
      p_component: input.component,
      p_message: message,
      p_operation: input.operation ?? null,
      p_severity: input.severity ?? "error",
      p_workspace_id: input.workspaceId ?? null,
      p_job_id: input.jobId ?? null,
      p_entity_id: input.entityId ?? null,
      p_error_code: input.errorCode ?? code,
      p_metadata: metadata,
    });

    if (result?.error) {
      console.error(
        `[error-reporting] could not store ${input.component}/${input.operation ?? "-"}: ${result.error.message ?? "unknown"}`,
      );
      return false;
    }
    return true;
  } catch (thrown) {
    // Storage is unreachable. Log locally and carry on — this is the whole
    // point of rule 1.
    console.error(
      `[error-reporting] reporter failed for ${input.component}: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    );
    return false;
  } finally {
    reporting = false;
  }
}
