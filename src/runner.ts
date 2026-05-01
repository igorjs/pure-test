/**
 * Test runner. Collects describe/it blocks and executes them.
 *
 * No runtime-specific imports. Uses only globalThis APIs.
 */

import { getReporter, type Reporter } from "./reporters.js";
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
  concurrent: false,
};

let currentSuite: Suite = rootSuite;
let autoRunScheduled = false;
let cliMode = false;
let activeReporter: Reporter | undefined;

/** Mark that run() will be called externally (by CLI). Disables auto-run. */
export const setCLIMode = (): void => {
  cliMode = true;
};

/** Set the output reporter. Defaults to 'spec'. */
export const setReporter = (nameOrReporter: string | Reporter): void => {
  activeReporter =
    typeof nameOrReporter === "string" ? getReporter(nameOrReporter) : nameOrReporter;
};

// ── Auto-run scheduling ─────────────────────────────────────────────────────

/**
 * Schedule run() to fire after all synchronous module code completes.
 * Uses setTimeout(0) to defer to after all top-level describe/it calls.
 * Only fires in direct-execution mode, not when CLI controls execution.
 */
const scheduleAutoRun = (): void => {
  if (autoRunScheduled || cliMode) return;
  autoRunScheduled = true;
  setTimeout(() => {
    run();
  }, 0);
};

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
    concurrent: false,
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
  scheduleAutoRun();
};

/** Define a test case. */
export const it = (name: string, fn: () => void | Promise<void>): void => {
  currentSuite.tests.push({ name, fn, skip: false });
  scheduleAutoRun();
};

/** Alias for it. */
export const test = it;

/** Skip a test. */
it.skip = (name: string, _fn: () => void | Promise<void>): void => {
  currentSuite.tests.push({ name, fn: () => {}, skip: true });
  scheduleAutoRun();
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
    concurrent: false,
  };
  currentSuite.suites.push(suite);
  scheduleAutoRun();
};

/**
 * Define a concurrent test suite. All tests in this suite run in parallel
 * via Promise.all. Use when tests are independent and don't share mutable state.
 *
 * @example
 * ```ts
 * describe.concurrent('crypto operations', () => {
 *   it('hash', async () => { ... })   // runs in parallel
 *   it('sign', async () => { ... })   // runs in parallel
 *   it('verify', async () => { ... }) // runs in parallel
 * })
 * ```
 */
describe.concurrent = (name: string, fn: () => void): void => {
  const suite: Suite = {
    name,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
    concurrent: true,
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
  scheduleAutoRun();
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

  // Run tests: concurrent or sequential
  if (suite.concurrent) {
    const promises = suite.tests.map((t) => runTest(t, suitePath, allBeforeEach, allAfterEach));
    results.push(...(await Promise.all(promises)));
  } else {
    for (const t of suite.tests) {
      results.push(await runTest(t, suitePath, allBeforeEach, allAfterEach));
    }
  }

  // Run nested suites (always sequential: suite ordering should be predictable)
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

// ── Public run function ─────────────────────────────────────────────────────

/**
 * Run all registered tests and print TAP output.
 *
 * You usually don't need to call this directly:
 * - In direct mode (`node test.mjs`), it auto-runs after all describe/it calls.
 * - Via CLI (`pure-test tests/`), the CLI calls it after importing all files.
 *
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

  const reporter = activeReporter ?? getReporter("spec");
  console.log(reporter.format(summary));

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
  autoRunScheduled = false;
};
