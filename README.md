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

## Quick Start

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

Run with any runtime:

```bash
node tests/math.test.mjs
deno run --allow-all tests/math.test.mjs
bun tests/math.test.mjs
```

## CLI

```
pure-test [paths...] [options]

Options:
  --reporter, -r <name>   Output format: spec (default), tap, json, minimal
  --help, -h              Show help

Discovers: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js
```

The CLI imports all discovered test files in a single process, then runs everything once. No workers, no transforms, no config.

```bash
npx pure-test tests/                     # discover and run all tests
npx pure-test tests/ --reporter tap      # TAP output
npx pure-test tests/ --reporter json     # JSON output
npx pure-test tests/ --reporter minimal  # dots output
npx pure-test tests/math.test.mjs        # single file
```

## API Reference

### Test Registration

```ts
describe(name, fn)              // define a suite (nestable)
describe.concurrent(name, fn)   // suite with parallel test execution
describe.skip(name, fn)         // skip a suite
it(name, fn) / test(name, fn)   // define a test (sync or async)
it.skip(name, fn)               // skip a test
```

### Lifecycle Hooks

```ts
beforeAll(fn)    // run once before all tests in the suite
afterAll(fn)     // run once after all tests in the suite
beforeEach(fn)   // run before each test in the suite
afterEach(fn)    // run after each test in the suite
```

Hooks inherit: a `beforeEach` in an outer `describe` runs before each test in all nested `describe` blocks.

### Concurrent Execution

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
expect(() => {}).not.toThrow()
```

### Spies

Create standalone spy functions or spy on existing methods.

#### `spyFn(impl?)`

Create a standalone spy function. Optionally wrap an implementation.

```ts
import { spyFn } from '@igorjs/pure-test'

const callback = spyFn()
callback(1, 2)
callback('a')

callback.mock.calls        // [[1, 2], ['a']]
callback.mock.lastCall     // ['a']
callback.mock.calls.length // 2
callback.mock.results      // [{ type: 'return', value: undefined }, ...]

// With initial implementation
const double = spyFn((x) => x * 2)
double(5) // 10
```

#### `spyOn(object, method)`

Spy on an existing method. Calls through to the original by default.

```ts
import { spyOn, restoreAllMocks } from '@igorjs/pure-test'

const obj = { greet: (name) => `hello ${name}` }
const spy = spyOn(obj, 'greet')

obj.greet('world')         // 'hello world' (calls original)
spy.mock.calls             // [['world']]

spy.mockReturnValue('hi')
obj.greet('world')         // 'hi' (overridden)

spy.mockRestore()          // restore original
obj.greet('world')         // 'hello world'
```

### Spy Behavior Control

All spy methods are chainable and Vitest-compatible:

```ts
const spy = spyFn()

// Fixed return value
spy.mockReturnValue(42)
spy() // 42

// One-time return values (chainable, uses queue)
spy.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)
spy() // 1
spy() // 2
spy() // 3
spy() // falls through to mockReturnValue or undefined

// Custom implementation
spy.mockImplementation((a, b) => a + b)
spy(2, 3) // 5

// One-time implementation
spy.mockImplementationOnce(() => 'once')
spy() // 'once'
spy() // falls through to mockImplementation

// Async: resolved promise
spy.mockResolvedValue({ data: 'ok' })
await spy() // { data: 'ok' }

// Async: one-time resolved
spy.mockResolvedValueOnce('first').mockResolvedValueOnce('second')
await spy() // 'first'
await spy() // 'second'

// Async: rejected promise
spy.mockRejectedValue(new Error('fail'))
await spy() // throws Error('fail')

// Async: one-time rejected
spy.mockRejectedValueOnce(new Error('once'))

// Throw synchronously
spy.mockThrow(new Error('boom'))
spy() // throws Error('boom')

// One-time throw
spy.mockThrowOnce(new Error('once'))

// Return `this` context
spy.mockReturnThis()
const obj = { method: spy }
obj.method() === obj // true
```

### Spy Inspection

```ts
spy.mock.calls              // Parameters<T>[] — all call arguments
spy.mock.lastCall            // Parameters<T> | undefined — last call args
spy.mock.results             // { type: 'return'|'throw', value }[] — all results
spy.mock.invocationCallOrder // number[] — global call ordering

