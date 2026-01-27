# Research: Linear CLI Integration (RSK-21)

## Issue Summary

Improve the initial setup experience by automatically creating Ralph-specific workflow statuses in Linear. Prefix statuses with `[RL]` (Ralph Loop) to avoid conflicts with user's existing statuses.

## Current State Analysis

### How Linear Integration Currently Works

Ralph uses **Linear MCP tools** (not a CLI or direct API) to interact with Linear. The integration is entirely MCP-based through the Claude Code environment:

- **Agent 1 (Linear Reader)**: Uses `mcp__linear__list_issue_statuses`, `mcp__linear__list_issues`, `mcp__linear__get_issue`, `mcp__linear__list_comments`, `mcp__linear__update_issue`
- **Agent 3 (Linear Writer)**: Uses `mcp__linear__update_issue`, `mcp__linear__create_comment`, `mcp__linear__create_issue`

Currently, status names are **hardcoded in agent prompts** with assumptions that they already exist in the user's Linear workspace.

### Expected Statuses (Current)

The prompts reference these status names:

| Category | Status Names |
|----------|--------------|
| Backlog | Backlog |
| Ready (unstarted) | Todo, Needs Research, Needs Specification, Needs Plan, Needs Implement, Needs Validate |
| In Progress (started) | Research In Progress, Specification In Progress, Plan In Progress, Implement In Progress, Validate In Progress, Oneshot In Progress |
| Done (completed) | Done |
| Canceled | Canceled |

### Problem

If a user doesn't have these exact status names in their Linear workspace, the agents will fail to find/update issues correctly. Users must manually create these statuses in Linear before using Ralph.

## Research Findings

### Linear API Status Management

1. **Linear MCP Tools Available**:
   - `mcp__linear__list_issue_statuses` - Read statuses (already used)
   - No MCP tool exists for creating statuses

2. **Linear GraphQL API**:
   - Linear exposes a full GraphQL API at `https://api.linear.app/graphql`
   - The API includes `workflowStateCreate` mutation for creating workflow states
   - Requires authentication via API key or OAuth2

3. **Linear SDK Options**:
   - `@linear/sdk` - Official TypeScript/JavaScript SDK
   - Provides typed access to all GraphQL operations including `workflowStateCreate`

### Required Status Creation Approach

Since there's no MCP tool for creating workflow states, we have two options:

**Option A: Direct GraphQL Calls**
- Use `fetch` to call Linear's GraphQL API
- Requires storing/passing Linear API key
- Full control over implementation

**Option B: Use @linear/sdk**
- Type-safe SDK wrapper around GraphQL
- Cleaner API with TypeScript types
- Still requires API key

### API Key Considerations

The user already has Linear MCP configured (since Agent 1 and 3 can use Linear tools). The MCP tool likely has the API key configured. However:
- We cannot access the MCP's internal API key
- For initialization, we need a separate API key or OAuth flow
- The SDK/API approach requires the user to provide their API key during setup

### First-Run Detection Options

1. **Configuration File**: Check for `.ralph/initialized` or similar marker file
2. **Status Presence Check**: On startup, check if `[RL]` statuses exist in Linear
3. **Interactive Prompt**: Ask user if this is first run

Recommended: **Status presence check** - most robust and self-healing (can detect if statuses were deleted).

### Proposed Status Names with [RL] Prefix

| Category | New Status Name |
|----------|-----------------|
| Backlog | `[RL] Backlog` |
| Ready (unstarted) | `[RL] Needs Research`, `[RL] Needs Specification`, `[RL] Needs Plan`, `[RL] Needs Implement`, `[RL] Needs Validate` |
| In Progress (started) | `[RL] Research In Progress`, `[RL] Specification In Progress`, `[RL] Plan In Progress`, `[RL] Implement In Progress`, `[RL] Validate In Progress`, `[RL] Oneshot In Progress` |
| Done (completed) | `[RL] Done` |
| Canceled | `[RL] Canceled` |

**Note**: We could potentially reuse the user's existing Backlog/Done/Canceled statuses and only create the Ralph-specific intermediate statuses to minimize clutter.

