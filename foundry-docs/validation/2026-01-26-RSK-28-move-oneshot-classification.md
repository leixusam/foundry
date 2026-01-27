# Validation Report: Move oneshot classification from Agent 1 to Agent 2 research stage

**Issue**: RSK-28
**Date**: 2026-01-26
**Plan**: thoughts/plans/2026-01-26-RSK-28-move-oneshot-classification.md
**Status**: PASSED

## Summary

All acceptance criteria have been verified. The implementation successfully moves oneshot classification from Agent 1's label/estimate heuristics to Agent 2's research stage, where the classification can be made based on actual complexity assessment after understanding the requirements and codebase.

## Automated Checks

### Tests
- Status: N/A
- Note: This project has no test suite configured

### TypeScript
- Status: PASS
- Errors: 0

### Build
- Status: PASS
- Output: Clean compilation

## Success Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| Agent 1 no longer makes oneshot vs staged decisions based on labels/estimates | PASS | No label heuristics (`chore`, `bug`, `small`, etc.) or estimate heuristics (`XS`, `S`) found in Agent 1 prompt |
| Agent 2 research stage outputs `workflow: oneshot \| staged` in WORK_RESULT | PASS | Line 245: `workflow: staged` in WORK_RESULT format |
| Classification uses defined criteria (1 day of work OR ~100 LOC) | PASS | Lines 89-90: Both criteria clearly documented |
| Agent 3 correctly routes based on Agent 2's classification | PASS | Lines 14, 138: `workflow` field documented as informational; routing uses `next_status` |
| Existing research → plan → implement → validate flow still works for staged tickets | PASS | Research prompt outputs proper `next_status` values for staged flow |
| Simple tasks still redirect to oneshot flow during research | PASS | Lines 106-110: Redirection logic to oneshot worker documented |
| Type check passes: `npm run typecheck` | PASS | Clean pass with no errors |

## Issues Found

None.

## Files Changed

- `ralph/prompts/agent1-linear-reader.md` - Removed label/estimate-based oneshot heuristics; Step 6 now purely maps status to stage
- `ralph/prompts/agent2-worker-research.md` - Added classification criteria (1 day OR ~100 LOC) with additional indicators; added `workflow: staged` to WORK_RESULT
- `ralph/prompts/agent2-worker-oneshot.md` - Added `workflow: oneshot` to all WORK_RESULT formats (success, blocked, error)
- `ralph/prompts/agent3-linear-writer.md` - Documented `workflow` field in extraction list and clarified it's informational (routing uses `next_status`)

## Verification Commands

All verification commands from the plan passed:

```bash
# Agent 1 - labels heuristic removed
grep -n "chore.*bug.*small" ralph/prompts/agent1-linear-reader.md || echo "Labels heuristic removed ✓"
# Result: Labels heuristic removed ✓

# Agent 1 - estimate heuristic removed
grep -n "Estimate is XS or S" ralph/prompts/agent1-linear-reader.md || echo "Estimate heuristic removed ✓"
# Result: Estimate heuristic removed ✓

# Agent 2 Research - day criterion present
grep -n "one day" ralph/prompts/agent2-worker-research.md
# Result: Line 89: "- Can be completed by one engineer in one day, OR"

# Agent 2 Research - LOC criterion present
grep -n "100 lines" ralph/prompts/agent2-worker-research.md
# Result: Line 90: "- Less than ~100 lines of code/changes"

# Agent 2 Research - workflow field present
grep -n "workflow:" ralph/prompts/agent2-worker-research.md
# Result: Multiple lines showing workflow field usage

# Agent 2 Oneshot - workflow field present
grep -n "workflow: oneshot" ralph/prompts/agent2-worker-oneshot.md
# Result: Lines 224, 243, 263 - present in all WORK_RESULT formats

# Agent 3 - workflow documented
grep -n "workflow" ralph/prompts/agent3-linear-writer.md
# Result: Lines 14, 138 - properly documented
```

## Recommendation

**APPROVE**: Ready for production.

All acceptance criteria have been met. The implementation is clean and maintains backward compatibility for issues already in "Oneshot In Progress" status. The workflow classification logic has been successfully moved to Agent 2's research stage where Opus can make informed decisions based on actual complexity assessment.
