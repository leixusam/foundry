# Validation Report: create a new auto mode (in addition to merge and pr)

**Issue**: F-73  
**Date**: 2026-02-02  
**Plan**: `foundry-docs/plans/2026-02-02-F-73-create-a-new-auto-mode.md`  
**Status**: PASSED

## Summary

Validation passed for the new `auto` merge mode (now the default), including prompt fragment assembly and the `∞ Awaiting Merge` taxonomy change (reclassified to a blocked-like “human intervention” status via `type: started`) without causing quick-check wake loops.

## Automated Checks

### Tests
- Status: PASS
- Output: `vitest run` — 15 files, 180 tests passed

### TypeScript
- Status: PASS
- Errors: 0 (`tsc --noEmit`)

### Lint
- Status: N/A
- Notes: No `lint` script is configured in `package.json`.

## Success Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| `FOUNDRY_MERGE_MODE` supports: `auto`, `merge`, `pr` (case-insensitive). | PASS | `src/config.ts` parses `FOUNDRY_MERGE_MODE` via `toLowerCase()` and accepts `auto`, `merge`, `pr`. |
| Default merge mode is `auto` when `FOUNDRY_MERGE_MODE` is unset or invalid. | PASS | `src/config.ts` defaults to `auto`; prompt sync defaults to `auto` when config is missing/invalid. |
| `foundry` minimal setup and `foundry config` wizards include `auto` and default to it. | PASS | `src/index.ts` and `src/lib/init-project.ts` include `auto` as the default selection. |
| In `auto`, `.foundry/prompts/agent2-worker-{oneshot,validate}.md` include both merge + PR instructions with an explicit decision rubric. | PASS | Manual smoke: setting merge mode to `auto` and running prompt sync renders `merge-auto` content (rubric + Option A/B). |
| `∞ Awaiting Merge` is classified as “blocked-like” (not completed) in Foundry’s Linear workflow definitions, with an upgrade path for existing teams. | PASS | `src/lib/linear-api.ts` defines `∞ Awaiting Merge` as `type: started` and migrates legacy `completed` states by renaming + creating the correct state + moving issues. |
| Quick check only wakes Agent 1 for actionable “ready-to-work” tickets (backlog/unstarted), not for human-intervention statuses like `∞ Awaiting Merge`. | PASS | `src/lib/linear-quick-check.ts` filters to `state.type in ['backlog','unstarted']`; unit tests updated and passing. |
| All tests pass: `npm test` | PASS | See automated checks above. |
| Type check passes: `npm run typecheck` | PASS | See automated checks above. |
| Build passes: `npm run build` | PASS | `tsc` succeeds. |

## Issues Found

None.

## Recommendation

APPROVE: Ready for production.

