/**
 * Self-test: the test runner testing itself.
 *
 * Run:
 *   node tests/self-test.mjs
 *   deno run --allow-all tests/self-test.mjs
 *   bun tests/self-test.mjs
 */

import { describe, it, expect, run, beforeAll, afterAll, beforeEach, afterEach } from "../dist/index.js";

// ── expect.toBe ─────────────────────────────────────────────────────────────

describe("expect.toBe", () => {
  it("passes for equal primitives", () => {
    expect(42).toBe(42);
    expect("hello").toBe("hello");
    expect(true).toBe(true);
    expect(null).toBe(null);
    expect(undefined).toBe(undefined);
  });

  it("fails for different values", () => {
    expect(() => expect(1).toBe(2)).toThrow();
  });

  it("uses strict equality", () => {
    expect(() => expect("1").toBe(1)).toThrow();
  });
});

// ── expect.toEqual ──────────────────────────────────────────────────────────

describe("expect.toEqual", () => {
  it("compares objects deeply", () => {
    expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
  });

  it("compares arrays deeply", () => {
    expect([1, [2, 3]]).toEqual([1, [2, 3]]);
  });

  it("fails for different structures", () => {
    expect(() => expect({ a: 1 }).toEqual({ a: 2 })).toThrow();
  });

  it("compares dates", () => {
    const d = new Date("2026-01-01");
    expect(d).toEqual(new Date("2026-01-01"));
  });
});

// ── expect.toBeTruthy / toBeFalsy ───────────────────────────────────────────

describe("expect.toBeTruthy / toBeFalsy", () => {
  it("truthy values", () => {
    expect(1).toBeTruthy();
    expect("hi").toBeTruthy();
    expect({}).toBeTruthy();
    expect([]).toBeTruthy();
  });

  it("falsy values", () => {
    expect(0).toBeFalsy();
    expect("").toBeFalsy();
    expect(null).toBeFalsy();
    expect(undefined).toBeFalsy();
  });
});

// ── expect.toBeNull / toBeUndefined / toBeDefined ───────────────────────────

describe("expect null/undefined/defined", () => {
  it("toBeNull", () => {
    expect(null).toBeNull();
    expect(() => expect(1).toBeNull()).toThrow();
  });

  it("toBeUndefined", () => {
    expect(undefined).toBeUndefined();
    expect(() => expect(1).toBeUndefined()).toThrow();
  });

  it("toBeDefined", () => {
    expect(1).toBeDefined();
    expect(() => expect(undefined).toBeDefined()).toThrow();
  });
});

// ── expect.toBeInstanceOf ───────────────────────────────────────────────────

describe("expect.toBeInstanceOf", () => {
  it("passes for correct instance", () => {
    expect(new Error("x")).toBeInstanceOf(Error);
    expect([]).toBeInstanceOf(Array);
  });

  it("fails for wrong instance", () => {
    expect(() => expect("hi").toBeInstanceOf(Array)).toThrow();
  });
});

// ── expect numeric comparisons ──────────────────────────────────────────────

describe("expect numeric comparisons", () => {
  it("toBeGreaterThan", () => {
    expect(5).toBeGreaterThan(3);
    expect(() => expect(3).toBeGreaterThan(5)).toThrow();
  });

  it("toBeLessThan", () => {
    expect(3).toBeLessThan(5);
  });

  it("toBeGreaterThanOrEqual", () => {
    expect(5).toBeGreaterThanOrEqual(5);
    expect(6).toBeGreaterThanOrEqual(5);
  });

  it("toBeLessThanOrEqual", () => {
    expect(5).toBeLessThanOrEqual(5);
    expect(4).toBeLessThanOrEqual(5);
  });
});

// ── expect.toContain ────────────────────────────────────────────────────────

describe("expect.toContain", () => {
  it("string contains substring", () => {
    expect("hello world").toContain("world");
  });

  it("array contains element", () => {
    expect([1, 2, 3]).toContain(2);
  });

  it("fails when not contained", () => {
    expect(() => expect("hello").toContain("xyz")).toThrow();
  });
});

// ── expect.toMatch ──────────────────────────────────────────────────────────

describe("expect.toMatch", () => {
  it("matches regex", () => {
    expect("hello-123").toMatch(/^hello-\d+$/);
  });

  it("fails on no match", () => {
    expect(() => expect("abc").toMatch(/\d+/)).toThrow();
  });
});

// ── expect.toHaveLength ─────────────────────────────────────────────────────

describe("expect.toHaveLength", () => {
  it("checks string length", () => {
    expect("hello").toHaveLength(5);
  });

  it("checks array length", () => {
    expect([1, 2, 3]).toHaveLength(3);
  });
});

// ── expect.toThrow ──────────────────────────────────────────────────────────

describe("expect.toThrow", () => {
  it("passes when function throws", () => {
    expect(() => { throw new Error("boom"); }).toThrow();
  });

  it("matches error message", () => {
    expect(() => { throw new Error("file not found"); }).toThrow("not found");
  });

  it("matches error regex", () => {
    expect(() => { throw new Error("error code 42"); }).toThrow(/code \d+/);
  });

  it("fails when function does not throw", () => {
    expect(() => expect(() => {}).toThrow()).toThrow();
  });
});

// ── expect.not ──────────────────────────────────────────────────────────────

describe("expect.not", () => {
  it("inverts toBe", () => {
    expect(1).not.toBe(2);
  });

  it("inverts toEqual", () => {
    expect({ a: 1 }).not.toEqual({ a: 2 });
  });

  it("inverts toBeTruthy", () => {
    expect(0).not.toBeTruthy();
  });

  it("inverts toContain", () => {
    expect("hello").not.toContain("xyz");
  });

  it("fails when not-assertion is wrong", () => {
    expect(() => expect(1).not.toBe(1)).toThrow();
  });
});

// ── async tests ─────────────────────────────────────────────────────────────

describe("async tests", () => {
  it("supports async/await", async () => {
    const value = await Promise.resolve(42);
    expect(value).toBe(42);
  });

  it("supports async with delay", async () => {
    const value = await new Promise(resolve => setTimeout(() => resolve("done"), 10));
    expect(value).toBe("done");
  });
});

// ── hooks ───────────────────────────────────────────────────────────────────

describe("hooks", () => {
  let counter = 0;

  beforeAll(() => {
    counter = 100;
  });

  beforeEach(() => {
    counter++;
  });

  afterEach(() => {
    counter--;
  });

  it("beforeAll ran", () => {
    // beforeAll set to 100, beforeEach incremented to 101
    expect(counter).toBe(101);
  });

  it("beforeEach runs again", () => {
    // afterEach decremented to 100, beforeEach incremented to 101
    expect(counter).toBe(101);
  });
});

// ── nested suites ───────────────────────────────────────────────────────────

describe("outer", () => {
  describe("inner", () => {
    it("nested test runs", () => {
      expect(true).toBeTruthy();
    });
  });
});

// ── skip ────────────────────────────────────────────────────────────────────

describe("skip", () => {
  it.skip("this test is skipped", () => {
    throw new Error("should not run");
  });

  it("this test runs", () => {
    expect(true).toBeTruthy();
  });
});

// ── run ─────────────────────────────────────────────────────────────────────

await run();
