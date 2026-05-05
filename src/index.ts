// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * @module pure-test
 *
 * Minimal cross-runtime test runner. Zero dependencies.
 * Works on Node.js, Deno, Bun, Cloudflare Workers, and browsers.
 *
 * @example
 * ```ts
 * import { describe, it, expect } from '@igorjs/pure-test'
 *
 * describe('math', () => {
 *   it('adds numbers', () => {
 *     expect(1 + 1).toBe(2)
 *   })
 * })
 *
 * // Auto-runs after all describe/it calls complete. No run() needed.
 * ```
 */

export type { Expectation } from "./expect.js";
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
export type { Reporter } from "./reporters.js";
export { getReporter, json, minimal, spec, tap } from "./reporters.js";
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  reset,
  run,
  setCLIMode,
  setReporter,
  test,
} from "./runner.js";
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
export type { RunSummary, Suite, Test, TestOptions, TestResult } from "./types.js";
