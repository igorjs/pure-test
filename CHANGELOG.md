# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-05-05

### Added
- Add describe.each for parameterised suites
- Add --bail / -b flag to stop on first failure
- Export AsymmetricMatcher type and add JSDoc to all matchers
- Add coloured terminal output to reporters
- Add diff output for failed deep equality assertions
- Add --grep / -t test name filtering
- Add test retry support
- Add test timeout support
- Add getter/setter spying via spyOn accessor parameter
- Add expect.assertions(n) and expect.hasAssertions()
- Add email and UUID validation matchers
- Add toMatchArray and toMatchUnsortedArray matchers
- Complete Jest/Vitest matcher parity
- Add toMatchObject, toHaveProperty, toStrictEqual, and asymmetric matchers
- Add toHaveBeenCalled spy assertion matchers

### Fixed
- Validate UUID variant nibble per RFC 9562

### Changed
- Benchmark and update performance claims in README

## [0.2.0] - 2026-05-06

### Added

#### Test Registration
- `it.only` / `describe.only` for focused test execution
- `it.todo` for documenting planned tests
- `it.each` / `describe.each` for parameterised data-driven tests
- Test timeout: `it('name', fn, 5000)` or `it('name', fn, { timeout: 5000 })`
- Test retry: `it('name', fn, { retry: 3 })`
- `--grep` / `-g` / `--testNamePattern` / `-t` for test name filtering (regex)
- `--bail` / `-b` to stop on first failure
- `setGrep()` and `setBail()` programmatic APIs

#### Fake Timers
- `useFakeTimers()` / `useRealTimers()` with full config (`now`, `toFake`, `loopLimit`)
- `advanceTimersByTime()`, `runAllTimers()`, `runOnlyPendingTimers()`
- `setSystemTime()`, `getRealSystemTime()`, `getTimerCount()`
- Fake `Date` (subclass preserving `instanceof`), `performance.now()`
- `restoreAllMocks()` also restores real timers
- Cross-runtime: works on Node, Deno, Bun, Workers

#### Assertions (complete Jest/Vitest parity)
- `toBeNaN()`, `toBeCloseTo()`, `toBeTypeOf()`, `toSatisfy()`
- `toContainEqual()`, `toMatchArray()`, `toMatchUnsortedArray()`
- `toMatchObject()`, `toHaveProperty()`, `toStrictEqual()`
- `toHaveBeenCalled()`, `toHaveBeenCalledTimes()`, `toHaveBeenCalledWith()`
- `toHaveBeenLastCalledWith()`, `toHaveBeenNthCalledWith()`
- `toHaveReturned()`, `toHaveReturnedTimes()`, `toHaveReturnedWith()`
- `toHaveLastReturnedWith()`, `toHaveNthReturnedWith()`
- `toBeEmail()`, `toBeUUID(version?)` with RFC 9562 validation
- `.resolves` / `.rejects` promise modifiers
- `expect.assertions(n)`, `expect.hasAssertions()`

#### Asymmetric Matchers
- `expect.any()`, `expect.anything()`
- `expect.stringContaining()`, `expect.stringMatching()`
- `expect.objectContaining()`, `expect.arrayContaining()`
- `expect.closeTo()`, `expect.email()`, `expect.uuid()`
- `expect.not.arrayContaining()`, `expect.not.objectContaining()`
- `expect.not.stringContaining()`, `expect.not.stringMatching()`

#### Mocking
- `vi` and `jest` namespace drop-ins for migration
- Getter/setter spying: `spyOn(obj, 'prop', 'get'|'set')`
- Timer functions on `vi.*` / `jest.*` namespaces

#### DX
- Coloured terminal output (respects `NO_COLOR`)
- Diff output for failed deep equality assertions
- JSDoc on all 40+ `Expectation` methods for IDE tooltips
- Export `AsymmetricMatcher` type for consumers

### Fixed
- Validate reporter flag in CLI
- UUID validation per RFC 9562 (variant nibble check)

### Changed
- Project status from alpha to beta
- Updated performance claims with real benchmarks (236 tests in ~80-100ms)
- Moved fake timers from "never support" to supported (cross-runtime concern debunked)

## [0.1.0] - 2026-05-04

### Added
- Vitest-compatible mock API (fn, spyOn, vi namespace)
- Add mocking utilities (fn, spyOn, mock, mockDeep, restoreAll)
- Add CLI runner, auto-run, concurrent mode, and reporters
- Initial release of @igorjs/pure-test

### Fixed
- Sync lockfile specifier with pinned biome version
- Close unclosed else block in release script

[0.3.0]: https://github.com/igorjs/pure-test/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/igorjs/pure-test/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/igorjs/pure-test/releases/tag/v0.1.0
