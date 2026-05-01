/**
 * Mocking utilities. No runtime-specific imports.
 *
 * Provides:
 * - `fn()` — standalone spy/stub
 * - `spyOn(obj, method)` — spy on an existing method
 * - `mock(obj)` — shallow mock: replace all methods with spies
 * - `mockDeep(obj)` — deep mock: recursively replace all methods on nested objects
 * - `restore()` — restore all spied methods to originals
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** A recorded call to a mock function. */
export interface MockCall {
  readonly args: readonly unknown[];
  readonly result: unknown;
  readonly error: unknown | undefined;
  readonly timestamp: number;
}

/** A mock function with call tracking and behavior control. */
export interface MockFn<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown> {
  /** Call the mock. */
  (...args: TArgs): TReturn;
  /** All recorded calls. */
  readonly calls: readonly MockCall[];
  /** Number of times called. */
  readonly callCount: number;
  /** Arguments of the last call. */
  readonly lastCall: readonly unknown[] | undefined;
  /** Whether the mock was called at least once. */
  readonly called: boolean;
  /** Set the return value for all subsequent calls. */
  returns(value: TReturn): MockFn<TArgs, TReturn>;
  /** Set the implementation for all subsequent calls. */
  impl(fn: (...args: TArgs) => TReturn): MockFn<TArgs, TReturn>;
  /** Set return values in sequence (one per call, then repeats last). */
  returnsOnce(...values: readonly TReturn[]): MockFn<TArgs, TReturn>;
  /** Make the mock throw on every call. */
  throws(error: unknown): MockFn<TArgs, TReturn>;
  /** Reset call history but keep behavior. */
  resetCalls(): void;
  /** Reset everything: calls and behavior. */
  resetAll(): void;
}

/** Info tracked for spyOn restoration. */
interface SpyRecord {
  readonly target: Record<string, unknown>;
  readonly method: string;
  readonly original: unknown;
}

// ── Global spy registry ─────────────────────────────────────────────────────

const spyRegistry: SpyRecord[] = [];

// ── fn() — create a standalone mock function ────────────────────────────────

/** Create a mock function (spy/stub). */
export const fn = <TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
  initialImpl?: (...args: TArgs) => TReturn,
): MockFn<TArgs, TReturn> => {
  const calls: MockCall[] = [];
  let implementation: ((...args: TArgs) => TReturn) | undefined = initialImpl;
  let returnValue: TReturn | undefined;
  let throwValue: unknown | undefined;
  let returnSequence: TReturn[] = [];
  let sequenceIndex = 0;
  let mode: "default" | "return" | "impl" | "throw" | "sequence" = initialImpl ? "impl" : "default";

  const mockFn = (...args: TArgs): TReturn => {
    let result: unknown;
    let error: unknown;

    try {
      switch (mode) {
        case "throw":
          throw throwValue;
        case "return":
          result = returnValue;
          break;
        case "sequence":
          result =
            sequenceIndex < returnSequence.length
              ? returnSequence[sequenceIndex++]
              : returnSequence[returnSequence.length - 1];
          break;
        case "impl":
          result = implementation!(...args);
          break;
        default:
          result = undefined;
      }
    } catch (e) {
      error = e;
      calls.push({ args, result: undefined, error, timestamp: Date.now() });
      throw e;
    }

    calls.push({ args, result, error: undefined, timestamp: Date.now() });
    return result as TReturn;
  };

  Object.defineProperties(mockFn, {
    calls: { get: () => calls },
    callCount: { get: () => calls.length },
    lastCall: {
      get: () => (calls.length > 0 ? calls[calls.length - 1]!.args : undefined),
    },
    called: { get: () => calls.length > 0 },
  });

  mockFn.returns = (value: TReturn): MockFn<TArgs, TReturn> => {
    mode = "return";
    returnValue = value;
    return mockFn as MockFn<TArgs, TReturn>;
  };

  mockFn.impl = (f: (...args: TArgs) => TReturn): MockFn<TArgs, TReturn> => {
    mode = "impl";
    implementation = f;
    return mockFn as MockFn<TArgs, TReturn>;
  };

  mockFn.returnsOnce = (...values: readonly TReturn[]): MockFn<TArgs, TReturn> => {
    mode = "sequence";
    returnSequence = [...values];
    sequenceIndex = 0;
    return mockFn as MockFn<TArgs, TReturn>;
  };

  mockFn.throws = (error: unknown): MockFn<TArgs, TReturn> => {
    mode = "throw";
    throwValue = error;
    return mockFn as MockFn<TArgs, TReturn>;
  };

  mockFn.resetCalls = (): void => {
    calls.length = 0;
  };

  mockFn.resetAll = (): void => {
    calls.length = 0;
    mode = "default";
    implementation = undefined;
    returnValue = undefined;
    throwValue = undefined;
    returnSequence = [];
    sequenceIndex = 0;
  };

  return mockFn as MockFn<TArgs, TReturn>;
};

// ── spyOn() — spy on an existing method ─────────────────────────────────────

/**
 * Replace a method on an object with a spy. The original is saved and
 * can be restored via `restore()` or `restoreAll()`.
 *
 * By default, the spy calls through to the original. Use `.returns()` or
 * `.impl()` to override behavior.
 */
export const spyOn = <T extends Record<string, unknown>>(
  target: T,
  method: string & keyof T,
): MockFn => {
  const original = target[method];
  if (typeof original !== "function") {
    throw new Error(`Cannot spy on ${method}: not a function`);
  }

  const spy = fn((...args: readonly unknown[]) =>
    (original as (...a: readonly unknown[]) => unknown).apply(target, [...args]),
  );

  spyRegistry.push({ target: target as Record<string, unknown>, method, original });
  (target as Record<string, unknown>)[method] = spy;

  return spy;
};

// ── mock() — shallow mock all methods ───────────────────────────────────────

/**
 * Replace all function properties on an object with spies.
 * Returns the same object (mutated) with all methods mocked.
 */
export const mock = <T extends Record<string, unknown>>(obj: T): T => {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "function") {
      spyOn(obj, key as string & keyof T);
    }
  }
  return obj;
};

// ── mockDeep() — recursively mock all methods ───────────────────────────────

/**
 * Recursively replace all function properties on an object and its nested
 * objects with spies. Returns the same object (mutated).
 *
 * @example
 * ```ts
 * const db = mockDeep({
 *   users: {
 *     find: (id) => ({ id, name: 'Alice' }),
 *     create: (data) => ({ id: 1, ...data }),
 *   },
 *   posts: {
 *     list: () => [],
 *   },
 * })
 *
 * db.users.find.returns({ id: 1, name: 'Mock' })
 * db.users.find(1) // { id: 1, name: 'Mock' }
 * db.users.find.callCount // 1
 * ```
 */
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

// ── restore ─────────────────────────────────────────────────────────────────

/** Restore all spied methods to their originals. */
export const restoreAll = (): void => {
  while (spyRegistry.length > 0) {
    const record = spyRegistry.pop()!;
    record.target[record.method] = record.original;
  }
};
