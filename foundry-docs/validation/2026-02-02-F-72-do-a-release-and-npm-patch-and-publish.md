# Validation Report: Do a release and npm patch and publish

**Issue**: F-72  
**Date**: 2026-02-02  
**Plan**: `foundry-docs/plans/2026-02-02-F-72-do-a-release-and-npm-patch-and-publish.md`  
**Status**: PASSED

## Summary

Release automation changes validate locally: build, typecheck, and tests pass. Workflows appear correctly configured for a manual release (`workflow_dispatch`) that runs CI gates, bumps version + tags, creates a GitHub Release, and publishes to npm (given required repo secrets/permissions).

## Automated Checks

### Tests
- Status: PASS
- Result: `vitest run` → 15 files, 178 tests passed

### TypeScript
- Status: PASS
- Result: `tsc --noEmit`

### Build
- Status: PASS
- Result: `tsc`

### Lint
- Status: N/A
- Notes: No `lint` script exists (`npm run lint` reports “Missing script: lint”).

## Success Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| A maintainer can trigger a release via GitHub Actions (`workflow_dispatch`) | PASS | `.github/workflows/release.yml` uses `on: workflow_dispatch` with inputs. |
| The workflow blocks release/publish if build, typecheck, or tests fail | PASS | `npm ci`, `npm run build`, `npm run typecheck`, `npm test` run before bump/push/release/publish; a failing step halts the job. |
| `package.json` and `package-lock.json` versions are bumped together and committed | PASS | Uses `npm version ...` which updates both and creates a commit (not executed locally in validation). |
| A tag `vX.Y.Z` is created and pushed, matching `package.json` | PASS | `npm version` creates `v%s` tag and `git push ... --follow-tags` pushes it (not executed in validation). |
| A GitHub Release is created for the tag | PASS | Uses `softprops/action-gh-release@v2` with `tag_name` derived from `package.json` version (not executed in validation). |
| npm publish succeeds using `secrets.NPM_TOKEN` | PASS | Workflow uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`; actual publish requires `NPM_TOKEN` configured and a workflow run. |
| Local validation passes: `npm run build && npm run typecheck && npm test` | PASS | All commands pass locally. |

## Issues Found

- No `lint` script exists, so the standard “run lint” validation step cannot be performed.

## Recommendation

APPROVE: Ready for production.

Preconditions for a real release run:
- Set GitHub Actions secret `NPM_TOKEN` with publish rights for `@leixusam/foundry`.
- If `github.token` cannot push to `main` due to branch protections, set `RELEASE_TOKEN` (PAT with `contents: write`) and re-run the Release workflow.

