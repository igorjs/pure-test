# TypeScript (opt-in)

Pure Test runs `.ts` and `.mts` test files by delegating type stripping to the
runtime. No transpiler is bundled, so the zero-dependency claim holds:
`dependencies` stays empty, and `typescript` is only an optional peer dependency
used for type checking, never to run tests.

## Enabling

| Runtime                       | How to enable                                                          |
|-------------------------------|------------------------------------------------------------------------|
| Deno                          | Automatic. `.ts` runs natively.                                        |
| Bun                           | Automatic. `.ts` runs natively.                                        |
| Node >= 22.18 or >= 23.6      | `pure-test --ts` (Node strips types by default).                       |
| Node 22.6 .. 22.17, 23.0 .. 23.5 | `pure-test --ts` (the CLI re-execs once with `--experimental-strip-types`). |
| Node < 22.6                   | Not supported. Upgrade Node.                                           |
| Workers / Browser             | Not supported. Use `.mjs` / `.js`.                                     |

```
pure-test tests/ --ts
deno run --allow-all bin/pure-test.mjs tests/
bun bin/pure-test.mjs tests/
```

On Node, `.ts` discovery is **opt-in** via `--ts`. On Deno and Bun it is
discovered automatically (so `--ts` is a no-op there). Discovery is therefore
runtime-dependent by design: the same `pure-test tests/` finds `.ts` files on
Deno/Bun but not on Node without `--ts`. When your Node needs the strip flag, the
CLI adds it for you with a single one-time re-exec — you never pass it yourself.

## Writing strippable tests

Node's type stripping only removes erasable syntax. Your `.ts` tests must avoid
constructs that emit runtime code:

- No `enum` (use a `const` object with `as const`).
- No runtime `namespace`.
- No constructor parameter properties, e.g. `constructor(private x: T)`.
- No `import =` / `export =`.
- Use `import type { ... }` for type-only imports.

This is the same constraint Node enforces under `--experimental-strip-types`.
`.cts` (CommonJS TypeScript) is intentionally not discovered; this runner is
ESM-first. Code that needs real emit (`--experimental-transform-types`) is out
of scope: a zero-transform runner does not own that pipeline.

## Type checking

Running tests does not type check them. Use the optional peer dependency:

```
npm i -D typescript
tsc --noEmit -p tsconfig.test.json
```

This stays separate from the runner by design, the same way coverage and watch
mode are external tools.
