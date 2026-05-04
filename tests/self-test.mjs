/**
 * Self-test: the test runner testing itself.
 *
 * Run:
 *   node tests/self-test.mjs
 *   deno run --allow-all tests/self-test.mjs
 *   bun tests/self-test.mjs
 */

import {
  advanceTimersByTime,
  afterEach,
  beforeAll,
  beforeEach,
  clearAllMocks,
  describe,
  expect,
  getTimerCount,
  it,
  jest,
  mock,
  mockDeep,
  resetAllMocks,
  restoreAllMocks,
  runAllTimers,
  runOnlyPendingTimers,
  setSystemTime,
  spyFn,
  spyOn,
  useFakeTimers,
  vi,
} from "../dist/index.js";

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
    expect(() => {
      throw new Error("boom");
    }).toThrow();
  });

  it("matches error message", () => {
    expect(() => {
      throw new Error("file not found");
    }).toThrow("not found");
  });

  it("matches error regex", () => {
    expect(() => {
      throw new Error("error code 42");
    }).toThrow(/code \d+/);
  });

  it("fails when function does not throw", () => {
    const noop = () => {
      /* intentionally empty */
    };
    expect(() => expect(noop).toThrow()).toThrow();
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

// ── spyFn() — Vitest-compatible mock function ──────────────────────────────────

describe("spyFn()", () => {
  it("tracks calls via mock.calls", () => {
    const spy = spyFn();
    spy(1, 2);
    spy("a");
    expect(spy.mock.calls).toHaveLength(2);
    expect(spy.mock.calls[0]).toEqual([1, 2]);
    expect(spy.mock.lastCall).toEqual(["a"]);
  });

  it("tracks results via mock.results", () => {
    const spy = spyFn().mockReturnValue(42);
    spy();
    expect(spy.mock.results[0].type).toBe("return");
    expect(spy.mock.results[0].value).toBe(42);
  });

  it("returns undefined by default", () => {
    expect(spyFn()()).toBeUndefined();
  });

  it("mockReturnValue sets fixed return", () => {
    const spy = spyFn().mockReturnValue(42);
    expect(spy()).toBe(42);
    expect(spy()).toBe(42);
  });

  it("mockReturnValueOnce chains one-time returns", () => {
    const spy = spyFn().mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3);
    expect(spy()).toBe(1);
    expect(spy()).toBe(2);
    expect(spy()).toBe(3);
    expect(spy()).toBeUndefined(); // exhausted
  });

  it("mockImplementation sets custom behavior", () => {
    const spy = spyFn().mockImplementation((a, b) => a + b);
    expect(spy(2, 3)).toBe(5);
  });

  it("mockImplementationOnce queues one-time impl", () => {
    const spy = spyFn()
      .mockImplementation(() => "default")
      .mockImplementationOnce(() => "first")
      .mockImplementationOnce(() => "second");
    expect(spy()).toBe("first");
    expect(spy()).toBe("second");
    expect(spy()).toBe("default");
  });

  it("mockResolvedValue returns resolved promise", async () => {
    const spy = spyFn().mockResolvedValue(42);
    expect(await spy()).toBe(42);
  });

  it("mockResolvedValueOnce chains async returns", async () => {
    const spy = spyFn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    expect(await spy()).toBe("a");
    expect(await spy()).toBe("b");
  });

  it("mockRejectedValue returns rejected promise", async () => {
    const spy = spyFn().mockRejectedValue(new Error("fail"));
    try {
      await spy();
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e.message).toBe("fail");
    }
  });

  it("mockThrow throws on every call", () => {
    const spy = spyFn().mockThrow(new Error("boom"));
    expect(() => spy()).toThrow("boom");
    expect(spy.mock.calls).toHaveLength(1);
  });

  it("mockThrowOnce throws once then normal", () => {
    const spy = spyFn().mockReturnValue("ok").mockThrowOnce(new Error("once"));
    expect(() => spy()).toThrow("once");
    expect(spy()).toBe("ok");
  });

  it("mockReturnThis returns this context", () => {
    const spy = spyFn().mockReturnThis();
    const obj = { method: spy };
    expect(obj.method()).toBe(obj);
  });

  it("mockClear clears history, keeps behavior", () => {
    const spy = spyFn().mockReturnValue(1);
    spy();
    spy();
    spy.mockClear();
    expect(spy.mock.calls).toHaveLength(0);
    expect(spy()).toBe(1); // behavior preserved
  });

  it("mockReset clears everything", () => {
    const spy = spyFn().mockReturnValue(99);
    spy();
    spy.mockReset();
    expect(spy.mock.calls).toHaveLength(0);
    expect(spy()).toBeUndefined(); // behavior reset
  });

  it("mockName and getMockName", () => {
    const spy = spyFn().mockName("myMock");
    expect(spy.getMockName()).toBe("myMock");
  });

  it("getMockImplementation returns current impl", () => {
    const impl = x => x * 2;
    const spy = spyFn().mockImplementation(impl);
    expect(spy.getMockImplementation()).toBe(impl);
  });

  it("wraps an initial implementation", () => {
    const spy = spyFn(x => x * 2);
    expect(spy(5)).toBe(10);
    expect(spy.mock.calls).toHaveLength(1);
  });
});

