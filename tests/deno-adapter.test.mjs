/**
 * Deno adapter smoke test.
 *
 * Verifies that `describe`/`it` from `@igorjs/pure-test/deno` register
 * themselves with `Deno.test` so that `deno test`, `deno test --filter`,
 * and IDE decorations work.
 *
 * Run:
 *   deno test --allow-read tests/deno-adapter.test.mjs
 *   deno test --allow-read --filter "adds" tests/deno-adapter.test.mjs
 */

import {
  advanceTimersByTime,
  describe,
  expect,
  it,
  restoreAllMocks,
  spyFn,
  useFakeTimers,
} from "../dist/deno.js";

// ── Top-level it() → standalone Deno.test ───────────────────────────────────

it("top-level it registers as Deno.test", () => {
  expect(1 + 1).toBe(2);
});

// ── describe() with flat children → Deno.test with t.step calls ─────────────

describe("math", () => {
  it("adds numbers", () => {
    expect(1 + 2).toBe(3);
  });

  it("multiplies numbers", () => {
    expect(2 * 3).toBe(6);
  });
});

// ── Nested describe → nested t.step ─────────────────────────────────────────

describe("outer", () => {
  describe("inner", () => {
    it("runs nested", () => {
      expect("nested").toContain("nest");
    });
  });
});

// ── Spies survive the adapter (mock state is independent of runner) ─────────

describe("spies", () => {
  it("tracks calls", () => {
    const spy = spyFn();
    spy(1, 2);
    expect(spy).toHaveBeenCalledWith(1, 2);
  });

  it("mockReturnValue", () => {
    const spy = spyFn().mockReturnValue(42);
    expect(spy()).toBe(42);
  });
});

// ── Fake timers survive the adapter ─────────────────────────────────────────

describe("fake timers", () => {
  it("advanceTimersByTime", async () => {
    useFakeTimers({ now: 0 });
    let value = 0;
    setTimeout(() => {
      value = 42;
    }, 100);
    await advanceTimersByTime(100);
    expect(value).toBe(42);
    restoreAllMocks();
  });

  it("Date.now is fakeable", () => {
    useFakeTimers({ now: 5000 });
    expect(Date.now()).toBe(5000);
    restoreAllMocks();
  });
});
