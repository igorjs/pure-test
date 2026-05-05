// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Test runner. Collects describe/it blocks and executes them.
 *
 * No runtime-specific imports. Uses only globalThis APIs.
 */

import { checkAssertionState, resetAssertionState } from "./expect.js";
import { getReporter, type Reporter } from "./reporters.js";
import { getRealClearTimeout, getRealSetTimeout, getRealTime } from "./timers.js";
import type { RunSummary, Suite, Test, TestResult } from "./types.js";

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

/** Define a test case. Optional timeout in milliseconds. */
export const it = (name: string, fn: () => void | Promise<void>, timeout?: number): void => {
  currentSuite.tests.push({ name, fn, skip: false, todo: false, only: false, timeout });
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
  });
  scheduleAutoRun();
};

/** Focus on a single test. When any .only exists, all other tests are skipped. */
it.only = (name: string, fn: () => void | Promise<void>, timeout?: number): void => {
  hasOnly = true;
  currentSuite.tests.push({ name, fn, skip: false, todo: false, only: true, timeout });
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
  if (t.skip) {
    return { suite: suitePath, name: t.name, status: "skip", duration: 0 };
  }
  // .only filtering: if any .only exists and this test isn't covered, skip it
  if (hasOnly && !insideOnly && !t.only) {
    return { suite: suitePath, name: t.name, status: "skip", duration: 0 };
  }

  const start = now();
  try {
    resetAssertionState();
    for (const hook of beforeEachHooks) {
      await hook();
    }

    // Race test function against optional timeout
    if (t.timeout !== undefined) {
      await raceTimeout(t.fn, t.timeout, t.name);
    } else {
      await t.fn();
    }

    for (const hook of afterEachHooks) {
      await hook();
    }
    checkAssertionState();
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
  insideOnly: boolean,
): Promise<TestResult[]> => {
  const suitePath = suite.name ? [...path, suite.name] : path;
  const results: TestResult[] = [];
  const effectiveOnly = insideOnly || suite.only;

  const allBeforeEach = [...parentBeforeEach, ...suite.beforeEach];
  const allAfterEach = [...suite.afterEach, ...parentAfterEach];

  // Run beforeAll hooks
  for (const hook of suite.beforeAll) {
    await hook();
  }

  // Run tests: concurrent or sequential
  if (suite.concurrent) {
    const promises = suite.tests.map(t =>
      runTest(t, suitePath, allBeforeEach, allAfterEach, effectiveOnly),
    );
    results.push(...(await Promise.all(promises)));
  } else {
    for (const t of suite.tests) {
      results.push(await runTest(t, suitePath, allBeforeEach, allAfterEach, effectiveOnly));
    }
  }

  // Run nested suites (always sequential: suite ordering should be predictable)
  for (const child of suite.suites) {
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
  const results = await runSuite(rootSuite, [], [], [], false);

  const summary: RunSummary = {
    results,
    passed: results.filter(r => r.status === "pass").length,
    failed: results.filter(r => r.status === "fail").length,
    skipped: results.filter(r => r.status === "skip").length,
    todo: results.filter(r => r.status === "todo").length,
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
  hasOnly = false;
};
