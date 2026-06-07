/**
 * Platform smoke test — verifies the library works in the current runtime
 * (Deno, Bun, Node) using only cross-platform globals.
 *
 * Run:
 *   deno run --allow-all tests/smoke-platform.mjs
 *   bun tests/smoke-platform.mjs
 *   node tests/smoke-platform.mjs
 */

import {
  advanceTimersByTime,
  describe,
  expect,
  it,
  restoreAllMocks,
  run,
  setCLIMode,
  setReporter,
  useFakeTimers,
} from "../dist/index.js";

setCLIMode();
setReporter("minimal");

const runtime =
  typeof globalThis.Deno !== "undefined"
    ? "Deno"
    : typeof globalThis.Bun !== "undefined"
      ? "Bun"
      : "Node";

// ── globalThis availability ──────────────────────────────────────────────────

describe(`platform (${runtime}): globals`, () => {
  it("globalThis is defined", () => {
    expect(typeof globalThis).toBe("object");
  });

  it("Promise is available", () => {
    expect(typeof Promise).toBe("function");
  });

  it("setTimeout is available", () => {
    expect(typeof setTimeout).toBe("function");
  });

  it("queueMicrotask is available", () => {
    expect(typeof queueMicrotask).toBe("function");
  });

  it("TextEncoder / TextDecoder are available", () => {
    expect(typeof TextEncoder).toBe("function");
    expect(typeof TextDecoder).toBe("function");
  });

  it("URL is available", () => {
    expect(typeof URL).toBe("function");
  });
});

// ── Async primitives ─────────────────────────────────────────────────────────

describe(`platform (${runtime}): async`, () => {
  it("Promise.resolve works", async () => {
    const v = await Promise.resolve("ok");
    expect(v).toBe("ok");
  });

  it("async/await works", async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const start = Date.now();
    await delay(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });

  it("Promise.all works", async () => {
    const results = await Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
    expect(results).toEqual([1, 2, 3]);
  });
});

// ── Fake timers (uses native setTimeout under the hood) ───────────────────────

describe(`platform (${runtime}): fake timers`, () => {
  it("intercepts setTimeout", async () => {
    useFakeTimers({ now: 0 });
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 100);
    expect(fired).toBe(false);
    await advanceTimersByTime(100);
    expect(fired).toBe(true);
    restoreAllMocks();
  });

  it("controls Date.now()", () => {
    useFakeTimers({ now: 1_000_000 });
    expect(Date.now()).toBe(1_000_000);
    restoreAllMocks();
  });

  it("restores real timers", () => {
    useFakeTimers({ now: 0 });
    restoreAllMocks();
    expect(Date.now()).toBeGreaterThan(0);
  });
});

// ── Module loading (verify dist/index.js exports are intact) ─────────────────

describe(`platform (${runtime}): exports`, () => {
  it("re-exports core symbols", async () => {
    const mod = await import("../dist/index.js");
    for (const name of ["describe", "it", "test", "suite", "expect", "run", "mock", "spyFn"]) {
      expect(typeof mod[name]).toBe("function");
    }
  });
});

const summary = await run();
process.exit(summary.failed > 0 ? 1 : 0);