// ── spyOn() ─────────────────────────────────────────────────────────────────

describe("spyOn()", () => {
  afterEach(() => restoreAllMocks());

  it("spies on a method and calls through", () => {
    const obj = { greet: name => `hello ${name}` };
    const spy = spyOn(obj, "greet");
    expect(obj.greet("world")).toBe("hello world");
    expect(spy.mock.calls).toHaveLength(1);
    expect(spy.mock.lastCall).toEqual(["world"]);
  });

  it("can override with mockReturnValue", () => {
    const obj = { getValue: () => "real" };
    spyOn(obj, "getValue").mockReturnValue("mocked");
    expect(obj.getValue()).toBe("mocked");
  });

  it("mockRestore restores original", () => {
    const obj = { getValue: () => "real" };
    const spy = spyOn(obj, "getValue").mockReturnValue("mocked");
    expect(obj.getValue()).toBe("mocked");
    spy.mockRestore();
    expect(obj.getValue()).toBe("real");
  });

  it("restoreAllMocks restores all spies", () => {
    const obj = { a: () => 1, b: () => 2 };
    spyOn(obj, "a").mockReturnValue(10);
    spyOn(obj, "b").mockReturnValue(20);
    restoreAllMocks();
    expect(obj.a()).toBe(1);
    expect(obj.b()).toBe(2);
  });

  it("throws if target is not a function", () => {
    const obj = { value: 42 };
    expect(() => spyOn(obj, "value")).toThrow("not a function");
  });
});

// ── clearAllMocks / resetAllMocks ────────────────────────────────────────────

describe("clearAllMocks / resetAllMocks", () => {
  afterEach(() => restoreAllMocks());

  it("clearAllMocks clears history on all spies", () => {
    const obj = { a: () => 1, b: () => 2 };
    const spyA = spyOn(obj, "a");
    const spyB = spyOn(obj, "b");
    obj.a();
    obj.b();
    clearAllMocks();
    expect(spyA.mock.calls).toHaveLength(0);
    expect(spyB.mock.calls).toHaveLength(0);
  });

  it("resetAllMocks resets history and implementations", () => {
    const obj = { getValue: () => 1 };
    spyOn(obj, "getValue").mockReturnValue(99);
    expect(obj.getValue()).toBe(99);
    resetAllMocks();
    expect(obj.getValue()).toBeUndefined();
  });
});

// ── mock() ──────────────────────────────────────────────────────────────────

describe("mock()", () => {
  afterEach(() => restoreAllMocks());

  it("replaces all methods with spies", () => {
    const obj = { a: () => 1, b: () => 2, notAFn: "hello" };
    mock(obj);
    obj.a();
    obj.b();
    expect(obj.a.mock.calls).toHaveLength(1);
    expect(obj.b.mock.calls).toHaveLength(1);
    expect(obj.notAFn).toBe("hello");
  });
});

// ── mockDeep() ──────────────────────────────────────────────────────────────

