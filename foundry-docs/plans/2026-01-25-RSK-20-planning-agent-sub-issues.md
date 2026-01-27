# Implementation Plan: Planning Agent Sub-Issue Creation

**Issue**: RSK-20
**Date**: 2026-01-25
**Research**: thoughts/research/2026-01-25-RSK-20-planning-agent-sub-issues.md
**Status**: Implementation Complete

## Overview

This plan implements the ability for Agent 2 (Plan Worker) to recommend sub-issues when an issue is too large or complex, and for Agent 3 (Linear Writer) to create those sub-issues in Linear with proper parent-child relationships.

The key insight is that complexity is only truly understood during planning, not during initial triage. When a plan reveals >1000 lines of estimated changes or logically separable feature components, the planning agent can recommend breaking it down into sub-issues.

## Success Criteria

- [x] `WorkResult` type includes optional `subIssues` array
- [x] `SubIssueRecommendation` interface defined in types.ts
- [x] `parseWorkResult` function parses sub_issues from YAML
- [x] Agent 2 plan prompt includes complexity assessment guidance
- [x] Agent 3 prompt includes sub-issue creation logic
- [x] Agent 1 prompt acknowledges sub-issues may exist
- [x] Type check passes: `npm run typecheck`
- [x] Build passes: `npm run build`

## Phases

### Phase 1: Type Definitions

**Goal**: Add TypeScript interfaces for sub-issue recommendations.

**Changes**:
- `ralph/src/types.ts`:
  - Add `SubIssueRecommendation` interface with fields: `title`, `description`, `planSection`, `estimatedScope`
  - Add optional `subIssues?: SubIssueRecommendation[]` field to `WorkResult` interface

**Code Pattern**:
```typescript
// Add after line 41 (after WorkResult interface)
export interface SubIssueRecommendation {
  title: string;           // Sub-issue title (e.g., "RSK-20a: Implement API layer")
  description: string;     // Sub-issue description
  planSection: string;     // Reference to plan section (e.g., "Phase 2: API Layer")
  estimatedScope: string;  // Brief scope estimate (e.g., "~400 lines, 3 endpoints")
}

// Modify WorkResult interface to add:
subIssues?: SubIssueRecommendation[];
```

**Verification**:
```bash
cd ralph && npm run typecheck
```

### Phase 2: Parser Updates

**Goal**: Enable parsing of sub_issues from WORK_RESULT YAML blocks.

**Changes**:
- `ralph/src/lib/parsers.ts`:
  - Import `SubIssueRecommendation` type
  - Add parsing logic for `sub_issues` array in `parseWorkResult` function
  - Handle both array format and graceful fallback if missing

**Code Pattern** (add after line 231, before the final `return`):
```typescript
// Parse sub_issues array
const subIssuesMatch = yamlContent.match(/sub_issues:\s*\n([\s\S]*?)(?=\n\s*[a-z_]+:|$)/i);
if (subIssuesMatch) {
  const subIssuesContent = subIssuesMatch[1];
  const subIssues: SubIssueRecommendation[] = [];

  // Match each sub-issue block (starts with "- title:")
  const issueBlocks = subIssuesContent.split(/\n\s*-\s+title:/).slice(1);
  for (const block of issueBlocks) {
    const titleMatch = block.match(/^(.+)/);
    const descMatch = block.match(/description:\s*\|\s*\n([\s\S]*?)(?=\n\s{6}\w+:|$)/);
    const planMatch = block.match(/plan_section:\s*["']?([^"'\n]+)["']?/);
    const scopeMatch = block.match(/estimated_scope:\s*["']?([^"'\n]+)["']?/);

    if (titleMatch) {
      subIssues.push({
        title: titleMatch[1].trim(),
        description: descMatch?.[1]?.trim() || '',
        planSection: planMatch?.[1]?.trim() || '',
        estimatedScope: scopeMatch?.[1]?.trim() || '',
      });
    }
  }

  if (subIssues.length > 0) {
    result.subIssues = subIssues;
  }
}
```

**Verification**:
```bash
cd ralph && npm run typecheck && npm run build
```

### Phase 3: Agent 2 Plan Prompt Update

**Goal**: Add complexity assessment and sub-issue recommendation guidance to the planning prompt.

**Changes**:
- `ralph/prompts/agent2-worker-plan.md`:
  - Add new section "Step 4.5: Assess Complexity" between Step 4 and Step 5
  - Add sub_issues field to WORK_RESULT output format
  - Provide clear guidelines on when to recommend sub-issues

**New Section** (add after Step 4, before Step 5):
```markdown
### Step 4.5: Assess Complexity and Consider Sub-Issues

After writing the plan, assess whether this issue should be broken into sub-issues.

**When to recommend sub-issues:**
- Total estimated lines of code changes exceed ~1000 LOC across all phases
- The work contains logically separable components that could be developed independently
- Different phases could be assigned to different agents working in parallel
- The work spans multiple distinct areas (e.g., "backend API" + "frontend UI" + "data migration")

**When NOT to create sub-issues:**
- Tasks are internal implementation steps within a single logical feature
- The work is sequential and each part depends on the previous
- Total scope is under ~1000 LOC
- The components aren't meaningful work items on their own

**Important distinction**: Sub-issues are NOT the same as implementation phases/tasks. Phases are steps within a single work item. Sub-issues are separate work items that:
- Get tracked individually in Linear
- Could be assigned to different developers/agents
- Have their own status tracking
- Reference back to sections of this plan document

If sub-issues are warranted, include them in your WORK_RESULT output.
```

