# Implementation Plan: Update Agent 2 Prompt for Straightforward Task Shortcut

**Issue**: RSK-10
**Date**: 2025-01-25
**Research**: `thoughts/research/2025-01-25-RSK-10-agent2-straightforward-shortcut.md`
**Status**: Ready for Implementation

## Overview

Modify the Agent 2 research prompt to allow straightforward tasks to proceed directly through research + plan + implement in a single session, while ensuring validation always remains a separate step. This reduces round-trips for simple work without compromising quality through the mandatory validation gate.

## Success Criteria

- [ ] Research prompt includes "Straightforward Assessment" step after understanding requirements
- [ ] Clear criteria defined for what qualifies as "straightforward"
- [ ] When task is straightforward: research, create inline plan, implement, then output `next_status: "Needs Validate"`
- [ ] When task is not straightforward: follow normal research-only flow with `next_status: "Needs Plan"`
- [ ] Validation always remains as separate step (never combined)
- [ ] Combined document created for fast-track mode: `thoughts/research-implement/YYYY-MM-DD-{identifier}-{slug}.md`
- [ ] All tests pass: `npm run test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint`

## Phases

### Phase 1: Update Research Prompt with Straightforward Assessment

**Goal**: Add a decision point in the research prompt that assesses whether a task is straightforward enough to fast-track.

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - Add "Step 2: Straightforward Assessment" after understanding requirements
  - Define clear criteria for "straightforward" tasks
  - Add branching logic: if straightforward → fast-track flow, else → normal flow

**New Section to Add** (after Step 1):

```markdown
### Step 2: Straightforward Assessment

After understanding requirements, assess if this task qualifies for fast-track (combined research + plan + implement):

**Criteria for Straightforward Tasks** (ALL must be true):
- [ ] Changes limited to 5 or fewer files
- [ ] Clear, well-defined scope with no ambiguity
- [ ] No complex dependencies or external integrations
- [ ] No breaking changes to existing APIs or interfaces
- [ ] No new architectural patterns or major structural changes
- [ ] Follows existing patterns already established in codebase
- [ ] No security-sensitive changes (auth, encryption, user data)
- [ ] No database migrations required
- [ ] Estimated implementation time under 30 minutes

**If ALL criteria are met**: Proceed to Fast-Track Flow (Step 2A)
**If ANY criteria is NOT met**: Proceed to Normal Research Flow (Step 3)
```

**Verification**:
```bash
# Check file is syntactically valid markdown
cat ralph/prompts/agent2-worker-research.md | head -100
```

### Phase 2: Add Fast-Track Flow Section

**Goal**: Define the complete fast-track workflow that combines research, planning, and implementation in one session.

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - Add "Step 2A: Fast-Track Flow" section
  - Include inline planning steps
  - Include implementation steps
  - Include verification steps
  - Ensure output transitions to "Needs Validate"

**New Section Content**:

```markdown
### Step 2A: Fast-Track Flow (Straightforward Tasks Only)

If all straightforward criteria are met, execute this combined flow:

#### 2A.1: Quick Codebase Scan
- Identify the specific files to modify
- Note existing patterns to follow
- Confirm no hidden complexity

#### 2A.2: Inline Planning
Create a brief mental plan:
- List files to change
- Order of changes
- Expected verification steps

#### 2A.3: Implement Changes
- Make the changes following existing patterns
- Keep changes minimal and focused
- Don't over-engineer

#### 2A.4: Run Verification
```bash
npm run test
npm run typecheck
npm run lint
```

Fix any issues before proceeding.

#### 2A.5: Write Combined Document

Create at: `thoughts/research-implement/YYYY-MM-DD-{identifier}-{slug}.md`

```markdown
# Research + Implementation: {issue_title}

**Issue**: {issue_identifier}
**Date**: {YYYY-MM-DD}
**Mode**: Fast-Track (Straightforward Task)
**Status**: Implemented - Awaiting Validation

## Task Summary

{Brief description of what was requested}

## Straightforward Assessment

- Files changed: {count} (≤5 ✓)
- Scope: {brief description} (clear ✓)
- Dependencies: {none/minimal} (✓)
- Breaking changes: No (✓)
- New patterns: No (✓)
- Security impact: None (✓)
- Migrations: None (✓)

## Implementation Details

### Files Changed
- `path/to/file.ts` - {what changed}
- ...

### Approach
{Brief description of the approach taken}

