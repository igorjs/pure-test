# Pure Test

Minimal cross-runtime test runner. Zero dependencies.

> **Note:** This project is in alpha. APIs may change.

Works identically on Node.js, Deno, Bun, Cloudflare Workers, and browsers.

![Node.js](https://img.shields.io/badge/Node.js_22+-339933?logo=nodedotjs&logoColor=white)
![Deno](https://img.shields.io/badge/Deno_2.0+-000000?logo=deno&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

## Philosophy

1. **No magic.** Tests are just modules. Import, register, done.
2. **No workers.** Single process, no startup overhead. Tests run in ~5ms, not ~500ms.
3. **No transforms.** Requires `.mjs` or runtime-native TypeScript. No babel, no esbuild.
4. **No config files.** CLI args only. Zero configuration to start.
5. **Isolation is your responsibility.** The runner doesn't sandbox tests. Use `beforeEach`/`afterEach` for setup/teardown. If tests share mutable state, fix the tests, not the runner.
6. **Performance by default.** Sequential execution is safe. `describe.concurrent` is opt-in for when you know tests are independent.

## Install

```bash
npm install @igorjs/pure-test --save-dev
```

## Usage

```ts
import { describe, it, expect } from '@igorjs/pure-test'

describe('math', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })

  it('works async', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })
})

// Auto-runs when the module finishes loading. No run() call needed.
```

### Run with any runtime

```bash
# Direct execution (auto-run)
node tests/math.test.mjs
deno run --allow-all tests/math.test.mjs
bun tests/math.test.mjs

# CLI (discovers and runs all test files)
npx pure-test tests/
npx pure-test tests/ --reporter tap
npx pure-test tests/ --reporter json
```

## CLI

```
pure-test [paths...] [options]

Options:
  --reporter, -r <name>   Output format: spec (default), tap, json, minimal
  --help, -h              Show help

Discovers: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js
```

The CLI imports all discovered test files in a single process, then runs everything once. No workers, no transforms, no config parsing.

## API

### Test registration

```ts
describe(name, fn)              // define a suite (nestable)
describe.concurrent(name, fn)   // define a suite with parallel test execution
describe.skip(name, fn)         // skip a suite
it(name, fn) / test(name, fn)   // define a test (sync or async)
it.skip(name, fn)               // skip a test
beforeAll(fn)                   // run once before all tests in the suite
afterAll(fn)                    // run once after all tests in the suite
beforeEach(fn)                  // run before each test in the suite
afterEach(fn)                   // run after each test in the suite
```

### Concurrent execution

By default, tests run sequentially. Use `describe.concurrent` when tests are independent:

```ts
describe.concurrent('crypto operations', () => {
  it('hash', async () => { /* 100ms */ })   // all three run
  it('sign', async () => { /* 100ms */ })   // at the same time
  it('verify', async () => { /* 100ms */ }) // total: ~100ms, not 300ms
})
```

Nested suites within a concurrent suite still run sequentially for predictability.

### Assertions

```ts
expect(value).toBe(expected)              // strict ===
expect(value).toEqual(expected)           // deep structural equality
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeInstanceOf(Class)
expect(value).toBeGreaterThan(n)
expect(value).toBeLessThan(n)
expect(value).toBeGreaterThanOrEqual(n)
expect(value).toBeLessThanOrEqual(n)
expect(value).toContain(item)             // string or array
expect(value).toMatch(/regex/)
expect(value).toHaveLength(n)
expect(fn).toThrow()
expect(fn).toThrow('message')
expect(fn).toThrow(/pattern/)
```

All assertions support `.not`:

```ts
expect(1).not.toBe(2)
expect([1, 2]).not.toContain(3)
```

### Reporters

Four built-in output formats:

```bash
pure-test tests/ --reporter spec     # human-readable (default)
pure-test tests/ --reporter tap      # TAP format (pipeable)
pure-test tests/ --reporter json     # machine-readable JSON
pure-test tests/ --reporter minimal  # dots: ...F.s..
```

Programmatic reporter selection:

```ts
import { setReporter } from '@igorjs/pure-test'
setReporter('tap')
```

Custom reporters:

```ts
import { setReporter } from '@igorjs/pure-test'

setReporter({
  name: 'custom',
  format: (summary) => `${summary.passed}/${summary.results.length} passed`
})
```

## Test isolation

Pure Test does **not** isolate tests. This is intentional.

Worker-per-file isolation (like Jest) costs ~50ms per file. For a project with 100 test files, that's 5 seconds of overhead before any test runs.

Instead, Pure Test gives you the tools for isolation:

```ts
describe('database', () => {
  let db

  beforeEach(() => {
    db = createTestDb()  // fresh state per test
  })

  afterEach(() => {
    db.close()           // cleanup per test
  })

  it('inserts a record', () => {
    db.insert({ id: 1 })
    expect(db.count()).toBe(1)
  })

  it('starts empty', () => {
    expect(db.count()).toBe(0)  // not affected by previous test
  })
})
```

If your tests have race conditions in sequential mode, that's a bug in the tests. `describe.concurrent` is opt-in: you explicitly take responsibility for independence.

## Why not Jest/Vitest?

| | Pure Test | Jest | Vitest |
|---|---|---|---|
| Startup time | ~5ms | ~500ms | ~200ms |
| Dependencies | 0 | 50+ | 30+ |
| Node | Yes | Yes | Yes |
| Deno | Yes | No | Experimental |
| Bun | Yes | Partial | Partial |
| Workers | Yes | No | No |
| Config needed | No | Yes | Yes |
| Transforms | None | babel/SWC | esbuild/SWC |

## License

[Apache-2.0](LICENSE)
