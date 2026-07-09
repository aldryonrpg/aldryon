import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Enforces the usecase/ >= 75% coverage gate on the integration run
 * (.claude/plan1.md §5). Bun 1.3.10's own `coverageThreshold` never fails
 * the run (verified: an aggregate of 90% passes a 95% bar, in both the
 * 0-1 and percent scales), so the gate is checked here from the lcov file
 * that bunfig.integration.toml writes.
 *
 * Run via `bun run test:integration:coverage` (which chains this script),
 * from apps/api.
 */

const THRESHOLD = 75;
const LCOV_PATH = join(import.meta.dir, "../coverage/integration/lcov.info");

let lcov: string;
try {
  lcov = readFileSync(LCOV_PATH, "utf-8");
} catch {
  console.error(
    `Coverage gate: could not read ${LCOV_PATH} — run the integration tests with coverage first.`,
  );
  process.exit(1);
}

let linesFound = 0;
let linesHit = 0;
let functionsFound = 0;
let functionsHit = 0;
let files = 0;

for (const record of lcov.split("end_of_record")) {
  const source = record.match(/^SF:(.+)$/m)?.[1]?.replaceAll("\\", "/");
  if (!source?.includes("src/usecase/")) continue;
  files++;
  linesFound += Number(record.match(/^LF:(\d+)$/m)?.[1] ?? 0);
  linesHit += Number(record.match(/^LH:(\d+)$/m)?.[1] ?? 0);
  functionsFound += Number(record.match(/^FNF:(\d+)$/m)?.[1] ?? 0);
  functionsHit += Number(record.match(/^FNH:(\d+)$/m)?.[1] ?? 0);
}

if (files === 0) {
  console.error("Coverage gate: no src/usecase/ files in the lcov report — nothing was measured.");
  process.exit(1);
}

// A denominator of 0 (e.g. interface-only files) counts as fully covered.
const linePct = linesFound === 0 ? 100 : (linesHit / linesFound) * 100;
const functionPct = functionsFound === 0 ? 100 : (functionsHit / functionsFound) * 100;

console.log(
  `usecase/ integration coverage: ${linePct.toFixed(2)}% lines (${linesHit}/${linesFound}), ` +
    `${functionPct.toFixed(2)}% functions (${functionsHit}/${functionsFound}) across ${files} file(s)`,
);

if (linePct < THRESHOLD || functionPct < THRESHOLD) {
  console.error(`Coverage gate FAILED: usecase/ must be >= ${THRESHOLD}% lines and functions.`);
  process.exit(1);
}
console.log(`Coverage gate passed (>= ${THRESHOLD}%).`);