spy.getMockName()            // string — spy's name
spy.mockName('myFn')         // set name (for assertion messages)
spy.getMockImplementation()  // T | undefined — current implementation
```

### Spy Reset

```ts
spy.mockClear()    // clear call history, keep implementation
spy.mockReset()    // clear history + reset implementation to default
spy.mockRestore()  // clear history + restore original (spyOn only)
```

### Object Mocking

#### `mock(object)`

Shallow mock: replace all function properties with spies.

```ts
import { mock, restoreAllMocks } from '@igorjs/pure-test'

const api = {
  getUser: (id) => fetch(`/users/${id}`),
  deleteUser: (id) => fetch(`/users/${id}`, { method: 'DELETE' }),
  baseUrl: 'https://api.example.com',
}

mock(api)
api.getUser(1)
api.getUser.mock.calls     // [[1]]
api.baseUrl                // 'https://api.example.com' (non-functions untouched)
restoreAllMocks()               // restore originals
```

#### `mockDeep(object)`

Recursively mock all methods on nested objects.

```ts
import { mockDeep, restoreAllMocks } from '@igorjs/pure-test'

const db = {
  users: {
    find: (id) => ({ id, name: 'Alice' }),
    create: (data) => ({ id: 1, ...data }),
  },
  posts: {
    list: () => [],
  },
}

mockDeep(db)

db.users.find.mockReturnValue({ id: 1, name: 'Mock' })
db.users.find(1)             // { id: 1, name: 'Mock' }
db.users.find.mock.calls     // [[1]]
db.posts.list.mock.calls     // []

restoreAllMocks()                 // restore all originals at every level
```

Handles circular references safely.

### Bulk Operations

```ts
import { restoreAllMocks, clearAllMocks, resetAllMocks } from '@igorjs/pure-test'

restoreAllMocks()       // restore all spied methods to originals
clearAllMocks()    // clear call history on all spies, keep implementations
resetAllMocks()    // clear history + reset implementations on all spies
```

### Reporters

Four built-in output formats:

| Reporter | Description | Use case |
|----------|-------------|----------|
| `spec` | Human-readable with suite nesting (default) | Local development |
| `tap` | TAP format | CI pipelines, piping to TAP consumers |
| `json` | Machine-readable JSON | Custom tooling, dashboards |
| `minimal` | Dots (`.` pass, `F` fail, `s` skip) | Large test suites, quick overview |

```bash
pure-test tests/ --reporter spec
pure-test tests/ --reporter tap
pure-test tests/ --reporter json
pure-test tests/ --reporter minimal
```

Programmatic selection:

```ts
import { setReporter } from '@igorjs/pure-test'
setReporter('tap')
```

Custom reporter:

```ts
import { setReporter } from '@igorjs/pure-test'

setReporter({
  name: 'custom',
  format: (summary) => {
    const icon = summary.failed > 0 ? 'FAIL' : 'PASS'
    return `${icon}: ${summary.passed}/${summary.results.length} passed in ${Math.round(summary.duration)}ms`
  }
})
```

## Test Isolation

Pure Test does **not** isolate tests. This is intentional.

Worker-per-file isolation (like Jest) costs ~50ms per file. For a project with 100 test files, that's 5 seconds of overhead before any test runs.

Instead, use the tools provided:

```ts
describe('database', () => {
  let db

  beforeEach(() => {
    db = createTestDb()    // fresh state per test
  })

  afterEach(() => {
    db.close()             // cleanup per test
  })

  it('inserts', () => {
    db.insert({ id: 1 })
    expect(db.count()).toBe(1)
  })

  it('starts empty', () => {
    expect(db.count()).toBe(0) // not affected by previous test
  })
})
```

If your tests have race conditions in sequential mode, that's a bug in the tests. `describe.concurrent` is opt-in: you explicitly take responsibility for independence.

## Porting from Jest

```diff
  // package.json
  "scripts": {
-   "test": "jest"
+   "test": "pure-test tests/"
  }
```

```diff
  // Rename: *.test.ts → *.test.mjs (or use runtime-native TS)

- import { describe, it, expect, jest } from '@jest/globals'
+ import { describe, it, expect, spyFn, spyOn, restoreAllMocks } from '@igorjs/pure-test'

  // jest.fn() → spyFn()
- const callback = jest.fn()
+ const callback = spyFn()

  // jest.spyOn() → spyOn()
- jest.spyOn(obj, 'method')
+ spyOn(obj, 'method')

  // jest.restoreAllMocks() → restoreAllMocks()
- jest.restoreAllMocks()
+ restoreAllMocks()

  // jest.clearAllMocks() → clearAllMocks()
