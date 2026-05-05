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

// ── Asymmetric matchers ──────────────────────────────────────────────────────

const ASYMMETRIC = Symbol.for("pure-test.asymmetric");

interface AsymmetricMatcher {
  readonly [ASYMMETRIC]: true;
  matches(value: unknown): boolean;
  toString(): string;
}

const isAsymmetric = (v: unknown): v is AsymmetricMatcher =>
  v !== null && typeof v === "object" && ASYMMETRIC in v;

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

const getMockCalls = (value: unknown): readonly unknown[][] => {
  const fn = value as Record<string, unknown> | null;
  if (fn && typeof fn === "function" && typeof fn["mock"] === "object" && fn["mock"] !== null) {
    const mock = fn["mock"] as Record<string, unknown>;
    if (Array.isArray(mock["calls"])) return mock["calls"] as unknown[][];
  }
  throw new AssertionError(
    "toHaveBeenCalled/toHaveBeenCalledWith requires a spy (created with spyFn or spyOn)",
    value,
    "spy",
  );
};

/** Fluent assertion builder. */
export interface Expectation<T> {
  /** Assert strict equality (===). */
  toBe(expected: T): void;
  /** Assert deep structural equality. */
  toEqual(expected: T): void;
  /** Assert the value is truthy. */
  toBeTruthy(): void;
  /** Assert the value is falsy. */
  toBeFalsy(): void;
  /** Assert the value is null. */
  toBeNull(): void;
  /** Assert the value is undefined. */
  toBeUndefined(): void;
  /** Assert the value is defined (not undefined). */
  toBeDefined(): void;
  /** Assert the value is an instance of a constructor. */
  toBeInstanceOf(ctor: new (...args: readonly unknown[]) => unknown): void;
  /** Assert the value is greater than expected. */
  toBeGreaterThan(expected: number): void;
  /** Assert the value is less than expected. */
  toBeLessThan(expected: number): void;
  /** Assert the value is greater than or equal to expected. */
  toBeGreaterThanOrEqual(expected: number): void;
  /** Assert the value is less than or equal to expected. */
  toBeLessThanOrEqual(expected: number): void;
  /** Assert the string or array contains the expected value. */
  toContain(expected: unknown): void;
  /** Assert the string matches a regex. */
  toMatch(pattern: RegExp): void;
  /** Assert the value has the expected length. */
  toHaveLength(expected: number): void;
  /** Assert a function throws (or async function rejects). */
  toThrow(messageOrPattern?: string | RegExp): void;
  /** Assert a spy was called at least once. */
  toHaveBeenCalled(): void;
  /** Assert a spy was called exactly N times. */
  toHaveBeenCalledTimes(expected: number): void;
  /** Assert a spy was called with specific arguments (any call). */
  toHaveBeenCalledWith(...args: readonly unknown[]): void;
  /** Assert the object contains a subset of properties (deep partial match). */
  toMatchObject(expected: Record<string, unknown>): void;
  /** Assert a property exists at the given path, optionally with a value. Pass NO_VALUE to check existence only. */
  toHaveProperty(path: string | readonly string[], value?: unknown): void;
  /** Assert deep equality with strict checks (undefined properties, constructor identity). */
  toStrictEqual(expected: T): void;
  /** Invert the assertion. */
  readonly not: Expectation<T>;
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

const createExpectation = <T>(actual: T, negated: boolean): Expectation<T> => {
  const assert = (condition: boolean, msg: string, exp: unknown) => {
    const pass = negated ? !condition : condition;
    if (!pass) {
      const prefix = negated ? "Expected NOT " : "Expected ";
      throw new AssertionError(`${prefix}${msg}`, actual, exp);
    }
  };

  return {
    toBe(expected: T) {
      assert(actual === expected, `${format(actual)} to be ${format(expected)}`, expected);
    },

    toEqual(expected: T) {
      assert(
        deepEqual(actual, expected),
        `${format(actual)} to equal ${format(expected)}`,
        expected,
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

    toBeInstanceOf(ctor: new (...args: readonly unknown[]) => unknown) {
      assert(actual instanceof ctor, `${format(actual)} to be instance of ${ctor.name}`, ctor.name);
    },

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

    toMatch(pattern: RegExp) {
      assert(pattern.test(String(actual)), `${format(actual)} to match ${pattern}`, pattern);
    },

    toHaveLength(expected: number) {
      const len = (actual as { length: number }).length;
      assert(len === expected, `length ${len} to be ${expected}`, expected);
    },

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

    toMatchObject(expected: Record<string, unknown>) {
      assert(
        matchesObject(actual, expected),
        `${format(actual)} to match object ${format(expected)}`,
        expected,
      );
    },

    toHaveProperty(path: string | readonly string[], ...rest: readonly unknown[]) {
      const { exists, value: propValue } = getProperty(actual, path);
      const pathStr = Array.isArray(path) ? path.join(".") : path;
      assert(exists, `object to have property "${pathStr}"`, pathStr);
      if (exists && rest.length > 0) {
        const value = rest[0];
        assert(
          deepEqual(propValue, value),
          `property "${pathStr}" to equal ${format(value)} (got ${format(propValue)})`,
          value,
        );
      }
    },

    toStrictEqual(expected: T) {
      assert(
        strictDeepEqual(actual, expected),
        `${format(actual)} to strictly equal ${format(expected)}`,
        expected,
      );
    },

    toHaveBeenCalled() {
      const calls = getMockCalls(actual);
      assert(
        calls.length > 0,
        `spy to have been called (called ${calls.length} times)`,
        ">0 calls",
      );
    },

    toHaveBeenCalledTimes(expected: number) {
      const calls = getMockCalls(actual);
      assert(
        calls.length === expected,
        `spy to have been called ${expected} times (called ${calls.length} times)`,
        expected,
      );
    },

    toHaveBeenCalledWith(...args: readonly unknown[]) {
      const calls = getMockCalls(actual);
      const match = calls.some(call => deepEqual(call, args));
      assert(match, `spy to have been called with ${format(args)}`, args);
    },

    get not(): Expectation<T> {
      return createExpectation(actual, !negated);
    },
  };
};
