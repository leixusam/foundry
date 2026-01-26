# Research: Planning Agent Sub-Issue Creation

**Issue**: RSK-20
**Date**: 2026-01-25
**Status**: Research Complete

## Overview

This research investigates enabling the planning agent (Agent 2) to recommend sub-issue creation when an issue is too large or complex, and enabling Agent 3 to create those sub-issues in Linear.

## Current Architecture

### Agent Communication Flow

```
Agent 1 (Linear Reader) → Agent 2 (Worker) → Agent 3 (Linear Writer)
     ↓                        ↓                    ↓
 Claim issue,            Execute work,        Update Linear,
 output context          output results       post comments
```

Agents communicate via plain text output that gets passed to the next agent. Agent 2 outputs a `WORK_RESULT` YAML block that Agent 3 parses.

### Current WORK_RESULT Structure

```typescript
interface WorkResult {
  success: boolean;
  stageCompleted?: 'research' | 'plan' | 'implement' | 'validate' | 'oneshot';
  artifactPath?: string;
  commitHash?: string;
  nextStatus?: string;
  summary?: string;
  error?: string;
}
```

### Relevant Files

| File | Purpose |
|------|---------|
| `ralph/prompts/agent2-worker-plan.md` | Planning stage prompt (lines 1-158) |
| `ralph/prompts/agent2-worker.md` | Base worker prompt (lines 1-80) |
| `ralph/prompts/agent3-linear-writer.md` | Linear update prompt (lines 1-74) |
| `ralph/prompts/agent1-linear-reader.md` | Issue selection prompt (lines 1-157) |
| `ralph/src/types.ts` | Type definitions (lines 33-41) |
| `ralph/src/lib/parsers.ts` | Output parsing (lines 170-235) |

### Linear MCP Capabilities

The `mcp__linear__create_issue` tool supports:
- `parentId`: "The parent issue ID, if this is a sub-issue"
- `team`: "The team name or ID"
- `state`: "The issue state type, name, or ID"
- `title`, `description`, `labels`, etc.

This confirms Agent 3 can create sub-issues with proper parent-child relationships.

## Requirements Analysis

### From the Ticket

1. **Agent 2 (Plan Worker) Changes**:
   - Detect when an issue is large/complex (rule of thumb: >1000 lines of code changes)
   - Output a structured breakdown of recommended sub-issues
   - Each sub-issue should reference the relevant section in the planning document
   - Sub-issues are distinct from tasks (tasks are implementation steps; sub-issues are logical feature components)

2. **Agent 3 (Linear Writer) Changes**:
   - Parse Agent 2's sub-issue recommendations
   - Create sub-issues in Linear using `mcp__linear__create_issue` with `parentId`
   - Set sub-issues to "Needs Implement" status (they already have plans from parent)

3. **Agent 1 (Linear Reader) Changes**:
   - Minor update to acknowledge sub-issues may exist
   - One line change in the prompt

### Key Distinction: Sub-Issues vs Tasks

| Aspect | Sub-Issues | Tasks |
|--------|------------|-------|
| Purpose | Logical feature components | Implementation steps within a phase |
| Tracked in | Linear (as child issues) | Plan document only |
| Size | Each ~1000+ lines of work | Smaller, within a phase |
| Example | "Add API endpoints", "Add UI components" | "Create UserService class" |

## Proposed Design

### 1. Extend WorkResult Type

Add optional `subIssues` field to the `WorkResult` interface:

```typescript
interface WorkResult {
  success: boolean;
  stageCompleted?: 'research' | 'plan' | 'implement' | 'validate' | 'oneshot';
  artifactPath?: string;
  commitHash?: string;
  nextStatus?: string;
  summary?: string;
  error?: string;
  subIssues?: SubIssueRecommendation[];  // NEW
}

interface SubIssueRecommendation {
  title: string;           // Sub-issue title
  description: string;     // Sub-issue description
  planSection: string;     // Reference to plan section (e.g., "Phase 2: API Layer")
  estimatedScope: string;  // Brief scope estimate
}
```

### 2. Update Agent 2 Plan Prompt

