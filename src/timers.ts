// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Fake timer implementation. Cross-runtime compatible.
 *
 * Replaces `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`,
 * `Date`, and `performance.now()` with controllable fakes. Uses only
 * standard Web APIs available in Node, Deno, Bun, Workers, and browsers.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Which global APIs can be faked. */
export type FakeableAPI =
  | "setTimeout"
  | "clearTimeout"
  | "setInterval"
  | "clearInterval"
  | "Date"
  | "performance";

/** Configuration for useFakeTimers(). */
export interface FakeTimerConfig {
  /** Initial fake time. Defaults to real Date.now(). */
  readonly now?: Date | number;
  /** Which APIs to fake. Defaults to all. Timer set/clear pairs are atomic. */
  readonly toFake?: readonly FakeableAPI[];
  /** Max iterations for runAllTimers() before throwing. Default: 10000. */
  readonly loopLimit?: number;
}

interface TimerEntry {
  readonly id: number;
  readonly callback: (...args: readonly unknown[]) => void | Promise<void>;
  fireAt: number;
  readonly interval: number | undefined;
  cleared: boolean;
}

declare const performance: { now(): number } | undefined;

// ── Real references (captured at module load, before any test code) ─────────

const g = globalThis as Record<string, unknown>;

const RealDate = globalThis.Date;
const realDateNow = Date.now;
const realSetTimeout = g["setTimeout"] as ((cb: () => void, ms?: number) => number) | undefined;
const realClearTimeout = g["clearTimeout"] as ((id: number) => void) | undefined;
const realSetInterval = g["setInterval"] as ((cb: () => void, ms?: number) => number) | undefined;
const realClearInterval = g["clearInterval"] as ((id: number) => void) | undefined;

const realPerformanceNow: (() => number) | undefined =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now.bind(performance)
    : undefined;

// ── getRealTime (used by runner for test duration) ──────────────────────────

/** Get real elapsed time, unaffected by fake timers. */
export const getRealTime = (): number => {
  if (realPerformanceNow) return realPerformanceNow();
  return realDateNow.call(RealDate);
};

/** Get real setTimeout, unaffected by fake timers. Used by runner for test timeouts. */
export const getRealSetTimeout = (): ((cb: () => void, ms?: number) => number) | undefined =>
  realSetTimeout;

/** Get real clearTimeout, unaffected by fake timers. */
export const getRealClearTimeout = (): ((id: number) => void) | undefined => realClearTimeout;

// ── Module state ────────────────────────────────────────────────────────────

let installed = false;
let fakeNow = 0;
let nextId = 1;
let loopLimit = 10_000;
const timerQueue: TimerEntry[] = [];
const fakedAPIs: Set<FakeableAPI> = new Set();

// Track what we replaced so we can restore exactly those
let savedSetTimeout: typeof realSetTimeout;
let savedClearTimeout: typeof realClearTimeout;
let savedSetInterval: typeof realSetInterval;
let savedClearInterval: typeof realClearInterval;
let savedDate: typeof Date | undefined;
let savedPerformanceNow: (() => number) | undefined;

// ── Guard ───────────────────────────────────────────────────────────────────

const assertInstalled = (method: string): void => {
  if (!installed) {
    throw new Error(`Fake timers not installed. Call useFakeTimers() before ${method}().`);
  }
};

// ── FakeDate ────────────────────────────────────────────────────────────────

// Build a FakeDate constructor that subclasses the real Date.
// The class is recreated each time useFakeTimers is called so that
// `fakeNow` is captured by closure correctly.
const buildFakeDate = (): typeof Date => {
  // Using a function-based approach for cross-runtime constructor compatibility
  function FakeDateConstructor(this: Date, ...args: readonly unknown[]): Date | string {
    // Called without `new` — Date() returns a string in spec
    if (!(this instanceof FakeDateConstructor)) {
      return new RealDate(fakeNow).toString();
    }
    if (args.length === 0) {
      return new RealDate(fakeNow);
    }
    // @ts-expect-error -- spread into Date constructor
    return new RealDate(...args);
  }

  // Inherit static methods and prototype from RealDate
  FakeDateConstructor.prototype = RealDate.prototype;
  Object.setPrototypeOf(FakeDateConstructor, RealDate);

  // Override static now()
  FakeDateConstructor.now = (): number => fakeNow;

  // Preserve Date.parse and Date.UTC via prototype chain (Object.setPrototypeOf above)

  // instanceof support: instances of RealDate should pass instanceof FakeDate
  Object.defineProperty(FakeDateConstructor, Symbol.hasInstance, {
    value: (v: unknown): boolean => v instanceof RealDate,
  });

  return FakeDateConstructor as unknown as typeof Date;
};