describe("mockDeep()", () => {
  afterEach(() => restoreAllMocks());

  it("mocks nested methods recursively", () => {
    const db = {
      users: { find: id => ({ id }), create: data => data },
      posts: { list: () => [] },
    };
    mockDeep(db);
    db.users.find(1);
    db.posts.list();
    expect(db.users.find.mock.calls).toHaveLength(1);
    expect(db.users.find.mock.lastCall).toEqual([1]);
    expect(db.posts.list.mock.calls).toHaveLength(1);
  });

  it("allows overriding nested return values", () => {
    const service = { auth: { login: () => null } };
    mockDeep(service);
    service.auth.login.mockReturnValue({ token: "abc" });
    expect(service.auth.login()).toEqual({ token: "abc" });
  });

  it("handles circular references", () => {
    const obj = { nested: {} };
    obj.nested.parent = obj;
    expect(() => mockDeep(obj)).not.toThrow();
  });

  it("restores everything on restoreAllMocks", () => {
    const service = { db: { query: () => "real" } };
    mockDeep(service);
    service.db.query.mockReturnValue("mocked");
    expect(service.db.query()).toBe("mocked");
    restoreAllMocks();
    expect(service.db.query()).toBe("real");
  });
});

// ── vi namespace ─────────────────────────────────────────────────────────────

describe("vi namespace", () => {
  afterEach(() => restoreAllMocks());

  it("vi.fn() creates a spy", () => {
    const spy = vi.fn();
    spy(1, 2);
    expect(spy.mock.calls).toHaveLength(1);
    expect(spy.mock.calls[0]).toEqual([1, 2]);
  });

  it("vi.spyOn() spies on methods", () => {
    const obj = { greet: name => `hi ${name}` };
    vi.spyOn(obj, "greet");
    obj.greet("world");
    expect(obj.greet.mock.calls).toHaveLength(1);
  });

  it("vi.restoreAllMocks() restores originals", () => {
    const obj = { val: () => 1 };
    vi.spyOn(obj, "val").mockReturnValue(99);
    expect(obj.val()).toBe(99);
    vi.restoreAllMocks();
    expect(obj.val()).toBe(1);
  });
});

// ── jest namespace ───────────────────────────────────────────────────────────

describe("jest namespace", () => {
  afterEach(() => restoreAllMocks());

  it("jest.fn() creates a spy", () => {
    const spy = jest.fn();
    spy("a");
    expect(spy.mock.calls).toHaveLength(1);
  });

  it("jest.spyOn() spies on methods", () => {
    const obj = { add: (a, b) => a + b };
    jest.spyOn(obj, "add");
    obj.add(2, 3);
    expect(obj.add.mock.lastCall).toEqual([2, 3]);
  });
});

// ── it.todo ──────────────────────────────────────────────────────────────────

describe("todo", () => {
  it.todo("planned feature");

  it("this test still runs", () => {
    expect(true).toBeTruthy();
  });
});

// ── it.each (parameterised tests) ────────────────────────────────────────────

describe("it.each", () => {
  it.each([1, 2, 3])("doubles %d", n => {
    expect(n * 2).toBeGreaterThan(n);
  });

  it.each([
    [1, 2, 3],
    [2, 3, 5],
    [10, 20, 30],
  ])("%d + %d = %d", (a, b, expected) => {
    expect(a + b).toBe(expected);
  });

  it.each([
    { a: 1, b: 2, sum: 3 },
    { a: 4, b: 5, sum: 9 },
  ])("$a + $b = $sum", ({ a, b, sum }) => {
    expect(a + b).toBe(sum);
  });

  it.each(["hello", "world"])("string %# is %s", s => {
    expect(typeof s).toBe("string");
  });
});

// ── useFakeTimers ────────────────────────────────────────────────────────────

