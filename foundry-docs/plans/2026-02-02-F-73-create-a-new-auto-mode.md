# Implementation Plan: create a new auto mode (in addition to merge and pr)

**Issue**: F-73  
**Date**: 2026-02-02  
**Research**: `foundry-docs/research/2026-02-02-F-73-create-a-new-auto-mode-in-addition-to-merge-and-pr.md`  
**Specification**: N/A  
**Status**: Ready for Implementation

## Overview

Add a third merge mode, `auto`, alongside `merge` and `pr`. In `auto` mode (the new default), Foundry will inject **both** the direct-merge and PR-creation instructions into the Agent 2 worker prompts (oneshot + validate) and let the agent choose the safer path. Also reclassify `∞ Awaiting Merge` as a “human intervention / blocked-like” status (not completed) for better alerting, without causing the quick-check loop to repeatedly wake Agent 1.

## Success Criteria

- [ ] `FOUNDRY_MERGE_MODE` supports: `auto`, `merge`, `pr` (case-insensitive).
- [ ] Default merge mode is `auto` when `FOUNDRY_MERGE_MODE` is unset or invalid.
- [ ] `foundry` minimal setup and `foundry config` wizards include `auto` and default to it.
- [ ] In `auto`, `.foundry/prompts/agent2-worker-{oneshot,validate}.md` include both merge + PR instructions with an explicit decision rubric.
- [ ] `∞ Awaiting Merge` is classified as “blocked-like” (not completed) in Foundry’s Linear workflow definitions, with an upgrade path for existing teams.
- [ ] Quick check only wakes Agent 1 for actionable “ready-to-work” tickets (backlog/unstarted), not for human-intervention statuses like `∞ Awaiting Merge`.
- [ ] All tests pass: `npm test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Build passes: `npm run build`

## Phases

### Phase Checklist

- [x] Phase 1: Add `auto` to merge mode typing + config parsing (and make it default)
- [x] Phase 2: Update onboarding wizards to offer `auto` (default)
- [ ] Phase 3: Implement `auto` prompt behavior via a new merge fragment
- [ ] Phase 4: Reclassify `∞ Awaiting Merge` as blocked-like without creating wake loops

### Phase 1: Add `auto` to merge mode typing + config parsing (and make it default)

**Goal**: Represent `auto` everywhere merge mode is typed/parsed/persisted, and change defaults from `merge` → `auto`.

**Changes**:
- `src/types.ts`: extend `MergeMode` to `'auto' | 'merge' | 'pr'`.
- `src/config.ts`: update `getMergeMode()` to parse `auto` and default to `auto`; update CLI help text.
- `src/lib/setup.ts`:
  - `loadExistingConfig()` to accept `auto`
  - `saveEnvConfig()` comment + default write to `auto`
  - `copyPromptsToProject()` to treat missing merge mode as `auto`
- `src/lib/__tests__/config.test.ts`: update merge mode tests for new default and `auto` parsing.

**Verification**:
```bash
npm test
npm run typecheck
npm run build
```

### Phase 2: Update onboarding wizards to offer `auto` (default)

**Goal**: Ensure both onboarding flows match the new default and allow explicit selection of all modes.

**Changes**:
- `src/index.ts` (`runMinimalSetup`): add `auto` option; use it as the default selection.
- `src/lib/init-project.ts` (`configProject`): add `auto` option; default to current config value, falling back to `auto`.

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 3: Implement `auto` prompt behavior via a new merge fragment

**Goal**: In `auto` mode, inject a single “decision wrapper” that includes both instruction sets and makes the decision rubric unmissable.

**Changes**:
- `prompts/fragments/merge-auto.md`: new fragment that:
  - Starts with a short, prominent rubric:
    - Prefer **PR** for “significant business logic updates”
    - Prefer **PR** when unsure
    - Prefer **direct merge** for small, clearly safe changes after checks pass
  - Contains two clearly separated sections:
    - **Option A: Merge directly to main** (embed content from `merge-direct.md`)
    - **Option B: Create PR for review** (embed content from `merge-pr.md`)
  - Avoids confusing step-number collisions (use headings + “Option A/B” rather than “Step 7/8/9” repeated).
  - Preserves required placeholders: `{{STAGE}}`, `{{WORKFLOW}}`, `{{ARTIFACT_DIR}}`, `{{PROVIDER_LINK}}`.
- `src/lib/setup.ts` (`copyPromptsToProject()`): select fragment by mode:
  - `auto` → `merge-auto.md`
  - `merge` → `merge-direct.md`
  - `pr` → `merge-pr.md`

**Verification**:
```bash
npm run build

