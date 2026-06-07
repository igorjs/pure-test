/**
 * Core smoke test — exercises assertions, hooks, mocks, and async.
 *
 * Runs on every runtime (Node, Deno, Bun) after building dist/.
 *
 * Run:
 *   node tests/smoke-core.mjs
 *   deno run --allow-all tests/smoke-core.mjs
 *   bun tests/smoke-core.mjs
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  run,
  setCLIMode,
  setReporter,
  spyFn,
  spyOn,
} from "../dist/index.js";

setCLIMode();
setReporter("minimal");

// ── Assertions ───────────────────────────────────────────────────────────────

describe("assertions", () => {
  it("toBe", () => {
    expect(1 + 1).toBe(2);
    expect("hello").toBe("hello");
    expect(true).toBe(true);
  });

  it("toEqual", () => {
    expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
    expect([1, 2, 3]).toEqual([1, 2, 3]);
  });

  it("toStrictEqual", () => {
    class Point {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
    }
    expect(new Point(1, 2)).toStrictEqual(new Point(1, 2));
  });

  it("truthiness", () => {
    expect(1).toBeTruthy();
    expect(0).toBeFalsy();
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
    expect(0).toBeDefined();
  });

  it("toContain", () => {
    expect([1, 2, 3]).toContain(2);
    expect("hello world").toContain("world");
  });

  it("toHaveLength", () => {
    expect([1, 2, 3]).toHaveLength(3);
    expect("abc").toHaveLength(3);
  });

  it("toMatch", () => {
    expect("hello-123").toMatch(/\d+/);
    expect("hello world").toMatch("world");
  });

  it("toBeGreaterThan / toBeLessThan", () => {
    expect(5).toBeGreaterThan(3);
    expect(5).toBeGreaterThanOrEqual(5);
    expect(3).toBeLessThan(5);
    expect(3).toBeLessThanOrEqual(3);
  });

  it("toThrow", () => {
    expect(() => {
      throw new Error("boom");
    }).toThrow("boom");
    expect(() => {
      throw new TypeError("type error");
    }).toThrow(TypeError);
  });

  it("toBeInstanceOf", () => {
    expect(new Date()).toBeInstanceOf(Date);
    expect([]).toBeInstanceOf(Array);
  });

  it("toHaveProperty", () => {
    expect({ a: { b: 42 } }).toHaveProperty("a.b", 42);
  });

  it("not", () => {
    expect(1).not.toBe(2);
    expect("foo").not.toContain("bar");
    expect(() => {
      /* noop */
    }).not.toThrow();
  });
});

// ── Async ────────────────────────────────────────────────────────────────────

describe("async", () => {
  it("resolves promise", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it("rejects with toThrow", async () => {
    await expect(Promise.reject(new Error("async fail"))).rejects.toThrow("async fail");
  });

  it("resolves with resolves", async () => {
    await expect(Promise.resolve("ok")).resolves.toBe("ok");
  });
});

// ── Hooks ────────────────────────────────────────────────────────────────────

describe("hooks", () => {
  const order = [];

  beforeAll(() => order.push("beforeAll"));
  afterAll(() => {
    order.push("afterAll");
    expect(order).toEqual([
      "beforeAll",
      "beforeEach",
      "afterEach",
      "beforeEach",
      "afterEach",
      "afterAll",
    ]);
  });
  beforeEach(() => order.push("beforeEach"));
  afterEach(() => order.push("afterEach"));

  it("first test", () => {
    expect(order).toEqual(["beforeAll", "beforeEach"]);
  });

  it("second test", () => {
    expect(order).toContain("afterEach");
  });
});

// ── Mocks / spies ────────────────────────────────────────────────────────────

describe("spies", () => {
  it("spyFn tracks calls", () => {
    const spy = spyFn();
    spy(1, 2);
    spy(3);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(1, 2);
    expect(spy).toHaveBeenLastCalledWith(3);
  });

  it("mockReturnValue", () => {
    const spy = spyFn().mockReturnValue(99);
    expect(spy()).toBe(99);
    expect(spy()).toBe(99);
  });

  it("mockImplementation", () => {
    const spy = spyFn().mockImplementation(x => x * 2);
    expect(spy(5)).toBe(10);
  });

  it("spyOn restores original", () => {
    const obj = { greet: () => "hello" };
    const spy = spyOn(obj, "greet").mockReturnValue("hi");
    expect(obj.greet()).toBe("hi");
    spy.mockRestore();
    expect(obj.greet()).toBe("hello");
  });
});

// ── Nested suites ────────────────────────────────────────────────────────────

describe("nesting", () => {
  describe("level 1", () => {
    describe("level 2", () => {
      it("deeply nested test", () => {
        expect(true).toBe(true);
      });
    });
  });
});

const summary = await run();
process.exit(summary.failed > 0 ? 1 : 0);