describe("useFakeTimers", () => {
  afterEach(() => restoreAllMocks());

  it("setTimeout fires after advanceTimersByTime", async () => {
    useFakeTimers();
    let called = false;
    setTimeout(() => {
      called = true;
    }, 1000);
    expect(called).toBe(false);
    await advanceTimersByTime(1000);
    expect(called).toBe(true);
  });

  it("setTimeout does not fire before its delay", async () => {
    useFakeTimers();
    let called = false;
    setTimeout(() => {
      called = true;
    }, 1000);
    await advanceTimersByTime(999);
    expect(called).toBe(false);
  });

  it("setInterval fires repeatedly", async () => {
    useFakeTimers();
    let count = 0;
    setInterval(() => {
      count++;
    }, 100);
    await advanceTimersByTime(350);
    expect(count).toBe(3);
  });

  it("clearTimeout prevents callback", async () => {
    useFakeTimers();
    let called = false;
    const id = setTimeout(() => {
      called = true;
    }, 100);
    clearTimeout(id);
    await advanceTimersByTime(200);
    expect(called).toBe(false);
  });

  it("clearInterval stops repeating", async () => {
    useFakeTimers();
    let count = 0;
    const id = setInterval(() => {
      count++;
    }, 100);
    await advanceTimersByTime(250);
    clearInterval(id);
    await advanceTimersByTime(200);
    expect(count).toBe(2);
  });

  it("Date.now() returns fake time", () => {
    useFakeTimers({ now: 1000 });
    expect(Date.now()).toBe(1000);
  });

  it("new Date() returns fake time", () => {
    useFakeTimers({ now: new Date("2025-06-15T00:00:00Z") });
    const d = new Date();
    expect(d.toISOString()).toBe("2025-06-15T00:00:00.000Z");
  });

  it("new Date(value) passes through", () => {
    useFakeTimers({ now: 0 });
    const d = new Date("2020-01-01T00:00:00Z");
    expect(d.getFullYear()).toBe(2020);
  });

  it("performance.now() tracks fake clock", async () => {
    useFakeTimers({ now: 0 });
    const start = performance.now();
    await advanceTimersByTime(500);
    expect(performance.now() - start).toBe(500);
  });

  it("setSystemTime changes Date.now() without firing timers", () => {
    useFakeTimers({ now: 0 });
    let called = false;
    setTimeout(() => {
      called = true;
    }, 100);
    setSystemTime(5000);
    expect(Date.now()).toBe(5000);
    expect(called).toBe(false);
  });

  it("runAllTimers drains the queue", async () => {
    useFakeTimers();
    const order = [];
    setTimeout(() => order.push("a"), 100);
    setTimeout(() => order.push("b"), 50);
    setTimeout(() => order.push("c"), 200);
    await runAllTimers();
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("runOnlyPendingTimers does not fire recursive timers", async () => {
    useFakeTimers();
    let count = 0;
    const tick = () => {
      count++;
      setTimeout(tick, 100);
    };
    setTimeout(tick, 100);
    await runOnlyPendingTimers();
    expect(count).toBe(1);
  });

  it("getTimerCount reflects queue size", () => {
    useFakeTimers();
    expect(getTimerCount()).toBe(0);
    setTimeout(() => {
      /* noop */
    }, 100);
    setTimeout(() => {
      /* noop */
    }, 200);
    expect(getTimerCount()).toBe(2);
    clearTimeout(1);
    expect(getTimerCount()).toBe(1);
  });

  it("toFake: ['Date'] only fakes Date", async () => {
    const realST = globalThis.setTimeout;
    useFakeTimers({ now: 42, toFake: ["Date"] });
    expect(Date.now()).toBe(42);
    expect(globalThis.setTimeout).toBe(realST);
  });

  it("restoreAllMocks restores real timers", () => {
    const realNow = Date.now();
    useFakeTimers({ now: 0 });
    expect(Date.now()).toBe(0);
    restoreAllMocks();
    expect(Date.now()).toBeGreaterThanOrEqual(realNow);
  });

  it("async callbacks complete before advancement returns", async () => {
    useFakeTimers();
    let value = 0;
    setTimeout(async () => {
      await Promise.resolve();
      value = 42;
    }, 100);
    await advanceTimersByTime(100);
    expect(value).toBe(42);
  });

  it("throws when advancing without install", async () => {
    let error;
    try {
      await advanceTimersByTime(100);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Fake timers not installed");
  });

  it("double useFakeTimers resets cleanly", () => {
    useFakeTimers({ now: 100 });
    expect(Date.now()).toBe(100);
    useFakeTimers({ now: 200 });
    expect(Date.now()).toBe(200);
  });

  it("vi.useFakeTimers works via namespace", async () => {
    vi.useFakeTimers({ now: 0 });
    let called = false;
    setTimeout(() => {
      called = true;
    }, 50);
    await vi.advanceTimersByTime(50);
    expect(called).toBe(true);
    vi.useRealTimers();
  });
});

// No run() needed - auto-runs after all describe/it calls complete
