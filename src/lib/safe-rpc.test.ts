import { describe, expect, it, vi } from "vitest";
import { settleRpc } from "./safe-rpc";

/**
 * Stand-in for a PostgrestFilterBuilder: thenable, but with NO `.catch` method.
 * This is the shape that made `supabase.rpc(...).catch(() => {})` throw.
 */
function builderLike<T>(settle: () => Promise<T>) {
  return {
    then<R1, R2>(
      onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
    ) {
      return settle().then(onFulfilled, onRejected);
    },
    // Deliberately no `catch` — that is the entire point.
  };
}

const resolvesTo = <T>(value: T) => builderLike(async () => value);
const rejectsWith = (reason: unknown) =>
  builderLike(async () => {
    throw reason;
  });

describe("reproducing the original bug", () => {
  it("a query builder has no .catch method", () => {
    const builder = resolvesTo({ error: null }) as any;
    expect(typeof builder.then).toBe("function");
    expect(builder.catch).toBeUndefined();
  });

  it("calling .catch() on one throws TypeError — the bug", () => {
    const builder = resolvesTo({ error: null }) as any;
    expect(() => builder.catch(() => {})).toThrow(TypeError);
  });

  it("and that throw escapes a surrounding catch block", async () => {
    // Exactly the shape of the bug: the recovery path itself throws, so the
    // error leaves the handler that was supposed to contain it.
    const attempt = () => {
      try {
        throw new Error("the original action failed");
      } catch {
        const builder = resolvesTo({ error: null }) as any;
        builder.catch(() => {}); // ← throws, escaping this catch
      }
    };
    expect(attempt).toThrow(TypeError);
  });
});

describe("settleRpc contains every failure mode", () => {
  it("reports success when the call resolves with no error", async () => {
    expect(await settleRpc(resolvesTo({ error: null }))).toEqual({ ok: true, error: null });
  });

  it("treats a resolved error payload as failure — PostgREST does not reject", async () => {
    const result = await settleRpc(resolvesTo({ error: { message: "permission denied" } }));
    expect(result).toEqual({ ok: false, error: "permission denied" });
  });

  it("contains a rejection instead of propagating it", async () => {
    const result = await settleRpc(rejectsWith(new Error("network down")));
    expect(result).toEqual({ ok: false, error: "network down" });
  });

  it("never throws, whatever it is handed", async () => {
    await expect(settleRpc(rejectsWith("a bare string"))).resolves.toMatchObject({ ok: false });
    await expect(settleRpc(rejectsWith(null))).resolves.toMatchObject({ ok: false });
    await expect(settleRpc(resolvesTo(null as any))).resolves.toEqual({ ok: true, error: null });
  });

  it("reports failures to the callback", async () => {
    const onFailure = vi.fn();
    await settleRpc(resolvesTo({ error: { message: "constraint violation" } }), onFailure);
    expect(onFailure).toHaveBeenCalledWith("constraint violation");
  });

  it("does not call the callback on success", async () => {
    const onFailure = vi.fn();
    await settleRpc(resolvesTo({ error: null }), onFailure);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("survives a reporter that throws", async () => {
    const result = await settleRpc(rejectsWith(new Error("boom")), () => {
      throw new Error("the logger is also broken");
    });
    expect(result).toEqual({ ok: false, error: "boom" });
  });
});

/**
 * The regression that matters: a batch of claimed actions where one fails in
 * the middle must still process the rest, and must still record the failure.
 */
describe("queue loop: one failing action must not strand the others", () => {
  interface Action {
    id: string;
    willThrow: boolean;
  }

  /** Models the loop in process-linkedin-queue. */
  async function runBatch(
    actions: Action[],
    recordResult: (id: string, outcome: string) => RpcShape,
    useFixedPattern: boolean,
  ) {
    const processed: string[] = [];
    const recorded: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        processed.push(action.id);
        if (action.willThrow) throw new Error(`adapter failed for ${action.id}`);
        await recordResult(action.id, "success");
        succeeded++;
      } catch {
        failed++;
        if (useFixedPattern) {
          const settled = await settleRpc(recordResult(action.id, "retry"));
          if (settled.ok) recorded.push(action.id);
        } else {
          // The original: .catch() on a builder.
          (recordResult(action.id, "retry") as any).catch(() => {});
          recorded.push(action.id);
        }
      }
    }
    return { processed, recorded, succeeded, failed };
  }

  type RpcShape = ReturnType<typeof resolvesTo<{ error: null }>>;
  const ok = () => resolvesTo({ error: null });

  const FIVE: Action[] = [
    { id: "a", willThrow: false },
    { id: "b", willThrow: false },
    { id: "c", willThrow: true }, // fails in the middle
    { id: "d", willThrow: false },
    { id: "e", willThrow: false },
  ];

  it("BEFORE: the old pattern aborts the batch at the failing action", async () => {
    await expect(runBatch(FIVE, ok, false)).rejects.toThrow(TypeError);
    // Actions d and e were already claimed and are now stranded.
  });

  it("AFTER: every claimed action is processed", async () => {
    const r = await runBatch(FIVE, ok, true);
    expect(r.processed).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("AFTER: the failure is recorded", async () => {
    const r = await runBatch(FIVE, ok, true);
    expect(r.recorded).toEqual(["c"]);
  });

  it("AFTER: counters stay correct", async () => {
    const r = await runBatch(FIVE, ok, true);
    expect(r.succeeded).toBe(4);
    expect(r.failed).toBe(1);
    expect(r.succeeded + r.failed).toBe(FIVE.length);
  });

  it("AFTER: processing continues even when recording itself fails", async () => {
    // Worst case — the action fails AND the retry record fails.
    const broken = () => rejectsWith(new Error("database unreachable")) as any;
    const r = await runBatch(FIVE, broken, true);
    expect(r.processed).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.recorded).toEqual([]); // nothing recorded, but nothing stranded
    expect(r.failed).toBe(5);
  });

  it("AFTER: consecutive failures do not compound", async () => {
    const allFail = FIVE.map((a) => ({ ...a, willThrow: true }));
    const r = await runBatch(allFail, ok, true);
    expect(r.processed).toHaveLength(5);
    expect(r.recorded).toHaveLength(5);
    expect(r.failed).toBe(5);
  });
});
