/**
 * TypeScript CLI integration tests (Node-only).
 *
 * Spawns bin/pure-test.mjs against .ts fixtures to verify opt-in discovery,
 * runtime type stripping, and the Node 22.6-23.5 re-exec path. Imported from
 * self-test.mjs only under Node (the bin spawns process.execPath as a Node
 * binary, so these are not meaningful under Deno/Bun).
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "../dist/index.js";

const BIN = resolve("bin/pure-test.mjs");
const PT = resolve("dist/index.js");

const run = (args, opts = {}) =>
  new Promise(res => {
    const child = spawn(process.execPath, [BIN, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", b => {
      stdout += b.toString();
    });
    child.stderr.on("data", b => {
      stderr += b.toString();
    });
    child.on("exit", code => res({ code: code ?? 0, stdout, stderr }));
  });

const write = (dir, name, body) => writeFileSync(join(dir, name), body);

const mjsPassing = name =>
  `import { it, expect } from "${PT}";\nit(${JSON.stringify(name)}, () => { expect(1).toBe(1); });\n`;
const tsPassing = name =>
  `import { it, expect } from "${PT}";\nconst answer: number = 1;\nit(${JSON.stringify(name)}, () => { expect(answer).toBe(1); });\n`;
const tsEnum = name =>
  `import { it, expect } from "${PT}";\nenum Color { Red, Green }\nit(${JSON.stringify(name)}, () => { expect(Color.Red).toBe(0); });\n`;

describe("CLI: .ts discovery is opt-in (--ts)", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-ts-disc-"));
    write(dir, "alpha.test.mjs", mjsPassing("mjs"));
    write(dir, "beta.test.ts", tsPassing("ts"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("ignores .ts without --ts", async () => {
    const r = await run([dir, "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("alpha.test.mjs");
    expect(r.stdout).not.toContain("beta.test.ts");
  });

  it("discovers .ts with --ts", async () => {
    const r = await run([dir, "--ts", "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("alpha.test.mjs");
    expect(r.stdout).toContain("beta.test.ts");
  });
});
