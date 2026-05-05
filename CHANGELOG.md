# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-05-05

### Added
- Add cross-runtime fake timer support
- Add it.only, it.todo, it.each, and vi/jest namespaces

### Fixed
- Validate reporter flag in CLI

## [0.1.0] - 2026-05-04

### Added
- Vitest-compatible mock API (fn, spyOn, vi namespace)
- Add mocking utilities (fn, spyOn, mock, mockDeep, restoreAll)
- Add CLI runner, auto-run, concurrent mode, and reporters
- Initial release of @igorjs/pure-test

### Fixed
- Sync lockfile specifier with pinned biome version
- Close unclosed else block in release script

[0.2.0]: https://github.com/igorjs/pure-test/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/igorjs/pure-test/releases/tag/v0.1.0
