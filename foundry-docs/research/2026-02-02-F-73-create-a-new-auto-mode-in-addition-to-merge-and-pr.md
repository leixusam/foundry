# Research: create a new auto mode (in addition to merge and pr)

**Issue**: F-73
**Date**: 2026-02-02
**Status**: Complete

## Summary

Add a third merge mode, `auto`, that becomes the default and gives Agent 2 both the direct-merge and PR-creation instructions, letting the agent choose the safer path (PR) when changes are significant or uncertainty exists. Also adjust the Linear workflow definition so `∞ Awaiting Merge` is treated as an “intervention/blocked-like” state rather than “completed”, to improve visibility and alerting.

## Requirements Analysis

### New merge mode: `auto`
- Add a new merge mode option in addition to `merge` and `pr`.
- `auto` should be the default when `FOUNDRY_MERGE_MODE` is unset or invalid.
- When `auto` is selected, Agent 2 (oneshot/validate) should receive **both**:
  - The “merge directly to main” instructions
  - The “create PR for human review” instructions
- Guidance for Agent 2 decision-making in `auto` mode:
  - Prefer **PR** when the change is a “significant business logic update”
  - Prefer **PR** when the agent is unsure about safety/impact
  - Prefer **direct merge** for small, clearly safe changes (e.g., refactors, tests, mechanical changes) after all checks pass

### Status taxonomy change
- Update the `∞ Awaiting Merge` status so it is in a “blocked/intervention” meta category rather than “completed”.
- Goal: better alerting/visibility for issues awaiting human review and merge.

## Codebase Analysis

### Relevant Files

#### Merge mode type + config parsing
- `src/types.ts` — defines `export type MergeMode = 'merge' | 'pr';` and `FoundryConfig.mergeMode`.
- `src/config.ts` — parses `FOUNDRY_MERGE_MODE` via `getMergeMode()` (currently defaults to `merge`).

#### Setup + onboarding flows
- `src/index.ts` — minimal setup wizard asks for merge mode with `promptSelect()`; currently offers only `merge` and `pr` and defaults to `merge`.
- `src/lib/init-project.ts` — full `foundry config` wizard; same merge mode selection and default logic.
- `src/lib/setup.ts`
  - `loadExistingConfig()` validates and reads `FOUNDRY_MERGE_MODE` from `.foundry/env`
  - `saveEnvConfig()` writes `.foundry/env` including merge mode comment + value
  - `copyPromptsToProject()` assembles worker prompts by substituting `{{MERGE_INSTRUCTIONS}}` using a merge fragment chosen by merge mode.

#### Prompt fragments (merge behavior)
- `prompts/fragments/merge-direct.md` — direct merge-to-main instructions and WORK_RESULT schema.
- `prompts/fragments/merge-pr.md` — PR-creation instructions (uses `gh pr create`) and WORK_RESULT schema.
- `src/lib/setup.ts:copyPromptsToProject()` currently chooses fragment by:
  - `mergeMode === 'pr' ? 'merge-pr.md' : 'merge-direct.md'`

#### Linear workflow status definitions
- `src/lib/linear-api.ts` — `FOUNDRY_STATUS_DEFINITIONS` includes:
  - `∞ Awaiting Merge` with `type: 'completed'` (current behavior)
- `prompts/agent1-linear-reader.md` + `prompts/agent3-linear-writer.md` describe how to treat `∞ Awaiting Merge`.
- `src/lib/linear-quick-check.ts` — “uncompleted tickets” quick-check uses `state.type nin ['completed','canceled']`; changing status types impacts loop behavior.

### Existing Patterns To Follow
- Merge behavior is selected via `FOUNDRY_MERGE_MODE` and captured as a `MergeMode` union type.
- Prompt customization is done at prompt-sync time (`copyPromptsToProject()`), not via runtime conditionals.
- Merge mode UI uses consistent `SelectOption<MergeMode>[]` in both minimal and full setup flows.

## Implementation Considerations

### Approach

1. **Extend merge mode to include `auto` (and make it default)**
   - Update `MergeMode` union: add `'auto'`.
   - Update `getMergeMode()` parsing in `src/config.ts`:
     - Accept `auto` (case-insensitive)
     - Default to `auto` when unset/invalid.
   - Update `loadExistingConfig()` and `saveEnvConfig()` in `src/lib/setup.ts` to accept/write `auto` and update the explanatory comment.
   - Update both setup wizards (`src/index.ts`, `src/lib/init-project.ts`) to include `auto` and default the selection to `auto` when no config exists.
   - Update docs (`README.md`) that describe `FOUNDRY_MERGE_MODE` values and default.

