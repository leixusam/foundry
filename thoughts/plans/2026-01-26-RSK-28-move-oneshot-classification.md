# Implementation Plan: Move oneshot classification from Agent 1 to Agent 2 research stage

**Issue**: RSK-28
**Date**: 2026-01-26
**Research**: thoughts/research/2026-01-26-RSK-28-move-oneshot-classification.md
**Specification**: N/A
**Status**: Ready for Implementation

## Overview

Move the oneshot vs staged workflow classification from Agent 1's label/estimate heuristics to Agent 2's research stage, where Opus can make informed decisions after reading requirements and exploring the codebase. Agent 1 will only map statuses to stages, Agent 2 will classify workflow type and output it in WORK_RESULT, and Agent 3 will handle routing accordingly.

## Success Criteria

- [ ] Agent 1 no longer makes oneshot vs staged decisions based on labels/estimates
- [ ] Agent 2 research stage outputs `workflow: oneshot | staged` in WORK_RESULT
- [ ] Classification uses defined criteria (1 day of work OR ~100 LOC)
- [ ] Agent 3 correctly routes based on Agent 2's classification
- [ ] Existing research → plan → implement → validate flow still works for staged tickets
- [ ] Simple tasks still redirect to oneshot flow during research
- [ ] Type check passes: `npm run typecheck`

## Phases

### Phase 1: Update Agent 1 - Remove Oneshot Heuristics

**Goal**: Remove label/estimate-based oneshot classification from Agent 1, making it purely status-based.

**Changes**:
- `ralph/prompts/agent1-linear-reader.md`:
  - Lines 98-101: Remove the ONESHOT classification block entirely
  - Line 102: Keep only the STAGED status-to-stage mapping
  - Line 122: Update "Oneshot In Progress" reference (keep it - still valid for issues already in that status from Agent 2)
  - Line 144: Remove "oneshot" from the stage examples, clarify Agent 2 decides workflow

**Specific edits**:

1. Replace lines 96-110 (Step 6: Decide Stage) with:
```markdown
### Step 6: Decide Stage

Map the issue's current status to the appropriate stage:
- Backlog status (type "backlog") → research
- "Needs Research" or similar unstarted status → research
- "Needs Specification" → specification
- "Needs Plan" → plan
- "Needs Implement" → implement
- "Needs Validate" → validate
- "Oneshot In Progress" → oneshot (for issues already classified by Agent 2)

Use the actual status names from Step 1 to determine the appropriate stage.

**Note**: Agent 1 no longer decides whether a ticket is oneshot or staged. Agent 2 makes this determination during the research stage based on actual complexity assessment.
```

2. Update line 144 to clarify stage output:
```markdown
- Stage to execute (research/specification/plan/implement/validate, or oneshot if status is "Oneshot In Progress")
```

**Verification**:
```bash
# Verify no syntax errors in markdown
cat ralph/prompts/agent1-linear-reader.md | head -200

# Check the oneshot heuristics are removed
grep -n "chore.*bug.*small" ralph/prompts/agent1-linear-reader.md || echo "Labels heuristic removed ✓"
grep -n "Estimate is XS or S" ralph/prompts/agent1-linear-reader.md || echo "Estimate heuristic removed ✓"
```

### Phase 2: Update Agent 2 Research - New Classification Criteria and Workflow Output

**Goal**: Update research stage to use new classification criteria and output `workflow` field.

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - Lines 84-101: Update "Quick Complexity Assessment" with new criteria
  - Lines 228-246: Add `workflow: oneshot | staged` to WORK_RESULT format

**Specific edits**:

1. Replace lines 84-101 (Step 2: Quick Complexity Assessment) with:
```markdown
### Step 2: Quick Complexity Assessment

After understanding requirements, assess whether this task should follow the oneshot or staged workflow.

**Oneshot Criteria** (either condition is sufficient):
- Can be completed by one engineer in one day, OR
- Less than ~100 lines of code/changes

**Additional oneshot indicators** (supporting evidence, not required):
- Changes limited to 5 or fewer files
- Clear, well-defined scope with no ambiguity
- Follows existing patterns already established in codebase
- No new architectural patterns or major structural changes

**Staged workflow indicators** (any of these suggests staged):
- Requires architectural decisions or design review
- Involves complex dependencies or external integrations
- Breaking changes to existing APIs or interfaces
- Security-sensitive changes (auth, encryption, user data)
- Database migrations required
- Multiple phases of work needed

**Classification decision**:
- If task meets **oneshot criteria**: Read and follow `ralph/prompts/agent2-worker-oneshot.md` instead of continuing with research. The oneshot worker will complete the task in this session.
- If task requires **staged workflow**: Continue with the normal research flow below and output `workflow: staged` in WORK_RESULT.

**Important**: When redirecting to oneshot, you will complete the task in this same session. The oneshot WORK_RESULT will include `workflow: oneshot`.
```

2. Update WORK_RESULT format (around line 232) to include workflow field:
```markdown
After completing research, output:

```
WORK_RESULT:
  success: true
  stage_completed: research
  workflow: staged
  branch_name: ralph/{identifier}
  artifact_path: thoughts/research/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash}
  next_status: "Needs Specification"  # OR "Needs Plan" if specification not needed
  summary: |
    {Description of what was researched and key findings}
