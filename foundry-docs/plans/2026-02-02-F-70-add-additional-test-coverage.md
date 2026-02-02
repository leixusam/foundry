# Implementation Plan: add additional test coverage

**Issue**: F-70  
**Date**: 2026-02-02  
**Research**: `foundry-docs/research/2026-02-02-F-70-add-additional-test-coverage.md`  
**Specification**: N/A  
**Status**: Ready for Implementation

## Overview

Add focused, deterministic unit tests for currently-untested (or lightly-tested) library modules that are feasible to test without external CLIs or real network access. Primary targets from research are:

- `src/lib/update-checker.ts` (cache + registry fetch + notification)
- `src/lib/gcp.ts` (metadata detection + stop command orchestration)
- `src/lib/readline.ts` (prompt/confirm/select flows)

Additionally, harden tests against local developer environments where `.foundry/env` exists, since `src/config.ts` loads it at import-time and can make test runs non-deterministic.

## Success Criteria

- [ ] New unit tests added for:
  - [ ] `src/lib/update-checker.ts`
  - [ ] `src/lib/gcp.ts`
  - [ ] `src/lib/readline.ts`
- [ ] Tests cover both happy paths and key failure/edge cases (timeouts/errors, missing values, invalid input).
- [ ] Test runs are deterministic even if `.foundry/env` exists locally.
- [ ] All tests pass: `npm run test`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Build passes: `npm run build`

## Phases

### Phase 1: Stabilize tests against local `.foundry/env`

**Goal**: Ensure `npm run test` does not change behavior based on a developer’s local `.foundry/env`.

**Status**: Complete (commit `21d724e`)

**Changes**:
- `src/lib/__tests__/config.test.ts`: mock `fs.existsSync` / `fs.readFileSync` (or otherwise stub the env-path checks) so `loadFoundryEnv()` behaves as if `.foundry/env` does not exist during these tests.
  - Prefer a narrow mock: only special-case the exact env path (`join(getRepoRoot(), '.foundry', 'env')`) and delegate other paths to the real `fs` implementation.
  - Keep ESM mocking order: define `vi.mock('fs', ...)` before importing `../../config.js`.

**Verification**:
```bash
npm run test -- src/lib/__tests__/config.test.ts
```

### Phase 2: Add `update-checker` unit tests

**Goal**: Cover cache behavior (fresh vs stale), failure modes, and notification printing without network or filesystem side effects.

**Status**: Complete (commit `2183f2d`)

**Changes**:
- `src/lib/__tests__/update-checker.test.ts`: add tests for `checkForUpdates()` and `displayUpdateNotification()`.
  - Mock `./version.js` dependency via `vi.mock('../version.js', ...)` (from within `src/lib/__tests__`) to control `getVersion()` and `getPackageName()`.
  - Mock `os.homedir()` to a stable test home path (module computes cache paths at import-time).
  - Mock `fs` (`existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`) to simulate cache hits/misses and verify writes.
  - Mock `globalThis.fetch` via `vi.stubGlobal('fetch', ...)` (or `globalThis.fetch = ...`) to return:
    - success JSON with `{ version: 'x.y.z' }`
    - `ok: false` response
    - thrown error to simulate network/timeout
  - Use `vi.useFakeTimers()` + `vi.setSystemTime(...)` to deterministically test the 24h TTL check.
  - Validate `displayUpdateNotification()` only logs when `updateAvailable` is true and `latestVersion` is non-null (spy on `console.log`).

**Verification**:
```bash
npm run test -- src/lib/__tests__/update-checker.test.ts
```

### Phase 3: Add `gcp` unit tests

**Goal**: Validate metadata detection and instance stop orchestration without real metadata calls or `gcloud`.

**Changes**:
- `src/lib/__tests__/gcp.test.ts`: add tests for `isRunningOnGcp()` and `stopGcpInstance()`.
  - Mock `child_process.execSync` (pattern already used in other tests) to capture command execution without running anything.
  - Stub `globalThis.fetch` to return Response-like objects based on URL:
    - metadata root returns headers with `Metadata-Flavor: Google` for “running on GCP”
    - instance name returns text (or non-OK)
    - instance zone returns `projects/.../zones/us-central1-a` (or non-OK)
  - Test cases:
    - `isRunningOnGcp()` returns true only when response header is `Google`
    - `isRunningOnGcp()` returns false on fetch error/timeout
    - `stopGcpInstance()` returns false when name/zone is missing and logs an error
    - `stopGcpInstance()` returns true and calls `execSync` with a command containing the instance name and zone when both are present

**Verification**:
```bash
npm run test -- src/lib/__tests__/gcp.test.ts
```

### Phase 4: Add `readline` unit tests

**Goal**: Validate interactive flows deterministically by mocking the readline interface and controlling answer sequences.

**Changes**:
- `src/lib/__tests__/readline.test.ts`: add tests for `prompt()`, `confirm()`, and `selectFromList()`.
  - Mock `readline.createInterface()` to return an object with `question(cb)` and `close()`.
  - Drive multiple prompts by returning a sequence of answers (e.g., invalid selection first, then valid) to exercise recursion in `selectFromList()`.
  - Spy on `console.log` to suppress noise and to assert “invalid selection” messaging if desired.

**Verification**:
```bash
npm run test -- src/lib/__tests__/readline.test.ts
```

## Testing Strategy

- Use Vitest unit tests only (no network calls, no real filesystem writes, no external CLIs).
- Prefer ESM-safe mocking:
  - `vi.mock(...)` at top-level before importing the module under test
  - `vi.resetModules()` + dynamic `await import(...)` when module computes constants at import time (e.g., update cache paths).
- Keep mocks narrow and deterministic (special-case only the paths/URLs used by the module under test).

## Rollback Plan

- Revert the planning/implementation commits for this ticket:
  - Remove newly added test files in `src/lib/__tests__/`
  - Revert any changes made to `src/lib/__tests__/config.test.ts`
- Verify rollback by running:
```bash
npm run test
```

## Notes

- This ticket should remain “tests-only” (no runtime behavior changes required).
- Be careful with `.js` extensions in imports inside tests (ESM requirement), following existing patterns like `await import('../../config.js')`.
