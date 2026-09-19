import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contract between `crm-detect-replies` and CrmReviewQueue.
 *
 * The bug: the function returned `{ skipped: true, ...stats }` where
 * `stats.skipped` is a COUNTER of skipped messages. The spread overwrote the
 * boolean with a number, and the caller reads `if (r?.skipped)` — producing two
 * wrong messages:
 *
 *   - a workspace with auto-detect disabled returned skipped: 0 → falsy →
 *     "Scanned 0, queued 0, auto-pushed 0" instead of "Auto-detection is disabled"
 *   - any successful run that skipped ≥1 message returned skipped: 3 → truthy →
 *     "Auto-detection is disabled" even though it ran
 *
 * The workspace-level flag is now named distinctly from the numeric counter.
 * These tests pin that separation from both ends.
 */

interface DetectRepliesResponse {
  scanned: number;
  classified: number;
  queued: number;
  auto_pushed: number;
  /** COUNT of messages skipped during a run. Never a boolean. */
  skipped: number;
  errors: number;
  /** Workspace-level: the run did not happen at all. */
  auto_detect_disabled?: boolean;
  reason?: string;
}

const emptyStats = {
  scanned: 0, classified: 0, queued: 0, auto_pushed: 0, skipped: 0, errors: 0,
};

/** Mirrors the branch in CrmReviewQueue.runDetection. */
function messageFor(r: DetectRepliesResponse): "disabled" | "summary" {
  return r?.auto_detect_disabled ? "disabled" : "summary";
}

describe("response shapes the function can return", () => {
  it("disabled workspace: reports disabled, and its counter stays numeric", () => {
    const r: DetectRepliesResponse = {
      ...emptyStats,
      auto_detect_disabled: true,
      reason: "auto_detect_disabled",
    };
    expect(messageFor(r)).toBe("disabled");
    expect(typeof r.skipped).toBe("number");
  });

  it("normal scan, zero skipped: reports the summary", () => {
    const r: DetectRepliesResponse = { ...emptyStats, scanned: 40, classified: 40 };
    expect(messageFor(r)).toBe("summary");
    expect(r.skipped).toBe(0);
  });

  it("normal scan, some skipped: STILL reports the summary", () => {
    // The precise case that used to report "Auto-detection is disabled".
    const r: DetectRepliesResponse = {
      ...emptyStats, scanned: 40, classified: 37, skipped: 3,
    };
    expect(messageFor(r)).toBe("summary");
    expect(r.auto_detect_disabled).toBeUndefined();
  });

  it("replies detected: reports the summary with real numbers", () => {
    const r: DetectRepliesResponse = {
      ...emptyStats, scanned: 120, classified: 118, queued: 9, auto_pushed: 4, skipped: 2,
    };
    expect(messageFor(r)).toBe("summary");
    expect(r.queued).toBe(9);
    expect(r.auto_pushed).toBe(4);
  });

  it("the old shape would have been wrong in both directions", () => {
    // Reproduces the original defect for the record.
    const oldDisabled = { skipped: true, reason: "auto_detect_disabled", ...emptyStats };
    expect(oldDisabled.skipped).toBe(0); // the spread overwrote the flag
    expect(Boolean(oldDisabled.skipped)).toBe(false); // → wrong message

    const statsWithSkips = { ...emptyStats, skipped: 3 };
    const oldRan = { skipped: true, ...statsWithSkips };
    expect(oldRan.skipped).toBe(3); // the counter, not the flag
    expect(Boolean(oldRan.skipped)).toBe(true); // → also the wrong message
  });
});

describe("both sides of the contract agree", () => {
  const fn = readFileSync("supabase/functions/crm-detect-replies/index.ts", "utf8");
  const ui = readFileSync("src/pages/crm/CrmReviewQueue.tsx", "utf8");

  it("the function returns the distinct flag", () => {
    expect(fn).toContain("auto_detect_disabled: true");
  });

  it("the function no longer returns a boolean named like the counter", () => {
    expect(fn).not.toContain("{ skipped: true");
  });

  it("the UI reads the distinct flag, not the counter", () => {
    expect(ui).toContain("r?.auto_detect_disabled");
    expect(ui).not.toMatch(/if \(r\?\.skipped\)/);
  });
});
