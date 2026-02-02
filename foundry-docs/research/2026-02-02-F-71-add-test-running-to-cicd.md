# Research: add test running to cicd

**Issue**: F-71  
**Date**: 2026-02-02  
**Status**: Complete

## Summary

CI/CD currently installs dependencies and runs `build` + `typecheck`, but it does not execute the project’s Vitest unit tests. This issue should add `npm test` (Vitest) to the CI workflow (PRs + main) and to the publish/release workflow so tests gate releases.

## Requirements Analysis

The ticket has no description, so requirements are inferred from the title and existing repo conventions:

- Ensure tests run in CI for pull requests and `main` pushes.
- Ensure tests run before publishing a release (so we don’t publish broken builds).
- Keep changes minimal and aligned with existing npm scripts.

## Codebase Analysis

### Relevant Files
- `.github/workflows/ci.yml` - current CI pipeline; runs `npm ci`, `npm run build`, `npm run typecheck` but no tests.
- `.github/workflows/publish.yml` - release publishing pipeline; runs `npm ci`, `npm run build`, `npm run typecheck`, then `npm publish`; no tests.
- `package.json` - defines `test` as `vitest run` and `typecheck` as `tsc --noEmit`.
- `vitest.config.ts` - Vitest config; includes `src/**/*.test.ts` with `environment: 'node'`.
- `src/lib/__tests__/*.test.ts` - existing unit test suite.

### Existing Patterns
- Workflows use `actions/setup-node@v4` with `cache: npm` (CI) and Node `20`.
- Tasks are executed as npm scripts (`npm run build`, `npm run typecheck`), so tests should follow the same pattern (`npm test` / `npm run test`).

### Dependencies
- Tests run via `vitest` (dev dependency).
- Workflows already use `npm ci`, so `vitest` is available in CI.

## Implementation Considerations

### Approach
- Add a `- run: npm test` step to `.github/workflows/ci.yml` after `npm ci` (order relative to build/typecheck is flexible; simplest is after typecheck or after build).
- Add a `- run: npm test` step to `.github/workflows/publish.yml` before `npm publish`.

Recommended sequencing:
1. `npm ci`
2. `npm run typecheck` (fast failure on TS errors)
3. `npm test`
4. `npm run build` (or build before tests; either is fine since tests run from `src/`)

### Risks
- If any tests depend on environment variables, network access, or local git state, they may be flaky in CI. (Current tests appear to be unit tests under `src/lib/__tests__`.)
- Some projects require `NODE_OPTIONS` or extra flags for ESM/test runners, but the repo already uses Vitest successfully locally via `npm test`, so this is unlikely.

### Testing Strategy
- Locally: `npm test` to confirm Vitest passes; optionally also run `npm run typecheck` and `npm run build`.
- In CI: ensure workflows include the test step and fail the job if tests fail.

## Specification Assessment

This is CI/CD plumbing with no user-facing UX.

**Needs Specification**: No

## Questions for Human Review

- Should publish/release be gated on *both* tests and build/typecheck, or is build/typecheck already sufficient? (Recommendation: keep build/typecheck and add tests.)
- Is there a preferred ordering for steps (tests before/after build)?

## Next Steps

Ready for planning/implementation: update GitHub Actions workflows to run `npm test` in CI and publish pipelines.

