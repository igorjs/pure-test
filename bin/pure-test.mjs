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
const VALID_REPORTERS = ["spec", "tap", "json", "minimal"];

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
  let grep = undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--reporter" || argv[i] === "-r") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${argv[i - 1]} requires a value (${VALID_REPORTERS.join(", ")})`);
        process.exit(1);
      }
      if (!VALID_REPORTERS.includes(value)) {
        console.error(`Error: unknown reporter "${value}". Valid reporters: ${VALID_REPORTERS.join(", ")}`);
        process.exit(1);
      }
      reporter = value;
    } else if (argv[i] === "--grep" || argv[i] === "-g" || argv[i] === "--testNamePattern" || argv[i] === "-t") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${argv[i - 1]} requires a pattern`);
        process.exit(1);
      }
      grep = value;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`
pure-test - minimal cross-runtime test runner

USAGE:
  pure-test [paths...] [options]

OPTIONS:
  --reporter, -r <name>      Output format: spec (default), tap, json, minimal
  --grep, -g <pattern>       Run only tests matching pattern (regex)
  --testNamePattern, -t      Alias for --grep (Jest/Vitest compatible)
  --help, -h                 Show this help

EXAMPLES:
  pure-test tests/
  pure-test tests/ --reporter tap
  pure-test tests/ --grep "auth"
  pure-test tests/ -t "User.*login"
  pure-test tests/math.test.mjs tests/string.test.mjs
`);
      process.exit(0);
    } else if (!argv[i].startsWith("-")) {
      targets.push(argv[i]);
    }
  }

  return { targets: targets.length > 0 ? targets : ["."], reporter, grep };
}

async function main() {
  const { targets, reporter, grep } = parseArgs(process.argv.slice(2));

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
  const { setCLIMode, setGrep, setReporter, run } = await import("../dist/index.js");
  setCLIMode();
  setReporter(reporter);
  if (grep) setGrep(grep);

  // Import all test files (tests register during import)
  for (const file of testFiles) {
    await import(file);
  }

  // Run everything
  await run();
}

main();
