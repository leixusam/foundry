# Research: add additional test coverage

**Issue**: F-70
**Date**: 2026-02-02
**Status**: Complete

## Summary

The ticket has no description, but based on the current repo state (post F-69), the most impactful “additional test coverage” is to cover the remaining unit-testable modules that are currently untested (notably `update-checker`, `gcp`, and `readline`). This research identifies the remaining coverage gaps, proposes concrete test cases, and flags an existing test fragility around `.foundry/env` being present during test runs.

## Requirements Analysis

No explicit requirements were provided in the issue. Reasonable interpretation:
- Add unit tests for modules that currently have no tests but are feasible to test without requiring external CLIs or real network calls.
- Prefer deterministic tests: mock `fetch`, `fs`, `child_process`, and interactive I/O.
- Keep changes aligned with existing Vitest patterns in `src/lib/__tests__`.

Success criteria (suggested):
- New tests added for at least 2–3 currently-untested modules.
- Tests cover happy paths and key failure/edge cases (timeouts, missing metadata, invalid input).
- `npm test` passes in a typical developer/CI environment.

## Codebase Analysis

### Current Test Setup
- Framework: Vitest (`vitest.config.ts` uses `environment: 'node'`)
- Tests live under `src/**` and match `src/**/*.test.ts`
- Existing established patterns:
  - `vi.mock()` before importing module under test
  - `vi.resetModules()` + dynamic `import()` when testing import-time behavior (e.g., config)
  - Typed mocks via `vi.mocked(...)`

### Remaining Untested Modules (heuristic: no matching `__tests__/{name}.test.ts`)
- `src/lib/update-checker.ts`
- `src/lib/gcp.ts`
- `src/lib/readline.ts`
- `src/lib/linear-api.ts` (mock-heavy, but many functions are unit-testable)
- `src/lib/setup.ts`, `src/lib/init-project.ts` (large orchestration modules)
- `src/lib/claude.ts`, `src/lib/codex.ts` (spawn external CLIs; unit tests likely limited unless refactored for dependency injection)

### Relevant Files (high value / low effort)
- `src/lib/update-checker.ts` - cache logic + registry fetch + notification printing
- `src/lib/gcp.ts` - metadata detection + stop command orchestration
- `src/lib/readline.ts` - prompt/confirm/selectFromList flow

### Integration Points
- `src/index.ts` calls:
  - `checkForUpdates()` and `displayUpdateNotification()` at startup
  - `isRunningOnGcp()` / `stopGcpInstance()` when “no work” and `gcpAutoStop` enabled

## Implementation Considerations

### Approach

Add focused unit tests for the remaining “easy-to-test” modules without changing runtime behavior:

1) `src/lib/__tests__/update-checker.test.ts`
   - Mock `./version.js` to control `getVersion()` / `getPackageName()`
   - Mock `fs` (`existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`) to simulate cache presence and writes
   - Mock `globalThis.fetch` to simulate npm registry responses (success, non-200, timeout/error)
   - Use `vi.useFakeTimers()` / `vi.setSystemTime()` to test cache freshness (24h TTL)
   - Key cases:
     - Uses cached result when `now - lastCheck < 24h` (no fetch)
     - Fetches + writes cache when stale or absent
     - Returns `latestVersion: null` and `updateAvailable: false` when fetch fails
     - `displayUpdateNotification()` prints only when `updateAvailable` is true

2) `src/lib/__tests__/gcp.test.ts`
   - Mock `globalThis.fetch` to return Response-like objects for:
     - metadata root (flavor header)
     - `instance/name` and `instance/zone`
   - Mock `child_process.execSync` to avoid running `gcloud`
   - Key cases:
     - `isRunningOnGcp()` true when `Metadata-Flavor` is `Google`
     - `isRunningOnGcp()` false on fetch error/timeout
     - `stopGcpInstance()` returns false when instance name or zone is missing / non-OK response
     - `stopGcpInstance()` returns true and calls `execSync` with expected command when both values are present

3) `src/lib/__tests__/readline.test.ts`
   - Mock `readline.createInterface()` to return an object with `question()` + `close()`
   - Key cases:
     - `prompt()` trims whitespace and closes interface
     - `confirm()` recognizes `y`/`yes` in any casing
     - `selectFromList()` retries on invalid input and returns selected option on valid input

Optional (if more coverage is desired in this ticket):
- `src/lib/__tests__/linear-api.test.ts` to cover pure-ish helpers:
  - `getFoundryStatusNames()` (pure)
  - `checkFoundryStatusesExist()` by stubbing `listWorkflowStates()`
  - More complex functions can be covered with a minimal mocked `LinearClient` shape

### Risks / Gotchas

- **Import-time side effects in config**: `src/config.ts` reads `.foundry/env` at module load. In environments where `.foundry/env` exists (like this workspace), `npm test` can become non-deterministic unless tests mock `fs.existsSync/readFileSync` for that path or the test harness ensures `.foundry/env` is absent.
- **ESM mocking order**: keep `vi.mock(...)` calls at top of test file (before importing the module under test), and prefer dynamic imports when the module reads global state on import.
- **Node fetch types**: for strict TS tests, return Response-like objects or cast `as unknown as Response` where needed.

### Testing Strategy
- Run `npm test` with a clean environment (no `.foundry/env` influencing defaults), or adjust `config.test.ts` to mock/ignore `.foundry/env` explicitly.
- If adding new tests, follow existing repository patterns:
  - do not introduce new dependencies
  - prefer unit tests with mocks over integration tests requiring external CLIs

## Specification Assessment

No UX specification needed (tests-only change).

**Needs Specification**: No

## Questions for Human Review

1) Which remaining modules should be prioritized for coverage beyond `update-checker`, `gcp`, and `readline` (e.g., `linear-api` vs. `setup/init-project`)?
2) Should tests be hardened to ignore local `.foundry/env` by default (mocking in `config.test.ts`) so `npm test` is deterministic in dev environments?
3) Do we want to add Vitest coverage reporting / thresholds, or keep scope to “add tests only”?

## Next Steps

Ready for planning phase with a scoped plan to:
- add tests for `update-checker`, `gcp`, `readline`
- optionally harden config tests against `.foundry/env` side effects

