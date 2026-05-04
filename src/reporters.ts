// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Output reporters. Pluggable: TAP, spec (human-readable), JSON, minimal.
 */

import type { RunSummary, TestResult } from "./types.js";

/** A reporter formats test results into a string. */
export interface Reporter {
  readonly name: string;
  readonly format: (summary: RunSummary) => string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const errMessage = (r: TestResult): string =>
  r.error instanceof Error ? r.error.message : String(r.error ?? "");

const fullName = (r: TestResult): string => {
  const path = r.suite.length > 0 ? `${r.suite.join(" > ")} > ` : "";
  return `${path}${r.name}`;
};

const summaryLine = (s: RunSummary): string => {
  const parts = [`${s.passed} passed`, `${s.failed} failed`, `${s.skipped} skipped`];
  if (s.todo > 0) parts.push(`${s.todo} todo`);
  return `${parts.join(", ")} (${s.duration.toFixed(0)}ms)`;
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

export const spec: Reporter = {
  name: "spec",
  format: summary => {
    const lines: string[] = [];
    let currentSuite: string[] = [];

    for (const r of summary.results) {
      // Print suite headers when they change
      const suitePath = r.suite;
      for (let i = 0; i < suitePath.length; i++) {
        if (currentSuite[i] !== suitePath[i]) {
          const indent = "  ".repeat(i);
          lines.push(`${indent}${suitePath[i]}`);
        }
      }
      currentSuite = [...suitePath];

      const indent = "  ".repeat(suitePath.length);
      if (r.status === "pass") {
        lines.push(`${indent}  pass  ${r.name} (${r.duration.toFixed(1)}ms)`);
      } else if (r.status === "todo") {
        lines.push(`${indent}  todo  ${r.name}`);
      } else if (r.status === "skip") {
        lines.push(`${indent}  skip  ${r.name}`);
      } else {
        lines.push(`${indent}  FAIL  ${r.name}`);
        lines.push(`${indent}        ${errMessage(r)}`);
      }
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
        if (r.status === "pass") return ".";
        if (r.status === "skip") return "s";
        if (r.status === "todo") return "T";
        return "F";
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

// ── Registry ────────────────────────────────────────────────────────────────

const reporters: Record<string, Reporter> = { tap, spec, json, minimal };

/** Get a reporter by name. Defaults to 'spec'. */
export const getReporter = (name?: string): Reporter => reporters[name ?? "spec"] ?? spec;
