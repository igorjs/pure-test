// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Assertion library. No runtime-specific imports.
 *
 * Uses only globalThis APIs so it works on Node, Deno, Bun, Workers, Browser.
 */

/** Thrown when an assertion fails. */
export class AssertionError extends Error {
  readonly actual: unknown;
  readonly expected: unknown;

  constructor(message: string, actual: unknown, expected: unknown) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
  }
}

// ── Assertion counting ──────────────────────────────────────────────────────

let assertionCount = 0;
let expectedAssertions: number | undefined;
let expectAnyAssertions = false;

/** Reset assertion counters. Called by the runner before each test. */
export const resetAssertionState = (): void => {
  assertionCount = 0;
  expectedAssertions = undefined;
  expectAnyAssertions = false;
};

/** Check assertion expectations. Called by the runner after each test. Throws on mismatch. */
export const checkAssertionState = (): void => {
  if (expectedAssertions !== undefined && assertionCount !== expectedAssertions) {
    throw new AssertionError(
      `Expected ${expectedAssertions} assertions but ${assertionCount} were called`,
      assertionCount,
      expectedAssertions,
    );
  }
  if (expectAnyAssertions && assertionCount === 0) {
    throw new AssertionError("Expected at least one assertion but none were called", 0, ">0");
  }
};

// ── Asymmetric matchers ──────────────────────────────────────────────────────

const ASYMMETRIC = Symbol.for("pure-test.asymmetric");

interface AsymmetricMatcher {
  readonly [ASYMMETRIC]: true;
  matches(value: unknown): boolean;
  toString(): string;
}

const isAsymmetric = (v: unknown): v is AsymmetricMatcher =>
  v !== null && typeof v === "object" && ASYMMETRIC in v;

// ── Format validators ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// RFC 9562 UUID format: xxxxxxxx-xxxx-Vxxx-Nxxx-xxxxxxxxxxxx
//   V = version (position 14): 1-8 for standard UUIDs
//   N = variant (position 19): 8,9,a,b for RFC 9562 variant (10xx)
// Nil UUID (all zeros) and Max UUID (all F's) are valid special cases.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const isUUID = (v: unknown, version?: number): boolean => {
  if (typeof v !== "string") return false;
  if (!UUID_RE.test(v)) return false;

  // Nil and Max UUIDs are valid when no version is specified
  const lower = v.toLowerCase();
  if (lower === NIL_UUID || lower === MAX_UUID) return version === undefined;

  // Version: position 14 (bits 48-51), valid values 1-8 per RFC 9562 Table 2
  const vChar = v[14]!;
  const ver = Number.parseInt(vChar, 16);
  if (ver < 1 || ver > 8) return false;

  // Variant: position 19 (bits 64-65), must be 10xx (0x8-0xB) per RFC 9562 Section 4.1
  const nChar = v[19]!;
  const variant = Number.parseInt(nChar, 16);
  if (variant < 0x8 || variant > 0xb) return false;

  // Version filter
  if (version !== undefined) return ver === version;
  return true;
};

// ── Deep equality ───────────────────────────────────────────────────────────

const deepEqualArrays = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }
  return true;
};

const deepEqualObjects = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
};

/** Deep structural equality. Supports asymmetric matchers on the expected side. */
const deepEqual = (a: unknown, b: unknown): boolean => {
  // Asymmetric matcher on expected side
  if (isAsymmetric(b)) return b.matches(a);

  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;

  if (Array.isArray(a) && Array.isArray(b)) return deepEqualArrays(a, b);

  if (typeof a === "object" && typeof b === "object") {
    return deepEqualObjects(a as Record<string, unknown>, b as Record<string, unknown>);
  }

  return false;
};

// ── Strict deep equality (checks undefined properties + constructor) ────────

const strictDeepEqualArrays = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!strictDeepEqual(a[i], b[i])) return false;
  }
  return true;
};

const strictDeepEqualObjects = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key)) return false;
    if (!strictDeepEqual(a[key], b[key])) return false;
  }
  return true;
};

