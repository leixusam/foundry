# Implementation Plan: use the release cicd to patch a version and publish

**Issue**: F-75  
**Date**: 2026-02-02  
**Research**: `foundry-docs/research/2026-02-02-F-75-use-the-release-cicd-to-patch-a-version-and-publish.md`  
**Specification**: N/A  
**Status**: Ready for Implementation

## Overview

This issue is process/documentation work: turn the existing GitHub Actions release automation into a clear, repeatable “patch release” checklist (what inputs to set, what outputs to expect, and how to recover from partial failures).

The repository already contains:
- `.github/workflows/release.yml`: end-to-end release workflow (CI gates → bump/tag → GitHub Release → npm publish)
- `.github/workflows/publish.yml`: manual recovery workflow (publish an existing tag/ref)
- `README.md`: maintainer release instructions aligned with the Actions flow
- `CLAUDE.md`: outdated manual release instructions (needs update)

## Success Criteria

- [ ] Maintainer checklist exists for doing a patch release via GitHub Actions (inputs + expected artifacts)
- [ ] Recovery path is documented for “tag exists but publish failed” and “publish succeeded but release creation failed”
- [ ] `CLAUDE.md` release guidance matches the Actions-based process (no outdated local/manual steps)
- [ ] Local CI parity checks pass: `npm run build && npm run typecheck && npm test`

## Phases

### Phase 1: Write the patch-release checklist (Actions-based)

**Goal**: Provide a step-by-step checklist that a maintainer can follow without guessing.

**Changes**:
- `README.md`: expand the “Releasing (Maintainers)” section with a concise checklist that includes the workflow inputs (`release_type`, `npm_tag`, `dry_run`), prerequisites, and expected outputs.
  - If we prefer to keep README short, add a “More details” subsection and keep the existing bullets intact.

**Checklist content (to add verbatim or close to it)**:

**Preflight**
1. Confirm `NPM_TOKEN` secret exists in GitHub repo settings and has publish rights for `@leixusam/foundry`.
2. If `main` is protected against workflow pushes, confirm `RELEASE_TOKEN` exists (PAT or GitHub App token) and has `contents: write`.
3. Confirm no concurrent release run is in progress (workflow uses `concurrency: release`).

**Optional dry run**
1. GitHub → Actions → `Release` → Run workflow (branch `main`)
2. Inputs:
   - `release_type`: `patch`
   - `npm_tag`: `latest`
   - `dry_run`: `true`
3. Expectation: build/typecheck/tests run and pass; no tag, commit, GitHub Release, or npm publish is created.

**Real patch release**
1. GitHub → Actions → `Release` → Run workflow (branch `main`)
2. Inputs:
   - `release_type`: `patch`
   - `npm_tag`: `latest` (or another dist-tag if intentionally publishing under it)
   - `dry_run`: `false`
3. Expected outputs:
   - A commit on `main` with message like `chore(release): vX.Y.Z`
   - A git tag `vX.Y.Z` pushed to the repo
   - A GitHub Release created for `vX.Y.Z` (release notes auto-generated)
   - `@leixusam/foundry@X.Y.Z` published to npm under the chosen dist-tag

**Recovery / re-publish existing tag**
1. If the `Release` workflow pushed a tag/commit but npm publish failed:
   - Re-run publishing via GitHub → Actions → `Publish existing ref to npm`
   - Inputs:
     - `ref`: the tag (e.g. `vX.Y.Z`)
     - `npm_tag`: `latest` (or the intended dist-tag)
2. If npm publish succeeded but GitHub Release creation failed:
   - Re-run only the release creation step (via UI or `gh release create vX.Y.Z --generate-notes`).

**Rollback guidance (only if necessary)**
- If a tag was created but should not exist (and npm publish did not occur), delete it:
  - `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
  - Delete the GitHub Release for that tag (UI).

**Verification**:
```bash
# Local parity checks (optional but fast and catches obvious failures)
npm ci
npm run build
npm run typecheck
npm test
```

### Phase 2: Update `CLAUDE.md` to match the real release process

**Goal**: Remove outdated manual instructions to prevent maintainers (and agents) from following incorrect steps.

**Changes**:
- `CLAUDE.md`: replace the current “Releasing” section (manual `npm version` / `gh release create`) with:
  - A pointer to the Actions-based release flow (same as README, but shorter)
  - A note that `.github/workflows/publish.yml` is a manual recovery workflow (not an automatic trigger on GitHub Release events)

**Verification**:
```bash
# Ensure docs match reality
rg -n "Releasing|publish\\.yml|release\\.yml|npm version" README.md CLAUDE.md .github/workflows/release.yml .github/workflows/publish.yml
```

## Testing Strategy

- Documentation-only changes:
  - Run `npm run build && npm run typecheck && npm test` locally to confirm the repository remains in a releasable state.
  - Validate the docs by cross-checking the workflow names and inputs against `.github/workflows/release.yml` and `.github/workflows/publish.yml`.

## Rollback Plan

- If documentation changes are incorrect: revert the doc commit(s) on `main` (or fix-forward with a follow-up doc patch).
- If a real release run (outside this repo work) goes wrong:
  - Prefer fix-forward with a new patch release.
  - Use `Publish existing ref to npm` for recovery when a tag exists but publish failed.

## Notes

- `release.yml` pushes directly to `main`. Whether this works depends on branch protection settings and token permissions.
- The `Release` workflow supports:
  - `release_type`: `patch|minor|major`
  - `npm_tag`: dist-tag (default `latest`)
  - `dry_run`: run CI gates only