```

**Note**: Research stage always outputs `workflow: staged` because if the task was classified as oneshot, the agent would have switched to the oneshot worker prompt and that stage outputs `workflow: oneshot`.
```

**Verification**:
```bash
# Verify the new criteria are present
grep -n "one day" ralph/prompts/agent2-worker-research.md && echo "Day criteria present ✓"
grep -n "100 lines" ralph/prompts/agent2-worker-research.md && echo "LOC criteria present ✓"

# Verify workflow field in WORK_RESULT
grep -n "workflow:" ralph/prompts/agent2-worker-research.md && echo "Workflow field present ✓"
```

### Phase 3: Update Agent 2 Oneshot Worker - Add Workflow Output

**Goal**: Ensure oneshot worker outputs `workflow: oneshot` in WORK_RESULT.

**Changes**:
- `ralph/prompts/agent2-worker-oneshot.md`:
  - Add `workflow: oneshot` field to both success and blocked WORK_RESULT formats

**Specific edits**:

1. Update success WORK_RESULT format (around line 221) to add workflow field after stage_completed:
```markdown
WORK_RESULT:
  success: true
  stage_completed: oneshot
  workflow: oneshot
  branch_name: ralph/{identifier}
  ...
```

2. Update blocked WORK_RESULT format (around line 239) to add workflow field:
```markdown
WORK_RESULT:
  success: true
  stage_completed: oneshot
  workflow: oneshot
  branch_name: ralph/{identifier}
  ...
```

3. Update error WORK_RESULT format (around line 255) to add workflow field:
```markdown
WORK_RESULT:
  success: false
  stage_completed: oneshot
  workflow: oneshot
  branch_name: ralph/{identifier}
  ...
```

**Verification**:
```bash
# Verify workflow field added to oneshot WORK_RESULT
grep -n "workflow: oneshot" ralph/prompts/agent2-worker-oneshot.md && echo "Oneshot workflow field present ✓"
```

### Phase 4: Update Agent 3 - Document Workflow Field Handling

**Goal**: Update Agent 3 documentation to acknowledge the workflow field, though routing already works via next_status.

**Changes**:
- `ralph/prompts/agent3-linear-writer.md`:
  - Add `workflow` to the list of fields to extract from WORK_RESULT
  - Clarify that routing uses next_status (workflow is informational)

**Specific edits**:

1. Update the key data extraction section (around line 12-18) to add workflow field:
```markdown
2. **Extract key data** from Agent 2's WORK_RESULT:
   - `workflow`: The workflow type (`oneshot` or `staged`) - informational
   - `commit_hash`: The git commit hash
   - `branch_name`: The feature branch (e.g., `ralph/RSK-123`)
   - `repo_url`: The GitHub repository URL (if provided)
   - `merge_status`: `success` or `blocked` (if merge was attempted)
   - `merge_conflict_files`: List of files with conflicts (if merge was blocked)
```

2. Add a note to the status updates section (around line 135) clarifying workflow vs next_status:
```markdown
## Status Updates

**Note**: Agent 2's `workflow` field indicates whether the task followed oneshot or staged flow. Status routing is determined by `next_status` from Agent 2, not the `workflow` field directly. The `workflow` field is primarily for logging and tracking purposes.

Update the issue status based on what happened AND the merge status:
```

**Verification**:
```bash
# Verify workflow field documented
grep -n "workflow" ralph/prompts/agent3-linear-writer.md && echo "Workflow documented in Agent 3 ✓"
```

## Testing Strategy

### Manual Verification
1. Read through each modified file to ensure prompt coherence
2. Verify all WORK_RESULT formats are consistent across agents
3. Check that the flow from research → oneshot redirect is still documented clearly

### Flow Verification
The implementation maintains these flows:
1. **Simple ticket (discovered during research)**:
   - Agent 1: Sets stage=research
   - Agent 2 Research: Classifies as oneshot, redirects to oneshot worker
   - Agent 2 Oneshot: Completes work, outputs `workflow: oneshot`, `next_status: "Done"`
   - Agent 3: Updates to Done

2. **Complex ticket**:
   - Agent 1: Sets stage=research
   - Agent 2 Research: Classifies as staged, outputs `workflow: staged`, `next_status: "Needs Specification" or "Needs Plan"`
   - Agent 3: Updates accordingly
   - (continues through plan, implement, validate stages)

3. **Already in Oneshot status** (from previous classification):
   - Agent 1: Sets stage=oneshot (status-based)
   - Agent 2 Oneshot: Completes work
   - Agent 3: Updates to Done

## Rollback Plan

All changes are to prompt files only. To rollback:
```bash
git checkout main -- ralph/prompts/agent1-linear-reader.md
git checkout main -- ralph/prompts/agent2-worker-research.md
git checkout main -- ralph/prompts/agent2-worker-oneshot.md
git checkout main -- ralph/prompts/agent3-linear-writer.md
```

## Notes

- This is a prompt-only change, no TypeScript code modifications required
- The `workflow` field is informational - actual routing uses `next_status`
- Existing tickets in "Oneshot In Progress" status will still work correctly
- The criteria "1 day OR ~100 LOC" leverage Opus's judgment after seeing the codebase, which is the goal of this change
- Total estimated changes: ~80-100 lines across 4 files
