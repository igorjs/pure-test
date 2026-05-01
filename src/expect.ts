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

/** Deep strict equality check. */
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
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
  /** Invert the assertion. */
  readonly not: Expectation<T>;
}

/** Create an expectation for a value. */
export const expect = <T>(actual: T): Expectation<T> => createExpectation(actual, false);

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
      assert(deepEqual(actual, expected), `${format(actual)} to equal ${format(expected)}`, expected);
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
        assert(actual.includes(expected as string), `"${actual}" to contain "${expected}"`, expected);
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
          assert(msg.includes(messageOrPattern), `error "${msg}" to contain "${messageOrPattern}"`, messageOrPattern);
        } else {
          assert(messageOrPattern.test(msg), `error "${msg}" to match ${messageOrPattern}`, messageOrPattern);
        }
      }
    },

    get not(): Expectation<T> {
      return createExpectation(actual, !negated);
    },
  };
};
