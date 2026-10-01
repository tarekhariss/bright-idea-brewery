import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Regression test for a hole in the gate itself.
 *
 * check-edge-functions.mjs used to parse only lines matching `TSxxxx [ERROR]:`.
 * Deno reports a SyntaxError as `error: SyntaxError: …`, which that pattern does
 * not match — so a file that did not even parse produced zero recognised
 * diagnostics and was reported CLEAN. The whole gate exited 0.
 *
 * That shipped: commit 02cc6bd contained two edge functions with duplicated call
 * openings. Both were syntactically invalid and would have failed to deploy, and
 * the gate said green.
 *
 * The invariant this file defends: a non-zero exit from `deno check` must ALWAYS
 * fail the gate, whether or not the parser recognises a diagnostic.
 *
 * The fixture is created and removed inside the test. It is named with a `zz-`
 * prefix so it sorts last, and a `finally` block removes it even if the test
 * throws — a leftover would break every subsequent run.
 */

const root = join(__dirname, "..", "..");
const FIXTURE_NAME = "zz-gate-regression-fixture";
const fixtureDir = join(root, "supabase", "functions", FIXTURE_NAME);
const fixtureFile = join(fixtureDir, "index.ts");

/** Runs the checker and returns its exit code, never throwing. */
function runChecker(): number {
  try {
    execFileSync("node", [join(root, "scripts", "check-edge-functions.mjs"), `--only=${FIXTURE_NAME}`], {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
    });
    return 0;
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

function writeFixture(source: string) {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(fixtureFile, source);
}

function removeFixture() {
  if (existsSync(fixtureDir)) rmSync(fixtureDir, { recursive: true, force: true });
}

afterEach(removeFixture);

describe("the gate cannot be passed by code that does not parse", () => {
  it("fails on a syntactically invalid edge function", () => {
    try {
      // Not a type error — the file cannot be parsed at all. Deno reports this
      // as `error: SyntaxError:`, which the old parser ignored entirely.
      writeFixture("const broken = {{{;\n");
      expect(runChecker()).not.toBe(0);
    } finally {
      removeFixture();
    }
  }, 180_000);

  it("fails on a type error, the case that always worked", () => {
    try {
      writeFixture('const wrong: number = "definitely not a number";\n');
      expect(runChecker()).not.toBe(0);
    } finally {
      removeFixture();
    }
  }, 180_000);

  it("passes on a valid function", () => {
    try {
      writeFixture("export const ok: number = 1;\n");
      expect(runChecker()).toBe(0);
    } finally {
      removeFixture();
    }
  }, 180_000);
});
