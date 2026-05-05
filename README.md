# Pure Test

Minimal cross-runtime test runner. Zero dependencies.

> **Note:** This project is in beta. APIs may change.

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
  --reporter, -r <name>      Output format: spec (default), tap, json, minimal
  --grep, -g <pattern>       Run only tests matching pattern (regex)
  --testNamePattern, -t      Alias for --grep (Jest/Vitest compatible)
  --help, -h                 Show help

Discovers: *.test.mjs, *.test.js, *.spec.mjs, *.spec.js
```

The CLI imports all discovered test files in a single process, then runs everything once. No workers, no transforms, no config.

```bash
npx pure-test tests/                     # discover and run all tests
npx pure-test tests/ --reporter tap      # TAP output
npx pure-test tests/ --reporter json     # JSON output
npx pure-test tests/ --reporter minimal  # dots output
npx pure-test tests/math.test.mjs        # single file
npx pure-test tests/ --grep "auth"       # only tests matching "auth"
npx pure-test tests/ -t "User.*login"    # regex pattern (Jest/Vitest compatible)
```

## API Reference

### Test Registration

```ts
describe(name, fn)              // define a suite (nestable)
describe.concurrent(name, fn)   // suite with parallel test execution
describe.skip(name, fn)         // skip a suite
describe.only(name, fn)         // focus: only run this suite
it(name, fn, options?)          // define a test (sync or async)
test(name, fn, options?)        // alias for it
it.skip(name, fn)               // skip a test
it.only(name, fn)               // focus: only run this test
it.todo(name)                   // placeholder for a planned test
it.each(cases)(name, fn)        // parameterised test from data
```

### Lifecycle Hooks

```ts
beforeAll(fn)    // run once before all tests in the suite
afterAll(fn)     // run once after all tests in the suite
beforeEach(fn)   // run before each test in the suite
afterEach(fn)    // run after each test in the suite
```

Hooks inherit: a `beforeEach` in an outer `describe` runs before each test in all nested `describe` blocks.

### Test Options

The third parameter to `it()` / `test()` accepts a timeout (number) or an options object:

```ts
// Timeout: fail if the test takes longer than 5 seconds
it('slow operation', async () => { ... }, 5000)

// Retry: re-run a flaky test up to 3 times before failing
it('flaky API call', async () => { ... }, { retry: 3 })

// Both: timeout + retry
it('network test', async () => { ... }, { timeout: 10000, retry: 2 })
```

Works with `it()`, `test()`, and `it.only()`.

### Assertion Counting

Verify that the expected number of assertions ran during a test:

```ts
it('calls both callbacks', () => {
  expect.assertions(2)       // exactly 2 assertions must run
  expect(a).toBe(1)
  expect(b).toBe(2)
})

it('has at least one assertion', () => {
  expect.hasAssertions()     // at least 1 assertion must run
  expect(result).toBeTruthy()
})
```

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

### Focus Mode (`.only`)

Use `.only` to run a single test or suite during debugging. All other tests are skipped:

```ts
describe('math', () => {
  it.only('this one runs', () => {
    expect(1 + 1).toBe(2)
  })

  it('this is skipped', () => {
    expect(true).toBeTruthy()
  })
})
```

`describe.only` focuses an entire suite — all tests inside it run:

```ts
describe.only('focused suite', () => {
  it('runs', () => { /* ... */ })
  it('also runs', () => { /* ... */ })
})

describe('skipped suite', () => {
  it('does not run', () => { /* ... */ })
})
```

Multiple `.only` markers can coexist. Remember to remove them before committing.

### Todo Tests

Document planned tests without failing the suite:

```ts
describe('auth', () => {
  it.todo('should handle token refresh')
  it.todo('should revoke expired sessions')

  it('logs in', () => {
    // this test runs normally
  })
})
```

Todo tests appear in output with a `todo` label and are counted separately.

### Parameterised Tests (`it.each`)

Reduce duplication for data-driven tests:

```ts
// Scalar values
it.each([1, 2, 3])('doubles %d', (n) => {
  expect(n * 2).toBeGreaterThan(n)
})

