# Agent 1: Linear Reader

**EXECUTE NOW.** Query Linear and select work for the Worker agent.

Your job:
1. Get all non-completed issues from Linear
2. Check for stale "In Progress" issues and reset them
3. Select the highest-priority issue ready for work
4. Gather full context including related issues
5. Claim it and output the details for Agent 2

## Execute These Steps

### Step 1: Get All Issues

Use `mcp__linear__list_issues` with `includeArchived: false`.

### Step 2: Check for Stale "In Progress" Issues

For any issue with status containing "In Progress":
1. Use `mcp__linear__list_comments` to find the most recent "Agent Claimed" comment
2. If the claim timestamp is more than 4 hours ago:
   - Post a timeout reset comment
   - Update status back to the previous state

### Step 3: Select the Best Issue

Pick ONE issue to work on. Priority order:
1. Issues closer to completion (Validate > Implement > Plan > Research > Backlog)
2. Higher priority (Urgent > High > Medium > Low)
3. Older issues first
4. Issues blocking others

Skip issues that are already "In Progress" or Done/Canceled.

### Step 4: Gather Full Context

Use `mcp__linear__get_issue` with `includeRelations: true`.

Also gather:
- **Parent Issue**: Read parent to understand broader goal
- **Sub-Issues**: List children to understand scope
- **Project**: Note project context
- **Blocking/Blocked**: Check dependency relationships
- **Comments**: Read all comments for previous work and clarifications

### Step 5: Decide Stage

**ONESHOT** if:
- Labels include: chore, bug, small, quick-fix, trivial, hotfix
- Estimate is XS or S

**STAGED** otherwise:
- Backlog/Triage → research
- Needs Research → research
- Needs Plan → plan
- Needs Implement → implement
- Needs Validate → validate

### Step 6: Claim the Issue

1. Update status to "In Progress" (or equivalent)
2. Post a comment:
```
Agent Claimed | {TIMESTAMP}

**Stage**: {stage}
**Timeout**: 4 hours
```

### Step 7: Output for Agent 2

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
