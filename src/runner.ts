/**
 * Test runner. Collects describe/it blocks and executes them.
 *
 * No runtime-specific imports. Uses only globalThis APIs.
 */

import type { RunSummary, Suite, Test, TestResult } from "./types.js";

// ── Global state ────────────────────────────────────────────────────────────

const rootSuite: Suite = {
  name: "",
  tests: [],
  suites: [],
  beforeAll: [],
  afterAll: [],
  beforeEach: [],
  afterEach: [],
};

let currentSuite: Suite = rootSuite;

// ── Registration API ────────────────────────────────────────────────────────

/** Define a test suite. Nests inside the current suite. */
export const describe = (name: string, fn: () => void): void => {
  const suite: Suite = {
    name,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
};

/** Define a test case. */
export const it = (name: string, fn: () => void | Promise<void>): void => {
  currentSuite.tests.push({ name, fn, skip: false });
};

/** Alias for it. */
export const test = it;

/** Skip a test. */
it.skip = (name: string, _fn: () => void | Promise<void>): void => {
  currentSuite.tests.push({ name, fn: () => {}, skip: true });
};

/** Skip a suite. */
describe.skip = (name: string, _fn: () => void): void => {
  const suite: Suite = {
    name,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  };
  currentSuite.suites.push(suite);
};

/** Register a before-all hook for the current suite. */
export const beforeAll = (fn: () => void | Promise<void>): void => {
  currentSuite.beforeAll.push(fn);
};

/** Register an after-all hook for the current suite. */
export const afterAll = (fn: () => void | Promise<void>): void => {
  currentSuite.afterAll.push(fn);
};

/** Register a before-each hook for the current suite. */
export const beforeEach = (fn: () => void | Promise<void>): void => {
  currentSuite.beforeEach.push(fn);
};

/** Register an after-each hook for the current suite. */
export const afterEach = (fn: () => void | Promise<void>): void => {
  currentSuite.afterEach.push(fn);
};

// ── Timer ───────────────────────────────────────────────────────────────────

const now = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

// ── Execution ───────────────────────────────────────────────────────────────

const runTest = async (
  t: Test,
  suitePath: readonly string[],
  beforeEachHooks: ReadonlyArray<() => void | Promise<void>>,
  afterEachHooks: ReadonlyArray<() => void | Promise<void>>,
): Promise<TestResult> => {
  if (t.skip) {
    return { suite: suitePath, name: t.name, status: "skip", duration: 0 };
  }

  const start = now();
  try {
    for (const hook of beforeEachHooks) {
      await hook();
    }
    await t.fn();
    for (const hook of afterEachHooks) {
      await hook();
    }
    return { suite: suitePath, name: t.name, status: "pass", duration: now() - start };
  } catch (error) {
    return { suite: suitePath, name: t.name, status: "fail", error, duration: now() - start };
  }
};

const runSuite = async (
  suite: Suite,
  path: readonly string[],
  parentBeforeEach: ReadonlyArray<() => void | Promise<void>>,
  parentAfterEach: ReadonlyArray<() => void | Promise<void>>,
): Promise<TestResult[]> => {
  const suitePath = suite.name ? [...path, suite.name] : path;
  const results: TestResult[] = [];

  const allBeforeEach = [...parentBeforeEach, ...suite.beforeEach];
  const allAfterEach = [...suite.afterEach, ...parentAfterEach];

  // Run beforeAll hooks
  for (const hook of suite.beforeAll) {
    await hook();
  }

  // Run tests in this suite
  for (const t of suite.tests) {
    results.push(await runTest(t, suitePath, allBeforeEach, allAfterEach));
  }

  // Run nested suites
  for (const child of suite.suites) {
    const childResults = await runSuite(child, suitePath, allBeforeEach, allAfterEach);
    results.push(...childResults);
  }

  // Run afterAll hooks
  for (const hook of suite.afterAll) {
    await hook();
  }

  return results;
};

// ── Reporter ────────────────────────────────────────────────────────────────

const formatResult = (r: TestResult, index: number): string => {
  const path = r.suite.length > 0 ? `${r.suite.join(" > ")} > ` : "";
  if (r.status === "skip") return `ok ${index} - ${path}${r.name} # SKIP`;
  if (r.status === "pass") return `ok ${index} - ${path}${r.name}`;

  const errMsg = r.error instanceof Error ? r.error.message : String(r.error);
  return `not ok ${index} - ${path}${r.name}\n  ---\n  error: ${errMsg}\n  ...`;
};

const report = (summary: RunSummary): string => {
  const lines: string[] = [];
  lines.push(`TAP version 14`);
  lines.push(`1..${summary.results.length}`);

  for (let i = 0; i < summary.results.length; i++) {
    lines.push(formatResult(summary.results[i]!, i + 1));
  }

  lines.push("");
  lines.push(`# tests ${summary.results.length}`);
  lines.push(`# pass ${summary.passed}`);
  lines.push(`# fail ${summary.failed}`);
  lines.push(`# skip ${summary.skipped}`);
  lines.push(`# duration ${summary.duration.toFixed(0)}ms`);

  return lines.join("\n");
};

// ── Public run function ─────────────────────────────────────────────────────

/**
 * Run all registered tests and print TAP output.
 *
 * Exits with code 1 if any test fails (Node/Deno/Bun).
 * Returns the summary for programmatic use.
 */
export const run = async (): Promise<RunSummary> => {
  const start = now();
  const results = await runSuite(rootSuite, [], [], []);

  const summary: RunSummary = {
    results,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    skipped: results.filter((r) => r.status === "skip").length,
    duration: now() - start,
  };

  console.log(report(summary));

  // Exit with failure code if any tests failed
  if (summary.failed > 0) {
    const g = globalThis as Record<string, unknown>;
    const proc = g["process"] as { exit?(code: number): void } | undefined;
    if (proc?.exit) {
      proc.exit(1);
    }
    const deno = g["Deno"] as { exit?(code: number): void } | undefined;
    if (deno?.exit) {
      deno.exit(1);
    }
  }

  return summary;
};

/**
 * Reset all registered suites and tests.
 * Useful for testing the test runner itself.
 */
export const reset = (): void => {
  rootSuite.tests.length = 0;
  rootSuite.suites.length = 0;
  rootSuite.beforeAll.length = 0;
  rootSuite.afterAll.length = 0;
  rootSuite.beforeEach.length = 0;
  rootSuite.afterEach.length = 0;
};