// ── Fake timer functions ────────────────────────────────────────────────────

const insertTimer = (entry: TimerEntry): void => {
  // Insert in sorted order by fireAt, maintaining insertion order for equal fireAt
  let i = timerQueue.length;
  while (i > 0 && timerQueue[i - 1]!.fireAt > entry.fireAt) {
    i--;
  }
  timerQueue.splice(i, 0, entry);
};

const fakeSetTimeout = (callback: (...args: readonly unknown[]) => void, ms?: number): number => {
  const id = nextId++;
  const delay = Math.max(0, ms ?? 0);
  insertTimer({ id, callback, fireAt: fakeNow + delay, interval: undefined, cleared: false });
  return id;
};

const fakeSetInterval = (callback: (...args: readonly unknown[]) => void, ms?: number): number => {
  const id = nextId++;
  const delay = Math.max(1, ms ?? 0); // setInterval with 0 is clamped to 1
  insertTimer({ id, callback, fireAt: fakeNow + delay, interval: delay, cleared: false });
  return id;
};

const fakeClearTimer = (id: number): void => {
  const entry = timerQueue.find(t => t.id === id);
  if (entry) entry.cleared = true;
};

// ── Advancement helpers ─────────────────────────────────────────────────────

const fireDueTimers = async (upTo: number): Promise<void> => {
  let firstError: unknown;

  // Process timers that are due, in order
  while (timerQueue.length > 0) {
    const next = timerQueue[0]!;
    if (next.fireAt > upTo || next.fireAt > fakeNow) break;

    timerQueue.shift();
    if (next.cleared) continue;

    try {
      await next.callback();
    } catch (e) {
      if (firstError === undefined) firstError = e;
    }

    // Re-queue interval timers
    if (next.interval !== undefined && !next.cleared) {
      next.fireAt += next.interval;
      insertTimer(next);
    }
  }

  if (firstError !== undefined) throw firstError;
};

// ── Public API ──────────────────────────────────────────────────────────────

const ALL_FAKEABLE: readonly FakeableAPI[] = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "Date",
  "performance",
];

const resolveToFake = (toFake: readonly FakeableAPI[] | undefined): Set<FakeableAPI> => {
  const set = new Set<FakeableAPI>(toFake ?? ALL_FAKEABLE);
  // Atomic pairs: faking setTimeout implies clearTimeout and vice versa
  if (set.has("setTimeout") || set.has("clearTimeout")) {
    set.add("setTimeout");
    set.add("clearTimeout");
  }
  if (set.has("setInterval") || set.has("clearInterval")) {
    set.add("setInterval");
    set.add("clearInterval");
  }
  return set;
};

const installFakes = (toFake: Set<FakeableAPI>): void => {
  fakedAPIs.clear();

  if (toFake.has("setTimeout") && realSetTimeout) {
    savedSetTimeout = g["setTimeout"] as typeof realSetTimeout;
    g["setTimeout"] = fakeSetTimeout;
    fakedAPIs.add("setTimeout");
  }
  if (toFake.has("clearTimeout") && realClearTimeout) {
    savedClearTimeout = g["clearTimeout"] as typeof realClearTimeout;
    g["clearTimeout"] = fakeClearTimer;
    fakedAPIs.add("clearTimeout");
  }
  if (toFake.has("setInterval") && realSetInterval) {
    savedSetInterval = g["setInterval"] as typeof realSetInterval;
    g["setInterval"] = fakeSetInterval;
    fakedAPIs.add("setInterval");
  }
  if (toFake.has("clearInterval") && realClearInterval) {
    savedClearInterval = g["clearInterval"] as typeof realClearInterval;
    g["clearInterval"] = fakeClearTimer;
    fakedAPIs.add("clearInterval");
  }
  if (toFake.has("Date")) {
    savedDate = g["Date"] as typeof Date;
    g["Date"] = buildFakeDate();
    fakedAPIs.add("Date");
  }
  if (toFake.has("performance") && typeof performance !== "undefined") {
    savedPerformanceNow = performance.now.bind(performance);
    performance.now = () => fakeNow;
    fakedAPIs.add("performance");
  }
};

