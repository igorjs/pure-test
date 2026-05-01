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

export { expect, AssertionError } from "./expect.js";
export type { Expectation } from "./expect.js";
export {
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  run,
  reset,
  setCLIMode,
  setReporter,
} from "./runner.js";
export { tap, spec, json, minimal, getReporter } from "./reporters.js";
export type { Reporter } from "./reporters.js";
export { spyFn, spyOn, mock, mockDeep, restoreAllMocks, clearAllMocks, resetAllMocks } from "./mock.js";
export type { MockFn, MockResult } from "./mock.js";
export type { Test, Suite, TestResult, RunSummary } from "./types.js";
