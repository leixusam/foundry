# Agent 1: Linear Reader

**EXECUTE NOW.** Query Linear and select work for the Worker agent.

Your job:
1. Get all available issue statuses for the team
2. Get all non-completed issues from Linear
3. Check for stale "In Progress" issues and reset them
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
- If you see an issue transition to "In Progress" after your initial fetch, skip it
- When claiming, verify the status hasn't changed before updating

## Execute These Steps

### Step 1: Get Available Statuses

Use `mcp__linear__list_issue_statuses` with the team parameter to get all available workflow statuses.

This gives you the full list of status names and their types (backlog, unstarted, started, completed, canceled). Use these actual status names throughout the rest of your workflow instead of hardcoding assumptions.

Store the statuses for reference:
- **Backlog statuses**: type = "backlog"
- **Ready statuses**: type = "unstarted" (e.g., Todo, Needs Research, Needs Plan, etc.)
- **In Progress statuses**: type = "started" (e.g., Research In Progress, Plan In Progress, etc.)
- **Done statuses**: type = "completed"
- **Canceled statuses**: type = "canceled"

### Step 2: Get All Issues

Use `mcp__linear__list_issues` with `includeArchived: false`.

### Step 3: Check for Stale "In Progress" Issues

**Note**: In a multi-agent environment, another agent may be actively working on or may have just completed an "In Progress" issue. Be cautious when resetting.

For any issue with a status of type "started" (use the actual status names from Step 1):
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. Also check for any "Stage Complete" or "Stage Failed" comments that are more recent than the claim
3. If the claim timestamp is more than 4 hours ago AND there are no recent completion comments:
   - **Re-fetch the issue status** before resetting to ensure it hasn't changed
   - If status is still "In Progress" type: Post a timeout reset comment and update status
   - If status has changed: Another agent completed the work, skip resetting this issue

### Step 4: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others
5. **Tie-breaker**: Issues that have been in their current status longer (reduces collision with other agents)

Skip issues that have status type "started", "completed", or "canceled" (use the actual status names from Step 1).

**Note**: In a multi-agent environment, your "best" choice may be another agent's best choice too. Consider having backup options ready in case your first choice gets claimed.

### Step 5: Gather Full Context

Use `mcp__linear__get_issue` with `includeRelations: true`.

Also gather:
- **Parent Issue**: Read parent to understand broader goal
- **Sub-Issues**: List children to understand scope
- **Project**: Note project context
- **Blocking/Blocked**: Check dependency relationships
- **Comments**: Read all comments for previous work and clarifications

### Step 6: Decide Stage

**ONESHOT** if:
- Labels include: chore, bug, small, quick-fix, trivial, hotfix
- Estimate is XS or S

**STAGED** otherwise - map the issue's current status to the appropriate stage:
- Backlog status (type "backlog") → research
- "Needs Research" or similar unstarted status → research
- "Needs Plan" → plan
- "Needs Implement" → implement
- "Needs Validate" → validate

Use the actual status names from Step 1 to determine the appropriate stage.

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