/** Install fake timers. Replaces global timer functions with controllable fakes. */
export const useFakeTimers = (config?: FakeTimerConfig): void => {
  if (installed) useRealTimers();

  const cfg = config ?? {};
  const initialTime =
    cfg.now instanceof Date ? cfg.now.getTime() : (cfg.now ?? realDateNow.call(RealDate));
  fakeNow = initialTime;
  nextId = 1;
  timerQueue.length = 0;
  loopLimit = cfg.loopLimit ?? 10_000;

  installFakes(resolveToFake(cfg.toFake));
  installed = true;
};

/** Restore real timers. No-op if not installed. */
export const useRealTimers = (): void => {
  if (!installed) return;

  if (fakedAPIs.has("setTimeout") && savedSetTimeout) {
    g["setTimeout"] = savedSetTimeout;
  }
  if (fakedAPIs.has("clearTimeout") && savedClearTimeout) {
    g["clearTimeout"] = savedClearTimeout;
  }
  if (fakedAPIs.has("setInterval") && savedSetInterval) {
    g["setInterval"] = savedSetInterval;
  }
  if (fakedAPIs.has("clearInterval") && savedClearInterval) {
    g["clearInterval"] = savedClearInterval;
  }
  if (fakedAPIs.has("Date") && savedDate) {
    g["Date"] = savedDate;
  }
  if (fakedAPIs.has("performance") && savedPerformanceNow && typeof performance !== "undefined") {
    performance.now = savedPerformanceNow;
  }

  timerQueue.length = 0;
  fakedAPIs.clear();
  installed = false;
};

/** Advance the fake clock by `ms` milliseconds, firing due callbacks in order. */
export const advanceTimersByTime = async (ms: number): Promise<void> => {
  assertInstalled("advanceTimersByTime");
  const target = fakeNow + ms;

  // Fire timers in time order, stepping fakeNow forward as we go
  while (timerQueue.length > 0 && timerQueue[0]!.fireAt <= target) {
    fakeNow = timerQueue[0]!.fireAt;
    await fireDueTimers(target);
  }

  fakeNow = target;
};

/** Run all pending timers until the queue is empty. Throws if loopLimit is reached. */
export const runAllTimers = async (): Promise<void> => {
  assertInstalled("runAllTimers");
  let iterations = 0;

  while (timerQueue.length > 0) {
    // Skip cleared timers
    if (timerQueue[0]!.cleared) {
      timerQueue.shift();
      continue;
    }

    iterations++;
    if (iterations > loopLimit) {
      throw new Error(`Aborting after ${loopLimit} timer iterations. Possible infinite loop.`);
    }

    const next = timerQueue[0]!;
    fakeNow = next.fireAt;
    await fireDueTimers(next.fireAt);
  }
};

/** Fire only currently pending timers. Timers scheduled during execution are not fired. */
export const runOnlyPendingTimers = async (): Promise<void> => {
  assertInstalled("runOnlyPendingTimers");
  const pendingIds = new Set(timerQueue.filter(t => !t.cleared).map(t => t.id));

  while (timerQueue.length > 0) {
    const next = timerQueue[0]!;
    if (!pendingIds.has(next.id)) break;

    timerQueue.shift();
    if (next.cleared) continue;

    fakeNow = next.fireAt;

    try {
      await next.callback();
    } catch {
      // Collect but don't stop
    }

    // Re-queue interval but it won't be in pendingIds so it won't fire again
    if (next.interval !== undefined && !next.cleared) {
      next.fireAt += next.interval;
      insertTimer(next);
    }
  }
};

/** Get the number of pending (non-cleared) timers. */
export const getTimerCount = (): number => {
  assertInstalled("getTimerCount");
  return timerQueue.filter(t => !t.cleared).length;
};

/** Set the fake system time without firing any timers. */
export const setSystemTime = (now: Date | number): void => {
  assertInstalled("setSystemTime");
  fakeNow = now instanceof Date ? now.getTime() : now;
};

/** Get the real system time, bypassing fake timers. */
export const getRealSystemTime = (): number => realDateNow.call(RealDate);

/** Restore real timers. Called by restoreAllMocks(). */
export const restoreTimers = useRealTimers;
