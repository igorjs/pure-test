#!/usr/bin/env node

/**
 * pure-test CLI - discovers and runs test files.
 *
 * Usage:
 *   pure-test                              # discover tests in current directory
 *   pure-test tests/                       # discover in specific directory
 *   pure-test tests/math.test.mjs          # run a specific file
 *   pure-test tests/ --reporter tap        # TAP output
 *   pure-test tests/ --reporter json       # JSON output
 *   pure-test tests/ --reporter minimal    # dots output
 *   pure-test tests/ --reporter spec       # human-readable (default)
 *
 * Discovers files matching: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js
 *
 * Cross-runtime: works on Node, Bun, and Deno (via node: imports).
 * No workers. No transforms. No config. Just import and run.
 */

import { watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const TEST_PATTERNS = [".test.mjs", ".test.js", ".spec.mjs", ".spec.js"];
const VALID_REPORTERS = ["spec", "tap", "json", "minimal", "verbose"];
const SOURCE_EXTS = [".js", ".mjs", ".ts", ".tsx", ".jsx"];

const isTestFile = (name) => TEST_PATTERNS.some((p) => name.endsWith(p));
const isSourceFile = (name) => SOURCE_EXTS.some((e) => name.endsWith(e));

async function discoverTests(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    if (entry.isDirectory()) {
      files.push(...(await discoverTests(full)));
    } else if (entry.isFile() && isTestFile(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

function parseShard(value, flag) {
  const m = /^(\d+)\/(\d+)$/.exec(value ?? "");
  if (!m) {
    console.error(`Error: ${flag} requires <index>/<total> (got "${value}")`);
    process.exit(1);
  }
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (index < 1 || total < 1 || index > total) {
    console.error(`Error: ${flag} index must be 1..total (got ${index}/${total})`);
    process.exit(1);
  }
  return { index, total };
}

function applyShard(files, shard) {
  if (!shard) return files;
  const { index, total } = shard;
  const start = Math.floor(((index - 1) * files.length) / total);
  const end = Math.floor((index * files.length) / total);
  return files.slice(start, end);
}

function parseArgs(argv) {
  const targets = [];
  const opts = {
    reporter: "spec",
    grep: undefined,
    testPathPattern: undefined,
    bail: false,
    verbose: false,
    forceExit: false,
    testTimeout: undefined,
    passWithNoTests: false,
    listTests: false,
    clearMocks: false,
    resetMocks: false,
    restoreMocks: false,
    shard: undefined,
    watch: false,
    parallel: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reporter" || a === "-r") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${a} requires a value (${VALID_REPORTERS.join(", ")})`);
        process.exit(1);
      }
      if (!VALID_REPORTERS.includes(value)) {
        console.error(`Error: unknown reporter "${value}". Valid reporters: ${VALID_REPORTERS.join(", ")}`);
        process.exit(1);
      }
      opts.reporter = value;
    } else if (a === "--grep" || a === "-g" || a === "--testNamePattern" || a === "-t") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${a} requires a pattern`);
        process.exit(1);
      }
      opts.grep = value;
    } else if (a === "--testPathPattern") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: --testPathPattern requires a pattern`);
        process.exit(1);
      }
      opts.testPathPattern = value;
    } else if (a === "--testTimeout") {
      const value = argv[++i];
      const ms = Number(value);
      if (!value || Number.isNaN(ms) || ms < 0) {
        console.error(`Error: --testTimeout requires a non-negative number (got ${value})`);
        process.exit(1);
      }
      opts.testTimeout = ms;
    } else if (a === "--shard") {
      opts.shard = parseShard(argv[++i], "--shard");
    } else if (a === "--bail" || a === "-b") {
      opts.bail = true;
    } else if (a === "--verbose" || a === "-v") {
      opts.verbose = true;
    } else if (a === "--force-exit" || a === "--forceExit") {
      opts.forceExit = true;
    } else if (a === "--passWithNoTests") {
      opts.passWithNoTests = true;
    } else if (a === "--listTests") {
      opts.listTests = true;
    } else if (a === "--clearMocks") {
      opts.clearMocks = true;
    } else if (a === "--resetMocks") {
      opts.resetMocks = true;
    } else if (a === "--restoreMocks") {
      opts.restoreMocks = true;
    } else if (a === "--watch" || a === "-w") {
      opts.watch = true;
    } else if (a === "--no-parallel") {
      opts.parallel = false;
    } else if (a === "--help" || a === "-h") {
      console.log(`
pure-test - minimal cross-runtime test runner

USAGE:
  pure-test [paths...] [options]

OPTIONS:
  --reporter, -r <name>      Output format: spec (default), tap, json, minimal, verbose
  --grep, -g <pattern>       Run only tests matching name pattern (regex)
  --testNamePattern, -t      Alias for --grep (Jest/Vitest compatible)
  --testPathPattern <pat>    Filter test files by path pattern (regex)
  --testTimeout <ms>         Default timeout for each test (ms)
  --shard <i>/<n>            Run only the i-th of n shards (1-indexed)
  --bail, -b                 Stop after first failure; skip importing remaining files
  --verbose, -v              Stream each test result as it runs
  --force-exit               Force exit after all tests complete (prevents hanging on open handles)
  --watch, -w                Re-run tests on file change (spawns fresh process per change)
  --no-parallel              Import test files sequentially (default: parallel)
  --passWithNoTests          Exit 0 even when no test files are found
  --listTests                Print discovered test file paths and exit
  --clearMocks               Auto-call clearAllMocks() before each test
  --resetMocks               Auto-call resetAllMocks() before each test
  --restoreMocks             Auto-call restoreAllMocks() before each test
  --help, -h                 Show this help

EXAMPLES:
  pure-test tests/
  pure-test tests/ --reporter tap
  pure-test tests/ --grep "auth"
  pure-test tests/ --shard 1/4              # CI: split across 4 jobs
  pure-test tests/ --watch                  # re-run on change
  pure-test tests/ --bail                   # stop importing remaining files on first failure
`);
      process.exit(0);
    } else if (!a.startsWith("-")) {
      targets.push(a);
    }
  }

  return { targets: targets.length > 0 ? targets : ["."], ...opts };
}

