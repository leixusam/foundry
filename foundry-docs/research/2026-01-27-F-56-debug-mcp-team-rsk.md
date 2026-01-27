# Research: Debug Why MCP Uses Team RSK

**Issue**: F-56
**Date**: 2026-01-27
**Status**: Complete

## Summary

The investigation reveals that the `LINEAR_TEAM_KEY` environment variable is loaded by Foundry but **never injected into the agent prompts**. Agents must guess which team to use, and they often default to "RSK" because of example patterns in the prompts and documentation.

## Requirements Analysis

The user reported that:
1. During initialization, Foundry correctly detected their team as "Robin Sidekick (ROB)"
2. The `.foundry/env` file has `LINEAR_TEAM_KEY=ROB`
3. Initialization completed showing "Linear Team: ROB"
4. However, Agent 1's MCP calls use `{"team":"RSK"}` instead of `{"team":"ROB"}`

The question: **Is "RSK" being hardcoded somewhere in the prompts or code?**

## Codebase Analysis

### Relevant Files

- `src/config.ts:27-56` - Loads `.foundry/env` and sets `process.env` values
- `src/config.ts:230` - Stores `LINEAR_TEAM_KEY` as `config.linearTeamId`
- `src/index.ts:73-84` - Builds Agent 1 prompt (does NOT include team key)
- `src/index.ts:200-217` - Builds Agent 2 prompt (does NOT include team key)
- `prompts/agent1-linear-reader.md:31` - Says "with the team parameter" but doesn't specify value
- `prompts/agent3-linear-writer.md:215` - Hardcoded example: `team: "RSK"`

### Root Cause: Team Key Not Injected into Prompts

**The `linearTeamId` is used only for:**
1. Checking if Foundry statuses exist in Linear (line 457)
2. Console logging at startup (line 469)

**The team key is NEVER passed to agent prompts.** Looking at `src/index.ts`:

```typescript
// Agent 1 prompt construction (lines 73-84)
const agent1Prompt = `## Agent Instance
You are part of pod: **${podName}** / Loop ${iteration} / Agent 1 (Linear Reader)
...
${agent1BasePrompt}`;  // <-- No team key injected!
```

The `agent1BasePrompt` contains this instruction:
```markdown
Use `mcp__linear__list_issue_statuses` with the team parameter to get all available workflow statuses.
```

But **no actual team key value is provided** - the agent must infer it.

### How the Agent Picks a Team

Without an explicit team key in the prompt, the LLM (Claude) must infer which team to use. It likely:
1. Uses patterns from in-context examples (RSK-123 appears throughout the prompts)
2. Uses the Linear MCP's default behavior (possibly first team or some heuristic)
3. Gets influenced by hardcoded examples like `team: "RSK"` in agent3-linear-writer.md

### Search Results for "RSK"

Searched the codebase and found 200+ references to "RSK":
- Most are **example identifiers** like "RSK-123" in prompt documentation
- Some are **historical artifact filenames** in `foundry-docs/`
- One is a **hardcoded team example** in `prompts/agent3-linear-writer.md:215`:
  ```
  team: "RSK",
  ```

## Implementation Considerations

### Approach

The fix requires two changes:

1. **Inject team key into Agent 1's prompt** - Add the `linearTeamId` value to the prompt so the agent knows which team to query:
   ```typescript
   const agent1Prompt = `## Agent Instance
   You are part of pod: **${podName}** / Loop ${iteration} / Agent 1 (Linear Reader)

   ## Linear Team Configuration
   **Team Key**: ${config.linearTeamId}

   Use this team key for all Linear MCP tool calls.

   ---
   ${agent1BasePrompt}`;
   ```

2. **Update prompts to use the injected value** - Modify `prompts/agent1-linear-reader.md` to reference the team key from the prompt header instead of saying "with the team parameter" vaguely.

3. **(Optional) Replace hardcoded RSK examples** - Change examples like `team: "RSK"` in agent3-linear-writer.md to use placeholders like `team: "{team_key}"` or reference the team from context.

### Risks

- **Low risk**: This is a prompt injection change, not a code logic change
- **Testing needed**: Verify agents correctly use the injected team key
- **Backwards compatibility**: No concerns, this is additive

### Testing Strategy

1. Run Foundry with a non-RSK team key configured
2. Verify Agent 1's MCP calls use the configured team key
3. Verify Agent 3's sub-issue creation uses the correct team

## Specification Assessment

This is a backend/infrastructure fix with no user-facing UX changes. The fix involves:
- Modifying TypeScript code in `src/index.ts`
- Updating markdown prompts

**Needs Specification**: No

## Questions for Human Review

1. Should we also inject the team key into Agent 2 and Agent 3 prompts for consistency?
2. Should we replace all RSK examples with placeholders to avoid confusion?

## Next Steps

Ready for planning phase. The fix is straightforward - inject `config.linearTeamId` into the agent prompts where Linear MCP calls are made.
