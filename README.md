# Pure Test

Minimal cross-runtime test runner. Zero dependencies.

> **Note:** This project is in alpha. APIs may change.

Works identically on Node.js, Deno, Bun, Cloudflare Workers, and browsers. Outputs [TAP](https://testanything.org/) format.

![Node.js](https://img.shields.io/badge/Node.js_22+-339933?logo=nodedotjs&logoColor=white)
![Deno](https://img.shields.io/badge/Deno_2.0+-000000?logo=deno&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

## Install

```bash
npm install @igorjs/pure-test --save-dev
```

## Usage

```ts
import { describe, it, expect, run } from '@igorjs/pure-test'

describe('math', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })

  it('works async', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })
})

await run()
```

Run with any runtime:

```bash
node tests/my-test.mjs
deno run --allow-all tests/my-test.mjs
bun tests/my-test.mjs
```

## API

### Test registration

| Function | Description |
|----------|-------------|
| `describe(name, fn)` | Define a test suite (nestable) |
| `it(name, fn)` / `test(name, fn)` | Define a test case (sync or async) |
| `it.skip(name, fn)` | Skip a test |
| `describe.skip(name, fn)` | Skip a suite |
| `beforeAll(fn)` | Run once before all tests in the suite |
| `afterAll(fn)` | Run once after all tests in the suite |
| `beforeEach(fn)` | Run before each test in the suite |
| `afterEach(fn)` | Run after each test in the suite |
| `run()` | Execute all tests, print TAP output, exit on failure |

### Assertions

```ts
expect(value).toBe(expected)              // strict equality (===)
expect(value).toEqual(expected)           // deep structural equality
expect(value).toBeTruthy()                // truthy check
expect(value).toBeFalsy()                 // falsy check
expect(value).toBeNull()                  // === null
expect(value).toBeUndefined()             // === undefined
expect(value).toBeDefined()               // !== undefined
expect(value).toBeInstanceOf(Class)       // instanceof check
expect(value).toBeGreaterThan(n)          // > n
expect(value).toBeLessThan(n)             // < n
expect(value).toBeGreaterThanOrEqual(n)   // >= n
expect(value).toBeLessThanOrEqual(n)      // <= n
expect(value).toContain(item)             // string.includes or array.includes
expect(value).toMatch(/regex/)            // regex match
expect(value).toHaveLength(n)             // .length === n
expect(fn).toThrow()                      // function throws
expect(fn).toThrow('message')             // throws with message containing string
expect(fn).toThrow(/pattern/)             // throws with message matching regex
```

All assertions support `.not`:

```ts
expect(1).not.toBe(2)
expect([1, 2]).not.toContain(3)
expect(() => {}).not.toThrow()
```

## Output

TAP version 14 format:

```
TAP version 14
1..5
ok 1 - math > adds numbers
ok 2 - math > works async
ok 3 - strings > trims whitespace
not ok 4 - strings > fails on purpose
  ---
  error: Expected 1 to be 2
  ...
ok 5 - skipped test # SKIP

# tests 5
# pass 3
# fail 1
# skip 1
# duration 12ms
```

## Why

Every cross-runtime test runner either adds dependencies (Vitest), only works on one runtime (node:test, Deno.test, bun:test), or requires complex configuration. Pure Test is a single import that works everywhere.

## License

[Apache-2.0](LICENSE)
