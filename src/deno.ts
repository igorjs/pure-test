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
 * Step 1 spike: only `describe`, `it`, and assertion/mock/timer APIs.
 * Hooks (`beforeAll`/`afterEach`), modifiers (`.only`/`.skip`/`.todo`),
 * and per-test options (timeout/retry/permissions) ship in later steps.
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

// ── Step tree (buffered while a describe is open) ───────────────────────────

interface TestStep {
  readonly kind: "test";
  readonly name: string;
  readonly fn: () => void | Promise<void>;
}

interface SuiteStep {
  readonly kind: "suite";
  readonly name: string;
  readonly children: Step[];
}

type Step = TestStep | SuiteStep;

/** Stack of "currently open describe blocks". null = at module top level. */
let currentChildren: Step[] | null = null;

const runSteps = async (steps: readonly Step[], t: DenoTestContext): Promise<void> => {
  for (const step of steps) {
    if (step.kind === "test") {
      await t.step(step.name, step.fn);
    } else {
      await t.step(step.name, async (innerT: DenoTestContext) => {
        await runSteps(step.children, innerT);
      });
    }
  }
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Define a test suite. Translates to a top-level `Deno.test()` if at module
 * scope, or to a nested `t.step()` if inside another describe.
 */
export const describe = (name: string, fn: () => void): void => {
  const parentChildren = currentChildren;
  const children: Step[] = [];
  currentChildren = children;
  try {
    fn();
  } finally {
    currentChildren = parentChildren;
  }

  if (parentChildren !== null) {
    parentChildren.push({ kind: "suite", name, children });
    return;
  }

  const deno = getDeno();
  deno.test(name, async (t: DenoTestContext) => {
    await runSteps(children, t);
  });
};

/**
 * Define a test case. Becomes a `t.step()` when inside a describe, or a
 * standalone `Deno.test()` at module scope.
 */
export const it = (name: string, fn: () => void | Promise<void>): void => {
  if (currentChildren !== null) {
    currentChildren.push({ kind: "test", name, fn });
    return;
  }
  const deno = getDeno();
  deno.test(name, fn);
};

/** Alias for `it`. */
export const test = it;
