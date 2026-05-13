// Copyright 2026 igorjs. SPDX-License-Identifier: Apache-2.0

/**
 * Deno environment-variable access.
 *
 * This file is excluded from coverage measurement when running under Node / Bun
 * (see .c8rc.node.json). All branches here are only reachable when
 * `globalThis.Deno.env` is available.
 */

export interface DenoEnvAPI {
  get(k: string): string | undefined;
  set(k: string, v: string): void;
  delete(k: string): void;
}

export interface DenoEnvBackend {
  readonly type: "deno";
  readonly env: DenoEnvAPI;
}

export const getDenoEnv = (): DenoEnvBackend | undefined => {
  const g = globalThis as Record<string, unknown>;
  const deno = g["Deno"] as { env?: DenoEnvAPI } | undefined;
  if (deno?.env) return { type: "deno", env: deno.env };
  return undefined;
};

export const setDenoEnvKey = (env: DenoEnvAPI, key: string, value: string): void => {
  env.set(key, value);
};

export const restoreDenoEnvKey = (
  env: DenoEnvAPI,
  key: string,
  original: string | undefined,
): void => {
  if (original === undefined) env.delete(key);
  else env.set(key, original);
};
