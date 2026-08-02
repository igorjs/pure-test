// SPDX-License-Identifier: Apache-2.0
/**
 * Run the core smoke test inside miniflare (Cloudflare Workers runtime).
 *
 * Reads tests/smoke-core.mjs, strips the self-execute tail, inlines it into
 * a temporary Worker entry that imports dist/index.js, then runs it via
 * Miniflare and asserts all tests pass.
 *
 * Usage: node tests/workers/run.mjs
 * Requires: miniflare devDependency
 */

import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";

const ROOT = resolve(new URL("../../", import.meta.url).pathname);

// Read smoke-core and strip the self-execute block so it exports only runSmokeCore
const coreSrc = await readFile(resolve(ROOT, "tests/smoke-core.mjs"), "utf-8");
const fnOnly = coreSrc.replace(
  /\/\/ Self-execute when run directly[\s\S]*$/,
  "",
);

const workerSrc =
  "\nimport * as lib from './dist/index.js';\n\n" +
  fnOnly +
  "\nexport default {\n" +
  "  async fetch() {\n" +
  "    const { passed, failed, logs } = await runSmokeCore(lib);\n" +
  "    return new Response(JSON.stringify({ passed, failed, logs }), {\n" +
  "      headers: { 'Content-Type': 'application/json' },\n" +
  "    });\n" +
  "  },\n" +
  "};\n";

// Write temp worker at project root so './dist/index.js' resolves correctly
const tmpPath = resolve(ROOT, ".tmp-worker-smoke-test.mjs");
await writeFile(tmpPath, workerSrc);

try {
  const mf = new Miniflare({
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
    scriptPath: tmpPath,
    compatibilityDate: "2024-01-01",
  });

  const resp = await mf.dispatchFetch("http://localhost/");
  const { passed, failed, logs } = await resp.json();

  for (const line of logs) {
    console.log(line);
  }

  await mf.dispose();

  if (failed > 0) {
    console.log("\nMiniflare: " + failed + " test(s) failed");
    process.exit(1);
  }
  console.log("\nMiniflare: all " + passed + " tests passed");
} finally {
  await rm(tmpPath, { force: true });
}
