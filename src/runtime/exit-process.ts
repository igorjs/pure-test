// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Node / Bun process exit dispatch.
 *
 * Excluded from Deno coverage runs (see .c8rc.deno.json).
 */

export const exitProcess = (code: number): boolean => {
  const g = globalThis as Record<string, unknown>;
  const proc = g["process"] as { exit?(code: number): void } | undefined;
  if (proc?.exit) {
    proc.exit(code);
    return true;
  }
  return false;
};
