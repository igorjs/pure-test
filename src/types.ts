// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Core type definitions for the test runner.
 */

/** Options for it() / test(). */
export interface TestOptions {
  readonly timeout?: number;
  readonly retry?: number;
}

/** A single test case. */
export interface Test {
  readonly name: string;
  readonly fn: () => void | Promise<void>;
  readonly skip: boolean;
  readonly todo: boolean;
  readonly only: boolean;
  readonly timeout: number | undefined;
  readonly retry: number;
}

/** A test suite (describe block). Can nest. */
export interface Suite {
  readonly name: string;
  readonly tests: Test[];
  readonly suites: Suite[];
  readonly beforeAll: Array<() => void | Promise<void>>;
  readonly afterAll: Array<() => void | Promise<void>>;
  readonly beforeEach: Array<() => void | Promise<void>>;
  readonly afterEach: Array<() => void | Promise<void>>;
  readonly concurrent: boolean;
  readonly only: boolean;
}

/** Result of running a single test. */
export interface TestResult {
  readonly suite: readonly string[];
  readonly name: string;
  readonly status: "pass" | "fail" | "skip" | "todo";
  readonly error?: unknown;
  readonly duration: number;
}

/** Summary of a full test run. */
export interface RunSummary {
  readonly results: readonly TestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly todo: number;
  readonly duration: number;
}