2. **Provide both merge+PR instructions in `auto` mode**
   - Add new fragment file: `prompts/fragments/merge-auto.md`.
   - Implement `merge-auto.md` as a single “decision wrapper” that:
     - States the decision rule (PR on uncertainty / significant business logic)
     - Includes (or paraphrases + embeds) both the direct merge instructions and the PR instructions
     - Preserves the stage placeholders (`{{STAGE}}`, `{{WORKFLOW}}`, `{{ARTIFACT_DIR}}`) and `{{PROVIDER_LINK}}` so `copyPromptsToProject()` can substitute consistently.
   - Update `copyPromptsToProject()` selection logic to:
     - `auto` → `merge-auto.md`
     - `pr` → `merge-pr.md`
     - `merge` → `merge-direct.md`

   **Note:** To reduce confusion, `merge-auto.md` should avoid duplicate “Step 7/8/9” numbering collisions by using “Option A / Option B” headings, while still embedding the exact commands and WORK_RESULT schemas from both modes.

3. **Move `∞ Awaiting Merge` out of “completed”**
   - Update `FOUNDRY_STATUS_DEFINITIONS` entry for `∞ Awaiting Merge` in `src/lib/linear-api.ts`:
     - Change `type` from `'completed'` → `'started'` (closest Linear equivalent to “intervention”)
     - Consider using the same red color as `∞ Blocked` (or keep yellow) so it’s visually prominent.
   - Update Foundry prompts/docs that treat this status as “completed”:
     - `prompts/agent1-linear-reader.md` currently says “Do NOT query for `∞ Awaiting Merge` (completed…)”; this must be updated so Agent 1 doesn’t attempt to pick it up as actionable work, but can still surface it as requiring human action.
     - `prompts/agent3-linear-writer.md` can continue setting `next_status: "∞ Awaiting Merge"` for PR-created outcomes.

   **Migration caveat:** `ensureFoundryStatuses()` currently only creates missing statuses; it does not update existing statuses’ type/color. If `∞ Awaiting Merge` already exists as `completed`, changing the definition alone won’t update the team. Implementation may need one of:
   - Add an “ensure/update” path that updates existing workflow states when type/color differ (requires Linear workflow state update mutation support).
   - Or document a manual one-time migration for teams that already have the old definition.

4. **Avoid infinite “quick check triggers Agent 1” loops**
   - If `∞ Awaiting Merge` becomes `started`, `checkForUncompletedTickets()` will treat it as “hasWork”, causing Foundry to wake Agent 1 repeatedly even when there’s no actionable work.
   - Mitigation options (needs a decision):
     1. Keep `∞ Awaiting Merge` as `started` for human visibility, but update quick check to exclude it by name (and possibly exclude `∞ Blocked` too).
     2. Redefine “hasWork” to mean “actionable tickets exist” (backlog/unstarted + `∞ Needs *`), and separately count “needs human intervention” tickets for alerting.

### Risks
- Prompt length/duplication: combining both instruction sets may make the worker prompt long and increase the chance of Agent 2 following the wrong path; the decision rubric must be prominent and explicit.
- Behavior change from new default: users who relied on implicit “always merge” will now be in “agent decides” mode; documentation should clearly explain how to revert (`FOUNDRY_MERGE_MODE=merge`).
- Status type migration: existing Linear teams won’t be updated unless explicit migration logic is added.

### Testing Strategy
- Unit tests:
  - Update existing merge mode tests in `src/lib/__tests__/config.test.ts` for new default (`auto`) and parsing of `FOUNDRY_MERGE_MODE=auto`.
  - Add tests (if desired) around `copyPromptsToProject()` fragment selection to confirm:
    - `auto` inserts content from `merge-auto.md`
    - `pr` inserts content from `merge-pr.md`
    - `merge` inserts content from `merge-direct.md`
- Manual smoke:
  - Run `foundry config` and confirm merge mode selector includes `auto` and defaults to it.
  - Run `foundry` with each merge mode and confirm `.foundry/prompts/agent2-worker-oneshot.md` contains the expected merge instructions block.

## Specification Assessment

This is primarily configuration + prompt orchestration behavior, with minor CLI selection text changes. No new user-facing UI flows beyond existing wizards.

**Needs Specification**: No

## Questions for Human Review

1. Should `auto` prefer PR by default unless the change is “obviously safe”, or should it try to merge by default unless risk is detected?
2. For `∞ Awaiting Merge`, do we want:
   - `type: 'started'` (shows up as active in Linear), or
   - a separate new status name (to avoid mutating an existing status), or
   - another approach that avoids impacting quick-check semantics?
3. Should quick check consider `∞ Awaiting Merge` as “work” (to keep Foundry awake), or should it explicitly exclude it to prevent churn?

## Next Steps

Proceed to planning with a concrete decision on:
- Quick-check behavior for `∞ Awaiting Merge` (exclude vs treat as work)
- Whether to implement automatic migration of the existing Linear workflow state type/color

