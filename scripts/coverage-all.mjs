/**
 * coverage-all.mjs - Per-runtime coverage orchestrator.
 *
 * Runs the self-test under each available runtime, collects per-runtime
 * coverage, and prints a side-by-side summary.
 *
 * Currently supported:
 *   - Node: c8 (V8 coverage), per-file report
 *   - Deno: deno run --coverage + deno coverage, per-file report
 *
 * Not supported:
 *   - Bun: bun --coverage only works under `bun test` (the bun:test runner),
 *     not arbitrary scripts. Our self-test.mjs uses our own pure-test framework,
 *     so Bun coverage would require wrapping in bun:test format (out of scope).
 *
 * Output: stdout per-runtime tables + a comparison summary at the end.
 *
 * Usage:
 *   node scripts/coverage-all.mjs
 *   node scripts/coverage-all.mjs --json   # emit a machine-readable summary
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");

const hasCommand = (cmd) => {
  try {
    execFileSync("which", [cmd], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

const log = (msg) => process.stdout.write(`${msg}\n`);
const section = (title) => {
  log("");
  log(`━━━ ${title} ${"━".repeat(Math.max(0, 60 - title.length))}`);
};

// ── Node (c8) ───────────────────────────────────────────────────────────────

const runNode = () => {
  section("Node coverage (c8 + .c8rc.node.json)");
  execFileSync(
    "npx",
    [
      "c8",
      "--config",
      ".c8rc.node.json",
      "--reporter=text-summary",
      "--reporter=lcov",
      "--report-dir=coverage/node",
      "node",
      "tests/self-test.mjs",
    ],
    { stdio: "inherit" },
  );
  // Parse coverage-summary.json if present (c8 also emits to dist by default? no, we use lcov + text)
  // For comparison we'll re-run with json-summary
  execFileSync(
    "npx",
    [
      "c8",
      "--config",
      ".c8rc.node.json",
      "--reporter=json-summary",
      "--report-dir=coverage/node",
      "node",
      "tests/self-test.mjs",
    ],
    { stdio: "pipe" },
  );
  const summary = JSON.parse(readFileSync("coverage/node/coverage-summary.json", "utf8"));
  return {
    runtime: "node",
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    statements: summary.total.statements.pct,
  };
};

// ── Deno ────────────────────────────────────────────────────────────────────

const runDeno = () => {
  section("Deno coverage (deno run --coverage)");
  rmSync("coverage/deno-raw", { recursive: true, force: true });
  rmSync("coverage/deno", { recursive: true, force: true });
  mkdirSync("coverage/deno", { recursive: true });
  execFileSync(
    "deno",
    ["run", "--allow-all", "--coverage=coverage/deno-raw", "tests/self-test.mjs"],
    { stdio: "inherit" },
  );
  // Text report (NO_COLOR so we can parse it reliably)
  const reportOut = execFileSync(
    "deno",
    [
      "coverage",
      "--include=dist/",
      "--exclude=dist/runtime/env-process.js",
      "--exclude=dist/runtime/exit-process.js",
      "coverage/deno-raw",
    ],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
  log(reportOut);
  // LCOV for merging later
  execFileSync(
    "deno",
    [
      "coverage",
      "--include=dist/",
      "--exclude=dist/runtime/env-process.js",
      "--exclude=dist/runtime/exit-process.js",
      "--lcov",
      "--output=coverage/deno/coverage.lcov",
      "coverage/deno-raw",
    ],
    { stdio: "inherit" },
  );
  // Parse the "All files" totals from the text report
  const m = /All files\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+/m.exec(reportOut);
  if (!m) throw new Error("Could not parse deno coverage totals");
  return {
    runtime: "deno",
    branches: Number.parseFloat(m[1]),
    functions: Number.parseFloat(m[2]),
    lines: Number.parseFloat(m[3]),
    statements: Number.parseFloat(m[3]),
  };
};

// ── Bun (skipped) ───────────────────────────────────────────────────────────

const reportBunSkipped = () => {
  section("Bun coverage (skipped)");
  log("Bun's --coverage flag only emits LCOV under `bun test` (its built-in");
  log("test runner). Our tests/self-test.mjs uses our own pure-test framework,");
  log("so Bun coverage requires wrapping tests in bun:test format. Out of scope.");
  return { runtime: "bun", lines: null, branches: null, functions: null, statements: null };
};

// ── Summary ─────────────────────────────────────────────────────────────────

const printSummary = (results) => {
  section("Cross-runtime coverage summary");
  log("");
  const pct = (n) => (n === null ? "  skipped" : `${n.toFixed(2)}%`.padStart(8));
  log("Runtime  | Lines    | Branches | Functions");
  log("---------|----------|----------|---------");
  for (const r of results) {
    log(`${r.runtime.padEnd(8)} | ${pct(r.lines)} | ${pct(r.branches)} | ${pct(r.functions)}`);
  }
  log("");
  log("Per-runtime LCOV files:");
  if (existsSync("coverage/node/lcov.info")) log("  coverage/node/lcov.info");
  if (existsSync("coverage/deno/coverage.lcov")) log("  coverage/deno/coverage.lcov");
};

// ── Main ────────────────────────────────────────────────────────────────────

const main = () => {
  const results = [];
  results.push(runNode());
  if (hasCommand("deno")) {
    results.push(runDeno());
  } else {
    section("Deno coverage (skipped)");
    log("deno not on PATH; skipping. Install from https://deno.land");
    results.push({ runtime: "deno", lines: null, branches: null, functions: null });
  }
  results.push(reportBunSkipped());

  if (asJson) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }
  printSummary(results);
};

main();
