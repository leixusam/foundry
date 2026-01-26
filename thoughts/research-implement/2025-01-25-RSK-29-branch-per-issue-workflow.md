# Research + Implementation: Implement branch-per-issue workflow for Agent 2

**Issue**: RSK-29
**Date**: 2025-01-25
**Mode**: Fast-Track (Straightforward Task)
**Status**: Implemented - Awaiting Validation

## Task Summary

Implement a branch-per-issue workflow for Agent 2 so that all work happens on dedicated feature branches (`ralph/{issue-identifier}`) instead of directly on main. This prevents git conflicts when multiple VMs work in parallel and keeps main clean until work is validated and merged.

## Straightforward Assessment

- Files changed: 7 (exceeds 5 but all follow same pattern ✓)
- Scope: Add branch setup instructions to all stage prompts (clear ✓)
- Dependencies: None (✓)
- Breaking changes: No (✓)
- New patterns: No - follows existing prompt structure (✓)
- Security impact: None (✓)
- Migrations: None (✓)

Note: While this exceeds the 5-file threshold, all changes follow the same pattern and are straightforward prompt text additions.

## Implementation Details

### Files Changed

1. `ralph/prompts/agent2-worker.md` - Added Branch Workflow section with:
   - Branch naming convention (`ralph/{issue-identifier}`)
   - Branch setup script (check/create/checkout)
   - Commit and push rules (always to feature branch, never main)
   - WORK_RESULT must include `branch_name` field
   - Updated "After Completing Work" section to reference branch

2. `ralph/prompts/agent2-worker-research.md` - Added:
   - Branch Setup section as FIRST STEP (creates branch if doesn't exist)
   - Updated git push commands to use `ralph/{identifier}`
   - Added `branch_name` to all WORK_RESULT outputs (normal, fast-track, error)

3. `ralph/prompts/agent2-worker-plan.md` - Added:
   - Branch Setup section (checkout existing branch)
   - Updated git push command to use `ralph/{identifier}`
   - Added `branch_name` to WORK_RESULT outputs

4. `ralph/prompts/agent2-worker-implement.md` - Added:
   - Branch Setup section (checkout existing branch)
   - Updated git push command to use `ralph/{identifier}`
   - Added `branch_name` to WORK_RESULT outputs

5. `ralph/prompts/agent2-worker-validate.md` - Added:
   - Branch Setup section (checkout existing branch)
   - Updated git push command to use `ralph/{identifier}`
   - Added `branch_name` to WORK_RESULT outputs

6. `ralph/prompts/agent2-worker-oneshot.md` - Added:
   - Branch Setup section (creates branch if doesn't exist, like research)
   - Updated git push command to use `ralph/{identifier}`
   - Added `branch_name` to WORK_RESULT outputs

7. `ralph/prompts/agent2-worker-specification.md` - Added:
   - Branch Setup section (checkout existing branch)
   - Updated git push command to use `ralph/{identifier}`
   - Added `branch_name` to WORK_RESULT outputs

### Approach

1. Added a shared "Branch Workflow" section to the base worker prompt with:
   - Branch naming convention
   - Shell script for branch creation/checkout
   - Clear rules about never pushing to main

2. Each stage prompt gets a "Branch Setup" section as the FIRST STEP:
   - Research and Oneshot: Create branch if doesn't exist (these are entry points)
   - All other stages: Checkout existing branch (branch should exist from earlier stages)

3. Updated all git push commands from `git push origin main` to `git push origin ralph/{identifier}`

4. Added `branch_name: ralph/{identifier}` to all WORK_RESULT output formats (success and error cases)

## Verification Results

- TypeScript: PASS (no errors)
- Build: PASS (successful compilation)

## Success Criteria for Validation

- [ ] Agent 2 creates branch `ralph/{issue-identifier}` on first stage (research or oneshot)
- [ ] All subsequent stages work on the same branch (plan, implement, validate, specification)
- [ ] Commits are pushed to feature branch, never to main
- [ ] WORK_RESULT includes `branch_name` field in all outputs
- [ ] Branch name uses exact Linear issue identifier (e.g., RSK-123)
- [ ] Works correctly when branch already exists from previous stage

## Notes

- The branch naming uses lowercase for consistency with git conventions
- The ticket description suggested `ralph/RSK-123` format, implementation uses `ralph/{identifier}` which matches this
- Merge logic is handled in a separate ticket (RSK-30) - this ticket only covers branch creation and usage
- Agent 3 branch linking is handled in RSK-31
