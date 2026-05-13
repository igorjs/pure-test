// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Output reporters. Pluggable: TAP, spec (human-readable), JSON, minimal, verbose.
 */

import type { RunSummary, TestResult } from "./types.js";

/** A reporter formats test results into a string. */
export interface Reporter {
  readonly name: string;
  /** Called after each individual test completes. Return a string to print it immediately. */
  readonly onResult?: (result: TestResult) => string | undefined;
  readonly format: (summary: RunSummary) => string;
}

// ── ANSI colours ────────────────────────────────────────────────────────────

const g = globalThis as Record<string, unknown>;
const proc = g["process"] as { env?: Record<string, string | undefined> } | undefined;
const noColor = proc?.env?.["NO_COLOR"] !== undefined;

const green = (s: string): string => (noColor ? s : `\x1b[32m${s}\x1b[0m`);
const red = (s: string): string => (noColor ? s : `\x1b[31m${s}\x1b[0m`);
const yellow = (s: string): string => (noColor ? s : `\x1b[33m${s}\x1b[0m`);
const cyan = (s: string): string => (noColor ? s : `\x1b[36m${s}\x1b[0m`);
const dim = (s: string): string => (noColor ? s : `\x1b[2m${s}\x1b[0m`);
const bold = (s: string): string => (noColor ? s : `\x1b[1m${s}\x1b[0m`);

// ── Helpers ─────────────────────────────────────────────────────────────────

const errMessage = (r: TestResult): string => {
  const msg = r.error instanceof Error ? r.error.message : String(r.error ?? "");
  return msg;
};

const fullName = (r: TestResult): string => {
  const path = r.suite.length > 0 ? `${r.suite.join(" > ")} > ` : "";
  return `${path}${r.name}`;
};

const summaryLine = (s: RunSummary): string => {
  const parts = [
    green(`${s.passed} passed`),
    s.failed > 0 ? red(`${s.failed} failed`) : `${s.failed} failed`,
    s.skipped > 0 ? yellow(`${s.skipped} skipped`) : `${s.skipped} skipped`,
  ];
  if (s.todo > 0) parts.push(cyan(`${s.todo} todo`));
  return `${parts.join(", ")} ${dim(`(${s.duration.toFixed(0)}ms)`)}`;
};

// ── TAP ─────────────────────────────────────────────────────────────────────

export const tap: Reporter = {
  name: "tap",
  format: summary => {
    const lines: string[] = [];
    lines.push(`1..${summary.results.length}`);

    for (let i = 0; i < summary.results.length; i++) {
      const r = summary.results[i]!;
      const name = fullName(r);
      if (r.status === "todo") {
        lines.push(`ok ${i + 1} - ${name} # TODO`);
      } else if (r.status === "skip") {
        lines.push(`ok ${i + 1} - ${name} # SKIP`);
      } else if (r.status === "pass") {
        lines.push(`ok ${i + 1} - ${name}`);
      } else {
        lines.push(`not ok ${i + 1} - ${name}`);
        lines.push(`  ---`);
        lines.push(`  error: ${errMessage(r)}`);
        lines.push(`  ...`);
      }
    }

    lines.push("");
    lines.push(`# tests ${summary.results.length}`);
    lines.push(`# pass ${summary.passed}`);
    lines.push(`# fail ${summary.failed}`);
    lines.push(`# skip ${summary.skipped}`);
    lines.push(`# todo ${summary.todo}`);
    lines.push(`# duration ${summary.duration.toFixed(0)}ms`);

    return lines.join("\n");
  },
};

// ── Spec (human-readable) ───────────────────────────────────────────────────

const formatSpecResult = (r: TestResult, indent: string): string[] => {
  if (r.status === "pass")
    return [`${indent}  ${green("pass")}  ${r.name} ${dim(`(${r.duration.toFixed(1)}ms)`)}`];
  if (r.status === "todo") return [`${indent}  ${cyan("todo")}  ${r.name}`];
  if (r.status === "skip") return [`${indent}  ${yellow("skip")}  ${r.name}`];
  const lines = [`${indent}  ${red("FAIL")}  ${r.name}`];
  for (const line of errMessage(r).split("\n")) {
    lines.push(`${indent}        ${red(line)}`);
  }
  return lines;
};

export const spec: Reporter = {
  name: "spec",
  format: summary => {
    const lines: string[] = [];
    let currentSuite: string[] = [];

    for (const r of summary.results) {
      const suitePath = r.suite;
      for (let i = 0; i < suitePath.length; i++) {
        if (currentSuite[i] !== suitePath[i]) {
          lines.push(`${"  ".repeat(i)}${bold(suitePath[i]!)}`);
        }
      }
      currentSuite = [...suitePath];
      lines.push(...formatSpecResult(r, "  ".repeat(suitePath.length)));
    }

    lines.push("");
    lines.push(summaryLine(summary));
    return lines.join("\n");
  },
};

// ── JSON ────────────────────────────────────────────────────────────────────

export const json: Reporter = {
  name: "json",
  format: summary =>
    JSON.stringify(
      {
        tests: summary.results.length,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        todo: summary.todo,
        duration: Math.round(summary.duration),
        results: summary.results.map(r => ({
          name: fullName(r),
          status: r.status,
          duration: Math.round(r.duration),
          ...(r.error !== undefined ? { error: errMessage(r) } : {}),
        })),
      },
      null,
      2,
    ),
};

// ── Minimal (dots) ──────────────────────────────────────────────────────────

export const minimal: Reporter = {
  name: "minimal",
  format: summary => {
    const dots = summary.results
      .map(r => {
        if (r.status === "pass") return green(".");
        if (r.status === "skip") return yellow("s");
        if (r.status === "todo") return cyan("T");
        return red("F");
      })
      .join("");
    const lines = [dots, ""];

    // Show failures
    const failures = summary.results.filter(r => r.status === "fail");
    for (const f of failures) {
      lines.push(`FAIL: ${fullName(f)}`);
      lines.push(`  ${errMessage(f)}`);
      lines.push("");
    }

    lines.push(summaryLine(summary));
    return lines.join("\n");
  },
};

// ── Verbose (streaming spec) ─────────────────────────────────────────────────

export const verbose: Reporter = (() => {
  let trackedSuite: string[] = [];
  return {
    name: "verbose",
    onResult: r => {
      const lines: string[] = [];
      const suitePath = r.suite;
      for (let i = 0; i < suitePath.length; i++) {
        if (trackedSuite[i] !== suitePath[i]) {
          lines.push(`${"  ".repeat(i)}${bold(suitePath[i]!)}`);
        }
      }
      trackedSuite = [...suitePath];
      lines.push(...formatSpecResult(r, "  ".repeat(suitePath.length)));
      return lines.join("\n");
    },
    format: summary => `\n${summaryLine(summary)}`,
  };
})();

// ── Registry ────────────────────────────────────────────────────────────────

const reporters: Record<string, Reporter> = { tap, spec, json, minimal, verbose };

/** Get a reporter by name. Defaults to 'spec'. */
export const getReporter = (name?: string): Reporter => reporters[name ?? "spec"] ?? spec;
