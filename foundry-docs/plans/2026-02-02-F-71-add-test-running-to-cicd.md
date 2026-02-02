# Implementation Plan: add test running to cicd

**Issue**: F-71  
**Date**: 2026-02-02  
**Research**: `foundry-docs/research/2026-02-02-F-71-add-test-running-to-cicd.md`  
**Specification**: N/A  
**Status**: Ready for Implementation

## Overview

Update GitHub Actions workflows so Vitest unit tests run in CI (PRs + `main`) and in the release publish workflow, ensuring broken tests block merges and prevent `npm publish`.

## Success Criteria

- [ ] CI workflow runs `npm test` on PRs and `main` pushes
- [ ] Publish workflow runs `npm test` before `npm publish`
- [ ] Local tests pass: `npm test`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Build passes: `npm run build`

## Phases

### Phase 1: Run tests in CI workflow

**Goal**: Ensure PRs and `main` pushes are gated by `npm test` (Vitest).

**Changes**:
- `.github/workflows/ci.yml`: add a `- run: npm test` step (after dependency install and existing build/typecheck steps)

**Verification**:
```bash
npm ci
npm run build
npm run typecheck
npm test
```

### Phase 2: Run tests in publish workflow

**Goal**: Ensure releases do not publish to npm when tests fail.

**Changes**:
- `.github/workflows/publish.yml`: add a `- run: npm test` step before the `npm publish` step

**Verification**:
```bash
npm ci
npm run build
npm run typecheck
npm test
```

## Testing Strategy

- Use existing unit tests run by `vitest run` via `npm test`.
- Validate locally with `npm test` plus `npm run build` and `npm run typecheck` to match CI.
- Confirm workflows fail when tests fail by observing the GitHub Actions run on a PR (CI) and on a release publish event (publish workflow).

## Rollback Plan

- Revert the workflow change commit(s) on `main`, or remove the `npm test` steps from `.github/workflows/ci.yml` and `.github/workflows/publish.yml` if tests become flaky and are blocking releases.

## Notes

- Current workflows use Node.js 20; the package supports Node >= 18, so running CI on Node 20 is compatible.
- The publish workflow is triggered on GitHub Release publish; adding tests will gate `npm publish` (but not the creation of the GitHub Release itself).

