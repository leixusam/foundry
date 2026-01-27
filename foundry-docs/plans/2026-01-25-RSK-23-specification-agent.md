# Implementation Plan: Add a Specification Agent to Agent Two

**Issue**: RSK-23
**Date**: 2026-01-25
**Research**: thoughts/research/2026-01-25-RSK-23-specification-agent.md
**Status**: Ready for Implementation

## Overview

This plan implements an optional Specification Agent that sits between Research and Planning stages. The agent acts as a PM/designer, ensuring features have simple, delightful, polished user experiences before technical planning begins. The Research agent determines whether specification is needed based on UX complexity.

## Success Criteria

- [ ] `specification` stage recognized in types and parsers
- [ ] New `agent2-worker-specification.md` prompt created
- [ ] Research worker can output `next_status: "Needs Specification"`
- [ ] Agent 1 maps "Needs Specification" → `specification` stage
- [ ] Agent 3 handles specification complete → "Needs Plan" transition
- [ ] Plan worker reads specification document if exists
- [ ] `thoughts/specifications/` directory exists for outputs
- [ ] All tests pass: `npm run test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint`

## Phases

### Phase 1: TypeScript Type Updates

**Goal**: Add 'specification' to all relevant type unions and interfaces

**Changes**:
- `ralph/src/types.ts`:
  - Line 16: Add `'specification'` to `stage` union in `DispatchResult`
  - Line 21-24: Add `specification?: string` to `existingArtifacts`
  - Line 35: Add `'specification'` to `stageCompleted` union in `WorkResult`

**Verification**:
```bash
npm run typecheck
```

### Phase 2: Parser Updates

**Goal**: Update parsers to recognize specification stage and artifact

**Changes**:
- `ralph/src/lib/parsers.ts`:
  - Line 59: Add `'specification'` to valid stages array
  - Line 193: Add `'specification'` to stage_completed array
  - After line 105: Add parsing for specification artifact (following research/plan pattern)

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 3: Create Specification Worker Prompt

**Goal**: Create the new specification worker prompt

**Changes**:
- Create `ralph/prompts/agent2-worker-specification.md`:
  - Input validation section (same pattern as other workers)
  - Available tools section (same as research worker - no Linear)
  - Specification process:
    1. Read research document
    2. Identify UX touchpoints
    3. Design user experience (focus on simplicity, delight, polish)
    4. Write specification document
  - Document template focused on UX (executive summary, user flows, interface specs)
  - Output format with WORK_RESULT (next_status: "Needs Plan")
- Create `thoughts/specifications/` directory (via .gitkeep)

**Verification**:
```bash
ls -la ralph/prompts/agent2-worker-specification.md
ls -la thoughts/specifications/
```

### Phase 4: Update Research Worker Prompt

**Goal**: Add specification assessment and new output option

**Changes**:
- `ralph/prompts/agent2-worker-research.md`:
  - After Step 5 (Document Risks), add new "Step 5.5: Specification Assessment" section
  - Add criteria for when specification is needed:
    - Significant UX changes
    - Big features with front-end/user-facing components
    - Complex business logic with user impact
  - Update Normal Research Flow Output section to include `next_status: "Needs Specification"` option
  - Add clarification that specification decision is made during research

**Verification**:
```bash
cat ralph/prompts/agent2-worker-research.md | grep -A 20 "Specification Assessment"
```

### Phase 5: Update Agent 1 Prompt

**Goal**: Add specification status mapping

**Changes**:
- `ralph/prompts/agent1-linear-reader.md`:
  - Step 1: Add "Needs Specification" to Ready statuses examples
  - Step 1: Add "Specification In Progress" to In Progress statuses examples
  - Step 6: Add mapping `"Needs Specification" → specification`
  - Step 7: Add "Specification In Progress" to status update examples

**Verification**:
```bash
cat ralph/prompts/agent1-linear-reader.md | grep -i specification
```

### Phase 6: Update Agent 2 Base Worker Prompt

**Goal**: Add specification stage to execution guidelines

**Changes**:
- `ralph/prompts/agent2-worker.md`:
  - Add new "For SPECIFICATION stage" section after RESEARCH stage:
    - Read research document
    - Focus on UX: simplicity, delight, polish
    - Document in `thoughts/specifications/YYYY-MM-DD-{issue-id}-{slug}.md`
    - next_status: "Needs Plan"
  - Commit and push

**Verification**:
```bash
cat ralph/prompts/agent2-worker.md | grep -i specification
```

### Phase 7: Update Plan Worker Prompt

**Goal**: Read specification document if exists

**Changes**:
- `ralph/prompts/agent2-worker-plan.md`:
  - Input Validation: Add optional `existing_artifacts.specification`
  - Step 1: Add instruction to read specification document if present
  - Note that specification document contains UX requirements to follow

**Verification**:
```bash
cat ralph/prompts/agent2-worker-plan.md | grep -i specification
```

### Phase 8: Update Agent 3 Prompt

**Goal**: Handle specification → Needs Plan transition

**Changes**:
- `ralph/prompts/agent3-linear-writer.md`:
  - Add to Status Updates section: `**specification complete** → "Needs Plan"`

**Verification**:
```bash
cat ralph/prompts/agent3-linear-writer.md | grep -i specification
```

## Testing Strategy

1. **TypeScript validation**: `npm run typecheck` after each phase
2. **Build validation**: `npm run build` after parser changes
3. **Lint validation**: `npm run lint` after all changes
4. **Manual review**: Verify all prompts have consistent formatting

## Rollback Plan

All changes are additive and don't modify existing behavior:
- Revert the commit
- Existing issues without specification will continue to work (specification is optional)

## Notes

### Linear Status Setup (Manual)

The following statuses must be created manually in Linear before using the specification workflow:
- **"Needs Specification"** (type: unstarted) - placed between "Needs Research" and "Needs Plan"
- **"Specification In Progress"** (type: started)

This is a manual step outside the code implementation.

### Specification Trigger Criteria

The Research agent determines if specification is needed based on:
1. Does this feature have significant UX changes?
2. Is it a big feature with a front-end/user-facing component?
3. Does it involve complex business logic with user impact?

If YES to any → `next_status: "Needs Specification"`
If NO to all → `next_status: "Needs Plan"` (skip specification)

### Model Recommendation

Based on the research document's questions:
- **Model**: sonnet (for quality UX thinking)
- **No fast-track**: Specification should always be thorough
- **Timeout**: Same as research (4 hours)
