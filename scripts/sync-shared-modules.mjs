#!/usr/bin/env node
/**
 * Copies dependency-free modules from src/lib into supabase/functions/_shared,
 * so edge functions and the browser run byte-identical logic.
 *
 * Every edge function in this project is self-contained by convention, and Deno
 * cannot import from src/. Rather than maintain two implementations that drift
 * apart, the browser copy is canonical and this script mirrors it. A vitest
 * check fails the build if the copies diverge, so the duplication cannot rot.
 *
 *   node scripts/sync-shared-modules.mjs          # write the copies
 *   node scripts/sync-shared-modules.mjs --check  # verify only, non-zero on drift
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Modules mirrored into the edge-function shared directory. */
export const SHARED_MODULES = ["email-name-match.ts", "import-normalizers.ts", "safe-rpc.ts"];

const BANNER = (name) =>
  `// GENERATED FILE — DO NOT EDIT.\n` +
  `// Mirrored from src/lib/${name} by scripts/sync-shared-modules.mjs.\n` +
  `// Edit the source there and re-run the script; \`npm test\` fails on drift.\n\n`;

const checkOnly = process.argv.includes("--check");
let drifted = 0;

for (const name of SHARED_MODULES) {
  const sourcePath = join(root, "src", "lib", name);
  const targetPath = join(root, "supabase", "functions", "_shared", name);
  const expected = BANNER(name) + readFileSync(sourcePath, "utf8");

  const actual = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : null;
  if (actual === expected) continue;

  if (checkOnly) {
    console.error(`drift: supabase/functions/_shared/${name} differs from src/lib/${name}`);
    drifted++;
    continue;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, expected);
  console.log(`synced ${name}`);
}

if (drifted > 0) {
  console.error(`\n${drifted} shared module(s) out of date. Run: node scripts/sync-shared-modules.mjs`);
  process.exit(1);
}
