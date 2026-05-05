/**
 * Tests for setGrep / --grep filtering.
 *
 * Uses reset() + setGrep() + run() programmatically to verify
 * filtering without impacting the main self-test suite.
 *
 * Run:
 *   node tests/grep-test.mjs
 */

import { describe, it, reset, run, setCLIMode, setGrep, setReporter } from "../dist/index.js";

setCLIMode();
const silent = { name: "silent", format: () => "" };

let allPassed = true;
let totalTests = 0;
let totalPassed = 0;

const assert = (label, condition) => {
  totalTests++;
  if (condition) {
    totalPassed++;
  } else {
    allPassed = false;
    console.log(`  FAIL  ${label}`);
  }
};

// ── Test: grep filters by test name ──────────────────────────────────────────

{
  reset();
  setReporter(silent);
  setGrep("alpha");

  describe("suite", () => {
    it("alpha test", () => {
      /* noop */
    });
    it("beta test", () => {
      /* noop */
    });
    it("alpha again", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("grep: passed = 2 (only alpha tests)", summary.passed === 2);
  assert("grep: skipped = 1 (beta)", summary.skipped === 1);
}

// ── Test: grep matches describe names ────────────────────────────────────────

{
  reset();
  setReporter(silent);
  setGrep("auth");

  describe("auth module", () => {
    it("logs in", () => {
      /* noop */
    });
    it("logs out", () => {
      /* noop */
    });
  });

  describe("billing", () => {
    it("charges card", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("grep describe: passed = 2 (auth tests)", summary.passed === 2);
  assert(
    "grep describe: billing skipped",
    !summary.results.some(r => r.name === "charges card" && r.status === "pass"),
  );
}

// ── Test: grep supports regex ────────────────────────────────────────────────

{
  reset();
  setReporter(silent);
  setGrep("test-\\d+");

  describe("suite", () => {
    it("test-1", () => {
      /* noop */
    });
    it("test-42", () => {
      /* noop */
    });
    it("other", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("grep regex: passed = 2", summary.passed === 2);
  assert("grep regex: skipped = 1", summary.skipped === 1);
}

// ── Test: grep with no matches skips everything ──────────────────────────────

{
  reset();
  setReporter(silent);
  setGrep("nonexistent");

  describe("suite", () => {
    it("test a", () => {
      /* noop */
    });
    it("test b", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("grep no match: passed = 0", summary.passed === 0);
  assert("grep no match: skipped = 2", summary.skipped === 2);
}

// ── Report ───────────────────────────────────────────────────────────────────

reset();

if (allPassed) {
  console.log(`\n${totalPassed}/${totalTests} grep-test assertions passed.`);
} else {
  console.log(`\n${totalPassed}/${totalTests} grep-test assertions passed.`);
  process.exit(1);
}
