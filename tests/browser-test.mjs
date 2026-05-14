/**
 * Browser smoke test via Playwright.
 *
 * Serves dist/ over HTTP, loads tests in Chromium, checks results.
 *
 * Run locally:
 *   node tests/browser-test.mjs
 *
 * Requires: npx playwright install chromium
 */

import { readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Preflight: verify the playwright devDependency is installed ─────────────
// Fail-fast with an actionable message rather than the cryptic ESM resolver
// error if someone runs this without `pnpm install` (regression: CI run
// 25391570458 on 2026-05-05 hit this path).

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (e) {
  const missing =
    e.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package 'playwright'/.test(e.message);
  if (missing) {
    console.error("browser-test requires the 'playwright' devDependency.");
    console.error("Install with:  pnpm install");
    console.error("Then install Chromium with:  npx playwright install --with-deps chromium");
  } else {
    console.error(`browser-test: failed to import playwright: ${e.message}`);
  }
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".map": "application/json",
};

// ── Static file server ──────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = req.url === "/" ? "/test.html" : req.url;
  const filePath = join(root, url);

  try {
    const content = await readFile(filePath, "utf8");
    const ext = extname(filePath);
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise(resolve => server.listen(0, resolve));
const port = server.address().port;

// ── Generate test HTML ──────────────────────────────────────────────────────

const testHtml = `<!DOCTYPE html>
<html>
<head><title>pure-test browser smoke</title></head>
<body>
<script type="module">
import {
  describe, it, expect, spyFn, run, setCLIMode, setReporter,
  useFakeTimers, advanceTimersByTime, restoreAllMocks,
} from "/dist/index.js";

setCLIMode();
setReporter("json");

describe("Browser: assertions", () => {
  it("toBe", () => { expect(1 + 1).toBe(2); });
  it("toEqual", () => { expect({ a: 1 }).toEqual({ a: 1 }); });
  it("toContain", () => { expect("hello").toContain("ell"); });
  it("toMatch", () => { expect("abc-123").toMatch(/\\d+/); });
  it("toHaveLength", () => { expect([1, 2, 3]).toHaveLength(3); });
});

describe("Browser: spies", () => {
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

describe("Browser: fake timers", () => {
  it("advanceTimersByTime", async () => {
    useFakeTimers({ now: 0 });
    let v = 0;
    setTimeout(() => { v = 42; }, 100);
    await advanceTimersByTime(100);
    expect(v).toBe(42);
    restoreAllMocks();
  });
  it("Date.now", () => {
    useFakeTimers({ now: 5000 });
    expect(Date.now()).toBe(5000);
    restoreAllMocks();
  });
});

const summary = await run();
window.__TEST_RESULT = { passed: summary.passed, failed: summary.failed, skipped: summary.skipped };
</script>
</body>
</html>`;

const htmlPath = join(root, "test.html");
await writeFile(htmlPath, testHtml);

// ── Run Playwright ──────────────────────────────────────────────────────────

let exitCode = 0;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("pageerror", err => console.error("Page error:", err.message));

  await page.goto(`http://localhost:${port}`);
  await page.waitForFunction(() => window.__TEST_RESULT, { timeout: 15000 });

  const result = await page.evaluate(() => window.__TEST_RESULT);
  await browser.close();

  if (result.failed > 0) {
    console.log(`FAIL: ${result.passed} passed, ${result.failed} failed`);
    exitCode = 1;
  } else {
    console.log(
      `Browser: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`,
    );
  }
} catch (e) {
  console.error(`Browser test error: ${e.message}`);
  exitCode = 1;
}

server.close();
await unlink(htmlPath).catch(() => {
  /* already cleaned up */
});
process.exit(exitCode);
