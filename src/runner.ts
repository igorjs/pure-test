// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Test runner. Collects describe/it blocks and executes them.
 *
 * No runtime-specific imports. Uses only globalThis APIs.
 */

import { checkAssertionState, resetAssertionState } from "./expect.js";
import { clearAllMocks, resetAllMocks, restoreAllMocks } from "./mock.js";
import { getReporter, type Reporter } from "./reporters.js";
import { getRealClearTimeout, getRealSetTimeout, getRealTime } from "./timers.js";
import type { RunSummary, Suite, Test, TestOptions, TestResult } from "./types.js";

const parseTestOptions = (
  optionsOrTimeout?: number | TestOptions,
): { timeout: number | undefined; retry: number } => {
  if (optionsOrTimeout === undefined) return { timeout: undefined, retry: 0 };
  if (typeof optionsOrTimeout === "number") return { timeout: optionsOrTimeout, retry: 0 };
  return { timeout: optionsOrTimeout.timeout, retry: optionsOrTimeout.retry ?? 0 };
};

declare const console: { log(msg: string): void };
declare function queueMicrotask(cb: () => void): void;

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
  only: false,
};

let currentSuite: Suite = rootSuite;
let autoRunScheduled = false;
let cliMode = false;
let hasOnly = false;
let activeReporter: Reporter | undefined;
let grepPattern: RegExp | undefined;
let bailOnFailure = false;
let bailed = false;
let forceExit = false;
let defaultTimeout: number | undefined;
let autoClearMocks = false;
let autoResetMocks = false;
let autoRestoreMocks = false;

/** Mark that run() will be called externally (by CLI). Disables auto-run. */
export const setCLIMode = (): void => {
  cliMode = true;
};

/** Set the output reporter. Defaults to 'spec'. */
export const setReporter = (nameOrReporter: string | Reporter): void => {
  activeReporter =
    typeof nameOrReporter === "string" ? getReporter(nameOrReporter) : nameOrReporter;
};

/** Stop running tests after the first failure. */
export const setBail = (enabled = true): void => {
  bailOnFailure = enabled;
};

/** Force process exit after all tests complete, preventing hanging on open handles. */
export const setForceExit = (enabled = true): void => {
  forceExit = enabled;
};

/** Set a global default timeout (ms) applied to every test that doesn't set its own. */
export const setDefaultTimeout = (ms: number): void => {
  defaultTimeout = ms;
};

/** Auto-call clearAllMocks() before each test. */
export const setAutoClearMocks = (enabled = true): void => {
  autoClearMocks = enabled;
};

/** Auto-call resetAllMocks() before each test. */
export const setAutoResetMocks = (enabled = true): void => {
  autoResetMocks = enabled;
};

/** Auto-call restoreAllMocks() before each test. */
export const setAutoRestoreMocks = (enabled = true): void => {
  autoRestoreMocks = enabled;
};

/** Filter tests by name pattern. Matches against the full name (describe > test). */
export const setGrep = (pattern: string | RegExp): void => {
  grepPattern = typeof pattern === "string" ? new RegExp(pattern) : pattern;
};

// ── Auto-run scheduling ─────────────────────────────────────────────────────

/**
 * Schedule run() to fire after all synchronous module code completes.
 * Only fires in direct-execution mode, not when CLI controls execution.
 */
const scheduleAutoRun = (): void => {
  if (autoRunScheduled || cliMode) return;
  autoRunScheduled = true;
  queueMicrotask(() => {
    run().catch(e => {
      console.log(String(e));
    });
  });
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
    only: false,
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
  scheduleAutoRun();
};

/** Define a test case. Optional timeout or options { timeout?, retry? }. */
export const it = (
  name: string,
  fn: () => void | Promise<void>,
  options?: number | TestOptions,
): void => {
  const { timeout, retry } = parseTestOptions(options);
  currentSuite.tests.push({ name, fn, skip: false, todo: false, only: false, timeout, retry });
  scheduleAutoRun();
};

/** Alias for it. */
export const test = it;

