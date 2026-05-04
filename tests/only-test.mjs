/**
 * Tests for it.only and describe.only.
 *
 * These must run in a separate file because .only filtering affects the
 * entire test run. We use reset() + run() programmatically to verify
 * the filtering behaviour without impacting the main self-test suite.
 *
 * Run:
 *   node tests/only-test.mjs
 */

import { describe, it, reset, run, setCLIMode, setReporter } from "../dist/index.js";

setCLIMode();

// Suppress output for inner runs
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

// ── Test: it.only runs only the focused test ─────────────────────────────────

{
  reset();
  setReporter(silent);

  describe("suite", () => {
    it("normal test", () => {
      /* noop */
    });
    it.only("focused test", () => {
      /* noop */
    });
    it("another normal", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("it.only: total results = 3", summary.results.length === 3);
  assert("it.only: passed = 1", summary.passed === 1);
  assert("it.only: skipped = 2", summary.skipped === 2);
  assert(
    "it.only: focused test passed",
    summary.results.find(r => r.name === "focused test")?.status === "pass",
  );
  assert(
    "it.only: normal test skipped",
    summary.results.find(r => r.name === "normal test")?.status === "skip",
  );
}

// ── Test: describe.only runs all tests inside ────────────────────────────────

{
  reset();
  setReporter(silent);

  describe("skipped suite", () => {
    it("should be skipped", () => {
      /* noop */
    });
  });

  describe.only("focused suite", () => {
    it("test A", () => {
      /* noop */
    });
    it("test B", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("describe.only: passed = 2", summary.passed === 2);
  assert(
    "describe.only: test A passed",
    summary.results.find(r => r.name === "test A")?.status === "pass",
  );
  assert(
    "describe.only: test B passed",
    summary.results.find(r => r.name === "test B")?.status === "pass",
  );
  // The skipped suite is pruned entirely (no results from it)
  assert(
    "describe.only: skipped suite pruned",
    !summary.results.some(r => r.name === "should be skipped"),
  );
}

// ── Test: multiple .only coexist ─────────────────────────────────────────────

{
  reset();
  setReporter(silent);

  describe("suite", () => {
    it.only("first only", () => {
      /* noop */
    });
    it("normal", () => {
      /* noop */
    });
    it.only("second only", () => {
      /* noop */
    });
  });

  const summary = await run();
  assert("multiple only: passed = 2", summary.passed === 2);
  assert("multiple only: skipped = 1", summary.skipped === 1);
}

// ── Test: nested it.only inside normal describe ──────────────────────────────

{
  reset();
  setReporter(silent);

  describe("outer", () => {
    it("outer test", () => {
      /* noop */
    });
    describe("inner", () => {
      it.only("inner focused", () => {
        /* noop */
      });
      it("inner normal", () => {
        /* noop */
      });
    });
  });

  const summary = await run();
  assert(
    "nested only: inner focused passed",
    summary.results.find(r => r.name === "inner focused")?.status === "pass",
  );
  assert(
    "nested only: inner normal skipped",
    summary.results.find(r => r.name === "inner normal")?.status === "skip",
  );
}

// ── Report ───────────────────────────────────────────────────────────────────

reset();

if (allPassed) {
  console.log(`\n${totalPassed}/${totalTests} only-test assertions passed.`);
  // Exit 0 (success) — default
} else {
  console.log(`\n${totalPassed}/${totalTests} only-test assertions passed.`);
  process.exit(1);
}