const strictDeepEqual = (a: unknown, b: unknown): boolean => {
  if (isAsymmetric(b)) return b.matches(a);
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;
  if (Array.isArray(a) && Array.isArray(b)) return strictDeepEqualArrays(a, b);

  if (typeof a === "object" && typeof b === "object") {
    if (a.constructor !== b.constructor) return false;
    return strictDeepEqualObjects(a as Record<string, unknown>, b as Record<string, unknown>);
  }

  return false;
};

// ── Partial matching (for toMatchObject) ────────────────────────────────────

const matchesObjectArrays = (actual: unknown[], expected: unknown[]): boolean => {
  if (expected.length > actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (!matchesObject(actual[i], expected[i])) return false;
  }
  return true;
};

const matchesObject = (actual: unknown, expected: unknown): boolean => {
  if (isAsymmetric(expected)) return expected.matches(actual);
  if (expected === actual) return true;
  if (expected === null || actual === null) return expected === actual;
  if (typeof expected !== "object" || typeof actual !== "object")
    return deepEqual(actual, expected);

  if (Array.isArray(expected) && Array.isArray(actual))
    return matchesObjectArrays(actual, expected);

  const eo = expected as Record<string, unknown>;
  const ao = actual as Record<string, unknown>;
  for (const key of Object.keys(eo)) {
    if (!matchesObject(ao[key], eo[key])) return false;
  }
  return true;
};

// ── Property path access (for toHaveProperty) ───────────────────────────────

const getProperty = (
  obj: unknown,
  path: string | readonly string[],
): { exists: boolean; value: unknown } => {
  const keys = typeof path === "string" ? path.split(".") : path;
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return { exists: false, value: undefined };
    }
    if (!Object.hasOwn(current, key)) {
      return { exists: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[key];
  }
  return { exists: true, value: current };
};