/** Skip a test. */
it.skip = (name: string, _fn: () => void | Promise<void>): void => {
  currentSuite.tests.push({
    name,
    fn: () => {
      /* noop: skipped */
    },
    skip: true,
    todo: false,
    only: false,
    timeout: undefined,
    retry: 0,
  });
  scheduleAutoRun();
};

/** Focus on a single test. When any .only exists, all other tests are skipped. */
it.only = (name: string, fn: () => void | Promise<void>, options?: number | TestOptions): void => {
  hasOnly = true;
  const { timeout, retry } = parseTestOptions(options);
  currentSuite.tests.push({ name, fn, skip: false, todo: false, only: true, timeout, retry });
  scheduleAutoRun();
};

/** Document a planned test. Appears in output but does not run or fail. */
it.todo = (name: string): void => {
  currentSuite.tests.push({
    name,
    fn: () => {
      /* noop: todo */
    },
    skip: false,
    todo: true,
    only: false,
    timeout: undefined,
    retry: 0,
  });
  scheduleAutoRun();
};

/**
 * Create parameterised tests from an array of cases.
 *
 * Name templates support `%s`, `%d`, `%i`, `%f`, `%j`, `%o` (consumed in order),
 * `%#` (test index), and `$property` (object key interpolation).
 *
 * @example
 * ```ts
 * it.each([1, 2, 3])('doubles %d', (n) => {
 *   expect(n * 2).toBeGreaterThan(n)
 * })
 *
 * it.each([[1, 2, 3], [2, 3, 5]])('%d + %d = %d', (a, b, sum) => {
 *   expect(a + b).toBe(sum)
 * })
 *
 * it.each([{ a: 1, b: 2, sum: 3 }])('$a + $b = $sum', ({ a, b, sum }) => {
 *   expect(a + b).toBe(sum)
 * })
 * ```
 */
it.each =
  <T>(cases: ReadonlyArray<T>) =>
  (name: string, fn: (...args: readonly unknown[]) => void | Promise<void>): void => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i] as unknown;
      const testName = formatEachName(name, c, i);
      const testFn = Array.isArray(c) ? () => fn(...c) : () => fn(c);
      it(testName, testFn);
    }
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
    only: false,
  };
  currentSuite.suites.push(suite);
  scheduleAutoRun();
};

/** Focus on a single suite. When any .only exists, all other tests are skipped. */
describe.only = (name: string, fn: () => void): void => {
  hasOnly = true;
  const suite: Suite = {
    name,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
    concurrent: false,
    only: true,
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
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
    only: false,
  };
  currentSuite.suites.push(suite);
  const parent = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parent;
  scheduleAutoRun();
};

/** Create parameterised suites from an array of cases. */
describe.each =
  <T>(cases: ReadonlyArray<T>) =>
  (name: string, fn: (...args: readonly unknown[]) => void): void => {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i] as unknown;
      const suiteName = formatEachName(name, c, i);
      const suiteFn = Array.isArray(c) ? () => fn(...c) : () => fn(c);
      describe(suiteName, suiteFn);
    }
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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a suite or any descendant has an .only flag. */
const suiteContainsOnly = (suite: Suite): boolean => {
  if (suite.only) return true;
  if (suite.tests.some(t => t.only)) return true;
  return suite.suites.some(s => suiteContainsOnly(s));
};

/** Format a parameterised test name from a template and test case. */
const formatEachName = (template: string, testCase: unknown, index: number): string => {
  let result = template;

  // $property interpolation for objects
  if (testCase !== null && typeof testCase === "object" && !Array.isArray(testCase)) {
    const obj = testCase as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      result = result.split(`$${key}`).join(String(obj[key]));
    }
  }

  // %# → test index
  result = result.split("%#").join(String(index));

  // %s, %d, %i, %f, %j, %o → consume values in order
  const values: unknown[] = Array.isArray(testCase) ? [...testCase] : [testCase];
  let vi = 0;
  result = result.replace(/%[sdifjo]/g, match => {
    if (vi >= values.length) return match;
    const val = values[vi++];
    switch (match) {
      case "%s":
        return String(val);
      case "%d":
      case "%f":
        return String(Number(val));
      case "%i":
        return String(Math.floor(Number(val)));
      case "%j":
      case "%o":
        return JSON.stringify(val);
      default:
        return match;
    }
  });

  return result;
};