- jest.clearAllMocks()
+ clearAllMocks()

  // jest.resetAllMocks() → resetAllMocks()
- jest.resetAllMocks()
+ resetAllMocks()
```

Mock instance methods are identical:

```ts
// These work the same in Jest and Pure Test:
spy.mockReturnValue(42)
spy.mockReturnValueOnce(1)
spy.mockImplementation(() => 'hi')
spy.mockImplementationOnce(() => 'once')
spy.mockResolvedValue({ data: 'ok' })
spy.mockRejectedValue(new Error('fail'))
spy.mockClear()
spy.mockReset()
spy.mockRestore()
spy.mock.calls
spy.mock.results
spy.mock.lastCall
```

**Not supported (intentionally):**

| Jest feature | Why not | Alternative |
|-------------|---------|-------------|
| `jest.mock('module')` | Module mocking is runtime-specific magic | Use dependency injection |
| `jest.useFakeTimers()` | Complex, runtime-specific | Mock the timer functions you need with `spyFn()` |
| `jest.requireActual()` | Coupled to module mocking | Not needed without module mocking |
| Snapshot testing | File I/O, brittle, hides intent | Write explicit assertions |
| `--coverage` | Requires V8/Istanbul integration | Use `c8` or your runtime's coverage tool |

## Porting from Vitest

```diff
  // package.json
  "scripts": {
-   "test": "vitest run"
+   "test": "pure-test tests/"
  }
```

```diff
- import { describe, it, expect, vi } from 'vitest'
+ import { describe, it, expect, spyFn, spyOn, restoreAllMocks, clearAllMocks, resetAllMocks } from '@igorjs/pure-test'

  // vi.fn() → spyFn()
- const spy = vi.fn()
+ const spy = spyFn()

  // vi.spyOn() → spyOn()
- vi.spyOn(obj, 'method')
+ spyOn(obj, 'method')

  // vi.restoreAllMocks() → restoreAllMocks()
- vi.restoreAllMocks()
+ restoreAllMocks()

  // vi.clearAllMocks() → clearAllMocks()
- vi.clearAllMocks()
+ clearAllMocks()

  // vi.resetAllMocks() → resetAllMocks()
- vi.resetAllMocks()
+ resetAllMocks()

  // afterEach cleanup
  afterEach(() => {
-   vi.restoreAllMocks()
+   restoreAllMocks()
  })
```

Mock instance methods are identical:

```ts
// These work the same in Vitest and Pure Test:
spy.mockReturnValue(42)
spy.mockReturnValueOnce(1)
spy.mockImplementation(() => 'hi')
spy.mockImplementationOnce(() => 'once')
spy.mockResolvedValue({ data: 'ok' })
spy.mockResolvedValueOnce('first')
spy.mockRejectedValue(new Error('fail'))
spy.mockRejectedValueOnce(new Error('once'))
spy.mockThrow(new Error('boom'))
spy.mockThrowOnce(new Error('once'))
spy.mockReturnThis()
spy.mockClear()
spy.mockReset()
spy.mockRestore()
spy.mockName('myFn')
spy.getMockName()
spy.getMockImplementation()
spy.mock.calls
spy.mock.results
spy.mock.lastCall
spy.mock.invocationCallOrder
```

**Not supported (intentionally):**

| Vitest feature | Why not | Alternative |
|-------------|---------|-------------|
| `vi.mock('module')` | Module mocking is runtime-specific | Use dependency injection |
| `vi.useFakeTimers()` | Complex, runtime-specific | Mock timers with `spyFn()` |
| `vi.stubGlobal()` | Mutating globals is fragile | Pass globals as parameters |
| `vi.hoisted()` | Transform-dependent | Not needed without transforms |
| `--coverage` | Requires V8/Istanbul | Use `c8` or runtime coverage |
| `vitest.config.ts` | Config file overhead | No config needed |

## Why Pure Test

|  | Pure Test | Jest | Vitest |
|---|---|---|---|
| Startup time | ~5ms | ~500ms | ~200ms |
| Dependencies | 0 | 50+ | 30+ |
| Config needed | No | Yes | Yes |
| Node.js | Yes | Yes | Yes |
| Deno | Yes | No | Experimental |
| Bun | Yes | Partial | Partial |
| Workers/Browser | Yes | No | No |
| Transforms needed | No | Yes | Yes |
| Mock API | Vitest-compatible | Jest API | vi namespace |

## License

[Apache-2.0](LICENSE)
