// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Deno exit dispatch.
 *
 * Excluded from Node/Bun coverage runs (see .c8rc.node.json).
 */

export const exitDeno = (code: number): boolean => {
  const g = globalThis as Record<string, unknown>;
  const deno = g["Deno"] as { exit?(code: number): void } | undefined;
  if (deno?.exit) {
    deno.exit(code);
    return true;
  }
  return false;
};