// ── Timer ───────────────────────────────────────────────────────────────────

const now = (): number => getRealTime();

// ── Test filtering helpers ──────────────────────────────────────────────────

const shouldSkip = (t: Test, suitePath: readonly string[], insideOnly: boolean): boolean => {
  if (t.todo || t.skip) return false; // handled separately
  if (hasOnly && !insideOnly && !t.only) return true;
  if (grepPattern) {
    const fullName = suitePath.length > 0 ? `${suitePath.join(" > ")} > ${t.name}` : t.name;
    if (!grepPattern.test(fullName)) return true;
  }
  return false;
};

// ── Timeout helper ──────────────────────────────────────────────────────────

const raceTimeout = (fn: () => void | Promise<void>, ms: number, name: string): Promise<void> => {
  const realST = getRealSetTimeout();
  const realCT = getRealClearTimeout();
  if (!realST) return fn() as Promise<void>;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = realST(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Test "${name}" timed out after ${ms}ms`));
      }
    }, ms);

    const done = Promise.resolve(fn());
    done.then(
      () => {
        if (!settled) {
          settled = true;
          if (realCT) realCT(timer);
          resolve();
        }
      },
      (err: unknown) => {
        if (!settled) {
          settled = true;
          if (realCT) realCT(timer);
          reject(err);
        }
      },
    );
  });
};

// ── Execution ───────────────────────────────────────────────────────────────

const runAttempt = async (
  t: Test,
  beforeEachHooks: ReadonlyArray<() => void | Promise<void>>,
  afterEachHooks: ReadonlyArray<() => void | Promise<void>>,
): Promise<void> => {
  resetAssertionState();
  if (autoClearMocks) clearAllMocks();
  if (autoResetMocks) resetAllMocks();
  if (autoRestoreMocks) restoreAllMocks();
  for (const hook of beforeEachHooks) {
    await hook();
  }
  const timeout = t.timeout ?? defaultTimeout;
  if (timeout !== undefined) {
    await raceTimeout(t.fn, timeout, t.name);
  } else {
    await t.fn();
  }
  for (const hook of afterEachHooks) {
    await hook();
  }
  checkAssertionState();
};

const runTest = async (
  t: Test,
  suitePath: readonly string[],
  beforeEachHooks: ReadonlyArray<() => void | Promise<void>>,
  afterEachHooks: ReadonlyArray<() => void | Promise<void>>,
  insideOnly: boolean,
): Promise<TestResult> => {
  if (t.todo) {
    return { suite: suitePath, name: t.name, status: "todo", duration: 0 };
  }
  if (t.skip || shouldSkip(t, suitePath, insideOnly)) {
    return { suite: suitePath, name: t.name, status: "skip", duration: 0 };
  }

  const maxAttempts = t.retry + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const start = now();
    try {
      await runAttempt(t, beforeEachHooks, afterEachHooks);
      return { suite: suitePath, name: t.name, status: "pass", duration: now() - start };
    } catch (error) {
      lastError = error;
    }
  }

  return { suite: suitePath, name: t.name, status: "fail", error: lastError, duration: 0 };
};

const runSuiteTests = async (
  tests: readonly Test[],
  suitePath: readonly string[],
  beforeEach: ReadonlyArray<() => void | Promise<void>>,
  afterEach: ReadonlyArray<() => void | Promise<void>>,
  effectiveOnly: boolean,
  concurrent: boolean,
): Promise<TestResult[]> => {
  if (concurrent) {
    const promises = tests.map(t => runTest(t, suitePath, beforeEach, afterEach, effectiveOnly));
    const resolved = await Promise.all(promises);
    for (const r of resolved) {
      const line = activeReporter?.onResult?.(r);
      if (line !== undefined) console.log(line);
    }
    return resolved;
  }
  const results: TestResult[] = [];
  for (const t of tests) {
    if (bailed) break;
    const result = await runTest(t, suitePath, beforeEach, afterEach, effectiveOnly);
    results.push(result);
    const line = activeReporter?.onResult?.(result);
    if (line !== undefined) console.log(line);
    if (bailOnFailure && result.status === "fail") {
      bailed = true;
    }
  }
  return results;
};

const runSuite = async (
  suite: Suite,
  path: readonly string[],
  parentBeforeEach: ReadonlyArray<() => void | Promise<void>>,
  parentAfterEach: ReadonlyArray<() => void | Promise<void>>,
  insideOnly: boolean,
): Promise<TestResult[]> => {
  const suitePath = suite.name ? [...path, suite.name] : path;
  const results: TestResult[] = [];
  const effectiveOnly = insideOnly || suite.only;

  const allBeforeEach = [...parentBeforeEach, ...suite.beforeEach];
  const allAfterEach = [...suite.afterEach, ...parentAfterEach];

  for (const hook of suite.beforeAll) {
    await hook();
  }

  results.push(
    ...(await runSuiteTests(
      suite.tests,
      suitePath,
      allBeforeEach,
      allAfterEach,
      effectiveOnly,
      suite.concurrent,
    )),
  );

  // Run nested suites (always sequential: suite ordering should be predictable)
  for (const child of suite.suites) {
    if (bailed) break;
    // Skip child suites that have no .only relevance when filtering is active
    if (hasOnly && !effectiveOnly && !suiteContainsOnly(child)) {
      continue;
    }
    const childResults = await runSuite(
      child,
      suitePath,
      allBeforeEach,
      allAfterEach,
      effectiveOnly,
    );
    results.push(...childResults);
  }

  // Run afterAll hooks
  for (const hook of suite.afterAll) {
    await hook();
  }

  return results;
};

// ── Public run function ─────────────────────────────────────────────────────

const summarise = (results: readonly TestResult[], duration: number): RunSummary => ({
  results: [...results],
  passed: results.filter(r => r.status === "pass").length,
  failed: results.filter(r => r.status === "fail").length,
  skipped: results.filter(r => r.status === "skip").length,
  todo: results.filter(r => r.status === "todo").length,
  duration,
});

/**
 * Run only the tests currently registered in the root suite, returning the
 * summary without printing or exiting. Used by the CLI to drive per-file
 * cycles (e.g. for `--bail` so further file imports can be skipped).
 *
 * @param resetBail if true (default), clears the bail flag before running.
 *                  Pass false to preserve bail across multiple calls.
 */
export const runRegistered = async (resetBail = true): Promise<RunSummary> => {
  if (resetBail) bailed = false;
  const start = now();
  const results = await runSuite(rootSuite, [], [], [], false);
  return summarise(results, now() - start);
};

/** Print the summary via the active reporter and exit if needed. */
export const printSummary = (summary: RunSummary): void => {
  const reporter = activeReporter ?? getReporter("spec");
  console.log(reporter.format(summary));

  const exitCode = summary.failed > 0 ? 1 : 0;
  if (exitCode !== 0 || forceExit) {
    const g = globalThis as Record<string, unknown>;
    const proc = g["process"] as { exit?(code: number): void } | undefined;
    if (proc?.exit) proc.exit(exitCode);
    const deno = g["Deno"] as { exit?(code: number): void } | undefined;
    if (deno?.exit) deno.exit(exitCode);
  }
};

/**
 * Clear all registered tests and suites from the root, but preserve runner
 * state (bail flag, hasOnly, defaults). Used by the CLI between per-file runs.
 */
export const clearRegistered = (): void => {
  rootSuite.tests.length = 0;
  rootSuite.suites.length = 0;
  rootSuite.beforeAll.length = 0;
  rootSuite.afterAll.length = 0;
  rootSuite.beforeEach.length = 0;
  rootSuite.afterEach.length = 0;
};

/** Whether the runner has bailed (a test failed with bail-on-failure enabled). */
export const isBailed = (): boolean => bailed;

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
  const summary = await runRegistered();
  printSummary(summary);
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
  hasOnly = false;
  grepPattern = undefined;
  bailOnFailure = false;
  bailed = false;
  forceExit = false;
  defaultTimeout = undefined;
  autoClearMocks = false;
  autoResetMocks = false;
  autoRestoreMocks = false;
};