Add a section to `agent2-worker-plan.md` that:

1. **Assesses issue complexity** after creating the plan
2. **Determines if sub-issues are needed** based on:
   - Total estimated lines of code (>1000 LOC)
   - Number of distinct, independently deployable components
   - Logical separation of concerns
3. **Outputs structured sub-issue recommendations** in the WORK_RESULT block

### 3. Update Agent 3 Prompt

Add logic to:

1. **Parse sub-issue recommendations** from Agent 2's output
2. **Create sub-issues in Linear** using:
   - `mcp__linear__create_issue` with `parentId` set to main issue ID
   - `state` set to "Needs Implement"
3. **Report sub-issue creation** in the comment

### 4. Minor Agent 1 Update

Add a note that sub-issues may exist and be ready for work:
```
Note: Some issues may have sub-issues that were created during planning. These sub-issues already have plans and are ready for implementation.
```

## WORK_RESULT Format for Sub-Issues

```yaml
WORK_RESULT:
  success: true
  stage_completed: plan
  artifact_path: thoughts/plans/2026-01-25-RSK-123-feature-name.md
  commit_hash: abc1234
  next_status: "Needs Implement"
  summary: |
    Created implementation plan with 4 phases. Issue is large enough
    to warrant 2 sub-issues for parallel development.
  sub_issues:
    - title: "RSK-123a: Implement API layer for feature X"
      description: |
        Implement the backend API endpoints for feature X.
        See Phase 2 of the implementation plan.
      plan_section: "Phase 2: API Layer"
      estimated_scope: "~400 lines of code, 3 new endpoints"
    - title: "RSK-123b: Implement UI components for feature X"
      description: |
        Implement the frontend React components for feature X.
        See Phase 3 of the implementation plan.
      plan_section: "Phase 3: UI Components"
      estimated_scope: "~600 lines of code, 5 new components"
```

## Implementation Estimate

### Changes Required

| File | Lines Changed | Type |
|------|---------------|------|
| `ralph/src/types.ts` | ~15 | Add SubIssueRecommendation interface |
| `ralph/src/lib/parsers.ts` | ~40 | Parse sub_issues from WORK_RESULT |
| `ralph/prompts/agent2-worker-plan.md` | ~60 | Add complexity assessment and sub-issue output |
| `ralph/prompts/agent3-linear-writer.md` | ~40 | Add sub-issue creation logic |
| `ralph/prompts/agent1-linear-reader.md` | ~5 | Add note about sub-issues |

**Total estimated changes**: ~160 lines

### Complexity Assessment

This is a **medium complexity** feature because:
- It extends existing communication patterns (no new architecture)
- Uses existing Linear MCP capabilities
- Changes are localized to 5 files
- No changes to core loop or provider logic

**Recommendation**: This can be implemented in a single session. Does NOT require sub-issues.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Parser fails on new YAML format | Add robust error handling, treat sub_issues as optional |
| Sub-issue creation fails | Log error but don't fail the entire update, status still updates |
| Circular dependency if sub-issues reference parent plan | Sub-issues should be self-contained with reference, not copy |
| Agent 2 over-creates sub-issues | Clear guidelines on when to use (>1000 LOC, logical separation) |

## Testing Strategy

1. **Unit tests** for parser changes (parse sub_issues from YAML)
2. **Integration test** with a mock planning scenario
3. **Manual test** with a real large ticket to verify end-to-end flow

## Recommendations

1. **Implement as a single enhancement** - changes are small and localized
2. **Make sub-issues optional** - not every plan needs them
3. **Clear guidelines** - prevent over-fragmentation with explicit criteria
4. **Graceful degradation** - if sub-issue creation fails, main update should still work

## Next Steps

1. Update `types.ts` with `SubIssueRecommendation` interface
2. Update `parsers.ts` to parse sub_issues
3. Update `agent2-worker-plan.md` with complexity assessment
4. Update `agent3-linear-writer.md` with sub-issue creation
5. Update `agent1-linear-reader.md` with sub-issue note
6. Test with a sample large ticket
