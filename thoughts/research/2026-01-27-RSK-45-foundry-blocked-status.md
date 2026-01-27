# Research: Create Foundry Blocked Status

**Issue**: RSK-45
**Date**: 2026-01-27
**Status**: Complete

## Summary

This ticket requests adding a `∞ Blocked` status to Foundry's workflow. This status is used when an agent is unclear about something and needs human input. Tickets in this status should NOT be automatically picked up by agents.

The comment on the ticket also asks about `∞ Needs Specification` and `∞ Specification In Progress` statuses - both already exist in the codebase (confirmed in `linear-api.ts:25-30`).

## Requirements Analysis

### Primary Requirements
1. **Create `∞ Blocked` status** during project initialization alongside other Foundry statuses
2. **Update README** to document this status and its purpose
3. **Update agent prompts** so agents:
   - Know about this status
   - Do NOT pick up tickets in `∞ Blocked` status
   - Can transition tickets TO this status when blocked (needs human input)

### Secondary Clarifications (from comment)
- `∞ Needs Specification` - Already exists (`linear-api.ts:25`)
- `∞ Specification In Progress` - Already exists (`linear-api.ts:30`)
- Only research agent should decide what goes into specification status - this is already how it works (`agent2-worker-research.md:159`)

## Codebase Analysis

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `src/lib/linear-api.ts` | Status definitions for initialization | Add `∞ Blocked` to `FOUNDRY_STATUS_DEFINITIONS` |
| `README.md` | User-facing documentation | Add `∞ Blocked` to Linear Workflow Statuses section |
| `prompts/agent1-linear-reader.md` | Agent 1 ticket selection logic | Add `∞ Blocked` to hard filters (must skip) |
| `prompts/agent2-worker-*.md` | Worker agent prompts | May need to document when to use `∞ Blocked` |
| `prompts/agent3-linear-writer.md` | Status transition logic | May need to add ability to set `∞ Blocked` |

### Existing Patterns

**Status Definition Pattern** (`src/lib/linear-api.ts:22-37`):
```typescript
export const FOUNDRY_STATUS_DEFINITIONS: FoundryStatusWithColor[] = [
  { name: `${FOUNDRY_STATUS_PREFIX} Backlog`, type: 'backlog', color: STATE_COLORS.backlog },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Research`, type: 'unstarted', color: STATE_COLORS.unstarted },
  // ... etc
];
```

**Status Type Options** (Linear workflow state types):
- `backlog` - Issue in backlog
- `unstarted` - Ready but not started
- `started` - In progress
- `completed` - Done
- `canceled` - Canceled

For `∞ Blocked`, the appropriate type is **`started`** (same as other "In Progress" statuses) because:
- The work has been started (agent attempted it)
- It's not unstarted (we don't want it picked up for new work)
- It's not completed or canceled
- It signals "waiting for input"

However, **`backlog`** could also be appropriate to ensure it doesn't get counted in "in progress" metrics. This is a design decision.

**Recommendation**: Use type `started` with a distinct color (red/orange for "blocked") to clearly signal it needs attention.

### Agent 1 Filtering Logic

In `prompts/agent1-linear-reader.md:80-101`, the hard filters are:

1. Blocked by incomplete dependency
2. Claimed by another agent within the last hour
3. Completed or canceled status

**New filter needed**: Issues in `∞ Blocked` status should be skipped. This is straightforward to add.

### Agent 2 Output Capability

Currently Agent 2 can output:
- `next_status: "∞ Needs Specification"` or `"∞ Needs Plan"` (research stage)
- `next_status: "∞ Done"` (oneshot/validate stages)

Agent 2 could theoretically output `next_status: "∞ Blocked"` when it encounters ambiguity. However, the current workflow doesn't have a clear pattern for this.

**Consideration**: When should Agent 2 use `∞ Blocked`?
- When requirements are unclear and can't be resolved by research
- When there's conflicting information
- When human decision is needed
- When blocked by external dependencies not tracked in Linear

### Agent 3 Behavior

Agent 3 (`prompts/agent3-linear-writer.md`) currently handles:
- Setting status based on `next_status` from Agent 2
- Using existing "Blocked" status for merge conflicts (line 152-153)

**Note**: There's already a "Blocked" status referenced (ID: `723acd28-e8a4-4083-a0ff-85986b42c2c2`). This appears to be the team's built-in Blocked status, not a Foundry-specific one. The new `∞ Blocked` would be Foundry-specific and created during initialization.

## Implementation Considerations

### Approach

1. **Add status definition** in `linear-api.ts`:
   ```typescript
   { name: `${FOUNDRY_STATUS_PREFIX} Blocked`, type: 'started', color: '#eb5757' },  // Red for attention
   ```

2. **Update Agent 1 prompt** to add hard filter:
   - Add `∞ Blocked` to the list of statuses to skip
   - Clarify it's for human intervention

3. **Update README**:
   - Add `∞ Blocked` to the status list
   - Explain when it's used

4. **Optionally update Agent 2/3**:
   - Define when Agent 2 should transition to `∞ Blocked`
   - Ensure Agent 3 can set this status

### Color Choice

Looking at existing colors:
- Gray (`#95a2b3`) - backlog/canceled
- Light gray (`#e2e2e2`) - unstarted
- Yellow (`#f2c94c`) - in progress
- Purple (`#5e6ad2`) - done

For Blocked, suggest **Red** (`#eb5757`) to signal attention needed.

### Status Type Decision

**Recommended**: `started` type
- Rationale: The issue is "in progress" from Foundry's perspective - it was picked up but is now waiting for human input
- Alternative: `backlog` could work if we want it to appear in "not started" metrics
- Decision: Use `started` to match the semantic of "work in progress but blocked"

### Risks

1. **Agents could overuse `∞ Blocked`**: Clear guidelines needed for when to use it
2. **Existing "Blocked" status confusion**: The team already has a "Blocked" status. The `∞ Blocked` is Foundry-specific. Need clear documentation.
3. **Status transitions**: Need to define how tickets move OUT of `∞ Blocked` (human sets back to appropriate "Needs X" status)

### Testing Strategy

1. Run `foundry init` on a test team and verify `∞ Blocked` is created
2. Create a ticket in `∞ Blocked` status and verify Agent 1 skips it
3. Verify README accurately documents the status

## Specification Assessment

This feature does NOT need a UX specification because:
- No user-facing UI changes (this is Linear status management)
- Backend/infrastructure change only
- Clear requirements from ticket and comment
- Following existing patterns exactly

**Needs Specification**: No

## Questions for Human Review

1. **Status type**: Should `∞ Blocked` be type `started` or `backlog`? (Recommended: `started`)
2. **When to use**: Should we define specific criteria for when Agent 2 should set `∞ Blocked`?
3. **Transition out**: Is it expected that humans manually move issues out of `∞ Blocked` back to the appropriate "Needs X" status?

## Next Steps

Ready for planning phase - the changes are well-defined and follow existing patterns.
