# Migrating from Jest

A step-by-step guide to porting your test suite from Jest to Pure Test.

## 1. Update package.json

```diff
  "scripts": {
-   "test": "jest"
+   "test": "pure-test tests/"
  }
```

## 2. Rename test files

Jest uses transforms to handle `.ts` files. Pure Test requires `.mjs` or runtime-native TypeScript (Deno, Bun).

```bash
# Rename .test.ts → .test.mjs
for f in $(find tests -name '*.test.ts'); do
  mv "$f" "${f%.ts}.mjs"
done
```

If using Deno or Bun, you can keep `.ts` files and run them directly.

## 3. Update imports

```diff
- import { describe, it, expect, jest } from '@jest/globals'
+ import { describe, it, expect, spyFn, spyOn, restoreAllMocks } from '@igorjs/pure-test'
```

## 4. Replace jest namespace calls

```diff
  // jest.fn() → spyFn()
- const callback = jest.fn()
+ const callback = spyFn()

  // jest.fn(impl) → spyFn(impl)
- const double = jest.fn((x) => x * 2)
+ const double = spyFn((x) => x * 2)

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

  // afterEach cleanup
  afterEach(() => {
-   jest.restoreAllMocks()
+   restoreAllMocks()
  })
```

## 5. Mock instance methods (no changes needed)

These work identically in Jest and Pure Test:

```ts
spy.mockReturnValue(42)
spy.mockReturnValueOnce(1)
spy.mockImplementation(() => 'hi')
spy.mockImplementationOnce(() => 'once')
spy.mockResolvedValue({ data: 'ok' })
spy.mockResolvedValueOnce('first')
spy.mockRejectedValue(new Error('fail'))
spy.mockRejectedValueOnce(new Error('once'))
spy.mockClear()
spy.mockReset()
spy.mockRestore()
spy.mock.calls
spy.mock.results
spy.mock.lastCall
```

## 6. Remove jest.config.js

Pure Test has no config file. CLI args handle everything:

```bash
pure-test tests/                     # default (spec reporter)
pure-test tests/ --reporter tap      # TAP output for CI
pure-test tests/ --reporter json     # machine-readable
```

## Features not supported

These Jest features are intentionally omitted. The table explains why and what to use instead.

| Jest feature | Why not | Alternative |
|-------------|---------|-------------|
| `jest.mock('module')` | Module mocking is runtime-specific magic that requires transforms | Use dependency injection: pass dependencies as parameters |
| `jest.useFakeTimers()` | Supported | `useFakeTimers()` or `jest.useFakeTimers()` — same API |
| `jest.requireActual()` | Only needed alongside module mocking | Not needed when using dependency injection |
| Snapshot testing | File I/O, brittle, hides intent, diffs are hard to review | Write explicit assertions that document expected behavior |
| `--coverage` | Requires V8 or Istanbul integration | Use [`c8`](https://github.com/bcoe/c8) or your runtime's built-in coverage |
| `--watch` | File system watching adds complexity | Use [`watchexec`](https://github.com/watchexec/watchexec) or `nodemon` externally |
| Worker isolation | ~50ms overhead per file, unnecessary for well-written tests | Use `beforeEach`/`afterEach` for per-test setup/teardown |
| `expect.extend()` | Custom matcher API adds complexity | Use helper functions that call `expect()` internally |

## Example: before and after

### Before (Jest)

```ts
import { jest, describe, it, expect } from '@jest/globals'

describe('UserService', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetches a user', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: 1, name: 'Alice' }),
    })

    const service = createUserService(mockFetch)
    const user = await service.getUser(1)

    expect(user.name).toBe('Alice')
    expect(mockFetch).toHaveBeenCalledWith('/users/1')
  })
})
```

### After (Pure Test)

```ts
import { describe, it, expect, spyFn, restoreAllMocks, afterEach } from '@igorjs/pure-test'

describe('UserService', () => {
  afterEach(() => restoreAllMocks())

  it('fetches a user', async () => {
    const mockFetch = spyFn().mockResolvedValue({
      json: () => Promise.resolve({ id: 1, name: 'Alice' }),
    })

    const service = createUserService(mockFetch)
    const user = await service.getUser(1)

    expect(user.name).toBe('Alice')
    expect(mockFetch.mock.calls[0][0]).toBe('/users/1')
  })
})
```

---

[Back to README](../README.md)
