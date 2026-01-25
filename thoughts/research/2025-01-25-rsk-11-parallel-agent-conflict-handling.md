# Research: Parallel Agent Conflict Handling for Agent 1 (RSK-11)

**Issue**: RSK-11
**Date**: 2025-01-25
**Stage**: Research

## Problem Statement

When multiple Ralph instances (Agent 1s) run in parallel, they may:
1. See an issue as available at the same time
2. Both attempt to claim the same issue
3. Create race conditions where the issue status has changed between fetch and claim

The current Agent 1 prompt does not account for this scenario, which could lead to:
- Duplicate work being performed
- Claim conflicts
- Status confusion

## Current State Analysis

### Agent 1 Prompt Location
- **File**: `ralph/prompts/agent1-linear-reader.md`
- **Lines**: 121 lines total

### Current Workflow Steps

1. **Step 1**: Get available statuses from Linear team
2. **Step 2**: Get all non-completed issues
3. **Step 3**: Check for stale "In Progress" issues (>4 hours) and reset them
4. **Step 4**: Select the best issue based on priority rules
5. **Step 5**: Gather full context for the selected issue
6. **Step 6**: Decide the stage (oneshot vs staged)
7. **Step 7**: Claim the issue (update status + post comment)
8. **Step 8**: Output details for Agent 2

### Race Condition Points Identified

#### Race Point 1: Between Step 2 and Step 4
- **Scenario**: Agent A fetches issue list, sees RSK-5 as "Needs Research"
- **Gap**: Agent B claims RSK-5, changes status to "Research In Progress"
- **Problem**: Agent A still thinks RSK-5 is available when selecting

#### Race Point 2: Between Step 4 and Step 7
- **Scenario**: Agent A selects RSK-5 as best issue
- **Gap**: Agent B claims RSK-5 before Agent A's claim
- **Problem**: Agent A attempts to claim already-claimed issue

#### Race Point 3: During Step 3 (Stale Issue Reset)
- **Scenario**: Agent A sees RSK-5 as stale in "Research In Progress"
- **Gap**: Agent B completes the work and changes status to "Needs Plan"
- **Problem**: Agent A resets RSK-5 incorrectly, losing the status transition

### Existing Mitigation (Partial)

The plan document (`thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md`) acknowledges this risk in the "Risks and Failure Modes" section:

> **Risk 3: Multiple Agents Racing**
> - Scenario: If running multiple Ralph instances, they could claim the same issue
> - Mitigation:
>   - Use Linear's optimistic locking (update only if status hasn't changed)
>   - Add "claimed_by" field in comment to identify which instance
>   - For v1, document single-instance requirement

However, **this mitigation is not implemented in the current prompt**.

## Proposed Prompt Changes

### Change 1: Add Parallel Execution Awareness Section

Add a new section near the top of the prompt (after the intro, before Step 1):

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

### Change 2: Modify Step 4 (Select Best Issue)

Current Step 4:
```markdown
### Step 4: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others

Skip issues that have status type "started", "completed", or "canceled" (use the actual status names from Step 1).
```

Proposed Step 4:
```markdown
### Step 4: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others
5. **Tie-breaker**: Issues that have been in their current status longer (reduces collision with other agents)

Skip issues that have status type "started", "completed", or "canceled" (use the actual status names from Step 1).

**Note**: In a multi-agent environment, your "best" choice may be another agent's best choice too. Consider having backup options ready.
```

### Change 3: Modify Step 7 (Claim the Issue)

Current Step 7:
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

Proposed Step 7:
```markdown
### Step 7: Claim the Issue

**Important**: Before claiming, re-fetch the issue to confirm it's still available.

1. **Re-check status**: Use `mcp__linear__get_issue` to get the current status
   - If the status has changed from what you saw in Step 4, the issue may have been claimed by another agent
   - If now "In Progress" status type: Skip this issue and return to Step 4 to select the next best option
   - If still available: Proceed with claiming

2. **Claim the issue**:
   - Update the status to the appropriate "In Progress" status
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

### Change 4: Modify Step 3 (Stale Issue Check)

Current Step 3:
```markdown
### Step 3: Check for Stale "In Progress" Issues

For any issue with a status of type "started" (use the actual status names from Step 1):
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. If the claim timestamp is more than 4 hours ago:
   - Post a timeout reset comment
   - Update status back to the previous state (the appropriate "Needs X" status)
```

Proposed Step 3:
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

### Change 5: Add Reminder at the End

Add to the existing "Reminders" section:

```markdown
## Reminders

- Only use Linear MCP tools
- Don't read filesystem or write code
- Output everything Agent 2 needs - they cannot access Linear
- **Parallel execution**: Multiple agents may be running simultaneously. Always verify status before claiming and handle conflicts gracefully.
- **Fresh data**: When in doubt, re-fetch issue status before making updates
```

## Summary of Changes

| Section | Change Type | Description |
|---------|-------------|-------------|
| New section | Add | "Parallel Execution Environment" awareness section |
| Step 3 | Modify | Add safeguards for stale issue reset in parallel environment |
| Step 4 | Modify | Add tie-breaker for parallel collision avoidance |
| Step 7 | Modify | Add re-check before claiming and conflict handling |
| Reminders | Modify | Add parallel execution reminders |

## Impact Assessment

**Benefits**:
- Reduces race conditions between multiple Agent 1 instances
- Provides clear guidance on handling conflicts
- Minimizes duplicate work
- Improves system resilience in multi-agent deployments

**Limitations**:
- Does not completely eliminate race conditions (inherent to distributed systems)
- Adds some overhead (re-fetching before claiming)
- No true locking mechanism (would require Linear API changes or external coordination)

## Recommended Next Steps

1. **Plan Stage**: Create detailed implementation plan for these prompt changes
2. **Implement Stage**: Apply the changes to `ralph/prompts/agent1-linear-reader.md`
3. **Validate Stage**: Test with multiple concurrent agents to verify conflict handling

## Alternative Approaches Considered

### Option A: External Locking Service
- Use Redis or a database lock to coordinate between agents
- **Rejected**: Adds infrastructure complexity, outside scope of prompt changes

### Option B: Optimistic Locking via Linear API
- Linear doesn't provide native optimistic locking
- Could be simulated by checking `updatedAt` timestamp
- **Partially adopted**: Re-check before claiming achieves similar effect

### Option C: Agent ID / Instance Tracking
- Each agent has a unique ID, includes it in claims
- Other agents respect claims from recent agent IDs
- **Could be added later**: Requires changes to both prompt and orchestrator

---

**Research completed. Ready for planning stage.**
