// SPDX-License-Identifier: Apache-2.0
/**
 * smoke-core.mjs - Cross-runtime smoke test for pure-test's core API.
 *
 * Exercises expect(), spyFn, and the describe/it/runRegistered suite API.
 * Also used as the test payload for browser (Playwright) and Cloudflare
 * Workers (miniflare) integration tests.
 *
 * Run:
 *   node tests/smoke-core.mjs
 *   deno run --allow-all tests/smoke-core.mjs
 *   bun tests/smoke-core.mjs
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: smoke test
export async function runSmokeCore(lib) {
  const {
    AssertionError,
    describe,
    expect,
    it,
    reset,
    runRegistered,
    setCLIMode,
    spyFn,
  } = lib;

  let passed = 0;
  let failed = 0;
  const logs = [];

  const log = (msg) => logs.push(msg);
  const section = (name) => log("\n--- " + name + " ---");

  // Verify a passing assertion
  const ok = (label, fn) => {
    try {
      const r = fn();
      // Handle async assertions (e.g. resolves/rejects)
      if (r && typeof r.then === "function") {
        return r.then(
          () => {
            log("  ok: " + label);
            passed++;
          },
          (e) => {
            log("  FAIL: " + label + " (" + (e && e.message) + ")");
            failed++;
          },
        );
      }
      log("  ok: " + label);
      passed++;
    } catch (e) {
      log("  FAIL: " + label + " (" + (e && e.message) + ")");
      failed++;
    }
    return undefined;
  };

  // Verify a failing assertion throws
  const fails = (label, fn) => {
    try {
      fn();
      log("  FAIL: " + label + " (expected throw, got none)");
      failed++;
    } catch {
      log("  ok: " + label);
      passed++;
    }
  };

  // ── expect: value matchers ─────────────────────────────────────────────────

  section("expect: value matchers");
  ok("toBe equal primitive", () => expect(42).toBe(42));
  ok("toBe string", () => expect("hello").toBe("hello"));
  ok("toBe null", () => expect(null).toBe(null));
  ok("toBe undefined", () => expect(undefined).toBe(undefined));
  fails("toBe fails on mismatch", () => expect(1).toBe(2));
  ok("toEqual object", () => expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 }));
  ok("toEqual array", () => expect([1, 2, 3]).toEqual([1, 2, 3]));
  fails("toEqual fails on mismatch", () => expect({ a: 1 }).toEqual({ a: 2 }));
  ok("toBeTruthy number", () => expect(1).toBeTruthy());
  ok("toBeTruthy string", () => expect("x").toBeTruthy());
  ok("toBeFalsy false", () => expect(false).toBeFalsy());
  ok("toBeFalsy zero", () => expect(0).toBeFalsy());
  ok("toBeNull", () => expect(null).toBeNull());
  ok("toBeUndefined", () => expect(undefined).toBeUndefined());
  ok("toBeDefined string", () => expect("x").toBeDefined());
  ok("toBeDefined zero", () => expect(0).toBeDefined());
  ok("toBeTypeOf string", () => expect("hi").toBeTypeOf("string"));
  ok("toBeTypeOf number", () => expect(42).toBeTypeOf("number"));
  ok("toBeTypeOf boolean", () => expect(true).toBeTypeOf("boolean"));
  ok("toBeInstanceOf Error", () => expect(new Error("x")).toBeInstanceOf(Error));
  ok("toSatisfy predicate", () => expect(10).toSatisfy((n) => n > 5));

  // ── expect: numeric matchers ───────────────────────────────────────────────

  section("expect: numeric matchers");
  ok("toBeGreaterThan", () => expect(5).toBeGreaterThan(3));
  ok("toBeLessThan", () => expect(3).toBeLessThan(5));
  ok("toBeGreaterThanOrEqual equal", () => expect(5).toBeGreaterThanOrEqual(5));
  ok("toBeGreaterThanOrEqual greater", () => expect(6).toBeGreaterThanOrEqual(5));
  ok("toBeLessThanOrEqual equal", () => expect(5).toBeLessThanOrEqual(5));
  ok("toBeCloseTo float", () => expect(0.1 + 0.2).toBeCloseTo(0.3, 5));

  // ── expect: container matchers ─────────────────────────────────────────────

  section("expect: container matchers");
  ok("toContain string substring", () => expect("hello world").toContain("world"));
  ok("toContain array element", () => expect([1, 2, 3]).toContain(2));
  ok("toHaveLength array", () => expect([1, 2, 3]).toHaveLength(3));
  ok("toHaveLength string", () => expect("abc").toHaveLength(3));
  ok("toMatchObject partial", () => expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }));
  ok("toHaveProperty dot-path", () => expect({ x: { y: 42 } }).toHaveProperty("x.y", 42));
  ok("toMatch regex", () => expect("foobar").toMatch(/foo/));
  ok("toMatch string", () => expect("foobar").toMatch("bar"));
  ok("toContainEqual", () => expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 2 }));

  // ── expect: not modifier ───────────────────────────────────────────────────

  section("expect: .not modifier");
  ok("not.toBe", () => expect(1).not.toBe(2));
  ok("not.toEqual", () => expect({ a: 1 }).not.toEqual({ a: 2 }));
  ok("not.toContain", () => expect([1, 2]).not.toContain(3));
  ok("not.toBeNull", () => expect(1).not.toBeNull());
  fails("not.toBe fails when equal", () => expect(1).not.toBe(1));

  // ── expect: error matchers ─────────────────────────────────────────────────

  section("expect: error matchers");
  ok("toThrow", () =>
    expect(() => {
      throw new Error("boom");
    }).toThrow(),
  );
  ok("toThrow message string", () =>
    expect(() => {
      throw new Error("boom");
    }).toThrow("boom"),
  );
  ok("toThrow message regex", () =>
    expect(() => {
      throw new Error("boom");
    }).toThrow(/boom/),
  );
  fails("toThrow fails on no-throw", () => expect(() => {}).toThrow());

  // ── expect: async matchers ─────────────────────────────────────────────────

  section("expect: async matchers");
  await ok("resolves", () => expect(Promise.resolve(42)).resolves.toBe(42));
  await ok("rejects matches Error", () =>
    expect(Promise.reject(new Error("oops"))).rejects.toMatchObject({ message: "oops" }),
  );

  // ── expect: asymmetric matchers ────────────────────────────────────────────

  section("expect: asymmetric matchers");
  ok("expect.any(Number)", () => expect(42).toEqual(expect.any(Number)));
  ok("expect.any(String)", () => expect("hi").toEqual(expect.any(String)));
  ok("expect.anything() non-null", () => expect("x").toEqual(expect.anything()));
  ok("expect.stringContaining", () =>
    expect("foobar").toEqual(expect.stringContaining("foo")),
  );
  ok("expect.objectContaining", () =>
    expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 })),
  );
  ok("expect.arrayContaining", () =>
    expect([1, 2, 3]).toEqual(expect.arrayContaining([2, 3])),
  );
  ok("expect.stringMatching regex", () =>
    expect("foobar").toEqual(expect.stringMatching(/foo/)),
  );

  // ── AssertionError ─────────────────────────────────────────────────────────

  section("AssertionError");
  {
    let caught = null;
    try {
      expect(1).toBe(2);
    } catch (e) {
      caught = e;
    }
    ok("throws AssertionError", () =>
      expect(caught).toBeInstanceOf(AssertionError),
    );
    ok("AssertionError message non-empty", () =>
      expect(caught.message.length).toBeGreaterThan(0),
    );
  }

  // ── spyFn ──────────────────────────────────────────────────────────────────

  section("spyFn");
  {
    const spy = spyFn();
    spy("a", "b");
    spy(1);
    ok("tracks call count", () => expect(spy).toHaveBeenCalledTimes(2));
    ok("toHaveBeenCalled", () => expect(spy).toHaveBeenCalled());
    ok("toHaveBeenCalledWith", () => expect(spy).toHaveBeenCalledWith("a", "b"));
    ok("toHaveBeenLastCalledWith", () =>
      expect(spy).toHaveBeenLastCalledWith(1),
    );
    ok("mock.calls length", () => expect(spy.mock.calls.length).toBe(2));

    spy.mockClear();
    ok("mockClear resets history", () =>
      expect(spy.mock.calls.length).toBe(0),
    );
  }

  {
    const spy = spyFn().mockReturnValue(42);
    ok("mockReturnValue", () => expect(spy()).toBe(42));
    ok("toHaveReturned", () => expect(spy).toHaveReturned());
    ok("toHaveReturnedWith", () => expect(spy).toHaveReturnedWith(42));
  }

  {
    const spy = spyFn()
      .mockReturnValueOnce("first")
      .mockReturnValueOnce("second");
    ok("mockReturnValueOnce first", () => expect(spy()).toBe("first"));
    ok("mockReturnValueOnce second", () => expect(spy()).toBe("second"));
    ok("mockReturnValueOnce exhausted", () =>
      expect(spy()).toBeUndefined(),
    );
  }

  {
    const spy = spyFn().mockImplementation((x) => x * 2);
    ok("mockImplementation", () => expect(spy(5)).toBe(10));
  }

  {
    const spy = spyFn().mockResolvedValue(99);
    const val = await spy();
    ok("mockResolvedValue", () => expect(val).toBe(99));
  }

  // ── describe / it / runRegistered ──────────────────────────────────────────

  section("suite runner");
  {
    reset();
    setCLIMode();

    describe("inner suite", () => {
      it("addition", () => {
        expect(1 + 1).toBe(2);
      });
      it("string contains", () => {
        expect("hello").toContain("hell");
      });
      it("spy inside runner", () => {
        const spy = spyFn();
        spy("ping");
        expect(spy).toHaveBeenCalledWith("ping");
      });
    });

    const summary = await runRegistered();
    ok("runner: passed count >= 3", () =>
      expect(summary.passed).toBeGreaterThanOrEqual(3),
    );
    ok("runner: no failures", () => expect(summary.failed).toBe(0));

    reset();
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  log("\n========================================");
  log("Smoke test (core): " + passed + " passed, " + failed + " failed");
  log("========================================");

  return { passed, failed, logs };
}

// Self-execute when run directly (Node/Deno/Bun)
if (typeof process !== "undefined" || typeof Deno !== "undefined") {
  const lib = await import("../dist/index.js");
  const { passed, failed, logs } = await runSmokeCore(lib);
  for (const line of logs) {
    console.log(line);
  }
  if (failed > 0) {
    if (typeof process !== "undefined" && typeof process.exit === "function") {
      process.exit(1);
    }
    throw new Error(failed + " smoke test(s) failed");
  }
}
