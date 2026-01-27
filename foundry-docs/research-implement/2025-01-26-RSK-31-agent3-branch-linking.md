# Research + Implementation: Update Agent 3 for branch linking and Blocked status handling

**Issue**: RSK-31
**Date**: 2025-01-26
**Mode**: Fast-Track (Straightforward Task)
**Status**: Implemented - Awaiting Validation

## Task Summary

Update Agent 3 (Linear Writer) to:
1. Attach feature branch links to Linear issues
2. Handle the new "Blocked" status when merge conflicts occur
3. Include branch information in completion comments

## Straightforward Assessment

- Files changed: 3 (≤5 ✓)
- Scope: Update prompt templates for Agent 3 and Agent 2 (clear ✓)
- Dependencies: None (✓)
- Breaking changes: No - additive changes to WORK_RESULT (✓)
- New patterns: No - follows existing patterns (✓)
- Security impact: None (✓)
- Migrations: None (✓)

## Implementation Details

### Files Changed

- `ralph/prompts/agent3-linear-writer.md` - Added branch linking section, blocked status comment format, updated status logic
- `ralph/prompts/agent2-worker-validate.md` - Added `repo_url` to all WORK_RESULT outputs, added Step 7.5 for getting repo URL
- `ralph/prompts/agent2-worker-oneshot.md` - Added `repo_url` to all WORK_RESULT outputs, added Step 7 for getting repo URL

### Approach

1. **Agent 3 Updates**:
   - Added "Branch Linking" section explaining how to construct and attach branch URLs
   - Added new fields to extract from WORK_RESULT: `branch_name`, `repo_url`, `merge_status`, `merge_conflict_files`
   - Updated comment format to include Branch, Commit, and Merge Status fields
   - Added "Merge Blocked" comment template with resolution steps
   - Updated Status Updates section to handle `merge_status: blocked` → "Blocked" (ID: `723acd28-e8a4-4083-a0ff-85986b42c2c2`)

2. **Agent 2 Validate Updates**:
   - Added Step 7.5 to get repository URL via `git remote get-url origin`
   - Added `repo_url` field to all WORK_RESULT outputs (success, blocked, failed)

3. **Agent 2 Oneshot Updates**:
   - Added Step 7 to get repository URL via `git remote get-url origin`
   - Added `repo_url` field to all WORK_RESULT outputs (success, blocked, error)

## Verification Results

- Tests: N/A (prompt files only)
- TypeScript: PASS
- Build: PASS

## Success Criteria for Validation

- [ ] Branch link attached to Linear issue when branch_name provided
- [ ] Completion comments include branch name and commit hash
- [ ] `merge_status: blocked` triggers "Blocked" status
- [ ] Blocked comment explains situation and provides resolution steps
- [ ] Conflicting files listed in blocked comment
- [ ] `merge_status: success` leads to "Done" status
- [ ] GitHub branch URL correctly formatted

## Notes

- The `repo_url` from Agent 2 may contain `.git` suffix - Agent 3 should handle this when constructing branch URLs
- Branch linking uses the `links` parameter on `mcp__linear__update_issue`
- Blocked status ID is hardcoded: `723acd28-e8a4-4083-a0ff-85986b42c2c2`