**Update Output Format** (modify the success WORK_RESULT section):
```markdown
After completing your work, output:

```
WORK_RESULT:
  success: true
  stage_completed: plan
  artifact_path: thoughts/plans/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash}
  next_status: "Needs Implement"
  summary: |
    {Description of the plan - number of phases, key decisions made}
  sub_issues:                    # OPTIONAL - only include if complexity warrants it
    - title: "{identifier}a: {Sub-issue title}"
      description: |
        {Brief description of this sub-issue}
        See {plan section} of the implementation plan.
      plan_section: "Phase X: {Section Name}"
      estimated_scope: "~{N} lines, {brief scope description}"
    - title: "{identifier}b: {Second sub-issue title}"
      ...
```

Note: Only include `sub_issues` if the complexity assessment determines they are needed. Most issues will NOT need sub-issues.
```

**Verification**:
```bash
# Verify the markdown is valid
cat ralph/prompts/agent2-worker-plan.md | head -200
```

### Phase 4: Agent 3 Linear Writer Update

**Goal**: Enable Agent 3 to create sub-issues in Linear based on Agent 2's recommendations.

**Changes**:
- `ralph/prompts/agent3-linear-writer.md`:
  - Add section explaining sub-issue handling
  - Document how to create sub-issues with parentId
  - Update comment format to report created sub-issues

**New Section** (add after "Status Updates" section, before "Reminders"):
```markdown
## Creating Sub-Issues

If Agent 2's WORK_RESULT contains a `sub_issues` array, create each sub-issue in Linear:

1. **Parse sub-issues** from Agent 2's output (look for `sub_issues:` block in WORK_RESULT)

2. **For each sub-issue**, use `mcp__linear__create_issue`:
   - `title`: Use the title from the sub-issue
   - `description`: Use the description from the sub-issue
   - `team`: Same team as the parent issue
   - `parentId`: The issue ID from Agent 1's output (this links it as a sub-issue)
   - `state`: "Needs Implement" (since the plan already covers their implementation)
   - `labels`: Copy any relevant labels from the parent issue

3. **Report creation** in your comment:
   ```
   ## Sub-Issues Created
   - {sub-issue identifier}: {title}
   - {sub-issue identifier}: {title}
   ```

4. **Error handling**: If sub-issue creation fails:
   - Log the error but don't fail the entire update
   - Report which sub-issues could not be created
   - The main issue status should still be updated

Example sub-issue creation:
```
mcp__linear__create_issue({
  title: "RSK-20a: Implement parser changes",
  description: "Implement parser updates for sub-issue support.\nSee Phase 2 of the implementation plan.",
  team: "RSK",
  parentId: "48ec45b4-5058-48d0-9b99-9d9824d2b9a5",
  state: "Needs Implement"
})
```
```

**Verification**:
```bash
# Verify the markdown is valid
cat ralph/prompts/agent3-linear-writer.md
```

### Phase 5: Agent 1 Minor Update

**Goal**: Add awareness of sub-issues to Agent 1's issue selection logic.

**Changes**:
- `ralph/prompts/agent1-linear-reader.md`:
  - Add a brief note in Step 5 (Gather Full Context) about sub-issues
  - Clarify that sub-issues created during planning are ready for implementation

**Update** (add to Step 5 bullet point "Sub-Issues"):
```markdown
- **Sub-Issues**: List children to understand scope. Note: Some sub-issues may have been created during the planning stage and already have plans. These will typically be in "Needs Implement" status.
```

**Verification**:
```bash
# Verify the markdown is valid
cat ralph/prompts/agent1-linear-reader.md | grep -A 5 "Sub-Issues"
```

## Testing Strategy

### Manual Testing

1. **Type/Build Verification**:
   ```bash
   cd ralph && npm run typecheck && npm run build
   ```

2. **Parser Testing**: Create a test WORK_RESULT string with sub_issues and verify parsing:
   - Write a simple test script that calls `parseWorkResult` with sample data
   - Verify the parsed result contains the expected sub-issues array

3. **Integration Testing**: Run Ralph on a sufficiently complex ticket and verify:
   - Agent 2 assesses complexity and outputs sub_issues if warranted
   - Agent 3 creates the sub-issues in Linear with correct parentId
   - Sub-issues appear as children of the main issue in Linear

### Automated Testing (Future)

- Add unit tests for `parseWorkResult` with sub_issues
- Add integration tests for Agent 2 → Agent 3 sub-issue flow

## Rollback Plan

If issues arise:
1. Revert the changes with `git revert {commit}`
2. The feature is additive and optional - existing functionality is unchanged
3. If only Agent 3 fails, sub-issues won't be created but main issue still updates

## Notes

### Sub-Issue Naming Convention
Sub-issues should be named with a suffix (e.g., `RSK-20a`, `RSK-20b`) to clearly show their relationship to the parent. This is a convention in the prompt, not enforced by Linear.

### Status for Sub-Issues
Sub-issues are created with "Needs Implement" status because:
- The research was done for the parent issue
- The plan document covers their implementation details
- They are ready to be picked up by any available agent

### Parser Robustness
The parser should gracefully handle:
- Missing sub_issues (most cases)
- Malformed sub_issues YAML
- Empty sub_issues array
In all error cases, parsing should continue without sub_issues rather than failing.

## File Change Summary

| File | Type | Lines Changed |
|------|------|---------------|
| `ralph/src/types.ts` | Add types | ~15 |
| `ralph/src/lib/parsers.ts` | Parse sub_issues | ~35 |
| `ralph/prompts/agent2-worker-plan.md` | Complexity assessment | ~50 |
| `ralph/prompts/agent3-linear-writer.md` | Sub-issue creation | ~45 |
| `ralph/prompts/agent1-linear-reader.md` | Minor note | ~5 |
| **Total** | | **~150** |
