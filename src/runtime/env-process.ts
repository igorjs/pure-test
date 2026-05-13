// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Node / Bun environment-variable access.
 *
 * This file is excluded from coverage measurement when running under Deno
 * (see .c8rc.deno.json). All branches here are only reachable from a
 * runtime that exposes `globalThis.process.env`.
 */

export interface ProcessEnvBackend {
  readonly type: "process";
  readonly env: Record<string, string | undefined>;
}

export const getProcessEnv = (): ProcessEnvBackend | undefined => {
  const g = globalThis as Record<string, unknown>;
  const proc = g["process"] as { env?: Record<string, string | undefined> } | undefined;
  if (proc?.env) return { type: "process", env: proc.env };
  return undefined;
};

export const setProcessEnvKey = (
  env: ProcessEnvBackend["env"],
  key: string,
  value: string,
): void => {
  env[key] = value;
};

export const restoreProcessEnvKey = (
  env: ProcessEnvBackend["env"],
  key: string,
  original: string | undefined,
): void => {
  if (original === undefined) delete env[key];
  else env[key] = original;
};
