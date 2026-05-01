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
 * No workers. No transforms. No config. Just import and run.
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const TEST_PATTERNS = [".test.mjs", ".test.js", ".spec.mjs", ".spec.js"];

const isTestFile = (name) => TEST_PATTERNS.some((p) => name.endsWith(p));

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

function parseArgs(argv) {
  const targets = [];
  let reporter = "spec";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--reporter" || argv[i] === "-r") {
      reporter = argv[++i] || "spec";
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`
pure-test - minimal cross-runtime test runner

USAGE:
  pure-test [paths...] [options]

OPTIONS:
  --reporter, -r <name>   Output format: spec (default), tap, json, minimal
  --help, -h              Show this help

EXAMPLES:
  pure-test tests/
  pure-test tests/ --reporter tap
  pure-test tests/math.test.mjs tests/string.test.mjs
`);
      process.exit(0);
    } else if (!argv[i].startsWith("-")) {
      targets.push(argv[i]);
    }
  }

  return { targets: targets.length > 0 ? targets : ["."], reporter };
}

async function main() {
  const { targets, reporter } = parseArgs(process.argv.slice(2));

  // Collect all test files
  const testFiles = [];
  for (const target of targets) {
    const abs = resolve(target);
    const s = await stat(abs).catch(() => null);
    if (s === null) {
      console.error(`Error: ${target} not found`);
      process.exit(1);
    }
    if (s.isDirectory()) {
      testFiles.push(...(await discoverTests(abs)));
    } else if (s.isFile()) {
      testFiles.push(abs);
    }
  }

  if (testFiles.length === 0) {
    console.error("No test files found.");
    console.error("Looking for: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js");
    process.exit(1);
  }

  console.error(`Found ${testFiles.length} test file${testFiles.length > 1 ? "s" : ""}:`);
  for (const f of testFiles) {
    console.error(`  ${f}`);
  }
  console.error("");

  // Import the runner and set CLI mode
  const { setCLIMode, setReporter, run } = await import("../dist/index.js");
  setCLIMode();
  setReporter(reporter);

  // Import all test files (tests register during import)
  for (const file of testFiles) {
    await import(file);
  }

  // Run everything
  await run();
}

main();
