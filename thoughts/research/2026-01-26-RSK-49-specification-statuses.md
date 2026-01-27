# Research: Consider adding specification statuses

**Issue**: RSK-49
**Date**: 2026-01-26
**Status**: Complete

## Summary

The specification statuses (`∞ Needs Specification` and `∞ Specification In Progress`) already exist and are fully integrated into the Foundry codebase. The only gap is that the README.md documentation doesn't mention these statuses, which could confuse users who read the docs but see these statuses in their Linear workspace.

## Requirements Analysis

The original request (from RSK-45 comment) asked to consider adding:
1. `∞ Needs Specification` status
2. `∞ Specification In Progress` status

The concern was that "only the research agent should have the authority to decide what should go into the specification status" - this is correctly implemented.

## Codebase Analysis

### Status Definitions ✅

**File**: `src/lib/linear-api.ts:22-38`

Both statuses are properly defined in `FOUNDRY_STATUS_DEFINITIONS`:
```typescript
{ name: `${FOUNDRY_STATUS_PREFIX} Needs Specification`, type: 'unstarted', color: STATE_COLORS.unstarted },
{ name: `${FOUNDRY_STATUS_PREFIX} Specification In Progress`, type: 'started', color: STATE_COLORS.started },
```

### Agent 1 (Linear Reader) ✅

**File**: `prompts/agent1-linear-reader.md`

Fully integrated:
- Line 44: `∞ Needs Specification` listed as ready status
- Line 73: Query instruction for `∞ Needs Specification`
- Line 81: Query instruction for `∞ Specification In Progress`
- Line 155: Status mapping: `∞ Needs Specification` → specification stage

### Agent 2 Research Worker ✅

**File**: `prompts/agent2-worker-research.md`

The research worker has specification assessment (Step 6) at lines 141-162:
- Criteria for when specification IS needed (UX changes, big features, etc.)
- Criteria for when specification is NOT needed (backend, bugs, copy changes)
- Outputs `next_status: "∞ Needs Specification"` or `"∞ Needs Plan"` based on assessment

This ensures only the research agent decides if specification is needed - matching the original requirement.

### Agent 2 Specification Worker ✅

**File**: `prompts/agent2-worker-specification.md`

Complete 280-line prompt for the specification stage that:
- Acts as PM/Designer perspective
- Focuses on UX touchpoints, simplicity, delight, and polish
- Produces specification documents in `thoughts/specifications/`
- Outputs `next_status: "∞ Needs Plan"` when complete

### Agent 3 (Linear Writer) ✅

**File**: `prompts/agent3-linear-writer.md:145-146`

Correctly handles routing:
- `research complete` → `∞ Needs Specification` or `∞ Needs Plan` (based on Agent 2's next_status)
- `specification complete` → `∞ Needs Plan`

### README Documentation ❌

**File**: `README.md:186-204`

The README lists these statuses:
```
Ready statuses (waiting for Foundry):
- ∞ Needs Research
- ∞ Needs Plan
- ∞ Needs Implement
- ∞ Needs Validate

In Progress statuses (Foundry is working):
- ∞ Research In Progress
- ∞ Plan In Progress
- ∞ Implement In Progress
- ∞ Validate In Progress
```

**Missing**:
- `∞ Needs Specification` (should be between Research and Plan)
- `∞ Specification In Progress` (should be between Research In Progress and Plan In Progress)

Additionally, the workflow diagram at lines 104-119 doesn't show the specification stage.

## Implementation Considerations

### What Needs to be Done

1. **Update README.md** - Add specification statuses to:
   - The "Linear Workflow Statuses" section (lines 186-204)
   - The workflow diagram (lines 104-119)

2. **No code changes needed** - All code is already in place

### Approach

Simple documentation update:
- Add `∞ Needs Specification` to ready statuses list
- Add `∞ Specification In Progress` to in-progress statuses list
- Update the ASCII workflow diagram to show specification as optional path

### Risks

- **Low risk**: This is purely a documentation change
- Users won't be confused when they see specification statuses in their Linear

### Testing Strategy

- Verify README renders correctly after changes
- No functional testing needed (code already works)

## Specification Assessment

This change is a pure documentation update with no user-facing impact (it documents existing behavior). No UX decisions needed.

**Needs Specification**: No

## Questions for Human Review

None - the research findings are clear and the path forward is straightforward.

## Next Steps

Ready for planning phase. The plan will be simple:
1. Update README.md to include specification statuses
2. Update the workflow diagram to show specification stage
