import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * The edge functions run a mirrored copy of certain src/lib modules, because
 * Deno cannot import from src/ and every function here is self-contained.
 *
 * That duplication is only safe if it cannot silently drift — an import
 * rejecting leads by different rules than the preview that showed the user what
 * would be rejected would be worse than having no check at all.
 */
describe("shared modules mirrored into supabase/functions/_shared", () => {
  it("are identical to their src/lib source", () => {
    expect(() =>
      execFileSync("node", ["scripts/sync-shared-modules.mjs", "--check"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
