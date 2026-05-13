/**
 * CLI integration tests: spawn bin/pure-test.mjs and assert on exit codes / output.
 *
 * These tests exercise the CLI flag wiring AND the runner CLI helpers
 * (runRegistered, printSummary, clearRegistered, isBailed, setCLIMode) which
 * are not safely testable in-process.
 *
 * c8 auto-instruments child processes via inherited NODE_V8_COVERAGE.
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

const writeFixture = (dir, name, body) => writeFileSync(join(dir, name), body);

const passingTest = name =>
  `import { it, expect } from "${PT}";\nit(${JSON.stringify(name)}, () => { expect(1).toBe(1); });\n`;
const failingTest = name =>
  `import { it, expect } from "${PT}";\nit(${JSON.stringify(name)}, () => { expect(1).toBe(2); });\n`;
const slowTest = (name, ms) =>
  `import { it } from "${PT}";\nit(${JSON.stringify(name)}, () => new Promise(r => setTimeout(r, ${ms})));\n`;

describe("CLI: --help and discovery", () => {
  it("--help exits 0 and prints usage", async () => {
    const r = await run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("USAGE");
    expect(r.stdout).toContain("--reporter");
  });

  it("-h is an alias for --help", async () => {
    const r = await run(["-h"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pure-test");
  });

  it("missing target exits 1 with error", async () => {
    const r = await run(["this-path-does-not-exist"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not found");
  });
});

describe("CLI: --listTests + --testPathPattern + --shard", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-"));
    writeFixture(dir, "alpha.test.mjs", passingTest("a"));
    writeFixture(dir, "beta.test.mjs", passingTest("b"));
    writeFixture(dir, "gamma.test.mjs", passingTest("c"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--listTests prints discovered files and exits 0", async () => {
    const r = await run([dir, "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("alpha.test.mjs");
    expect(r.stdout).toContain("beta.test.mjs");
    expect(r.stdout).toContain("gamma.test.mjs");
  });

  it("--testPathPattern filters by regex", async () => {
    const r = await run([dir, "--testPathPattern", "alpha", "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("alpha.test.mjs");
    expect(r.stdout).not.toContain("beta.test.mjs");
  });

  it("--shard 1/3 returns first slice", async () => {
    const r = await run([dir, "--shard", "1/3", "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("alpha.test.mjs");
  });

  it("--shard 3/3 returns last slice", async () => {
    const r = await run([dir, "--shard", "3/3", "--listTests"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("gamma.test.mjs");
  });

  it("--shard with empty slice exits 0 (CI-friendly)", async () => {
    const r = await run([dir, "--shard", "5/10", "--testPathPattern", "no-match-xyz"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("empty slice");
  });

  it("--passWithNoTests exits 0 when no files match", async () => {
    const r = await run([dir, "--testPathPattern", "no-match-xyz", "--passWithNoTests"]);
    expect(r.code).toBe(0);
  });

  it("no test files (no --passWithNoTests) exits 1", async () => {
    const r = await run([dir, "--testPathPattern", "no-match-xyz"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("No test files found");
  });
});

describe("CLI: --reporter (each format)", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-rep-"));
    writeFixture(dir, "ok.test.mjs", passingTest("works"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--reporter tap emits TAP", async () => {
    const r = await run([dir, "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("1..1");
    expect(r.stdout).toContain("ok 1");
  });

  it("--reporter json emits parseable JSON", async () => {
    const r = await run([dir, "--reporter", "json"]);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.passed).toBe(1);
  });

  it("--reporter minimal emits dots", async () => {
    const r = await run([dir, "--reporter", "minimal"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("passed");
  });

  it("--reporter unknown exits 1", async () => {
    const r = await run([dir, "--reporter", "nope"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("unknown reporter");
  });

  it("--verbose streams results", async () => {
    const r = await run([dir, "--verbose"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("works");
  });
});

describe("CLI: --bail stops importing remaining files", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-bail-"));
    writeFixture(dir, "a.test.mjs", `${failingTest("a fails")}console.error("[import] a");\n`);
    writeFixture(dir, "b.test.mjs", `${passingTest("b passes")}console.error("[import] b");\n`);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--bail prevents b.test.mjs from being imported", async () => {
    const r = await run([dir, "--bail", "--reporter", "minimal"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("[import] a");
    expect(r.stderr).not.toContain("[import] b");
  });

  it("without --bail both files are imported", async () => {
    const r = await run([dir, "--reporter", "minimal"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("[import] a");
    expect(r.stderr).toContain("[import] b");
  });
});

describe("CLI: --testTimeout default", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-to-"));
    writeFixture(dir, "slow.test.mjs", slowTest("slow", 200));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--testTimeout 50 fails the slow test", async () => {
    const r = await run([dir, "--testTimeout", "50", "--reporter", "minimal"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("timed out");
  });

  it("--testTimeout 1000 passes the slow test", async () => {
    const r = await run([dir, "--testTimeout", "1000", "--reporter", "minimal"]);
    expect(r.code).toBe(0);
  });

  it("--testTimeout with non-numeric exits 1", async () => {
    const r = await run([dir, "--testTimeout", "abc"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("non-negative number");
  });
});

describe("CLI: --no-parallel and --runInBand", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-ser-"));
    writeFixture(dir, "ok.test.mjs", passingTest("ser-ok"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--no-parallel runs sequentially and passes", async () => {
    const r = await run([dir, "--no-parallel", "--reporter", "minimal"]);
    expect(r.code).toBe(0);
  });

  it("--runInBand runs sequentially and passes", async () => {
    const r = await run([dir, "--runInBand", "--reporter", "minimal"]);
    expect(r.code).toBe(0);
  });

  it("--runInBand --no-parallel warns about redundancy", async () => {
    const r = await run([dir, "--runInBand", "--no-parallel", "--reporter", "minimal"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("redundant");
  });
});

describe("CLI: conflict detection", () => {
  it("--watch + --listTests exits 2 with hard error", async () => {
    const r = await run([".", "--watch", "--listTests"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("cannot be combined");
  });

  it("--shard with bad format exits 1", async () => {
    const r = await run([".", "--shard", "not-valid"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--shard");
  });

  it("--shard 5/3 (index > total) exits 1", async () => {
    const r = await run([".", "--shard", "5/3"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("1..total");
  });

  it("--reporter without value exits 1", async () => {
    const r = await run([".", "--reporter"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--reporter");
  });

  it("--grep without pattern exits 1", async () => {
    const r = await run([".", "--grep"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--grep");
  });
});

describe("CLI: NO_COLOR env var", () => {
  let dir;
  // ANSI ESC byte (decimal 27); built without literal control chars to satisfy lint
  const ESC = String.fromCharCode(27);
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-nc-"));
    writeFixture(dir, "ok.test.mjs", passingTest("colorless"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("strips ANSI escapes when NO_COLOR is set", async () => {
    const r = await run([dir, "--reporter", "spec"], { env: { NO_COLOR: "1" } });
    expect(r.code).toBe(0);
    // ANSI escape sequences start with \x1b[ — should not appear at all
    expect(r.stdout).not.toContain(ESC);
    expect(r.stdout).toContain("colorless");
    expect(r.stdout).toContain("passed");
  });

  it("includes ANSI escapes when NO_COLOR is unset", async () => {
    // Explicitly unset NO_COLOR (parent's env may have it set)
    const env = { ...process.env };
    delete env.NO_COLOR;
    const r = await new Promise(res => {
      const child = spawn(process.execPath, [BIN, dir, "--reporter", "spec"], {
        stdio: ["ignore", "pipe", "pipe"],
        env,
      });
      let stdout = "";
      child.stdout.on("data", b => {
        stdout += b.toString();
      });
      child.on("exit", code => res({ code: code ?? 0, stdout }));
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(ESC);
  });
});

describe("focus modifiers (covered via spawn)", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-focus-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("describe.skip skips an entire suite", async () => {
    const fixture = join(dir, "describe-skip.test.mjs");
    writeFileSync(
      fixture,
      `import { describe, it, expect } from "${PT}";\ndescribe.skip("skipped suite", () => { it("never runs", () => { throw new Error("BAD") }); });\ndescribe("kept", () => { it("runs", () => expect(1).toBe(1)); });\n`,
    );
    const r = await run([fixture, "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("ok");
    expect(r.stdout).toContain("# pass 1");
  });

  it("describe.only focuses a single suite (others not iterated)", async () => {
    const fixture = join(dir, "describe-only.test.mjs");
    writeFileSync(
      fixture,
      `import { describe, it, expect } from "${PT}";\ndescribe("not focused", () => { it("skipped-out", () => { throw new Error("BAD") }); });\ndescribe.only("focused", () => { it("runs", () => expect(1).toBe(1)); });\n`,
    );
    const r = await run([fixture, "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("focused > runs");
    expect(r.stdout).not.toContain("skipped-out");
    expect(r.stdout).toContain("# pass 1");
  });

  it("it.only focuses a single test", async () => {
    const fixture = join(dir, "it-only.test.mjs");
    writeFileSync(
      fixture,
      `import { describe, it, expect } from "${PT}";\ndescribe("mixed", () => {\n  it("normal", () => { throw new Error("BAD") });\n  it.only("focused", () => expect(1).toBe(1));\n});\n`,
    );
    const r = await run([fixture, "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("# pass 1");
    expect(r.stdout).toContain("# skip 1");
  });
});

describe("runtime fallback: no process, no Deno (covered via spawn)", () => {
  it("getProcessEnv returns undefined when process is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pt-fallback-"));
    const fixture = join(dir, "no-process.mjs");
    // Delete globalThis.process BEFORE importing the runtime helper
    writeFileSync(
      fixture,
      `delete globalThis.process;\nconst { getProcessEnv } = await import("${resolve("dist/runtime/env-process.js")}");\nconst { exitProcess } = await import("${resolve("dist/runtime/exit-process.js")}");\nif (getProcessEnv() !== undefined) { console.error("expected undefined"); process.exit(1); }\nif (exitProcess(0) !== false) { console.error("expected false"); process.exit(1); }\nconsole.log("OK");\n`,
    );
    const r = await new Promise(res => {
      const child = spawn(process.execPath, [fixture], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      child.stdout.on("data", b => {
        stdout += b.toString();
      });
      child.on("exit", code => res({ code: code ?? 0, stdout }));
    });
    rmSync(dir, { recursive: true, force: true });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("OK");
  });
});

describe("runner.reset() (covered via spawn)", () => {
  it("clears registered tests and state, allowing re-registration", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pt-reset-"));
    const fixture = join(dir, "use-reset.mjs");
    writeFileSync(
      fixture,
      `import { describe, it, expect, reset, run, setCLIMode, setBail, isBailed } from "${PT}";
setCLIMode();
setBail(true);
describe("BEFORE", () => { it("never runs", () => { throw new Error("BAD") }); });
reset();
if (isBailed()) { throw new Error("bail flag should be reset"); }
describe("AFTER", () => { it("runs", () => expect(1).toBe(1)); });
await run();
`,
    );
    const r = await new Promise(res => {
      const child = spawn(process.execPath, [fixture], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
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
    rmSync(dir, { recursive: true, force: true });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("AFTER");
    expect(r.stdout).not.toContain("BEFORE");
    expect(r.stdout).not.toContain("never runs");
  });
});

describe("CLI: --grep / --testNamePattern", () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pt-cli-grep-"));
    writeFixture(
      dir,
      "x.test.mjs",
      `import { it, expect } from "${PT}";\nit("auth login", () => expect(1).toBe(1));\nit("payments charge", () => expect(1).toBe(1));\n`,
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("--grep marks non-matching tests as SKIP", async () => {
    const r = await run([dir, "--grep", "auth", "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("ok 1 - auth login");
    expect(r.stdout).toContain("payments charge # SKIP");
    expect(r.stdout).toContain("# pass 1");
    expect(r.stdout).toContain("# skip 1");
  });

  it("--testNamePattern is an alias for --grep", async () => {
    const r = await run([dir, "--testNamePattern", "payments", "--reporter", "tap"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("ok 2 - payments charge");
    expect(r.stdout).toContain("auth login # SKIP");
  });
});
