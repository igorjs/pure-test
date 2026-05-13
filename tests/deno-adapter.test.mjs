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
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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

// ── Hooks: counts and ordering ──────────────────────────────────────────────

describe("hooks: counts", () => {
  let beforeAllCount = 0;
  let afterAllCount = 0;
  let beforeEachCount = 0;
  let afterEachCount = 0;

  beforeAll(() => {
    beforeAllCount++;
  });
  afterAll(() => {
    afterAllCount++;
    // Verify final tallies after the suite finishes.
    if (beforeAllCount !== 1) throw new Error(`beforeAll ran ${beforeAllCount}x, expected 1`);
    if (beforeEachCount !== 3) throw new Error(`beforeEach ran ${beforeEachCount}x, expected 3`);
    if (afterEachCount !== 3) throw new Error(`afterEach ran ${afterEachCount}x, expected 3`);
  });
  beforeEach(() => {
    beforeEachCount++;
  });
  afterEach(() => {
    afterEachCount++;
  });

  it("runs first", () => {
    expect(beforeAllCount).toBe(1);
    expect(beforeEachCount).toBe(1);
  });

  it("runs second", () => {
    expect(beforeAllCount).toBe(1);
    expect(beforeEachCount).toBe(2);
    expect(afterEachCount).toBe(1);
  });

  it("runs third", () => {
    expect(beforeEachCount).toBe(3);
    expect(afterEachCount).toBe(2);
  });
});

// ── Hooks: parent → child inheritance for beforeEach/afterEach ──────────────

describe("hooks: inheritance", () => {
  const order = [];

  beforeEach(() => order.push("outer-before"));
  afterEach(() => order.push("outer-after"));

  describe("nested", () => {
    beforeEach(() => order.push("inner-before"));
    afterEach(() => order.push("inner-after"));

    it("sees parent then own beforeEach, then own then parent afterEach", () => {
      expect(order).toEqual(["outer-before", "inner-before"]);
    });

    it("preserves chronology across tests in the nested suite", () => {
      // After test 1: ['outer-before', 'inner-before', 'inner-after', 'outer-after']
      // Test 2 begins, hooks fire again before this assertion.
      expect(order).toEqual([
        "outer-before",
        "inner-before",
        "inner-after",
        "outer-after",
        "outer-before",
        "inner-before",
      ]);
    });
  });
});

// ── Hooks: top-level use throws (adapter constraint) ────────────────────────

describe("hooks: top-level call rejected", () => {
  it("beforeAll outside describe throws clearly", () => {
    // Any direct call to beforeAll() at module scope (no enclosing describe)
    // must throw — verified by calling it during a test, when currentFrame is
    // null (the test body executes after the describe closure has popped).
    const noop = () => undefined;
    expect(() => beforeAll(noop)).toThrow(/inside a describe/);
  });
});
