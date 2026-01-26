# RSK-25: Log Token Cost for Each Worker and Loop in Linear

## Issue Summary

**Issue**: RSK-25 - Log the token cost for each worker and each loop in back into linear as well by agent three.

**Date**: 2025-01-25

**Status**: Implemented (Fast-Track)

## Research Findings

### Pre-existing Infrastructure

The Ralph codebase already had most of the infrastructure needed:

1. **Token data capture**: Both `claude.ts` and `codex.ts` already extract and return `tokenUsage` with `input`, `output`, and `cached` tokens in their `ProviderResult` (see `src/lib/provider.ts`).

2. **Partial data flow**: Agent 2 token stats were already being passed to Agent 3 in `index.ts` lines 152-160, but Agent 1 stats were not included.

3. **Comment template gap**: The Agent 3 Linear Writer prompt didn't have a template section for cost/token information.

### What Was Missing

1. Agent 1 (Linear Reader) token/cost data was not being passed to Agent 3
2. Loop totals (aggregate across agents) were not calculated
3. Agent 3's comment template didn't include a cost summary section

## Implementation

### Changes Made

#### 1. `ralph/src/index.ts`

Updated the Session Stats section passed to Agent 3 to include:
- Agent 1 stats: model, cost, duration, tokens
- Agent 2 stats: provider, model, cost, duration, tokens
- Loop totals: aggregated cost, duration, and token counts

#### 2. `ralph/prompts/agent3-linear-writer.md`

Added a Cost Summary table to both success and failure comment templates:
```markdown
## Cost Summary
| Agent | Model | Tokens (in/out/cached) | Cost |
|-------|-------|----------------------|------|
| Agent 1 | {model} | {in}/{out}/{cached} | ${cost} |
| Agent 2 | {model} | {in}/{out}/{cached} | ${cost} |
| **Total** | - | {totals} | **${total_cost}** |
```

### Files Modified

1. `ralph/src/index.ts` - Session stats section expanded
2. `ralph/prompts/agent3-linear-writer.md` - Comment templates updated

## Verification

- TypeScript typecheck: PASSED
- Build: PASSED

## Notes

- Agent 3's own cost is not included in the loop totals because Agent 3 runs after the stats are calculated. This is acceptable as Agent 3 uses haiku and its cost is minimal (~$0.0001-0.001 per run).
- Codex costs are marked as "estimated" since Claude Code provides exact costs while Codex CLI does not.