// Tuple values (array elements are spread as arguments)
it.each([
  [1, 2, 3],
  [2, 3, 5],
  [10, 20, 30],
])('%d + %d = %d', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

// Object values with $property interpolation
it.each([
  { input: 'hello', len: 5 },
  { input: 'hi', len: 2 },
])('$input has length $len', ({ input, len }) => {
  expect(input).toHaveLength(len)
})
```

**Name template specifiers:**

| Specifier | Description |
|-----------|-------------|
| `%s` | String |
| `%d`, `%f` | Number |
| `%i` | Integer (floored) |
| `%j`, `%o` | JSON |
| `%#` | Test case index |
| `$property` | Object property value |

### Assertions

```ts
expect(value).toBe(expected)              // strict ===
expect(value).toEqual(expected)           // deep structural equality
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeNaN()                  // Number.isNaN
expect(value).toBeInstanceOf(Class)
expect(value).toBeTypeOf('string')       // typeof check (Vitest-compatible)
expect(value).toSatisfy(fn)              // custom predicate
expect(value).toBeGreaterThan(n)
expect(value).toBeLessThan(n)
expect(value).toBeGreaterThanOrEqual(n)
expect(value).toBeLessThanOrEqual(n)
expect(value).toBeCloseTo(n, digits?)    // float comparison (default: 2 digits)
expect(value).toContain(item)            // string or array (===)
expect(value).toContainEqual(item)       // array (deep equality)
expect(value).toMatch(/regex/)           // regex or string pattern
expect(value).toHaveLength(n)
expect(value).toMatchObject(subset)      // partial deep match
expect(value).toHaveProperty('a.b', v)   // nested property exists, optional value
expect(value).toStrictEqual(expected)    // deep equality + undefined props + constructors
expect(fn).toThrow()
expect(fn).toThrow('message')
expect(fn).toThrow(/pattern/)
expect(spy).toHaveBeenCalled()
expect(spy).toHaveBeenCalledTimes(n)
expect(spy).toHaveBeenCalledWith(a, b)
expect(spy).toHaveBeenLastCalledWith(a)  // last call args
expect(spy).toHaveBeenNthCalledWith(n, a) // nth call args (1-indexed)
expect(spy).toHaveReturned()             // returned at least once
expect(spy).toHaveReturnedTimes(n)       // returned exactly n times
expect(spy).toHaveReturnedWith(value)    // any return matches
expect(spy).toHaveLastReturnedWith(value)
expect(spy).toHaveNthReturnedWith(n, value)
```

#### Asymmetric Matchers

Use inside `toEqual`, `toMatchObject`, `toHaveBeenCalledWith`, and other deep comparisons:

```ts
expect(42).toEqual(expect.any(Number))
expect('hello').toEqual(expect.any(String))
expect({ id: 1 }).toEqual(expect.anything())
expect('hello world').toEqual(expect.stringContaining('world'))
expect('abc-123').toEqual(expect.stringMatching(/\d+/))
expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 }))
expect([1, 2, 3]).toEqual(expect.arrayContaining([3, 1]))
expect({ price: 0.1 + 0.2 }).toEqual({ price: expect.closeTo(0.3) })
```

Negated asymmetric matchers:

```ts
expect([1, 2]).toEqual(expect.not.arrayContaining([3, 4]))
expect({ a: 1 }).toEqual(expect.not.objectContaining({ b: 2 }))
expect('hello').toEqual(expect.not.stringContaining('xyz'))
expect('hello').toEqual(expect.not.stringMatching(/\d+/))
```

Composable: nest matchers freely:

```ts
expect(spy).toHaveBeenCalledWith(
  expect.any(Number),
  expect.objectContaining({ name: expect.any(String) })
)
```

All assertions support `.not`, `.resolves`, and `.rejects`:

```ts
expect(1).not.toBe(2)
expect([1, 2]).not.toContain(3)
expect(() => {}).not.toThrow()

await expect(Promise.resolve(42)).resolves.toBe(42)
await expect(Promise.reject(new Error('fail'))).rejects.toBeInstanceOf(Error)
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

### Drop-in Namespaces (`vi` / `jest`)

For easy migration, Pure Test exports `vi` and `jest` namespace objects that map to the built-in spy/mock functions:

```ts
// Vitest migration
import { vi } from '@igorjs/pure-test'    // was: import { vi } from 'vitest'

const spy = vi.fn()
vi.spyOn(obj, 'method')
vi.restoreAllMocks()
vi.clearAllMocks()
vi.resetAllMocks()

// Jest migration
import { jest } from '@igorjs/pure-test'  // was: import { jest } from '@jest/globals'

const spy = jest.fn()
jest.spyOn(obj, 'method')
jest.restoreAllMocks()
```

These cover the spy/mock and fake timer subsets. Features like `vi.mock()` and `jest.mock()` are intentionally not included (see [What Pure Test will never support](#what-pure-test-will-never-support)).

### Fake Timers

Control time in your tests. Replaces `setTimeout`, `setInterval`, `Date`, and `performance.now()` with controllable fakes.

```ts
import { useFakeTimers, advanceTimersByTime, restoreAllMocks } from '@igorjs/pure-test'

describe('debounce', () => {
  afterEach(() => restoreAllMocks())  // also restores real timers

  it('fires after delay', async () => {
    useFakeTimers()
    let fired = false
    setTimeout(() => { fired = true }, 500)

    await advanceTimersByTime(499)
    expect(fired).toBe(false)

    await advanceTimersByTime(1)
    expect(fired).toBe(true)
  })
})
```

Also available via `vi.useFakeTimers()` / `jest.useFakeTimers()`.

#### Configuration

```ts
useFakeTimers({
  now: new Date('2025-01-01'),  // initial fake time (default: real Date.now())
  toFake: ['setTimeout', 'Date'], // selective faking (default: all)
  loopLimit: 10_000,            // max iterations for runAllTimers (default: 10000)
})
```

Timer set/clear pairs are atomic: faking `setTimeout` also fakes `clearTimeout`.

#### Timer Control

```ts
await advanceTimersByTime(1000) // advance clock, fire due callbacks
await runAllTimers()            // drain queue (throws on infinite loop)
await runOnlyPendingTimers()    // fire current queue, skip newly scheduled
getTimerCount()                 // number of pending timers
```

All advancement functions are async and `await` each callback, so async timer callbacks complete before the function returns.

#### Date Control

```ts
useFakeTimers({ now: new Date('2025-01-01') })
Date.now()           // 1735689600000
new Date()           // 2025-01-01T00:00:00.000Z
new Date('2020-06-15') // passes through to real Date
setSystemTime(new Date('2025-06-01'))  // change clock, don't fire timers
getRealSystemTime()  // real Date.now(), bypasses fake
```

`new Date()` with no arguments returns fake time. `new Date(value)` passes through. `instanceof Date` works correctly.

> **Note:** Fake timers use module-level state and should not be used with `describe.concurrent`.

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

### Programmatic Filtering

Filter tests by name when running directly (without the CLI):

```ts
import { setGrep } from '@igorjs/pure-test'
setGrep('auth')            // string (treated as regex)
setGrep(/User.*login/i)    // RegExp
```

Matches against the full hierarchical test name (`describe > test`).

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

## Migration Guides

Already using Jest or Vitest? Step-by-step porting guides with before/after examples:

- **[Migrating from Jest](docs/migrating-from-jest.md)** — replace `jest.fn()` with `spyFn()`, drop jest.config.js
- **[Migrating from Vitest](docs/migrating-from-vitest.md)** — replace `vi.fn()` with `spyFn()`, drop vitest.config.ts

Mock instance methods (`mockReturnValue`, `mockImplementation`, `mock.calls`, etc.) are API-compatible. Most tests only need an import change.

## Why Pure Test

|  | Pure Test | Jest | Vitest |
|---|---|---|---|
| 50 tests (same suite) | **~57ms** | ~762ms | ~559ms |
| Startup (1 test) | **~50ms** | ~880ms | ~660ms |
| Install footprint | **0 packages** | ~194 packages | ~35 packages |
| Config needed | **No** | Yes | Yes |
| Node.js | Yes | Yes | Yes |
| Deno | **Yes** | No | Experimental |
| Bun | **Yes** | Partial | Partial |
| Workers/Browser | **Yes** | No | No |
| Transforms needed | **No** | Yes (babel/SWC) | Yes (esbuild/SWC) |
| Mock API | `vi` + `jest` + individual | Jest API | vi namespace |

> Benchmarks: Apple M-series, Node 25, identical 50-test suite across all three runners, measured with `performance.now()` over 7 runs (median). Jest 30.2, Vitest 4.1.

## Feature Comparison

### What Pure Test supports

These features work the same way across all three frameworks. If you're using them in Jest or Vitest, they'll work in Pure Test with minimal changes.

| Feature | Pure Test | Jest | Vitest |
|---------|-----------|------|--------|
| `describe` / `it` / `test` | Yes | Yes | Yes |
| `describe.concurrent` | Yes | No | Yes |
| `describe.skip` / `it.skip` | Yes | Yes | Yes |
| `describe.only` / `it.only` | Yes | Yes | Yes |
| `it.todo` | Yes | Yes | Yes |
| `it.each` (parameterised tests) | Yes | Yes | Yes |
| `useFakeTimers` / `useRealTimers` | Yes | Yes | Yes |
| `advanceTimersByTime` / `runAllTimers` | Yes | Yes | Yes |
| `beforeAll` / `afterAll` | Yes | Yes | Yes |
| `beforeEach` / `afterEach` | Yes | Yes | Yes |
| `expect().toBe()` | Yes | Yes | Yes |
| `expect().toEqual()` | Yes | Yes | Yes |
| `expect().toBeTruthy/Falsy()` | Yes | Yes | Yes |
| `expect().toBeNull/Undefined/Defined()` | Yes | Yes | Yes |
| `expect().toBeInstanceOf()` | Yes | Yes | Yes |
| `expect().toBeNaN()` | Yes | Yes | Yes |
| `expect().toBeTypeOf()` | No | No | Yes |
| `expect().toSatisfy()` | No | No | Yes |
| `expect().toBeGreaterThan()` and friends | Yes | Yes | Yes |
| `expect().toBeCloseTo()` | Yes | Yes | Yes |
| `expect().toContain()` / `toContainEqual()` | Yes | Yes | Yes |
| `expect().toMatch()` | Yes | Yes | Yes |
| `expect().toHaveLength()` | Yes | Yes | Yes |
| `expect().toMatchObject()` / `toHaveProperty()` | Yes | Yes | Yes |
| `expect().toStrictEqual()` | Yes | Yes | Yes |
| `expect().toThrow()` | Yes | Yes | Yes |
| `expect().toHaveBeenCalled/Times/With()` | Yes | Yes | Yes |
| `expect().toHaveBeenLastCalledWith()` | Yes | Yes | Yes |
| `expect().toHaveBeenNthCalledWith()` | Yes | Yes | Yes |
| `expect().toHaveReturned/Times/With()` | Yes | Yes | Yes |
| `expect().toHaveLastReturnedWith()` | Yes | Yes | Yes |
| `expect().toHaveNthReturnedWith()` | Yes | Yes | Yes |
| `expect.any()` / asymmetric matchers | Yes | Yes | Yes |
| `expect.not.*` asymmetric matchers | Yes | Yes | Yes |
| `expect.closeTo()` | Yes | Yes | Yes |
| `expect.assertions()` / `expect.hasAssertions()` | Yes | Yes | Yes |
| `.not` / `.resolves` / `.rejects` modifiers | Yes | Yes | Yes |
| `spyOn(obj, 'prop', 'get'\|'set')` | Yes | Yes | Yes |
| Test timeout `it('name', fn, 5000)` | Yes | Yes | Yes |
| `--grep` / `-t` test name filtering | Yes (Mocha) | Yes | Yes |
| `spyFn()` / `fn()` / `vi.fn()` | Yes | Yes | Yes |
| `spyOn()` | Yes | Yes | Yes |
| `mockReturnValue` / `mockReturnValueOnce` | Yes | Yes | Yes |
| `mockImplementation` / `mockImplementationOnce` | Yes | Yes | Yes |
| `mockResolvedValue` / `mockRejectedValue` | Yes | Yes | Yes |
| `mockThrow` / `mockThrowOnce` | Yes | No | Yes (v4.1+) |
| `mockReturnThis` | Yes | Yes | Yes |
| `mockClear` / `mockReset` / `mockRestore` | Yes | Yes | Yes |
| `mock.calls` / `mock.results` / `mock.lastCall` | Yes | Yes | Yes |
| `mockDeep()` | Yes | Via jest-mock-extended | No |
| Multiple reporters (TAP, JSON, spec, minimal) | Yes | Via packages | Via packages |
| Custom reporters | Yes | Via packages | Via packages |
| Async test support | Yes | Yes | Yes |

### What Pure Test will never support

These features are intentionally excluded. Each one conflicts with our philosophy of zero dependencies, no transforms, no magic, and cross-runtime compatibility.

| Feature | Jest | Vitest | Why we skip it |
|---------|------|--------|---------------|
| Module mocking (`jest.mock` / `vi.mock`) | Yes | Yes | **Requires transform hooks** that intercept `import` statements at compile time. This is runtime-specific magic: Jest uses babel, Vitest uses Vite. There's no cross-runtime way to do it. Use dependency injection instead: pass dependencies as parameters, mock at the call site. |
| Global stubbing (`vi.stubGlobal` / `vi.stubEnv`) | No | Yes | **Mutating globals is fragile** and leaks between tests. Pass globals as function parameters instead. |
| Hoisted mocks (`vi.hoisted`) | No | Yes | **Only works with Vite's transform pipeline.** The concept doesn't exist without a bundler. |
| Snapshot testing | Yes | Yes | **Requires file I/O** to read/write `.snap` files, which isn't available in Workers or browsers. Snapshots are also brittle: they pass when they shouldn't (accepting wrong output) and fail when they shouldn't (formatting changes). Write explicit assertions that document what you expect. |
| Coverage (`--coverage`) | Yes | Yes | **Requires V8 or Istanbul instrumentation** which is deeply runtime-specific. Use [`c8`](https://github.com/bcoe/c8) for Node, `deno coverage` for Deno, or `bun test --coverage` for Bun. Separating coverage from the test runner is better architecture. |
| Watch mode | Yes | Yes | **Requires file system watchers** (FSEvents, inotify) which are runtime-specific. Use [`watchexec`](https://github.com/watchexec/watchexec) or `nodemon` externally: `watchexec -e mjs -- pure-test tests/`. Unix philosophy: do one thing well. |
| Browser environments (jsdom, happy-dom) | Yes | Yes | **Simulated DOM is a Node-only concept.** Pure Test runs in real browsers via Playwright. Test browser code in a real browser, not a simulation. |
| Worker/thread isolation | Yes | Yes | **Costs ~50ms per file** in process creation overhead. For 100 test files, that's 5 seconds before any test runs. Use `beforeEach`/`afterEach` for test isolation. If your tests need process isolation, your tests have a design problem. |
| `expect.extend()` (custom matchers) | Yes | Yes | **Adds API surface and complexity.** Write helper functions that call `expect()` internally. They compose better and are easier to debug. |
| Config files | Yes (`jest.config`) | Yes (`vitest.config`) | **Config parsing adds startup overhead** and a new thing to learn. CLI args cover everything. If you need project-specific settings, use npm scripts. |
| Benchmark mode | No | Yes (`bench()`) | **Benchmarking is a different tool.** Use [mitata](https://github.com/evanwashere/mitata) or [tinybench](https://github.com/tinylibs/tinybench). Mixing tests and benchmarks in one runner conflates two concerns. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and how to submit changes.

## Disclaimer

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## License

[Apache-2.0](LICENSE)
