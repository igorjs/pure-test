/**
 * Self-test: the test runner testing itself.
 *
 * Run:
 *   node tests/self-test.mjs
 *   deno run --allow-all tests/self-test.mjs
 *   bun tests/self-test.mjs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, fn, spyOn, mock, mockDeep, restoreAll } from "../dist/index.js";

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

// ── concurrent ──────────────────────────────────────────────────────────────

describe.concurrent("concurrent tests", () => {
  it("runs in parallel A", async () => {
    await new Promise(r => setTimeout(r, 10));
    expect(true).toBeTruthy();
  });

  it("runs in parallel B", async () => {
    await new Promise(r => setTimeout(r, 10));
    expect(true).toBeTruthy();
  });

  it("runs in parallel C", async () => {
    await new Promise(r => setTimeout(r, 10));
    expect(true).toBeTruthy();
  });
});

// ── fn() mock function ──────────────────────────────────────────────────────

describe("fn()", () => {
  it("tracks calls", () => {
    const spy = fn();
    spy(1, 2);
    spy("a");
    expect(spy.callCount).toBe(2);
    expect(spy.called).toBeTruthy();
    expect(spy.lastCall).toEqual(["a"]);
  });

  it("returns undefined by default", () => {
    const spy = fn();
    expect(spy()).toBeUndefined();
  });

  it("returns a set value", () => {
    const spy = fn().returns(42);
    expect(spy()).toBe(42);
    expect(spy()).toBe(42);
  });

  it("uses custom implementation", () => {
    const spy = fn().impl((a, b) => a + b);
    expect(spy(2, 3)).toBe(5);
  });

  it("returns values in sequence", () => {
    const spy = fn().returnsOnce(1, 2, 3);
    expect(spy()).toBe(1);
    expect(spy()).toBe(2);
    expect(spy()).toBe(3);
    expect(spy()).toBe(3); // repeats last
  });

  it("throws on call", () => {
    const spy = fn().throws(new Error("boom"));
    expect(() => spy()).toThrow("boom");
    expect(spy.callCount).toBe(1);
  });

  it("resets calls", () => {
    const spy = fn().returns(1);
    spy();
    spy();
    spy.resetCalls();
    expect(spy.callCount).toBe(0);
    expect(spy()).toBe(1); // behavior preserved
  });

  it("resets everything", () => {
    const spy = fn().returns(99);
    spy();
    spy.resetAll();
    expect(spy.callCount).toBe(0);
    expect(spy()).toBeUndefined(); // behavior reset
  });

  it("wraps an initial implementation", () => {
    const spy = fn((x) => x * 2);
    expect(spy(5)).toBe(10);
    expect(spy.callCount).toBe(1);
  });
});

// ── spyOn() ─────────────────────────────────────────────────────────────────

describe("spyOn()", () => {
  afterEach(() => restoreAll());

  it("spies on a method and calls through", () => {
    const obj = { greet: (name) => `hello ${name}` };
    const spy = spyOn(obj, "greet");
    expect(obj.greet("world")).toBe("hello world");
    expect(spy.callCount).toBe(1);
    expect(spy.lastCall).toEqual(["world"]);
  });

  it("can override return value", () => {
    const obj = { getValue: () => "real" };
    spyOn(obj, "getValue").returns("mocked");
    expect(obj.getValue()).toBe("mocked");
  });

  it("restores original on restoreAll", () => {
    const obj = { getValue: () => "real" };
    spyOn(obj, "getValue").returns("mocked");
    expect(obj.getValue()).toBe("mocked");
    restoreAll();
    expect(obj.getValue()).toBe("real");
  });

  it("throws if target is not a function", () => {
    const obj = { value: 42 };
    expect(() => spyOn(obj, "value")).toThrow("not a function");
  });
});

// ── mock() ──────────────────────────────────────────────────────────────────

describe("mock()", () => {
  afterEach(() => restoreAll());

  it("replaces all methods with spies", () => {
    const obj = {
      a: () => 1,
      b: () => 2,
      notAFn: "hello",
    };
    mock(obj);
    obj.a();
    obj.b();
    expect(obj.a.callCount).toBe(1);
    expect(obj.b.callCount).toBe(1);
    expect(obj.notAFn).toBe("hello"); // non-functions untouched
  });
});

// ── mockDeep() ──────────────────────────────────────────────────────────────

describe("mockDeep()", () => {
  afterEach(() => restoreAll());

  it("mocks nested methods recursively", () => {
    const db = {
      users: {
        find: (id) => ({ id, name: "Alice" }),
        create: (data) => ({ id: 1, ...data }),
      },
      posts: {
        list: () => [],
      },
    };

    mockDeep(db);

    db.users.find(1);
    db.users.create({ name: "Bob" });
    db.posts.list();

    expect(db.users.find.callCount).toBe(1);
    expect(db.users.find.lastCall).toEqual([1]);
    expect(db.users.create.callCount).toBe(1);
    expect(db.posts.list.callCount).toBe(1);
  });

  it("allows overriding nested return values", () => {
    const service = {
      auth: {
        login: () => null,
      },
    };

    mockDeep(service);
    service.auth.login.returns({ token: "abc" });

    expect(service.auth.login()).toEqual({ token: "abc" });
  });

  it("handles circular references", () => {
    const obj = { nested: {} };
    obj.nested.parent = obj;
    expect(() => mockDeep(obj)).not.toThrow();
  });

  it("restores everything on restoreAll", () => {
    const service = {
      db: {
        query: () => "real result",
      },
    };

    mockDeep(service);
    service.db.query.returns("mocked");
    expect(service.db.query()).toBe("mocked");

    restoreAll();
    expect(service.db.query()).toBe("real result");
  });
});

// No run() needed - auto-runs after all describe/it calls complete
