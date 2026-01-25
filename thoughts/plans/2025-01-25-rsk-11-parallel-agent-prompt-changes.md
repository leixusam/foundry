# Implementation Plan: Parallel Agent Conflict Handling for Agent 1 (RSK-11)

**Issue**: RSK-11
**Date**: 2025-01-25
**Stage**: Plan
**Research Document**: `thoughts/research/2025-01-25-rsk-11-parallel-agent-conflict-handling.md`

## Overview

Update `ralph/prompts/agent1-linear-reader.md` to handle parallel agent execution, minimizing race conditions and providing clear guidance for conflict handling.

## Target File

- **File**: `ralph/prompts/agent1-linear-reader.md`
- **Current Lines**: 121 lines

## Implementation Phases

### Phase 1: Add Parallel Execution Awareness Section

**Location**: After line 12 (after the intro "Your job:" list, before "## Execute These Steps")

**Add new section**:

```markdown
## Important: Parallel Execution Environment

Multiple agents may be running simultaneously and looking at issues together. This means:

1. **Statuses can change at any time** - Another agent may claim an issue between when you fetch and when you try to claim
2. **Always use fresh data** - Before claiming, re-check the current status to minimize conflicts
3. **Handle claim failures gracefully** - If claiming fails (issue already claimed), simply move on to the next best issue

### Best Practices for Parallel Execution:
- Prefer issues that have been in their current status longer (less likely to be targeted by other agents)
- If you see an issue transition to "In Progress" after your initial fetch, skip it
- When claiming, verify the status hasn't changed before updating
```

**Rationale**: This section establishes awareness upfront so agents understand the multi-agent context before executing any steps.

---

### Phase 2: Modify Step 3 (Stale Issue Check)

**Location**: Lines 32-38

**Current content**:
```markdown
### Step 3: Check for Stale "In Progress" Issues

For any issue with a status of type "started" (use the actual status names from Step 1):
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. If the claim timestamp is more than 4 hours ago:
   - Post a timeout reset comment
   - Update status back to the previous state (the appropriate "Needs X" status)
```

**Replace with**:
```markdown
### Step 3: Check for Stale "In Progress" Issues

**Note**: In a multi-agent environment, another agent may be actively working on or may have just completed an "In Progress" issue. Be cautious when resetting.

For any issue with a status of type "started" (use the actual status names from Step 1):
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. Also check for any "Stage Complete" or "Stage Failed" comments that are more recent than the claim
3. If the claim timestamp is more than 4 hours ago AND there are no recent completion comments:
   - **Re-fetch the issue status** before resetting to ensure it hasn't changed
   - If status is still "In Progress" type: Post a timeout reset comment and update status
   - If status has changed: Another agent completed the work, skip resetting this issue
```

**Rationale**: Prevents race condition where an agent resets an issue that another agent just completed.

---

### Phase 3: Modify Step 4 (Select Best Issue)

**Location**: Lines 40-48

**Current content**:
```markdown
### Step 4: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others

Skip issues that have status type "started", "completed", or "canceled" (use the actual status names from Step 1).
```

**Replace with**:
```markdown
### Step 4: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others
5. **Tie-breaker**: Issues that have been in their current status longer (reduces collision with other agents)

Skip issues that have status type "started", "completed", or "canceled" (use the actual status names from Step 1).

**Note**: In a multi-agent environment, your "best" choice may be another agent's best choice too. Consider having backup options ready in case your first choice gets claimed.
```

**Rationale**: Adds collision-avoidance heuristic and prompts agents to prepare backup choices.

---

### Phase 4: Modify Step 7 (Claim the Issue)

**Location**: Lines 76-85

**Current content**:
```markdown
### Step 7: Claim the Issue

1. Update the status to the appropriate "In Progress" status (use the actual status name from Step 1, e.g., "Research In Progress", "Plan In Progress", "Implement In Progress", "Validate In Progress", or "Oneshot In Progress")
2. Post a comment:
```
Agent Claimed | {TIMESTAMP}

**Stage**: {stage}
**Timeout**: 4 hours
```
```

**Replace with**:
```markdown
### Step 7: Claim the Issue

**Important**: Before claiming, re-fetch the issue to confirm it's still available.

1. **Re-check status**: Use `mcp__linear__get_issue` to get the current status
   - If the status has changed from what you saw in Step 4, the issue may have been claimed by another agent
   - If now "In Progress" status type: Skip this issue and return to Step 4 to select the next best option
   - If still available: Proceed with claiming

2. **Claim the issue**:
   - Update the status to the appropriate "In Progress" status (use the actual status name from Step 1, e.g., "Research In Progress", "Plan In Progress", "Implement In Progress", "Validate In Progress", or "Oneshot In Progress")
   - Post a comment:
```
Agent Claimed | {TIMESTAMP}

**Stage**: {stage}
**Timeout**: 4 hours
```

3. **Handle claim conflicts**: If the status update fails or you detect another agent's recent claim comment:
   - Do NOT retry claiming this issue
   - Return to Step 4 and select the next best available issue
   - If no other issues are available, output NO_WORK
```

**Rationale**: This is the critical change - adds a verification step before claiming and provides clear conflict handling instructions.

---

### Phase 5: Update Reminders Section

**Location**: Lines 116-121

**Current content**:
```markdown
## Reminders

- Only use Linear MCP tools
- Don't read filesystem or write code
- Output everything Agent 2 needs - they cannot access Linear
```

**Replace with**:
```markdown
## Reminders

- Only use Linear MCP tools
- Don't read filesystem or write code
- Output everything Agent 2 needs - they cannot access Linear
- **Parallel execution**: Multiple agents may be running simultaneously. Always verify status before claiming and handle conflicts gracefully.
- **Fresh data**: When in doubt, re-fetch issue status before making updates
```

**Rationale**: Reinforces the parallel execution concepts at the end of the prompt as a reminder.

---

## Summary of Changes

| Phase | Section | Change Type | Lines Affected |
|-------|---------|-------------|----------------|
| 1 | New "Parallel Execution" section | Add | After line 12 |
| 2 | Step 3 (Stale Issue Check) | Replace | 32-38 |
| 3 | Step 4 (Select Best Issue) | Replace | 40-48 |
| 4 | Step 7 (Claim the Issue) | Replace | 76-85 |
| 5 | Reminders | Replace | 116-121 |

## Success Criteria

1. **Prompt compiles**: No markdown syntax errors
2. **Parallel awareness present**: New section clearly communicates multi-agent environment
3. **Step 3 safeguards**: Stale check includes completion comment verification and re-fetch
4. **Step 4 tie-breaker**: Selection includes status duration as collision avoidance
5. **Step 7 verification**: Claim process includes re-check and conflict handling
6. **Reminders updated**: Parallel execution reminders present

## Validation Steps

1. Read the updated prompt to verify all changes applied correctly
2. Check markdown syntax (no broken formatting)
3. Verify each of the 5 success criteria above
4. Ensure prompt flow still makes logical sense

## Estimated Impact

- **New lines added**: ~35-40 lines
- **Final file size**: ~155-165 lines
- **Behavioral changes**: Agents will re-verify before claiming, handle conflicts gracefully

## Rollback Plan

If issues arise:
- Revert commit via `git revert`
- The research document preserves the original prompt sections for reference

---

**Plan completed. Ready for implementation stage.**
