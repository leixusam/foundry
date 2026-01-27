# Implementation Plan: Create Foundry Blocked Status

**Issue**: RSK-45
**Date**: 2026-01-27
**Research**: thoughts/research/2026-01-27-RSK-45-foundry-blocked-status.md
**Specification**: N/A
**Status**: Implementation Complete

## Overview

Add a `∞ Blocked` status to Foundry's workflow to signal when an agent needs human input. This status will:
1. Be created during project initialization alongside other Foundry statuses
2. Be skipped by Agent 1 (issues in `∞ Blocked` won't be automatically picked up)
3. Be available for Agent 2 to transition to when blocked
4. Be documented in the README

## Success Criteria

- [x] `∞ Blocked` status is defined in `src/lib/linear-api.ts`
- [x] `foundry init` creates the `∞ Blocked` status in Linear
- [x] Agent 1 skips issues in `∞ Blocked` status
- [x] Agent 2 can output `next_status: "∞ Blocked"` when needed
- [x] Agent 3 can set the `∞ Blocked` status
- [x] README documents the `∞ Blocked` status
- [x] Type check passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

## Phases

### Phase 1: Add Status Definition

**Goal**: Define the `∞ Blocked` status in the codebase so it's created during initialization.

**Changes**:
- `src/lib/linear-api.ts`:
  - Add `{ name: '∞ Blocked', type: 'started', color: '#eb5757' }` to `FOUNDRY_STATUS_DEFINITIONS` array
  - Place it near the end, before `∞ Done` and `∞ Canceled` (logical grouping: "Needs" statuses, "In Progress" statuses, "Blocked", then terminal statuses)
  - The red color (#eb5757) signals attention needed

**Verification**:
```bash
# Check the status is defined correctly
grep -A 2 "Blocked" src/lib/linear-api.ts

# Type check
npm run typecheck

# Build
npm run build
```

### Phase 2: Update Agent 1 to Skip Blocked Issues

**Goal**: Ensure Agent 1 never picks up issues in `∞ Blocked` status.

**Changes**:
- `prompts/agent1-linear-reader.md`:
  - Add `∞ Blocked` to the hard filters section (around line 80-85)
  - Add new hard filter rule: "Issues in `∞ Blocked` status: These require human intervention"
  - Update the Foundry Workflow Statuses section to include `∞ Blocked` under a new category

**Pattern to follow** (existing hard filter format):
```markdown
#### Hard Filters (must skip these):

1. **Blocked by incomplete dependency**: ...
2. **Claimed by another agent within the last hour**: ...
3. **Completed or canceled**: ...
4. **Blocked status**: Issues in `∞ Blocked` status require human intervention and must not be picked up.
```

**Verification**:
```bash
# Verify the filter is documented
grep -B 1 -A 1 "Blocked" prompts/agent1-linear-reader.md
```

### Phase 3: Enable Agent 2 to Use Blocked Status

**Goal**: Allow Agent 2 to transition issues to `∞ Blocked` when it needs human input.

**Changes**:
- `prompts/agent2-worker-research.md`:
  - Add guidance in output format section for when to use `∞ Blocked`
  - Document: Use `next_status: "∞ Blocked"` when requirements are unclear and cannot be resolved through research

- `prompts/agent2-worker-plan.md`:
  - Add guidance for using `∞ Blocked` when plan cannot be created due to ambiguous requirements

- `prompts/agent2-worker-implement.md`:
  - Add guidance for using `∞ Blocked` when implementation is blocked by unclear requirements

- `prompts/agent2-worker-validate.md`:
  - Add guidance for using `∞ Blocked` when validation criteria are unclear

- `prompts/agent2-worker-specification.md`:
  - Add guidance for using `∞ Blocked` when UX decisions need human input

**Pattern to add** (in Output Format sections):
```markdown
### When to Use `∞ Blocked`

If you cannot proceed due to unclear requirements or need human decision-making:

```
WORK_RESULT:
  success: false
  stage_completed: {stage}
  branch_name: foundry/{identifier}
  next_status: "∞ Blocked"
  error: |
    Cannot proceed - human input required.

    ## What's Blocked
    {Describe what is unclear or needs decision}

    ## Options
    1. {Option A}
    2. {Option B}

    ## Questions for Human
    - {Question 1}
    - {Question 2}
```

**Verification**:
```bash
# Verify all agent2 prompts have the guidance
grep -l "∞ Blocked" prompts/agent2-worker-*.md
```

### Phase 4: Update Agent 3 for Blocked Status

**Goal**: Ensure Agent 3 can properly set the `∞ Blocked` status.

**Changes**:
- `prompts/agent3-linear-writer.md`:
  - Add `∞ Blocked` to the status updates section
  - Document that when Agent 2 outputs `next_status: "∞ Blocked"`, Agent 3 should set the issue to `∞ Blocked`
  - Add comment format for blocked issues

**Pattern to add** (in Status Updates section):
```markdown
### When next_status is "∞ Blocked"
- **Any stage incomplete + blocked** → `∞ Blocked`
  - This indicates the agent needs human intervention
  - Human should review the error details and either:
    - Clarify requirements and move to appropriate "Needs X" status
    - Make a decision and move to appropriate "Needs X" status
```

**Verification**:
```bash
# Verify agent3 prompt has the guidance
grep -B 2 -A 4 "∞ Blocked" prompts/agent3-linear-writer.md
```

### Phase 5: Update README Documentation

**Goal**: Document the `∞ Blocked` status for users.

**Changes**:
- `README.md`:
  - Add `∞ Blocked` to the "Linear Workflow Statuses" section
  - Create a new category for intervention statuses or add to terminal statuses
  - Explain when this status is used and how to move out of it

**Location**: After "In Progress statuses" and before "Terminal statuses" sections, add:

```markdown
**Intervention statuses** (requires human action):
- `∞ Blocked` - Agent needs clarification or decision before proceeding
```

Also update the workflow diagram in the README to show `∞ Blocked` as a possible transition from any stage.

**Verification**:
```bash
# Verify README has the new status documented
grep -A 2 "Blocked" README.md
```

## Testing Strategy

1. **Build verification**: Run `npm run typecheck` and `npm run build` to ensure no type errors
2. **Status definition**: Verify the status appears in `FOUNDRY_STATUS_DEFINITIONS` array
3. **Documentation review**: Manually verify all prompts and README reflect the new status
4. **Integration test** (manual): Run `foundry init` on a test team and verify `∞ Blocked` is created

Note: Full integration testing (Agent 1 skipping blocked issues, Agent 2 transitioning to blocked) requires running the full agent pipeline and is outside the scope of this implementation phase.

## Rollback Plan

If issues arise:
1. Remove the `∞ Blocked` entry from `FOUNDRY_STATUS_DEFINITIONS` in `linear-api.ts`
2. Revert changes to agent prompts and README
3. The status will remain in Linear but will be unused (no harm)

Note: The status cannot be automatically deleted from Linear teams that have already been initialized - this is a Linear platform limitation and is acceptable.

## Notes

### Design Decisions

1. **Status type**: Using `started` type (not `backlog`) because:
   - The work has been started (agent attempted it)
   - `started` signals "in progress but blocked"
   - Keeps it out of "not started" metrics

2. **Color**: Using red (#eb5757) to clearly signal attention needed

3. **Placement in array**: After "In Progress" statuses, before "Done"/"Canceled" to match logical workflow order

### Human Workflow for Moving Out of `∞ Blocked`

When a human sees an issue in `∞ Blocked`:
1. Read the agent's comment explaining why it's blocked
2. Make the required decision or clarify requirements
3. Add a comment with the decision/clarification
4. Move the issue back to the appropriate "∞ Needs X" status
5. Foundry will pick it up on the next loop

### Existing "Blocked" Status

The team may already have a built-in "Blocked" status (ID: `723acd28-e8a4-4083-a0ff-85986b42c2c2`). The new `∞ Blocked` is Foundry-specific and separate. Agent 3 currently uses the built-in "Blocked" for merge conflicts - this behavior remains unchanged.
