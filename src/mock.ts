// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Mocking utilities with Vitest-compatible API.
 *
 * Drop-in replacement: change `import { vi } from 'vitest'` to
 * `import { vi } from '@igorjs/pure-test'` and everything works.
 *
 * Also exports individual functions: `fn`, `spyOn`, `mock`, `mockDeep`, `restoreAllMocks`.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Result of a single mock invocation. */
export interface MockResult<T> {
  readonly type: "return" | "throw";
  readonly value: T;
}

/** A Vitest-compatible mock function. */
export interface MockFn<
  T extends (...args: readonly unknown[]) => unknown = (...args: readonly unknown[]) => unknown,
> {
  /** Call the mock. */
  (...args: Parameters<T>): ReturnType<T>;

  /** Call tracking data. */
  readonly mock: {
    /** Arguments for each call. */
    readonly calls: Parameters<T>[];
    /** Return/throw results for each call. */
    readonly results: MockResult<ReturnType<T>>[];
    /** Arguments of the last call, or undefined. */
    readonly lastCall: Parameters<T> | undefined;
    /** Number of times called. */
    readonly invocationCallOrder: number[];
  };

  // ── Naming ──

  /** Get the mock's name. */
  getMockName(): string;
  /** Set the mock's name (for assertion messages). */
  mockName(name: string): MockFn<T>;

  // ── History ──

  /** Clear call history, keep implementation. */
  mockClear(): MockFn<T>;
  /** Clear history and reset implementation to default. */
  mockReset(): MockFn<T>;
  /** Clear history and restore original (spyOn only). */
  mockRestore(): void;

  // ── Implementation ──

  /** Set the implementation. */
  mockImplementation(fn: T): MockFn<T>;
  /** Set a one-time implementation (chainable, uses queue). */
  mockImplementationOnce(fn: T): MockFn<T>;
  /** Get the current implementation. */
  getMockImplementation(): T | undefined;

  // ── Return values ──

  /** Set the return value for all calls. */
  mockReturnValue(value: ReturnType<T>): MockFn<T>;
  /** Set a one-time return value (chainable). */
  mockReturnValueOnce(value: ReturnType<T>): MockFn<T>;
  /** Set the mock to resolve with a value (async). */
  mockResolvedValue(value: Awaited<ReturnType<T>>): MockFn<T>;
  /** Set a one-time resolved value (async, chainable). */
  mockResolvedValueOnce(value: Awaited<ReturnType<T>>): MockFn<T>;
  /** Set the mock to reject with a value (async). */
  mockRejectedValue(value: unknown): MockFn<T>;
  /** Set a one-time rejected value (async, chainable). */
  mockRejectedValueOnce(value: unknown): MockFn<T>;
  /** Set the mock to throw a value. */
  mockThrow(value: unknown): MockFn<T>;
  /** Set a one-time throw (chainable). */
  mockThrowOnce(value: unknown): MockFn<T>;
  /** Set the mock to return `this`. */
  mockReturnThis(): MockFn<T>;
}

/** Info tracked for spyOn restoration. */
interface SpyRecord {
  readonly target: Record<string, unknown>;
  readonly method: string;
  readonly original: unknown;
  readonly mock: MockFn;
}

// ── Global state ────────────────────────────────────────────────────────────

const spyRegistry: SpyRecord[] = [];
let globalCallOrder = 0;

// ── fn() ────────────────────────────────────────────────────────────────────

/** Create a standalone spy function. */
export const spyFn = <
  T extends (...args: readonly unknown[]) => unknown = (...args: readonly unknown[]) => unknown,
