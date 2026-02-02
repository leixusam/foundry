# Research: Use the release CI/CD to patch a version and publish

**Issue**: F-75  
**Date**: 2026-02-02  
**Status**: Complete

## Summary

This repo already has a GitHub Actions release workflow that runs CI gates, bumps the npm version (`patch|minor|major`), pushes the version commit + tag to `main`, creates a GitHub Release, and publishes to npm. F-75 appears to be asking to use that workflow (instead of a local manual release process) to perform a patch release.

## Requirements Analysis

From the issue title:
- “use the release cicd”
  - Prefer GitHub Actions workflows over local `npm version` / `npm publish`.
- “to patch a version and publish”
  - The flow should bump `package.json`/`package-lock.json` to the next patch version, tag it as `vX.Y.Z`, create a GitHub Release, and publish `@leixusam/foundry` to npm.

Implicit success criteria:
- CI gates (build/typecheck/test) run before publishing.
- Publishing uses repo secrets (`NPM_TOKEN`) and works under common branch protection constraints (or documents what’s required).
- If a release partially fails (e.g., tag exists but publish fails), there’s a recovery path.

## Codebase Analysis

### Relevant Files
- `.github/workflows/release.yml` - End-to-end release: CI gates → `npm version` bump → push tag/commit → GitHub Release → `npm publish`.
- `.github/workflows/publish.yml` - Manual recovery workflow: publish an existing ref (e.g., a tag like `v0.1.10`) to npm after running CI gates.
- `package.json` / `package-lock.json` - Version source of truth; `npm version` updates both.
- `README.md` - Maintainer release instructions (already reference the `Release` workflow).
- `CLAUDE.md` - Contains older “manual release” instructions that no longer match the current workflows.

### Existing Patterns
- CI gating is consistent across workflows: `npm ci`, `npm run build`, `npm run typecheck`, `npm test` all run before any publish.
- Release is intentionally manual (`workflow_dispatch`) with inputs:
  - `release_type`: `patch|minor|major` (default `patch`)
  - `npm_tag`: dist-tag to publish under (default `latest`)
  - `dry_run`: skip version/tag/release/publish while still running CI gates

### Dependencies
- GitHub Actions secrets:
  - `NPM_TOKEN` (required) for `npm publish`
  - `RELEASE_TOKEN` (optional) PAT/token with `contents: write` if `github.token` can’t push to `main` due to branch protections
- npm registry authentication and publish rights for `@leixusam/foundry`

## Implementation Considerations

### Approach

Use `.github/workflows/release.yml`:
- Start with `dry_run: true` if you want to verify CI gates without creating a tag/publishing.
- For a real patch release:
  - `release_type: patch`
  - `npm_tag: latest` (or another dist-tag if needed)

Recovery:
- If a release run fails after the tag was created (or if you want to publish a previously created tag), use `.github/workflows/publish.yml` with `ref: vX.Y.Z`.

### Risks
- **Branch protection**: the release workflow pushes directly to `main`; it may require `RELEASE_TOKEN` to bypass restrictions.
- **Already-published version**: npm publish fails if the version exists; ensure the bump produces a new version.
- **Secret availability**: missing/invalid `NPM_TOKEN` causes publish to fail late in the workflow.

### Testing Strategy
- Primary verification is via GitHub Actions logs for the `Release` workflow run (CI gates + publish steps).
- Local sanity checks (optional):
  - `npm ci && npm run build && npm run typecheck && npm test`

## Specification Assessment

No UX changes; this is release/infrastructure process work.

**Needs Specification**: No

## Questions for Human Review

- Should F-75 result in an actual patch release being executed now (e.g., `0.1.10`), or is the goal only to confirm/document the process?
- Is `main` protected such that workflow pushes require a PAT (`RELEASE_TOKEN`)?
- Which npm dist-tag should be used for the next publish (`latest` vs pre-release tags)?

## Next Steps

Ready for planning phase: decide whether to (a) run the `Release` workflow for a patch publish now, and (b) update `CLAUDE.md` to reflect the current release process (Actions-based) to avoid maintainers following outdated manual instructions.

