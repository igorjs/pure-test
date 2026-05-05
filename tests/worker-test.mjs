/**
 * Cloudflare Workers smoke test via Miniflare API.
 *
 * Runs a subset of tests inside a Workers-compatible environment.
 * Verifies the library works without Node built-ins.
 *
 * Run locally:
 *   node tests/worker-test.mjs
 *
 * Requires: npm install miniflare (dev dependency)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");

// Build worker script by bundling dist/ imports into a single module
const workerScript = `
import {
  describe, it, expect, spyFn, run, setCLIMode, setReporter,
  useFakeTimers, advanceTimersByTime, restoreAllMocks,
} from "./index.js";

setCLIMode();
setReporter("json");

describe("Workers: assertions", () => {
  it("toBe", () => { expect(1 + 1).toBe(2); });
  it("toEqual", () => { expect({ a: 1 }).toEqual({ a: 1 }); });
  it("toContain", () => { expect("hello").toContain("ell"); });
  it("toHaveLength", () => { expect([1, 2, 3]).toHaveLength(3); });
  it("toThrow", () => { expect(() => { throw new Error("boom"); }).toThrow("boom"); });
});

describe("Workers: spies", () => {
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

describe("Workers: fake timers", () => {
  it("advanceTimersByTime", async () => {
    useFakeTimers();
    let called = false;
    setTimeout(() => { called = true; }, 1000);
    await advanceTimersByTime(1000);
    expect(called).toBe(true);
    restoreAllMocks();
  });
  it("Date.now", () => {
    useFakeTimers({ now: 1000 });
    expect(Date.now()).toBe(1000);
    restoreAllMocks();
  });
});

export default {
  async fetch() {
    const summary = await run();
    return new Response(JSON.stringify({
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
    }), {
      status: summary.failed === 0 ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  },
};
`;

let exitCode = 0;
try {
  const { Miniflare } = await import("miniflare");

  const mf = new Miniflare({
    modules: true,
    script: workerScript,
    modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
    scriptPath: join(distDir, "worker-entry.js"),
  });

  const response = await mf.dispatchFetch("http://localhost/");
  const result = await response.json();
  await mf.dispose();

  if (result.failed > 0) {
    console.log(`FAIL: ${result.passed} passed, ${result.failed} failed`);
    exitCode = 1;
  } else {
    console.log(
      `Workers: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`,
    );
  }
} catch (e) {
  console.error(`Worker test error: ${e.message}`);
  exitCode = 1;
}

process.exit(exitCode);
