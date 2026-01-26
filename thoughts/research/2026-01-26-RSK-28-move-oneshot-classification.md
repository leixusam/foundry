# Research: Move oneshot classification from Agent 1 to Agent 2 research stage

**Issue**: RSK-28
**Date**: 2026-01-26
**Status**: Complete

## Summary

This ticket moves the oneshot vs staged workflow classification from Agent 1's simple label/estimate heuristics to Agent 2's research stage, where Opus can make a more informed decision after reading the requirements and exploring the codebase.

## Requirements Analysis

### Current Behavior (To Be Removed)
Agent 1 currently classifies tickets as "oneshot" if:
- Labels include: `chore`, `bug`, `small`, `quick-fix`, `trivial`, `hotfix`
- Estimate is XS or S

This happens at `ralph/prompts/agent1-linear-reader.md:98-101`.

### Desired Behavior

1. **Agent 1 Changes**:
   - Remove oneshot classification heuristics from Step 6
   - Agent 1 should only map current status to stage (research/specification/plan/implement/validate)
   - No longer output `stage: oneshot` based on labels/estimates

2. **Agent 2 Research Stage Changes**:
   - Update classification criteria to:
     - Can be completed by one engineer in one day, OR
     - Less than ~100 lines of code/changes
   - Add `workflow: oneshot | staged` field to WORK_RESULT output
   - If oneshot: `next_status` should route to oneshot flow
   - If staged: continue normal Research → Specification → Plan → Implement → Validate flow

3. **Agent 3 Changes**:
   - Handle `workflow` field in WORK_RESULT
   - Route to appropriate status based on classification

## Codebase Analysis

### Relevant Files

- `ralph/prompts/agent1-linear-reader.md` (173 lines)
  - Lines 98-101: Current oneshot heuristics to remove
  - Line 122: References "Oneshot In Progress" status
  - Line 144: Documents stage output includes "oneshot"

- `ralph/prompts/agent2-worker-research.md` (267 lines)
  - Lines 84-101: Current "Quick Complexity Assessment" with different criteria
  - Lines 229-246: WORK_RESULT output format (needs `workflow` field)
  - Line 99: Currently tells agent to switch to oneshot prompt mid-session

- `ralph/prompts/agent3-linear-writer.md` (215 lines)
  - Lines 140-152: Status update routing based on stage completion
  - Line 143: Research completion already routes based on `next_status`

- `ralph/prompts/agent2-worker.md` (36 lines)
  - Line 11: Maps `oneshot` stage to oneshot worker prompt
  - Reference only - no changes needed

- `ralph/prompts/agent2-worker-oneshot.md` (274 lines)
  - Reference for oneshot workflow - no changes needed

### Existing Patterns

1. **WORK_RESULT Format**: All agent stages output a structured WORK_RESULT block with `success`, `stage_completed`, `branch_name`, `next_status`, `summary`, etc.

2. **Status Routing**: Agent 3 uses `next_status` from Agent 2 to determine the Linear status update.

3. **Current Oneshot Redirect**: The research prompt tells Agent 2 to switch to oneshot prompt file if task is simple - this pattern can be preserved but criteria need updating.

### Dependencies

- Linear MCP tools (used by Agent 1 and Agent 3 only)
- Linear workflow statuses: "Research In Progress", "Oneshot In Progress", "Needs Specification", "Needs Plan", etc.

## Implementation Considerations

### Approach

**Recommended approach**: Update the existing flow to:

1. **Agent 1** removes heuristic-based oneshot detection. All new issues start with research stage (status-based mapping only).

2. **Agent 2 Research** updates the Quick Complexity Assessment to use the new criteria (1 day OR ~100 LOC) and outputs `workflow: oneshot | staged` in WORK_RESULT.

3. **When oneshot is detected during research**:
   - Agent 2 switches to oneshot flow immediately (current behavior)
   - Outputs WORK_RESULT with `stage_completed: oneshot`, `workflow: oneshot`
   - Sets `next_status: "Done"` or `next_status: "Blocked"` (as per oneshot completion)

4. **When staged is determined during research**:
   - Agent 2 completes research and outputs normally
   - Adds `workflow: staged` to WORK_RESULT
   - Sets `next_status: "Needs Specification"` or `"Needs Plan"` based on specification assessment

5. **Agent 3** handles the workflow field but routing logic mostly stays the same since oneshot completion already routes to "Done" or "Blocked".

### Alternative Approach (Not Recommended)

Have research output `workflow: oneshot` and `next_status: "Oneshot In Progress"`, then Agent 3 sets that status and the next iteration picks it up. This adds an extra loop iteration and is less efficient.

### Risks

1. **Status Transition Validity**: Need to ensure "Research In Progress" → "Done" (via oneshot in same session) is a valid Linear transition.

2. **Existing Oneshot Issues**: Issues already marked for "Oneshot In Progress" by the old system should still work - the oneshot worker prompt handles them.

3. **Criteria Subjectivity**: "1 day of work" and "~100 LOC" are estimates that Opus makes during research. This is actually the point - leverage Opus's judgment after seeing the codebase.

### Testing Strategy

1. **Manual testing with sample tickets**:
   - A clearly simple ticket (bug fix, config change) → should route to oneshot
   - A complex ticket (new feature, architectural change) → should route to staged

2. **Verify status transitions**:
   - Research → oneshot → Done (direct completion)
   - Research → Needs Specification → ... (staged flow)
   - Research → Needs Plan (staged, no spec needed)

3. **Edge cases**:
   - Ticket with `chore` label but complex scope → should be staged
   - Ticket without labels but simple fix → should be oneshot

## Specification Assessment

This feature does NOT need a UX specification because:
- Pure backend/infrastructure changes (agent prompt updates)
- No user-facing UI changes
- No UX decisions needed
- Clear requirements already specified in the ticket
- Follows existing patterns for agent prompts

**Needs Specification**: No

## Questions for Human Review

1. **Flow clarification**: Should oneshot completion during research still go through Agent 3 to mark "Done", or should the current behavior of completing in same session be preserved? (Current recommendation: preserve same-session completion)

2. **Criteria refinement**: The "1 day" and "~100 LOC" criteria are good heuristics, but should there be additional criteria considered? The current research prompt has more detailed criteria (5 files, no breaking changes, etc.) that could complement these.

3. **Transition from old tickets**: Any tickets already in "Oneshot In Progress" status from the old classification system - these will still be processed correctly by the oneshot worker, but should we document this edge case?

## Next Steps

Ready for planning phase. The implementation is well-defined:

1. Modify `agent1-linear-reader.md` to remove oneshot heuristics (Step 6)
2. Modify `agent2-worker-research.md` to update criteria and add `workflow` field
3. Modify `agent3-linear-writer.md` to document the workflow field handling (minimal changes needed)
