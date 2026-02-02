# Implementation Plan: Do a release and npm patch and publish

**Issue**: F-72  
**Date**: 2026-02-02  
**Research**: `foundry-docs/research/2026-02-02-F-72-do-a-release-and-npm-patch-and-publish.md`  
**Specification**: N/A  
**Status**: Implementation Complete

## Overview

Implement a GitHub Actions release workflow that:

1. Runs the same CI gates as `CI` (build, typecheck, tests)
2. Bumps the npm package version (default `patch`)
3. Creates and pushes a git tag (e.g. `v0.1.10`) and the matching version commit
4. Creates a GitHub Release for that tag
5. Publishes `@leixusam/foundry` to npm

This should be fully runnable from GitHub Actions (no local `npm version` / `npm publish` required).

## Success Criteria

- [ ] A maintainer can trigger a release via GitHub Actions (`workflow_dispatch`)
- [ ] The workflow blocks release/publish if build, typecheck, or tests fail
- [ ] `package.json` and `package-lock.json` versions are bumped together and committed
- [ ] A tag `vX.Y.Z` is created and pushed, matching `package.json`
- [ ] A GitHub Release is created for the tag
- [ ] npm publish succeeds using `secrets.NPM_TOKEN`
- [ ] Local validation passes: `npm run build && npm run typecheck && npm test`

## Phases

### Phase 1: Decide Release Constraints (Protected Branch vs Direct Push)

**Goal**: Choose a workflow strategy that works with the repo’s branch protection settings.

**Decision**:
- **Preferred**: single workflow that bumps + tags + releases + publishes in one run (recommended by research)
- **Fallback** (if `main` cannot be pushed to by Actions): switch to a PR-based bump workflow (out of scope unless needed)

**Checks / Preconditions**:
- Repository has `NPM_TOKEN` secret configured with publish rights for `@leixusam/foundry`.
- GitHub Actions can push a commit + tag to `main` (either:
  - branch protection allows “GitHub Actions” to bypass, or
  - use a PAT/GitHub App token stored as a secret for pushing).

**Verification**:
```bash
# No repo changes in this phase; verify by confirming repo settings + secrets.
```

### Phase 2: Add a Release Workflow (Bump + Tag + Release + Publish)

**Goal**: Add `.github/workflows/release.yml` that performs the complete release in one run.

**Changes**:
- `.github/workflows/release.yml`: new workflow triggered by `workflow_dispatch` with inputs:
  - `release_type`: `patch|minor|major` (default `patch`)
  - optional `npm_tag`: `latest` (default) for future flexibility
  - optional `dry_run`: if added, skips pushing/tagging/release/publish but still runs CI gates (optional; only if low-risk to add)

**Implementation details**:
- Use `actions/checkout@v4` with `fetch-depth: 0` (tag operations).
- Use `actions/setup-node@v4` with a Node version compatible with `package.json#engines` (Node 20 is fine; Node 18+ required).
- Run gates: `npm ci`, `npm run build`, `npm run typecheck`, `npm test`.
- Configure git identity in workflow before versioning:
  - `git config user.name "github-actions[bot]"`
  - `git config user.email "github-actions[bot]@users.noreply.github.com"`
- Run `npm version $release_type` to update `package.json` + `package-lock.json`, create a commit, and create tag `vX.Y.Z`.
  - Set a consistent commit message, e.g. `chore(release): v%s`.
- Push commit and tags back to `main`:
  - `git push origin HEAD:main --follow-tags`
- Create a GitHub Release for the tag:
  - Use `gh release create` or a standard action (e.g. `softprops/action-gh-release`) with generated notes.
- Publish to npm:
  - `npm publish --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
- Add `concurrency` to prevent multiple releases running simultaneously.
- Set explicit workflow permissions:
  - `contents: write` (required for pushing tags and creating releases)
  - `id-token: write` only if adopting npm provenance later (optional)

**Verification**:
```bash
# Local parity checks (developer machine)
npm ci
npm run build
npm run typecheck
npm test

# GitHub Actions
# - Trigger workflow on main with release_type=patch
# - Confirm: version bump commit + tag pushed, release created, npm publish succeeded
```

### Phase 3: Remove or Re-scope Existing Publish Workflow + Document the Process

**Goal**: Avoid double-publishing and make the release flow easy to follow.

**Changes**:
- `.github/workflows/publish.yml`: either remove it or re-scope it to a manual-only “publish existing tag” emergency workflow.
  - Rationale: the current `on: release: published` approach is fragile when releases are created by workflows.
- `README.md` (or `foundry-docs/README.md`): document:
  - how to trigger a release workflow
  - required secrets/permissions
  - what the workflow does (bump/tag/release/publish)
  - what to do if a release fails midway (see Rollback Plan)

**Verification**:
```bash
# Confirm workflows are present/updated and docs explain release steps.
git status
```

## Testing Strategy

- Local: `npm ci && npm run build && npm run typecheck && npm test` before pushing workflow changes.
- GitHub: trigger release workflow on `main` and confirm:
  - CI gates pass
  - version bump commit + tag are pushed
  - GitHub Release exists for that tag
  - npm registry shows the new version

## Rollback Plan

If the workflow fails **before** npm publish:
- Re-run the workflow after fixing the cause.
- If a tag was pushed but no publish happened, delete the tag and release:
  - `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
  - delete GitHub Release for the tag (UI or `gh release delete`).

If npm publish succeeded but GitHub Release failed:
- Re-run only the “create release” portion (manual `gh release create`) for the already-published version/tag.

If npm publish succeeded with an incorrect artifact:
- Publish a new patch version with the fix (npm unpublish is time-limited and disruptive; avoid unless necessary).

## Notes

- The existing `.github/workflows/publish.yml` is triggered by `release: published`; this plan intentionally avoids relying on cross-workflow triggers.
- If `main` is protected from workflow pushes, implementation should either:
  - adjust branch protection to permit GitHub Actions to push release commits/tags, or
  - switch to a PR-based bump approach (not preferred; only if required).

## Implementation Notes (2026-02-02)

- Added `.github/workflows/release.yml` to run CI gates, bump `npm` version, push tag/commit, create a GitHub Release, and publish to npm.
- Re-scoped `.github/workflows/publish.yml` to an emergency manual workflow (“publish existing ref”) to avoid double-publishing.
- Documented maintainer release steps in `README.md`.