# optional manual spot-check (local repo):
node dist/cli.js   # observe "Prompts synced (..., merge mode: auto)" with a default config
```

### Phase 4: Reclassify `∞ Awaiting Merge` as blocked-like without creating wake loops

**Goal**: Make “awaiting human merge” visible as an active/intervention state in Linear, but keep Foundry’s automation from thrashing.

**Changes**:
- `src/lib/linear-api.ts`: change `FOUNDRY_STATUS_DEFINITIONS` entry for `∞ Awaiting Merge`:
  - `type: 'completed'` → `type: 'started'`
  - choose an “intervention” color (either reuse `#eb5757` like `∞ Blocked`, or keep yellow `STATE_COLORS.started`; decide during implementation and apply consistently).
- `src/lib/linear-quick-check.ts`: change “hasWork” semantics to only consider tickets that are ready to be picked up:
  - Query only `state.type in ['backlog', 'unstarted']` instead of `nin ['completed','canceled']`.
  - Keep the same fallback behavior in `src/index.ts` (full Agent 1 run every `FOUNDRY_FULL_CHECK_INTERVAL_MINUTES`).
- `src/lib/__tests__/linear-quick-check.test.ts`: update tests to match new filtering behavior.
- `prompts/agent1-linear-reader.md`: update text that currently treats `∞ Awaiting Merge` as completed; it should remain “do not pick up”, but no longer be described as completed.

**Migration / upgrade behavior**:
- `ensureFoundryStatuses()` currently only creates missing states. Add an update path:
  - When a Foundry status exists by name but its `type`/`color` differs from `FOUNDRY_STATUS_DEFINITIONS`, update it (at minimum for `∞ Awaiting Merge`).
  - Use Linear SDK `updateWorkflowState(id, input)` with a small, explicit allowlist (avoid unexpectedly mutating user-customized workflow states beyond the `∞` prefixed ones).
- If workflow state update is not feasible for some reason, document a one-time manual migration in `README.md` (fallback only).

**Verification**:
```bash
npm test
npm run typecheck
npm run build
```

## Testing Strategy

- Unit tests:
  - `src/lib/__tests__/config.test.ts`: merge mode parsing (`auto`, `merge`, `pr`), default behavior, invalid values.
  - `src/lib/__tests__/linear-quick-check.test.ts`: verify quick check ignores started/completed/canceled tickets and only counts backlog/unstarted.
- Manual smoke:
  - Run `foundry config` and confirm merge mode selector includes `auto` and defaults to it.
  - Ensure `.foundry/prompts/agent2-worker-oneshot.md` and `.foundry/prompts/agent2-worker-validate.md` contain the `auto` rubric + both option sections when `FOUNDRY_MERGE_MODE=auto`.

## Rollback Plan

- Revert commits on `foundry/F-73` (git revert) to restore prior behavior.
- If `∞ Awaiting Merge` type migration causes unexpected workflow behavior for a team, revert the `FOUNDRY_STATUS_DEFINITIONS` change and rerun status ensure/migration, or manually restore the workflow state type in Linear.
- Users can force old behavior at any time by setting `FOUNDRY_MERGE_MODE=merge` (previous default).

## Notes

- The `auto` prompt fragment must be written carefully to avoid ambiguity; it should “front-load” the decision rule and then present the two paths as mutually exclusive options.
- Changing `∞ Awaiting Merge` away from `completed` is a behavior change: keep Agent 1 from picking it up, but make it visible as requiring human action.
