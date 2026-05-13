// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * @module pure-test/deno
 *
 * Deno-native adapter. Registers each `describe`/`it` as a `Deno.test()` call
 * with nested `t.step()` calls, so tools like `deno test`, `deno test --filter`,
 * and IDE test decorations work out of the box.
 *
 * Drop-in swap from the main entry point — only the import path changes:
 *
 * ```ts
 * // Before (auto-runs in pure-test's own runner):
 * import { describe, it, expect } from '@igorjs/pure-test'
 *
 * // After (each test is a Deno.test call):
 * import { describe, it, expect } from '@igorjs/pure-test/deno'
 * ```
 *
 * Step 2: hooks (`beforeAll`/`afterAll`/`beforeEach`/`afterEach`) supported,
 * with parent → child inheritance for `beforeEach`/`afterEach`.
 * Modifiers (`.only`/`.skip`/`.todo`) and per-test options ship in later steps.
 */

// ── Re-exports (unchanged across runtimes) ──────────────────────────────────

export type { AsymmetricMatcher, Expectation } from "./expect.js";
export { AssertionError, expect } from "./expect.js";
export type { MockFn, MockResult } from "./mock.js";
export {
  clearAllMocks,
  jest,
  mock,
  mockDeep,
  resetAllMocks,
  restoreAllMocks,
  spyFn,
  spyOn,
  vi,
} from "./mock.js";
export type { FakeableAPI, FakeTimerConfig } from "./timers.js";
export {
  advanceTimersByTime,
  getRealSystemTime,
  getTimerCount,
  runAllTimers,
  runOnlyPendingTimers,
  setSystemTime,
  useFakeTimers,
  useRealTimers,
} from "./timers.js";

// ── Deno runtime surface (typed locally to avoid a @types/deno dep) ─────────

interface DenoTestContext {
  step(name: string, fn: (t: DenoTestContext) => void | Promise<void>): Promise<unknown>;
}

interface DenoGlobal {
  test(name: string, fn: (t: DenoTestContext) => void | Promise<void>): void;
}

const getDeno = (): DenoGlobal => {
  const g = globalThis as Record<string, unknown>;
  const deno = g["Deno"] as DenoGlobal | undefined;
  if (!deno || typeof deno.test !== "function") {
    throw new Error(
      "@igorjs/pure-test/deno requires the Deno runtime. " +
        "Use '@igorjs/pure-test' on Node, Bun, Workers, or browsers.",
    );
  }
  return deno;
};

// ── Suite frame (buffered while a describe is open) ─────────────────────────

type HookFn = () => void | Promise<void>;

interface SuiteFrame {
  readonly children: Step[];
  readonly beforeAll: HookFn[];
  readonly afterAll: HookFn[];
  readonly beforeEach: HookFn[];
  readonly afterEach: HookFn[];
}

interface TestStep {
  readonly kind: "test";
  readonly name: string;
  readonly fn: HookFn;
}

interface SuiteStep {
  readonly kind: "suite";
  readonly name: string;
  readonly frame: SuiteFrame;
}

type Step = TestStep | SuiteStep;

const newFrame = (): SuiteFrame => ({
  children: [],
  beforeAll: [],
  afterAll: [],
  beforeEach: [],
  afterEach: [],
});

/** Currently open describe block. null = at module top level. */
let currentFrame: SuiteFrame | null = null;

// ── Execution ───────────────────────────────────────────────────────────────

const runFrame = async (
  frame: SuiteFrame,
  t: DenoTestContext,
  parentBeforeEach: readonly HookFn[],
  parentAfterEach: readonly HookFn[],
): Promise<void> => {
  const allBeforeEach: readonly HookFn[] = [...parentBeforeEach, ...frame.beforeEach];
  const allAfterEach: readonly HookFn[] = [...frame.afterEach, ...parentAfterEach];

  for (const hook of frame.beforeAll) {
    await hook();
  }
  try {
    for (const step of frame.children) {
      if (step.kind === "test") {
        await t.step(step.name, async () => {
          for (const h of allBeforeEach) await h();
          try {
            await step.fn();
          } finally {
            for (const h of allAfterEach) await h();
          }
        });
      } else {
        await t.step(step.name, async (innerT: DenoTestContext) => {
          await runFrame(step.frame, innerT, allBeforeEach, allAfterEach);
        });
      }
    }
  } finally {
    for (const hook of frame.afterAll) {
      await hook();
    }
  }
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Define a test suite. Translates to a top-level `Deno.test()` if at module
 * scope, or to a nested `t.step()` if inside another describe.
 */
export const describe = (name: string, fn: () => void): void => {
  const parentFrame = currentFrame;
  const frame = newFrame();
  currentFrame = frame;
  try {
    fn();
  } finally {
    currentFrame = parentFrame;
  }

  if (parentFrame !== null) {
    parentFrame.children.push({ kind: "suite", name, frame });
    return;
  }

  const deno = getDeno();
  deno.test(name, async (t: DenoTestContext) => {
    await runFrame(frame, t, [], []);
  });
};

/**
 * Define a test case. Becomes a `t.step()` when inside a describe, or a
 * standalone `Deno.test()` at module scope.
 */
export const it = (name: string, fn: HookFn): void => {
  if (currentFrame !== null) {
    currentFrame.children.push({ kind: "test", name, fn });
    return;
  }
  const deno = getDeno();
  deno.test(name, fn);
};

/** Alias for `it`. */
export const test = it;

// ── Hooks ───────────────────────────────────────────────────────────────────

const requireFrame = (hook: string): SuiteFrame => {
  if (currentFrame === null) {
    throw new Error(
      `${hook}() must be called inside a describe() block when using '@igorjs/pure-test/deno'. ` +
        "Top-level hooks are not supported in adapter mode — wrap your tests in describe().",
    );
  }
  return currentFrame;
};

/** Run once before all tests in the enclosing describe. */
export const beforeAll = (fn: HookFn): void => {
  requireFrame("beforeAll").beforeAll.push(fn);
};

/** Run once after all tests in the enclosing describe. */
export const afterAll = (fn: HookFn): void => {
  requireFrame("afterAll").afterAll.push(fn);
};

/** Run before each test in the enclosing describe (and inherited by children). */
export const beforeEach = (fn: HookFn): void => {
  requireFrame("beforeEach").beforeEach.push(fn);
};

/** Run after each test in the enclosing describe (and inherited by children). */
export const afterEach = (fn: HookFn): void => {
  requireFrame("afterEach").afterEach.push(fn);
};