>(
  initialImpl?: T,
): MockFn<T> => {
  let name = "spyFn()";
  let impl: T | undefined = initialImpl;
  const implOnceQueue: T[] = [];
  const returnOnceQueue: ReturnType<T>[] = [];
  const throwOnceQueue: unknown[] = [];
  let fixedReturn: { value: ReturnType<T> } | undefined;
  let fixedThrow: { value: unknown } | undefined;
  let returnThis = false;

  const calls: Parameters<T>[] = [];
  const results: MockResult<ReturnType<T>>[] = [];
  const invocationCallOrder: number[] = [];

  const mockData = {
    get calls() {
      return calls;
    },
    get results() {
      return results;
    },
    get lastCall() {
      return calls.length > 0 ? calls[calls.length - 1] : undefined;
    },
    get invocationCallOrder() {
      return invocationCallOrder;
    },
  };

  const resolveThrow = (): unknown => {
    if (throwOnceQueue.length > 0) return throwOnceQueue.shift();
    if (fixedThrow !== undefined) return fixedThrow.value;
    return undefined;
  };

  const resolveReturn = (ctx: unknown, args: Parameters<T>): ReturnType<T> => {
    if (returnThis) return ctx as ReturnType<T>;
    if (returnOnceQueue.length > 0) return returnOnceQueue.shift()!;
    if (implOnceQueue.length > 0) return implOnceQueue.shift()?.(...args) as ReturnType<T>;
    if (fixedReturn !== undefined) return fixedReturn.value;
    if (impl !== undefined) return impl(...args) as ReturnType<T>;
    return undefined as ReturnType<T>;
  };

  const mockFn = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    calls.push(args);
    invocationCallOrder.push(++globalCallOrder);

    try {
      const err = resolveThrow();
      if (err !== undefined) {
        results.push({ type: "throw", value: err as ReturnType<T> });
        throw err;
      }

      const result = resolveReturn(this, args);
      results.push({ type: "return", value: result });
      return result;
    } catch (e) {
      if (results.length === 0 || results[results.length - 1]?.type !== "throw") {
        results.push({ type: "throw", value: e as ReturnType<T> });
      }
      throw e;
    }
  } as MockFn<T>;

  // Attach mock data
  Object.defineProperty(mockFn, "mock", { get: () => mockData });

  // Naming
  mockFn.getMockName = () => name;
  mockFn.mockName = (n: string) => {
    name = n;
    return mockFn;
  };

  // History
  mockFn.mockClear = () => {
    calls.length = 0;
    results.length = 0;
    invocationCallOrder.length = 0;
    return mockFn;
  };

  mockFn.mockReset = () => {
    mockFn.mockClear();
    impl = undefined;
    implOnceQueue.length = 0;
    returnOnceQueue.length = 0;
    throwOnceQueue.length = 0;
    fixedReturn = undefined;
    fixedThrow = undefined;
    returnThis = false;
    return mockFn;
  };

  mockFn.mockRestore = () => {
    mockFn.mockReset();
    // For spyOn, the actual restore is handled by restoreAllMocks()
    const record = spyRegistry.find(r => r.mock === mockFn);
    if (record) {
      record.target[record.method] = record.original;
      spyRegistry.splice(spyRegistry.indexOf(record), 1);
    }
  };

  // Implementation
  mockFn.mockImplementation = (f: T) => {
    impl = f;
    return mockFn;
  };
  mockFn.mockImplementationOnce = (f: T) => {
    implOnceQueue.push(f);
    return mockFn;
  };
  mockFn.getMockImplementation = () => impl;

  // Return values
  mockFn.mockReturnValue = (value: ReturnType<T>) => {
    fixedReturn = { value };
    return mockFn;
  };
  mockFn.mockReturnValueOnce = (value: ReturnType<T>) => {
    returnOnceQueue.push(value);
    return mockFn;
  };

  mockFn.mockResolvedValue = (value: Awaited<ReturnType<T>>) => {
    impl = (() => Promise.resolve(value)) as unknown as T;
    return mockFn;
  };
  mockFn.mockResolvedValueOnce = (value: Awaited<ReturnType<T>>) => {
    implOnceQueue.push((() => Promise.resolve(value)) as unknown as T);
    return mockFn;
  };

  mockFn.mockRejectedValue = (value: unknown) => {
    impl = (() => Promise.reject(value)) as unknown as T;
    return mockFn;
  };
  mockFn.mockRejectedValueOnce = (value: unknown) => {
    implOnceQueue.push((() => Promise.reject(value)) as unknown as T);
    return mockFn;
  };

  mockFn.mockThrow = (value: unknown) => {
    fixedThrow = { value };
    return mockFn;
  };
  mockFn.mockThrowOnce = (value: unknown) => {
    throwOnceQueue.push(value);
    return mockFn;
  };
  mockFn.mockReturnThis = () => {
    returnThis = true;
    return mockFn;
  };

  return mockFn;
};

// ── spyOn() ─────────────────────────────────────────────────────────────────

/**
 * Spy on a method. Calls through to original by default.
 * Use `.mockImplementation()` or `.mockReturnValue()` to override.
 */
export const spyOn = <T extends Record<string, unknown>>(
  target: T,
  method: string & keyof T,
): MockFn => {
  const original = target[method];
  if (typeof original !== "function") {
    throw new Error(`Cannot spy on ${method}: not a function`);
  }

  const spy = spyFn((...args: readonly unknown[]) =>
    (original as (...a: readonly unknown[]) => unknown).apply(target, [...args]),
  );
  spy.mockName(`spy.${method}`);

  spyRegistry.push({ target: target as Record<string, unknown>, method, original, mock: spy });
  (target as Record<string, unknown>)[method] = spy;

  return spy;
};

// ── mock() / mockDeep() ─────────────────────────────────────────────────────

/** Shallow mock: replace all methods on an object with spies. */
export const mock = <T extends Record<string, unknown>>(obj: T): T => {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "function") {
      spyOn(obj, key as string & keyof T);
    }
  }
  return obj;
};

/** Deep mock: recursively replace all methods on nested objects with spies. */
export const mockDeep = <T extends Record<string, unknown>>(obj: T, seen?: Set<unknown>): T => {
  const visited = seen ?? new Set();
  if (visited.has(obj)) return obj;
  visited.add(obj);

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "function") {
      spyOn(obj, key as string & keyof T);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      mockDeep(val as Record<string, unknown>, visited);
    }
  }
  return obj;
};

// ── restoreAllMocksMocks() ────────────────────────────────────────────────────────────

/** Restore all spied methods to their originals. */
export const restoreAllMocks = (): void => {
  while (spyRegistry.length > 0) {
    const record = spyRegistry.pop()!;
    record.target[record.method] = record.original;
  }
};

// ── Bulk operations ─────────────────────────────────────────────────────────

/** Clear call history on all active spies, keep implementations. */
export const clearAllMocks = (): void => {
  for (const record of spyRegistry) {
    (record.mock as MockFn).mockClear();
  }
};

/** Reset all active spies: clear history and implementations. */
export const resetAllMocks = (): void => {
  for (const record of spyRegistry) {
    (record.mock as MockFn).mockReset();
  }
};
