# Migrating from Vitest

A step-by-step guide to porting your test suite from Vitest to Pure Test.

## 1. Update package.json

```diff
  "scripts": {
-   "test": "vitest run"
+   "test": "pure-test tests/"
  }
```

## 2. Rename test files

Vitest uses Vite transforms to handle `.ts` files. Pure Test requires `.mjs` or runtime-native TypeScript (Deno, Bun).

```bash
# Rename .test.ts → .test.mjs
for f in $(find tests -name '*.test.ts'); do
  mv "$f" "${f%.ts}.mjs"
done
```

If using Deno or Bun, you can keep `.ts` files and run them directly.

## 3. Update imports

```diff
- import { describe, it, expect, vi } from 'vitest'
+ import { describe, it, expect, spyFn, spyOn, restoreAllMocks, clearAllMocks, resetAllMocks } from '@igorjs/pure-test'
```

## 4. Replace vi namespace calls

```diff
  // vi.fn() → spyFn()
- const spy = vi.fn()
+ const spy = spyFn()

  // vi.fn(impl) → spyFn(impl)
- const double = vi.fn((x) => x * 2)
+ const double = spyFn((x) => x * 2)

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

## 5. Mock instance methods (no changes needed)

These work identically in Vitest and Pure Test:

```ts
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

## 6. Remove vitest.config.ts

Pure Test has no config file. CLI args handle everything:

```bash
pure-test tests/                     # default (spec reporter)
pure-test tests/ --reporter tap      # TAP output for CI
pure-test tests/ --reporter json     # machine-readable
```

## 7. Replace vi.globals with explicit imports

If your Vitest config uses `globals: true` (auto-injects `describe`/`it`/`expect`), you need to add explicit imports:

```diff
+ import { describe, it, expect } from '@igorjs/pure-test'

  describe('math', () => {
    it('adds', () => {
      expect(1 + 1).toBe(2)
    })
  })
```

## Features supported (no porting needed)

Most of the Vitest API works as-is. These are supported by pure-test:

| Vitest feature | pure-test equivalent |
|---|---|
| `vi.useFakeTimers()` | `useFakeTimers()` or `vi.useFakeTimers()` — same API |
| `vi.stubEnv(key, value)` | `vi.stubEnv()` — auto-restored by `restoreAllMocks()` |
| `vi.stubGlobal(key, value)` | `vi.stubGlobal()` — auto-restored by `restoreAllMocks()` |
| `expect.extend(matchers)` | `expect.extend()` — Proxy-dispatched, `.not` aware |
| `--watch` | `pure-test --watch` — re-spawns child process per change |
| `--testTimeout <ms>` | `pure-test --testTimeout 5000` |
| `--testPathPattern <regex>` | `pure-test --testPathPattern "auth"` |
| `--shard <i>/<n>` | `pure-test --shard 1/4` |
| `--passWithNoTests` | `pure-test --passWithNoTests` |
| `--listTests` | `pure-test --listTests` |
| `--clearMocks` / `--resetMocks` / `--restoreMocks` | Same flags |

## Features not supported

These Vitest features are intentionally omitted. The table explains why and what to use instead.

| Vitest feature | Why not | Alternative |
|-------------|---------|-------------|
| `vi.mock('module')` | Module mocking requires transform hooks that are runtime-specific | Use dependency injection: pass dependencies as parameters |
| `vi.hoisted()` | Only works with Vite's transform pipeline | Not needed without transforms |
| `--coverage` (built-in) | First-party coverage adds dependencies | Use [`c8`](https://github.com/bcoe/c8) on Node, `deno coverage` on Deno (per-runtime configs supported) |
| `vitest.config.ts` | Config file adds startup overhead | No config needed, use CLI args |
| Snapshot testing | File I/O, brittle, diffs obscure intent | Write explicit assertions |
| `--typecheck` | Requires tsc integration | Run `tsc --noEmit` separately |

## Example: before and after

### Before (Vitest)

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('PaymentService', () => {
  let gateway

  beforeEach(() => {
    gateway = {
      charge: vi.fn().mockResolvedValue({ id: 'tx_123', status: 'ok' }),
      refund: vi.fn().mockRejectedValue(new Error('not implemented')),
    }
  })

  afterEach(() => vi.restoreAllMocks())

  it('charges a card', async () => {
    const service = createPaymentService(gateway)
    const result = await service.processPayment(100)

    expect(result.status).toBe('ok')
    expect(gateway.charge).toHaveBeenCalledWith(100)
  })

  it('handles refund failure', async () => {
    const service = createPaymentService(gateway)
    const result = await service.processRefund('tx_123')

    expect(result.isErr).toBe(true)
  })
})
```

### After (Pure Test)

```ts
import { describe, it, expect, spyFn, restoreAllMocks, beforeEach, afterEach } from '@igorjs/pure-test'

describe('PaymentService', () => {
  let gateway

  beforeEach(() => {
    gateway = {
      charge: spyFn().mockResolvedValue({ id: 'tx_123', status: 'ok' }),
      refund: spyFn().mockRejectedValue(new Error('not implemented')),
    }
  })

  afterEach(() => restoreAllMocks())

  it('charges a card', async () => {
    const service = createPaymentService(gateway)
    const result = await service.processPayment(100)

    expect(result.status).toBe('ok')
    expect(gateway.charge.mock.calls[0][0]).toBe(100)
  })

  it('handles refund failure', async () => {
    const service = createPaymentService(gateway)
    const result = await service.processRefund('tx_123')

    expect(result.isErr).toBe(true)
  })
})
```

---

[Back to README](../README.md)
