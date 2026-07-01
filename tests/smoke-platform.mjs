// SPDX-License-Identifier: Apache-2.0
/**
 * smoke-platform.mjs - Cross-runtime smoke test for pure-test's full runner API.
 *
 * Registers suites with describe/it, lifecycle hooks, fake timers, async tests,
 * and parameterized tests; runs them via runRegistered(); exits 1 on failure.
 *
 * Run:
 *   node tests/smoke-platform.mjs
 *   deno run --allow-all tests/smoke-platform.mjs
 *   bun tests/smoke-platform.mjs
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
  reset,
  runRegistered,
  setCLIMode,
  spyFn,
  useFakeTimers,
  useRealTimers,
} from "../dist/index.js";

reset();
setCLIMode();

// ── lifecycle hooks ────────────────────────────────────────────────────────────

const hookEvents = [];

describe("lifecycle hooks", () => {
  beforeAll(() => {
    hookEvents.push("beforeAll");
  });
  afterAll(() => {
    hookEvents.push("afterAll");
  });
  beforeEach(() => {
    hookEvents.push("beforeEach");
  });
  afterEach(() => {
    hookEvents.push("afterEach");
  });

  it("first test passes", () => {
    expect(1 + 1).toBe(2);
  });

  it("second test passes", () => {
    expect("world").toContain("orl");
  });
});

// ── it.skip ───────────────────────────────────────────────────────────────────

describe("it.skip", () => {
  it("runs normally", () => {
    expect(true).toBeTruthy();
  });

  it.skip("skipped test never runs", () => {
    throw new Error("must not execute");
  });
});

// ── it.each ───────────────────────────────────────────────────────────────────

describe("it.each", () => {
  it.each([
    [1, 1, 2],
    [2, 3, 5],
    [10, 0, 10],
    [0, 0, 0],
  ])("adds %d + %d = %d", (a, b, expected) => {
    expect(a + b).toBe(expected);
  });
});

// ── async tests ───────────────────────────────────────────────────────────────

describe("async tests", () => {
  it("resolves a promise", async () => {
    const val = await Promise.resolve(42);
    expect(val).toBe(42);
  });

  it("expect.resolves", async () => {
    await expect(Promise.resolve("ok")).resolves.toBe("ok");
  });

  it("expect.rejects", async () => {
    await expect(Promise.reject(new Error("nope"))).rejects.toMatchObject({
      message: "nope",
    });
  });
});

// ── fake timers ───────────────────────────────────────────────────────────────

describe("fake timers", () => {
  it("fires setTimeout after advance", async () => {
    useFakeTimers();
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 500);
    await advanceTimersByTime(500);
    expect(fired).toBe(true);
    useRealTimers();
  });

  it("stubs Date.now", () => {
    useFakeTimers({ now: 1_000_000 });
    expect(Date.now()).toBe(1_000_000);
    useRealTimers();
  });
});

// ── spies ─────────────────────────────────────────────────────────────────────

describe("spies", () => {
  it("tracks calls", () => {
    const spy = spyFn();
    spy("hello");
    spy("world");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("world");
  });

  it("mockReturnValue", () => {
    const spy = spyFn().mockReturnValue(7);
    expect(spy()).toBe(7);
    expect(spy).toHaveReturned();
    expect(spy).toHaveReturnedWith(7);
  });

  it("mockImplementation", () => {
    const spy = spyFn().mockImplementation((x) => x * 3);
    expect(spy(4)).toBe(12);
  });
});

// ── nested describe ───────────────────────────────────────────────────────────

describe("nested describe", () => {
  describe("level A", () => {
    it("inner A1", () => {
      expect("a").toBe("a");
    });
    it("inner A2", () => {
      expect([1]).toHaveLength(1);
    });
  });
  describe("level B", () => {
    it("inner B1", () => {
      expect({ x: 1 }).toMatchObject({ x: 1 });
    });
  });
});

// ── Run ───────────────────────────────────────────────────────────────────────

const summary = await runRegistered();

// Verify hooks fired in correct order
const firstEvent = hookEvents[0];
const hasAll = hookEvents.includes("afterAll");
if (firstEvent !== "beforeAll" || !hasAll) {
  console.error("FAIL: lifecycle hooks did not fire correctly: " + JSON.stringify(hookEvents));
  process.exit(1);
}

const totalExpected = 2 + 1 + 4 + 3 + 2 + 3 + 3; // 18 passing
const skippedExpected = 1;

console.log(
  "\nSmoke test (platform): " +
    summary.passed +
    " passed, " +
    summary.failed +
    " failed, " +
    summary.skipped +
    " skipped",
);

if (summary.failed > 0) {
  if (typeof process !== "undefined" && typeof process.exit === "function") {
    process.exit(1);
  }
  throw new Error(summary.failed + " smoke test(s) failed");
}

if (summary.passed < totalExpected) {
  console.error(
    "FAIL: expected at least " + totalExpected + " passing tests, got " + summary.passed,
  );
  if (typeof process !== "undefined" && typeof process.exit === "function") {
    process.exit(1);
  }
}
