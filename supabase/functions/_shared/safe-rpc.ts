// GENERATED FILE — DO NOT EDIT.
// Mirrored from src/lib/safe-rpc.ts by scripts/sync-shared-modules.mjs.
// Edit the source there and re-run the script; `npm test` fails on drift.

/**
 * Settling a Supabase call without letting it abort the caller.
 *
 * Two traps, both of which bit `process-linkedin-queue`:
 *
 * 1. `supabase.rpc(...)` returns a PostgrestFilterBuilder, which is *thenable*
 *    but has no `.catch` method. Writing `.catch(() => {})` on it therefore
 *    throws `TypeError: ... .catch is not a function` — and if that happens
 *    inside a catch block, the throw escapes the handler entirely and aborts
 *    whatever loop the handler was protecting.
 *
 * 2. PostgREST does not reject on a database error. It *resolves* with
 *    `{ data, error }`. So even a correctly-written `.catch()` would never fire
 *    for a failed RPC — the failure sits silently in the resolved value.
 *
 * `settleRpc` handles both: it awaits inside try/catch, treats a returned
 * `error` as failure, and never throws. Use it for best-effort side effects —
 * recording a failure, closing out a run — where the caller must continue no
 * matter what happens.
 *
 * It is deliberately NOT for calls whose success matters: those should surface
 * their error so the caller can decide.
 */

export interface SettledRpc {
  /** True only when the call completed and returned no error payload. */
  ok: boolean;
  /** Human-readable failure reason, or null on success. */
  error: string | null;
}

/** Shape of anything awaitable that may carry a PostgREST-style error. */
type RpcLike = PromiseLike<{ error?: { message?: string } | null } | null | undefined>;

function describe(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason) ?? String(reason);
  } catch {
    return String(reason);
  }
}

/**
 * Await a Supabase call and report how it went, without ever throwing.
 *
 * @param pending  the builder or promise to settle
 * @param onFailure optional reporter — receives the reason when the call fails.
 *                  Keep it cheap and non-throwing; anything it throws is swallowed.
 */
export async function settleRpc(
  pending: RpcLike,
  onFailure?: (reason: string) => void,
): Promise<SettledRpc> {
  let outcome: SettledRpc;

  try {
    const result = await pending;
    const message = result?.error?.message;
    outcome = message
      ? { ok: false, error: message }
      : result?.error
        ? { ok: false, error: describe(result.error) }
        : { ok: true, error: null };
  } catch (thrown) {
    outcome = { ok: false, error: describe(thrown) };
  }

  if (!outcome.ok && onFailure) {
    // A reporter must never be able to do what we are here to prevent.
    try {
      onFailure(outcome.error ?? "unknown error");
    } catch {
      /* ignored on purpose */
    }
  }

  return outcome;
}