## Key Decisions Needed

### 1. Which statuses to create?

**Option A**: Create all Ralph statuses (full isolation)
- Pros: Complete separation from user workflows
- Cons: More statuses, potential clutter

**Option B**: Only create intermediate statuses (hybrid approach)
- Reuse existing: Backlog, Todo, Done, Canceled
- Create new: All `[RL] Needs X` and `[RL] X In Progress` statuses
- Pros: Less clutter, integrates with existing workflow
- Cons: May conflict if user's existing statuses behave differently

### 2. How to authenticate for status creation?

**Option A**: Use existing MCP context (if possible)
- Investigate if we can use Linear MCP tools for status creation
- May not be supported

**Option B**: Require API key during initialization
- User provides API key during first-run setup
- Store securely (environment variable or config file)
- Could be same key used by MCP

**Option C**: Guide user to create statuses manually
- Print instructions during initialization
- User creates statuses in Linear UI
- We verify they exist before proceeding

### 3. Initialization UX flow?

**Option A**: Fully automated
- Detect missing statuses on startup
- Create them automatically if API key available
- Minimal user interaction

**Option B**: Interactive CLI wizard
- `ralph init` command
- Walk user through setup
- Explain what will be created
- Confirm before making changes

**Option C**: Documentation + verification
- Document required setup
- On startup, verify statuses exist
- Error with helpful message if missing

## Architecture Implications

### Changes Required

1. **New initialization module** (`ralph/src/init.ts` or `ralph/src/lib/init.ts`)
   - Check if Ralph statuses exist
   - Create missing statuses via Linear SDK/API
   - Handle authentication

2. **Config updates** (`ralph/src/config.ts`)
   - Add `linearApiKey` configuration option
   - Add `linearTeamId` configuration (currently unused but defined in types)

3. **Entry point changes** (`ralph/src/index.ts`)
   - Add initialization check before main loop
   - Run setup wizard if first time

4. **Prompt updates** (all agent prompts)
   - Update status name references to use `[RL]` prefix
   - Make status names configurable or dynamic

5. **New dependency**
   - `@linear/sdk` for type-safe API access

### File Structure

```
ralph/
├── src/
│   ├── index.ts          # Add init check
│   ├── config.ts         # Add linearApiKey, linearTeamId
│   ├── init.ts           # NEW: Initialization logic
│   ├── lib/
│   │   └── linear-api.ts # NEW: Linear SDK wrapper
├── prompts/
│   ├── agent1-linear-reader.md  # Update status names
│   └── agent3-linear-writer.md  # Update status names
```

## Complexity Assessment

**This is a complex task with UX impact.**

Reasons:
1. **UX Design Required**: First-run experience needs careful design
2. **Multiple Components**: Init logic, API integration, prompt updates
3. **Authentication Flow**: Need to handle API key securely
4. **User Decision Points**: Several design decisions affect user experience
5. **Breaking Change**: Changing status names affects existing workflows

**Recommendation**: Proceed to **Specification** stage to define the UX before planning implementation.

## Questions for Specification

1. Should Ralph use fully isolated `[RL]` statuses or hybrid approach with existing Backlog/Done?
2. How should API authentication work during initialization?
3. What is the ideal first-run experience - automated, wizard, or documentation?
4. Should initialization be a separate `ralph init` command or automatic on first run?
5. How do we handle existing Ralph installations that use non-prefixed statuses (migration)?
6. Should we allow customizing the prefix (e.g., `[RALPH]`, `[BOT]`, etc.)?

## References

- [Linear GraphQL API](https://linear.app/developers/graphql)
- [Linear SDK](https://www.npmjs.com/package/@linear/sdk)
- [Linear Issue Status Docs](https://linear.app/docs/configuring-workflows)
- Current prompts: `ralph/prompts/agent1-linear-reader.md`, `ralph/prompts/agent3-linear-writer.md`
- Current config: `ralph/src/config.ts`

## Next Status

**Needs Specification** - This task has UX impact and requires specification before planning.
