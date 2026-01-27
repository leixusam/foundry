# Implementation Plan: Debug Why MCP Uses Team RSK

**Issue**: F-56
**Date**: 2026-01-27
**Research**: foundry-docs/research/2026-01-27-F-56-debug-mcp-team-rsk.md
**Specification**: N/A (backend infrastructure fix)
**Status**: Ready for Implementation

## Overview

The `LINEAR_TEAM_KEY` environment variable is loaded by Foundry into `config.linearTeamId`, but it is never injected into the agent prompts. This causes agents to guess the team value, often defaulting to "RSK" from placeholder examples. The fix injects the team key into all agent prompts so they know which Linear team to use for MCP calls.

## Success Criteria

- [ ] Agent 1 uses the configured team key for all Linear MCP calls
- [ ] Agent 3 uses the configured team key when creating sub-issues
- [ ] No hardcoded "RSK" team references remain in prompts
- [ ] Type check passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`

## Phases

### Phase 1: Inject Team Key into Agent Prompts in src/index.ts

**Goal**: Add a "Linear Team Configuration" section to all three agent prompts that provides the team key from config.

**Changes**:
- `src/index.ts:73-84`: Add team key section to Agent 1 prompt
- `src/index.ts:200-217`: Add team key section to Agent 2 prompt (even though Agent 2 doesn't make Linear calls directly, it provides context that Agent 3 uses)
- `src/index.ts:277-330`: Add team key section to Agent 3 prompt

**Implementation Details**:

For each agent prompt, add this section after the "Agent Instance" header:

```typescript
// Agent 1 prompt construction (new code around line 73-84)
const agent1Prompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 1 (Linear Reader)
...

## Linear Team Configuration

**Team Key**: ${config.linearTeamId}

Use this team key for all Linear MCP tool calls (list_issues, list_issue_statuses, update_issue, create_comment, etc.).

---

${agent1BasePrompt}`;
```

The same pattern applies to Agent 2 and Agent 3 prompts.

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 2: Update Hardcoded RSK Example in agent3-linear-writer.md

**Goal**: Replace the hardcoded `team: "RSK"` example with a reference to the team key from context.

**Changes**:
- `prompts/agent3-linear-writer.md:211-218`: Update the example sub-issue creation to reference the team key from the Linear Team Configuration section

**Before**:
```markdown
mcp__linear__create_issue({
  title: "RSK-20a: Implement parser changes",
  description: "Implement parser updates for sub-issue support.\nSee Phase 2 of the implementation plan.",
  team: "RSK",
  parentId: "48ec45b4-5058-48d0-9b99-9d9824d2b9a5",
  state: "∞ Needs Implement"
})
```

**After**:
```markdown
mcp__linear__create_issue({
  title: "{identifier}a: Implement parser changes",
  description: "Implement parser updates for sub-issue support.\nSee Phase 2 of the implementation plan.",
  team: "{team_key from Linear Team Configuration above}",
  parentId: "{issue_id from Agent 1's output}",
  state: "∞ Needs Implement"
})
```

**Verification**:
```bash
# Verify no hardcoded RSK team references remain (identifier examples like RSK-20 are OK)
grep -r 'team:\s*"RSK"' prompts/
# Should return no results
```

## Testing Strategy

### Manual Testing
1. Configure a project with `LINEAR_TEAM_KEY=ROB` (or any non-RSK team)
2. Run Foundry: `npm run start`
3. Observe Agent 1 logs - MCP calls should use `{"team":"ROB"}` not `{"team":"RSK"}`
4. Observe Agent 3 logs - sub-issue creation should use the correct team

### Automated Testing
This change is primarily in prompt templates and runtime behavior. The main automated checks are:
- TypeScript compilation: `npm run typecheck`
- Build: `npm run build`

## Rollback Plan

If the change causes issues:
1. Revert the commits on the feature branch
2. The previous behavior (team inference by LLM) still works, just less reliably

## Notes

- Agent 2 doesn't directly make Linear MCP calls, but including the team key in its prompt provides consistency and ensures the team context is available if prompt templates are referenced or passed through
- The fix is additive - it adds explicit team configuration without removing any existing functionality
- Total estimated changes: ~30 lines across 2 files