const format = (v: unknown): string => {
  if (typeof v === "string") return `"${v}"`;
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

const formatPretty = (v: unknown, indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const items = v.map(i => `${pad}  ${formatPretty(i, indent + 1)}`).join(",\n");
    return `[\n${items}\n${pad}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const props = entries
    .map(([k, val]) => `${pad}  ${k}: ${formatPretty(val, indent + 1)}`)
    .join(",\n");
  return `{\n${props}\n${pad}}`;
};

const diff = (actual: unknown, expected: unknown): string => {
  const a = formatPretty(actual);
  const e = formatPretty(expected);
  if (a === e) return "";
  return `\n  Actual:   ${a}\n  Expected: ${e}`;
};

// ── Mock data extraction ────────────────────────────────────────────────────

interface MockData {
  readonly calls: readonly unknown[][];
  readonly results: ReadonlyArray<{ type: string; value: unknown }>;
  readonly lastCall: readonly unknown[] | undefined;
}

const getMockData = (value: unknown): MockData => {
  const fn = value as Record<string, unknown> | null;
  if (fn && typeof fn === "function" && typeof fn["mock"] === "object" && fn["mock"] !== null) {
    const mock = fn["mock"] as Record<string, unknown>;
    if (Array.isArray(mock["calls"])) return mock as unknown as MockData;
  }
  throw new AssertionError(
    "Spy assertion requires a spy (created with spyFn or spyOn)",
    value,
    "spy",
  );
};

/** Fluent assertion builder. */
export interface Expectation<T> {
  // ── Value matchers ──
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toStrictEqual(expected: T): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toBeInstanceOf(ctor: new (...args: readonly unknown[]) => unknown): void;
  toBeTypeOf(expected: string): void;
  toSatisfy(predicate: (value: T) => boolean): void;
  /** Assert the value is a valid email address. */
  toBeEmail(): void;
  /** Assert the value is a valid UUID, optionally of a specific version. */
  toBeUUID(version?: number): void;

  // ── Numeric matchers ──
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, numDigits?: number): void;

  // ── Container matchers ──
  toContain(expected: unknown): void;
  toContainEqual(expected: unknown): void;
  /** Assert array matches exactly (same elements, same order, same length). */
  toMatchArray(expected: readonly unknown[]): void;
  /** Assert array contains the same elements regardless of order (multiset equality). */
  toMatchUnsortedArray(expected: readonly unknown[]): void;
  toMatch(pattern: RegExp | string): void;
  toHaveLength(expected: number): void;
  toMatchObject(expected: Record<string, unknown>): void;
  toHaveProperty(path: string | readonly string[], ...value: readonly unknown[]): void;

  // ── Error matchers ──
  toThrow(messageOrPattern?: string | RegExp): void;

  // ── Spy matchers ──
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(expected: number): void;
  toHaveBeenCalledWith(...args: readonly unknown[]): void;
  toHaveBeenLastCalledWith(...args: readonly unknown[]): void;
  toHaveBeenNthCalledWith(n: number, ...args: readonly unknown[]): void;
  toHaveReturned(): void;
  toHaveReturnedTimes(expected: number): void;
  toHaveReturnedWith(expected: unknown): void;
  toHaveLastReturnedWith(expected: unknown): void;
  toHaveNthReturnedWith(n: number, expected: unknown): void;

  // ── Modifiers ──
  readonly not: Expectation<T>;
  readonly resolves: Expectation<Awaited<T>>;
  readonly rejects: Expectation<unknown>;
}

/** Create an expectation for a value. */
export const expect = <T>(actual: T): Expectation<T> => createExpectation(actual, false);

/** Match any value of a given type. */
expect.any = (ctor: Function): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => {
    if (ctor === String) return typeof v === "string";
    if (ctor === Number) return typeof v === "number";
    if (ctor === Boolean) return typeof v === "boolean";
    if (ctor === BigInt) return typeof v === "bigint";
    if (ctor === Symbol) return typeof v === "symbol";
    if (ctor === Function) return typeof v === "function";
    return v instanceof (ctor as new (...args: readonly unknown[]) => unknown);
  },
  toString: () => `expect.any(${ctor.name})`,
});

/** Match any defined value (not null or undefined). */
expect.anything = (): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => v !== null && v !== undefined,
  toString: () => "expect.anything()",
});

/** Match a string containing the expected substring. */
expect.stringContaining = (expected: string): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => typeof v === "string" && v.includes(expected),
  toString: () => `expect.stringContaining("${expected}")`,
});

/** Match a string matching the expected pattern. */
expect.stringMatching = (pattern: string | RegExp): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => {
    if (typeof v !== "string") return false;
    const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return re.test(v);
  },
  toString: () => `expect.stringMatching(${pattern})`,
});

/** Match an object containing a subset of properties. */
expect.objectContaining = (expected: Record<string, unknown>): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => matchesObject(v, expected),
  toString: () => `expect.objectContaining(${format(expected)})`,
});

/** Match an array containing all expected elements (in any order). */
expect.arrayContaining = (expected: readonly unknown[]): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => {
    if (!Array.isArray(v)) return false;
    return expected.every(exp => v.some(item => deepEqual(item, exp)));
  },
  toString: () => `expect.arrayContaining(${format(expected)})`,
});

/** Match a valid email address. */
expect.email = (): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => typeof v === "string" && EMAIL_RE.test(v),
  toString: () => "expect.email()",
});

/** Match a valid UUID, optionally of a specific version. */
expect.uuid = (version?: number): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => isUUID(v, version),
  toString: () => (version !== undefined ? `expect.uuid(${version})` : "expect.uuid()"),
});

/** Match a number approximately equal to expected. */
expect.closeTo = (expected: number, numDigits = 2): AsymmetricMatcher => ({
  [ASYMMETRIC]: true,
  matches: (v: unknown) => {
    if (typeof v !== "number") return false;
    return Math.abs(v - expected) < 10 ** -numDigits / 2;
  },
  toString: () => `expect.closeTo(${expected})`,
});

/** Verify that a specific number of assertions were called during a test. */
expect.assertions = (count: number): void => {
  expectedAssertions = count;
};

/** Verify that at least one assertion was called during a test. */
expect.hasAssertions = (): void => {
  expectAnyAssertions = true;
};

/** Negated asymmetric matchers. */
expect.not = {
  arrayContaining: (expected: readonly unknown[]): AsymmetricMatcher => ({
    [ASYMMETRIC]: true,
    matches: (v: unknown) => !expect.arrayContaining(expected).matches(v),
    toString: () => `expect.not.arrayContaining(${format(expected)})`,
  }),
  objectContaining: (expected: Record<string, unknown>): AsymmetricMatcher => ({
    [ASYMMETRIC]: true,
    matches: (v: unknown) => !expect.objectContaining(expected).matches(v),
    toString: () => `expect.not.objectContaining(${format(expected)})`,
  }),
  stringContaining: (expected: string): AsymmetricMatcher => ({
    [ASYMMETRIC]: true,
    matches: (v: unknown) => !expect.stringContaining(expected).matches(v),
    toString: () => `expect.not.stringContaining("${expected}")`,
  }),
  stringMatching: (pattern: string | RegExp): AsymmetricMatcher => ({
    [ASYMMETRIC]: true,
    matches: (v: unknown) => !expect.stringMatching(pattern).matches(v),
    toString: () => `expect.not.stringMatching(${pattern})`,
  }),
};

const createExpectation = <T>(actual: T, negated: boolean): Expectation<T> => {
  const assert = (condition: boolean, msg: string, exp: unknown, showDiff = false) => {
    assertionCount++;
    const pass = negated ? !condition : condition;
    if (!pass) {
      const prefix = negated ? "Expected NOT " : "Expected ";
      const diffStr = showDiff && !negated ? diff(actual, exp) : "";
      throw new AssertionError(`${prefix}${msg}${diffStr}`, actual, exp);
    }
  };

  return {
    // ── Value matchers ──

    toBe(expected: T) {
      assert(actual === expected, `${format(actual)} to be ${format(expected)}`, expected);
    },

    toEqual(expected: T) {
      assert(
        deepEqual(actual, expected),
        `${format(actual)} to equal ${format(expected)}`,
        expected,
        true,
      );
    },

    toStrictEqual(expected: T) {
      assert(
        strictDeepEqual(actual, expected),
        `${format(actual)} to strictly equal ${format(expected)}`,
        expected,
        true,
      );
    },

    toBeTruthy() {
      assert(!!actual, `${format(actual)} to be truthy`, true);
    },

    toBeFalsy() {
      assert(!actual, `${format(actual)} to be falsy`, false);
    },

    toBeNull() {
      assert(actual === null, `${format(actual)} to be null`, null);
    },

    toBeUndefined() {
      assert(actual === undefined, `${format(actual)} to be undefined`, undefined);
    },

    toBeDefined() {
      assert(actual !== undefined, `${format(actual)} to be defined`, "defined");
    },

    toBeNaN() {
      assert(Number.isNaN(actual), `${format(actual)} to be NaN`, NaN);
    },

    toBeInstanceOf(ctor: new (...args: readonly unknown[]) => unknown) {
      assert(actual instanceof ctor, `${format(actual)} to be instance of ${ctor.name}`, ctor.name);
    },

    toBeTypeOf(expected: string) {
      assert(typeof actual === expected, `typeof ${format(actual)} to be "${expected}"`, expected);
    },

    toSatisfy(predicate: (value: T) => boolean) {
      assert(predicate(actual), `${format(actual)} to satisfy predicate`, "predicate");
    },

    toBeEmail() {
      assert(
        typeof actual === "string" && EMAIL_RE.test(actual),
        `${format(actual)} to be a valid email`,
        "email",
      );
    },

    toBeUUID(version?: number) {
      const label = version !== undefined ? `UUID v${version}` : "UUID";
      assert(isUUID(actual, version), `${format(actual)} to be a valid ${label}`, label);
    },

    // ── Numeric matchers ──

    toBeGreaterThan(expected: number) {
      assert((actual as number) > expected, `${format(actual)} > ${expected}`, expected);
    },

    toBeLessThan(expected: number) {
      assert((actual as number) < expected, `${format(actual)} < ${expected}`, expected);
    },

    toBeGreaterThanOrEqual(expected: number) {
      assert((actual as number) >= expected, `${format(actual)} >= ${expected}`, expected);
    },

    toBeLessThanOrEqual(expected: number) {
      assert((actual as number) <= expected, `${format(actual)} <= ${expected}`, expected);
    },

    toBeCloseTo(expected: number, numDigits = 2) {
      const pow = 10 ** -numDigits / 2;
      const pass = Math.abs((actual as number) - expected) < pow;
      assert(pass, `${format(actual)} to be close to ${expected} (${numDigits} digits)`, expected);
    },

    // ── Container matchers ──

    toContain(expected: unknown) {
      if (typeof actual === "string") {
        assert(
          actual.includes(expected as string),
          `"${actual}" to contain "${expected}"`,
          expected,
        );
      } else if (Array.isArray(actual)) {
        assert(actual.includes(expected), `array to contain ${format(expected)}`, expected);
      } else {
        throw new AssertionError("toContain requires string or array", actual, expected);
      }
    },

    toContainEqual(expected: unknown) {
      if (!Array.isArray(actual)) {
        throw new AssertionError("toContainEqual requires an array", actual, expected);
      }
      const match = actual.some(item => deepEqual(item, expected));
      assert(match, `array to contain equal ${format(expected)}`, expected);
    },

    toMatchArray(expected: readonly unknown[]) {
      if (!Array.isArray(actual)) {
        throw new AssertionError("toMatchArray requires an array", actual, expected);
      }
      assert(
        deepEqual(actual, expected),
        `${format(actual)} to match array ${format(expected)}`,
        expected,
        true,
      );
    },

    toMatchUnsortedArray(expected: readonly unknown[]) {
      if (!Array.isArray(actual)) {
        throw new AssertionError("toMatchUnsortedArray requires an array", actual, expected);
      }
      if (actual.length !== expected.length) {
        assert(false, `array length ${actual.length} to be ${expected.length}`, expected);
        return;
      }
      // Multiset equality: each expected element must match exactly one actual element
      const used = new Array<boolean>(actual.length).fill(false);
      for (const exp of expected) {
        const idx = actual.findIndex((item, i) => !used[i] && deepEqual(item, exp));
        if (idx === -1) {
          assert(false, `${format(actual)} to contain ${format(exp)} (unordered)`, expected);
          return;
        }
        used[idx] = true;
      }
      assert(true, "", expected);
    },

    toMatch(pattern: RegExp | string) {
      const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      assert(re.test(String(actual)), `${format(actual)} to match ${re}`, pattern);
    },

    toHaveLength(expected: number) {
      const len = (actual as { length: number }).length;
      assert(len === expected, `length ${len} to be ${expected}`, expected);
    },

    toMatchObject(expected: Record<string, unknown>) {
      assert(
        matchesObject(actual, expected),
        `${format(actual)} to match object ${format(expected)}`,
        expected,
        true,
      );
    },

    toHaveProperty(path: string | readonly string[], ...rest: readonly unknown[]) {
      const { exists, value: propValue } = getProperty(actual, path);
      const pathStr = Array.isArray(path) ? path.join(".") : path;
      assert(exists, `object to have property "${pathStr}"`, pathStr);
      if (exists && rest.length > 0) {
        assert(
          deepEqual(propValue, rest[0]),
          `property "${pathStr}" to equal ${format(rest[0])} (got ${format(propValue)})`,
          rest[0],
        );
      }
    },

    // ── Error matchers ──

    toThrow(messageOrPattern?: string | RegExp) {
      if (typeof actual !== "function") {
        throw new AssertionError("toThrow requires a function", actual, "function");
      }
      let threw = false;
      let error: unknown;
      try {
        (actual as () => unknown)();
      } catch (e) {
        threw = true;
        error = e;
      }
      assert(threw, "function to throw", "thrown");
      if (threw && messageOrPattern !== undefined) {
        const msg = error instanceof Error ? error.message : String(error);
        if (typeof messageOrPattern === "string") {
          assert(
            msg.includes(messageOrPattern),
            `error "${msg}" to contain "${messageOrPattern}"`,
            messageOrPattern,
          );
        } else {
          assert(
            messageOrPattern.test(msg),
            `error "${msg}" to match ${messageOrPattern}`,
            messageOrPattern,
          );
        }
      }
    },

    // ── Spy matchers ──

    toHaveBeenCalled() {
      const { calls } = getMockData(actual);
      assert(
        calls.length > 0,
        `spy to have been called (called ${calls.length} times)`,
        ">0 calls",
      );
    },

    toHaveBeenCalledTimes(expected: number) {
      const { calls } = getMockData(actual);
      assert(
        calls.length === expected,
        `spy to have been called ${expected} times (called ${calls.length} times)`,
        expected,
      );
    },

    toHaveBeenCalledWith(...args: readonly unknown[]) {
      const { calls } = getMockData(actual);
      assert(
        calls.some(c => deepEqual(c, args)),
        `spy to have been called with ${format(args)}`,
        args,
      );
    },

    toHaveBeenLastCalledWith(...args: readonly unknown[]) {
      const { lastCall } = getMockData(actual);
      assert(
        lastCall !== undefined && deepEqual(lastCall, args),
        `spy last call to equal ${format(args)} (got ${format(lastCall)})`,
        args,
      );
    },

    toHaveBeenNthCalledWith(n: number, ...args: readonly unknown[]) {
      const { calls } = getMockData(actual);
      const call = calls[n - 1];
      assert(
        call !== undefined && deepEqual(call, args),
        `spy call #${n} to equal ${format(args)} (got ${format(call)})`,
        args,
      );
    },

    toHaveReturned() {
      const { results } = getMockData(actual);
      const returned = results.some(r => r.type === "return");
      assert(returned, "spy to have returned", "return");
    },

    toHaveReturnedTimes(expected: number) {
      const { results } = getMockData(actual);
      const count = results.filter(r => r.type === "return").length;
      assert(
        count === expected,
        `spy to have returned ${expected} times (returned ${count} times)`,
        expected,
      );
    },

    toHaveReturnedWith(expected: unknown) {
      const { results } = getMockData(actual);
      const match = results.some(r => r.type === "return" && deepEqual(r.value, expected));
      assert(match, `spy to have returned ${format(expected)}`, expected);
    },

    toHaveLastReturnedWith(expected: unknown) {
      const { results } = getMockData(actual);
      const last = results.length > 0 ? results[results.length - 1] : undefined;
      assert(
        last !== undefined && last.type === "return" && deepEqual(last.value, expected),
        `spy last return to equal ${format(expected)} (got ${format(last?.value)})`,
        expected,
      );
    },

    toHaveNthReturnedWith(n: number, expected: unknown) {
      const { results } = getMockData(actual);
      const result = results[n - 1];
      assert(
        result !== undefined && result.type === "return" && deepEqual(result.value, expected),
        `spy return #${n} to equal ${format(expected)} (got ${format(result?.value)})`,
        expected,
      );
    },

    // ── Modifiers ──

    get not(): Expectation<T> {
      return createExpectation(actual, !negated);
    },

    get resolves(): Expectation<Awaited<T>> {
      if (!(actual instanceof Promise)) {
        throw new AssertionError("resolves requires a Promise", actual, "Promise");
      }
      const pending = (actual as Promise<Awaited<T>>).then(
        v => createExpectation(v, negated),
        e => {
          throw new AssertionError(`Promise rejected instead of resolving: ${e}`, e, "resolved");
        },
      );
      return new Proxy({} as Expectation<Awaited<T>>, {
        get: (_target, prop) => {
          if (prop === "then") return pending.then.bind(pending);
          return (...args: readonly unknown[]) =>
            pending.then(exp => (exp[prop as keyof Expectation<Awaited<T>>] as Function)(...args));
        },
      });
    },

    get rejects(): Expectation<unknown> {
      if (!(actual instanceof Promise)) {
        throw new AssertionError("rejects requires a Promise", actual, "Promise");
      }
      const pending = (actual as Promise<unknown>).then(
        v => {
          throw new AssertionError(
            `Promise resolved instead of rejecting: ${format(v)}`,
            v,
            "rejected",
          );
        },
        e => createExpectation(e, negated),
      );
      return new Proxy({} as Expectation<unknown>, {
        get: (_target, prop) => {
          if (prop === "then") return pending.then.bind(pending);
          return (...args: readonly unknown[]) =>
            pending.then(exp => (exp[prop as keyof Expectation<unknown>] as Function)(...args));
        },
      });
    },
  };
};