## Verification Results

- Tests: PASS ({count} passing)
- TypeScript: PASS
- Lint: PASS

## Success Criteria for Validation

- [ ] {Criterion 1 - what should be verified}
- [ ] {Criterion 2}
- [ ] All automated checks pass

## Notes

{Any relevant notes for the validator}
```

#### 2A.6: Git Commit and Push

```bash
git add .
git commit -m "{type}({identifier}): {short description}"
git push origin main
```

Then output WORK_RESULT with `next_status: "Needs Validate"`.
```

**Verification**:
```bash
cat ralph/prompts/agent2-worker-research.md | grep -A 5 "Fast-Track"
```

### Phase 3: Update Output Format for Fast-Track Mode

**Goal**: Add alternate output format for when fast-track flow is used.

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - Modify "Output Format" section to include fast-track variant
  - Ensure `next_status: "Needs Validate"` for fast-track
  - Keep `next_status: "Needs Plan"` for normal flow

**Updated Output Section**:

```markdown
## Output Format

### Normal Research Flow Output

After completing normal research, output:

```
WORK_RESULT:
  success: true
  stage_completed: research
  artifact_path: thoughts/research/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash}
  next_status: "Needs Plan"
  summary: |
    {Description of what was researched and key findings}
```

### Fast-Track Flow Output

After completing fast-track implementation, output:

```
WORK_RESULT:
  success: true
  stage_completed: research-implement
  mode: fast-track
  artifact_path: thoughts/research-implement/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash}
  next_status: "Needs Validate"
  summary: |
    Fast-track implementation completed.
    Files changed: {list}
    All checks pass. Ready for validation.
```
```

**Verification**:
```bash
cat ralph/prompts/agent2-worker-research.md | grep -A 10 "WORK_RESULT"
```

### Phase 4: Renumber and Adjust Normal Flow Steps

**Goal**: Renumber the normal research flow steps to account for the new assessment step.

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - Step 2 (old) → Step 3: Explore the Codebase
  - Step 3 (old) → Step 4: Identify Integration Points
  - Step 4 (old) → Step 5: Document Risks and Considerations
  - Step 5 (old) → Step 6: Write Research Document
  - Step 6 (old) → Step 7: Git Commit and Push
  - Add note that normal flow is for non-straightforward tasks

**Verification**:
```bash
grep -n "^### Step" ralph/prompts/agent2-worker-research.md
```

### Phase 5: Update Generic Worker Prompt Documentation

**Goal**: Update the main worker prompt to document the new fast-track capability.

**Changes**:
- `ralph/prompts/agent2-worker.md`:
  - Update RESEARCH stage description to mention fast-track capability
  - Clarify that validation is always separate

**Section to Update**:
```markdown
### For RESEARCH stage
- Explore the codebase to understand the current state
- Assess if task is straightforward enough for fast-track
- If straightforward: research + plan + implement in one session, output to "Needs Validate"
- If complex: document findings in `thoughts/research/...`, output to "Needs Plan"
- Validation is ALWAYS a separate stage (never skipped or combined)
```

**Verification**:
```bash
cat ralph/prompts/agent2-worker.md | grep -A 5 "RESEARCH"
```

### Phase 6: Create thoughts/research-implement Directory

**Goal**: Ensure the new artifact directory exists.

**Changes**:
- Create `thoughts/research-implement/` directory
- Add `.gitkeep` to preserve directory in git

**Verification**:
```bash
ls -la thoughts/research-implement/
```

## Testing Strategy

1. **Syntax Verification**: Ensure all markdown files are properly formatted
2. **Pattern Check**: Verify the straightforward criteria list is complete and clear
3. **Flow Check**: Read through the prompt to ensure both paths (fast-track and normal) are clearly defined
4. **Output Check**: Verify WORK_RESULT formats are consistent with other prompts
5. **Integration Check**: Confirm the validate prompt can handle artifacts from `thoughts/research-implement/`

## Rollback Plan

All changes are to markdown prompt files. To rollback:
```bash
git revert {commit-hash}
```

## Notes

- The fast-track flow is an optimization, not a replacement for the full workflow
- When in doubt, agents should prefer the normal flow
- Validation must ALWAYS be separate to maintain quality gates
- The `stage_completed: research-implement` in the output helps Agent 1 understand what happened
- Future enhancement: Could add fast-track capability to plan stage as well (Option 3 from research)
