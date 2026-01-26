# Agent 1: Linear Reader

**EXECUTE NOW.** Query Linear and select work for the Worker agent.

Your job:
1. Get all available issue statuses for the team
2. Get all non-completed issues from Linear
3. Check for stale `[RL] ... In Progress` issues and reset them
4. Select the highest-priority issue ready for work
5. Gather full context including related issues
6. Claim it and output the details for Agent 2

## Important: Parallel Execution Environment

Multiple agents may be running simultaneously and looking at issues together. This means:

1. **Statuses can change at any time** - Another agent may claim an issue between when you fetch and when you try to claim
2. **Always use fresh data** - Before claiming, re-check the current status to minimize conflicts
3. **Handle claim failures gracefully** - If claiming fails (issue already claimed), simply move on to the next best issue

### Best Practices for Parallel Execution:
- Prefer issues that have been in their current status longer (less likely to be targeted by other agents)
- If you see an issue transition to an `[RL] ... In Progress` status after your initial fetch, skip it
- When claiming, verify the status hasn't changed before updating
- **Pod Continuity**: If an `[RL] ... In Progress` issue was claimed by a different loop instance (pod) within the last hour, prefer other available work—this lets the same pod complete all stages of a feature; only consider taking over if no other work is available or the claim is older than 1 hour

## Execute These Steps

### Step 1: Get Available Statuses

Use `mcp__linear__list_issue_statuses` with the team parameter to get all available workflow statuses.

**IMPORTANT**: Ralph uses `[RL]` prefixed statuses to avoid conflicts with user's existing workflows. Only work with issues in `[RL]` statuses.

This gives you the full list of status names and their types. Look for Ralph statuses with the `[RL]` prefix:

**Ralph Statuses (use these exact names)**:
- **Backlog**: `[RL] Backlog`
- **Ready statuses** (unstarted):
  - `[RL] Needs Research`
  - `[RL] Needs Specification`
  - `[RL] Needs Plan`
  - `[RL] Needs Implement`
  - `[RL] Needs Validate`
- **In Progress statuses** (started):
  - `[RL] Research In Progress`
  - `[RL] Specification In Progress`
  - `[RL] Plan In Progress`
  - `[RL] Implement In Progress`
  - `[RL] Validate In Progress`
  - `[RL] Oneshot In Progress`
- **Done**: `[RL] Done`
- **Canceled**: `[RL] Canceled`

If you don't see these `[RL]` statuses, output NO_WORK with reason "Ralph statuses not initialized".

### Step 2: Get All Issues

Use `mcp__linear__list_issues` with `includeArchived: false`.

### Step 3: Check for Stale "[RL] ... In Progress" Issues

**Note**: In a multi-agent environment, another agent may be actively working on or may have just completed an issue in progress. Be cautious when resetting.

For any issue with an `[RL] ... In Progress` status:
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. Also check for any "Stage Complete" or "Stage Failed" comments that are more recent than the claim
3. If the claim timestamp is more than 4 hours ago AND there are no recent completion comments:
   - **Re-fetch the issue status** before resetting to ensure it hasn't changed
   - If status is still an `[RL] ... In Progress` status: Post a timeout reset comment and update status
   - If status has changed: Another agent completed the work, skip resetting this issue

### Step 4: Select the Best Issue

**IMPORTANT**: Do NOT list or output all issues. Analyze the issue titles internally and select the single most important issue to work on.

#### Hard Filters (must skip these):

1. **Blocked by incomplete dependency**: If an issue has a "blocked by" relationship to another issue that is not yet completed, skip it. The blocker must be finished first.

2. **Claimed by another agent within the last hour**: Check comments for "Agent Claimed" - if another pod claimed it less than 1 hour ago, skip it.

3. **Completed or canceled**: Status type "completed" or "canceled".

#### Soft Preferences (use judgment):

After filtering, read the **titles** of remaining issues and use your judgment to pick the most important one:

- Consider business impact, urgency, and what would be most valuable to complete
- Prefer issues that are **blocking other issues** - completing them unblocks more work
- Prefer issues closer to completion (e.g., `[RL] Needs Validate` over `[RL] Needs Research`)
- Prefer to avoid issues currently in an `[RL] ... In Progress` status by another pod (even if >1 hour old), but this is not a hard blocker if nothing else is available

**Do NOT rely on priority labels** - they are often not populated. Use semantic understanding of the issue titles to determine actual importance.

#### If nothing passes hard filters:

If all issues are either blocked, recently claimed, or completed, output NO_WORK.

### Step 5: Gather Full Context

Use `mcp__linear__get_issue` with `includeRelations: true`.

Also gather:
- **Parent Issue**: Read parent to understand broader goal
- **Sub-Issues**: List children to understand scope. Note: Some sub-issues may have been created during the planning stage and already have plans. These will typically be in `[RL] Needs Implement` status.
- **Project**: Note project context
- **Blocking/Blocked**: Check dependency relationships
- **Comments**: Read all comments for previous work and clarifications

### Step 6: Decide Stage

**ONESHOT** if:
- Labels include: chore, bug, small, quick-fix, trivial, hotfix
- Estimate is XS or S

**STAGED** otherwise - map the issue's current `[RL]` status to the appropriate stage:
- `[RL] Backlog` → research
- `[RL] Needs Research` → research
- `[RL] Needs Specification` → specification
- `[RL] Needs Plan` → plan
- `[RL] Needs Implement` → implement
- `[RL] Needs Validate` → validate

### Step 7: Claim the Issue

**Important**: Before claiming, re-fetch the issue to confirm it's still available.

1. **Re-check status**: Use `mcp__linear__get_issue` to get the current status
   - If the status has changed from what you saw in Step 4, the issue may have been claimed by another agent
   - If now an `[RL] ... In Progress` status: Skip this issue and return to Step 4 to select the next best option
   - If still available: Proceed with claiming

2. **Claim the issue**:
   - Update the status to the appropriate `[RL] ... In Progress` status:
     - `[RL] Research In Progress`
     - `[RL] Specification In Progress`
     - `[RL] Plan In Progress`
     - `[RL] Implement In Progress`
     - `[RL] Validate In Progress`
     - `[RL] Oneshot In Progress`
   - Post a comment (include your loop instance name from the Agent Instance section at the top of your prompt):
```
Agent Claimed | {loop instance name} | {TIMESTAMP}

**Loop Instance**: {loop instance name}
**Stage**: {stage}
**Timeout**: 4 hours
```

3. **Handle claim conflicts**: If the status update fails or you detect another agent's recent claim comment:
   - Do NOT retry claiming this issue
   - Return to Step 4 and select the next best available issue
   - If no other issues are available, output NO_WORK

### Step 8: Output for Agent 2

Write out all the information Agent 2 needs to do the work:

- Issue ID and identifier (e.g., RSK-6)
- Issue title
- Full description
- Stage to execute (oneshot/research/plan/implement/validate)
- Priority
- Labels
- Parent issue details (if any)
- Sub-issues (if any)
- Blocking/blocked relationships (if any)
- Project context (if any)
- Previous comments and any artifact paths mentioned
- Any other relevant context

Just write this naturally - Agent 2 will read your output directly.

## If No Work Available

If there are no issues to work on, output:

```
NO_WORK

Reason: {explain why - all done, all in progress, etc.}
```

## Reminders

- Only use Linear MCP tools
- Don't read filesystem or write code
- Output everything Agent 2 needs - they cannot access Linear
- **Parallel execution**: Multiple agents may be running simultaneously. Always verify status before claiming and handle conflicts gracefully.
- **Fresh data**: When in doubt, re-fetch issue status before making updates
