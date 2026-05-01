/**
 * @module pure-test
 *
 * Minimal cross-runtime test runner. Zero dependencies.
 * Works on Node.js, Deno, Bun, Cloudflare Workers, and browsers.
 *
 * @example
 * ```ts
 * import { describe, it, expect, run } from '@igorjs/pure-test'
 *
 * describe('math', () => {
 *   it('adds numbers', () => {
 *     expect(1 + 1).toBe(2)
 *   })
 *
 *   it('works async', async () => {
 *     const result = await Promise.resolve(42)
 *     expect(result).toBe(42)
 *   })
 * })
 *
 * await run()
 * ```
 */

export { expect, AssertionError } from "./expect.js";
export type { Expectation } from "./expect.js";
export { describe, it, test, beforeAll, afterAll, beforeEach, afterEach, run, reset } from "./runner.js";
export type { Test, Suite, TestResult, RunSummary } from "./types.js";