// ── Cross-runtime spawn helper ──────────────────────────────────────────────

function detectRuntime() {
  if (typeof globalThis.Deno !== "undefined") return "deno";
  if (typeof globalThis.Bun !== "undefined") return "bun";
  return "node";
}

async function spawnChild(scriptPath, args) {
  const runtime = detectRuntime();
  if (runtime === "deno") {
    const cmd = new globalThis.Deno.Command("deno", {
      args: ["run", "--allow-all", scriptPath, ...args],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const proc = cmd.spawn();
    return {
      kill: () => {
        try {
          proc.kill("SIGTERM");
        } catch {
          /* already exited */
        }
      },
      done: proc.status.then((s) => s.code ?? 0),
    };
  }
  // Node and Bun both implement node:child_process
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
  return {
    kill: () => child.kill("SIGTERM"),
    done: new Promise((res) => child.once("exit", (code) => res(code ?? 0))),
  };
}

// ── Watch mode ──────────────────────────────────────────────────────────────

async function runWatch(targets, childArgs) {
  let current = null;
  let pendingRerun = false;
  let timer = null;

  const start = async () => {
    current = await spawnChild(process.argv[1], childArgs);
    current.done.then(() => {
      current = null;
      if (pendingRerun) {
        pendingRerun = false;
        start();
      } else {
        console.error("\n[watch] waiting for changes...");
      }
    });
  };

  const trigger = () => {
    if (current) {
      pendingRerun = true;
      current.kill();
    } else {
      start();
    }
  };

  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(trigger, 100);
  };

  // Set up watchers on each target's directory
  const watchers = [];
  for (const target of targets) {
    const abs = resolve(target);
    const s = await stat(abs).catch(() => null);
    if (!s) continue;
    const watchDir = s.isDirectory() ? abs : dirname(abs);
    try {
      const w = watch(watchDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        if (filename.includes("node_modules") || filename.includes("/.git/")) return;
        if (!isSourceFile(filename)) return;
        debounced();
      });
      watchers.push(w);
    } catch (e) {
      console.error(`[watch] could not watch ${watchDir}: ${e.message}`);
    }
  }

  process.on("SIGINT", () => {
    if (current) current.kill();
    for (const w of watchers) w.close();
    process.exit(0);
  });

  console.error(`[watch] watching ${watchers.length} director${watchers.length === 1 ? "y" : "ies"}. Ctrl-C to exit.`);
  start();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function discoverAll(targets) {
  const files = [];
  for (const target of targets) {
    const abs = resolve(target);
    const s = await stat(abs).catch(() => null);
    if (s === null) {
      console.error(`Error: ${target} not found`);
      process.exit(1);
    }
    if (s.isDirectory()) files.push(...(await discoverTests(abs)));
    else if (s.isFile()) files.push(abs);
  }
  return files;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Watch mode: parent process supervises a child running the same args (minus --watch)
  if (opts.watch) {
    const childArgs = process.argv.slice(2).filter((a) => a !== "--watch" && a !== "-w");
    await runWatch(opts.targets, childArgs);
    return;
  }

  // Discover → filter → shard
  let testFiles = await discoverAll(opts.targets);
  if (opts.testPathPattern) {
    const re = new RegExp(opts.testPathPattern);
    testFiles = testFiles.filter((f) => re.test(f));
  }
  testFiles = applyShard(testFiles, opts.shard);

  if (testFiles.length === 0) {
    if (opts.passWithNoTests) {
      console.error("No test files found (--passWithNoTests).");
      process.exit(0);
    }
    if (opts.shard) {
      console.error(`No test files in shard ${opts.shard.index}/${opts.shard.total} (empty slice).`);
      process.exit(0);
    }
    console.error("No test files found.");
    console.error("Looking for: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js");
    process.exit(1);
  }

  if (opts.listTests) {
    for (const f of testFiles) console.log(f);
    process.exit(0);
  }

  console.error(`Found ${testFiles.length} test file${testFiles.length > 1 ? "s" : ""}${opts.shard ? ` (shard ${opts.shard.index}/${opts.shard.total})` : ""}:`);
  for (const f of testFiles) console.error(`  ${f}`);
  console.error("");

  const runner = await import("../dist/index.js");
  runner.setCLIMode();
  runner.setReporter(opts.verbose ? "verbose" : opts.reporter);
  if (opts.grep) runner.setGrep(opts.grep);
  if (opts.bail) runner.setBail();
  if (opts.forceExit) runner.setForceExit();
  if (opts.testTimeout !== undefined) runner.setDefaultTimeout(opts.testTimeout);
  if (opts.clearMocks) runner.setAutoClearMocks();
  if (opts.resetMocks) runner.setAutoResetMocks();
  if (opts.restoreMocks) runner.setAutoRestoreMocks();

  // Bail mode: import-then-run per file, stop importing once bail triggers
  if (opts.bail) {
    const accumulated = [];
    let totalDuration = 0;
    for (const file of testFiles) {
      await import(file);
      const summary = await runner.runRegistered(false);
      accumulated.push(...summary.results);
      totalDuration += summary.duration;
      if (runner.isBailed()) break;
      runner.clearRegistered();
    }
    runner.printSummary({
      results: accumulated,
      passed: accumulated.filter((r) => r.status === "pass").length,
      failed: accumulated.filter((r) => r.status === "fail").length,
      skipped: accumulated.filter((r) => r.status === "skip").length,
      todo: accumulated.filter((r) => r.status === "todo").length,
      duration: totalDuration,
    });
    return;
  }

  // Default mode: parallel imports (or sequential with --no-parallel), single run
  if (opts.parallel) {
    await Promise.all(testFiles.map((f) => import(f)));
  } else {
    for (const file of testFiles) await import(file);
  }
  await runner.run();
}

main();
