# Research: Add a Specification Agent to Agent Two

**Issue**: RSK-23
**Date**: 2026-01-25
**Status**: Complete

## Summary

This issue requires adding an optional Specification Agent that sits between Research and Planning stages. The agent's purpose is to deeply consider user experience (UX) and write formal specifications before technical planning begins. It acts as a PM/designer, ensuring features are simple, delightful, and polished before implementation planning.

## Requirements Analysis

### Core Requirements

1. **New Specification Agent**: Between Research and Planning
   - Takes research report as input
   - Focuses on UX: delightful, simple, concise, polished
   - Strives for simplicity and fewer words
   - Acts as PM/designer writing down desired UX

2. **Optional Invocation**: Not always called
   - Triggered for significant UX changes
   - Triggered for big features with front-end/user-facing components
   - Triggered for complex back-end business logic with user impact
   - Research agent OR Planning agent decides whether to invoke

3. **New Linear Statuses Required**:
   - "Needs Specification" (type: unstarted)
   - "Specification In Progress" (type: started)

4. **Workflow Order**:
   ```
   Backlog → Needs Research → Research In Progress → [Needs Specification → Specification In Progress →] Needs Plan → ...
   ```
   The specification stage is optional (indicated by brackets).

### Decision Logic for Specification Stage

The Research agent will assess whether specification is needed based on:
- Does this feature have significant UX changes?
- Is it a big feature with a front-end/user-facing component?
- Does it involve complex business logic with user impact?
- Would a UX-focused review prevent over-engineering?

If YES to any: next_status = "Needs Specification"
If NO to all: next_status = "Needs Plan" (skip specification)

## Codebase Analysis

### Relevant Files

#### Prompts (need updates)

| File | Changes Needed |
|------|----------------|
| `ralph/prompts/agent1-linear-reader.md` | Add "Needs Specification" and "Specification In Progress" to status mapping; add "specification" stage to Step 6 |
| `ralph/prompts/agent2-worker.md` | Add SPECIFICATION stage section in Execution Guidelines |
| `ralph/prompts/agent2-worker-research.md` | Add specification assessment section; update next_status options to include "Needs Specification" |
| `ralph/prompts/agent2-worker-plan.md` | Update to read specification document if exists; add to existing_artifacts |
| `ralph/prompts/agent3-linear-writer.md` | Add "specification complete → Needs Plan" to status updates |
| **NEW** `ralph/prompts/agent2-worker-specification.md` | Create new prompt for specification worker |

#### TypeScript (need updates)

| File | Changes Needed |
|------|----------------|
| `ralph/src/types.ts:16` | Add `'specification'` to stage union type |
| `ralph/src/types.ts:21-24` | Add `specification?: string` to existingArtifacts |
| `ralph/src/types.ts:34` | Add `'specification'` to stageCompleted union |
| `ralph/src/lib/parsers.ts:59` | Add `'specification'` to valid stages array |
| `ralph/src/lib/parsers.ts:193` | Add `'specification'` to stage_completed array |
| `ralph/src/lib/parsers.ts` | Add parsing for specification artifact path |

#### Artifacts Directory

- Create: `thoughts/specifications/` folder for specification documents

### Existing Patterns

#### Research Worker Pattern (to follow for specification assessment)
The research worker already has a "straightforward assessment" that determines whether to fast-track. We'll add a similar "specification assessment" section.

#### Document Naming Convention
`thoughts/specifications/YYYY-MM-DD-{identifier}-{slug}.md`

#### Stage Detection in Agent 1
Agent 1 maps status names to stages in Step 6. Current mapping:
```
- Backlog → research
- "Needs Research" → research
- "Needs Plan" → plan
- "Needs Implement" → implement
- "Needs Validate" → validate
```

Add:
```
- "Needs Specification" → specification
```

#### WORK_RESULT Format
Current valid next_status values after research:
- "Needs Plan" (complex research)
- "Needs Validate" (fast-track research-implement)

Add:
- "Needs Specification" (needs UX specification first)

### Dependencies

1. **Linear MCP**: Must be able to handle new status values (it already can - statuses are just strings)
2. **Linear Team Configuration**: Need to create the new statuses in Linear manually or via script
3. **No code dependencies** on specific status strings - all handled via prompts

## Implementation Considerations

### Approach

#### Phase 1: TypeScript Changes
1. Update `types.ts` to add 'specification' stage
2. Update `parsers.ts` to recognize 'specification' stage and artifact path
3. Add specification to existingArtifacts type

#### Phase 2: New Specification Prompt
Create `agent2-worker-specification.md` with:
- Input validation (like other workers)
- UX-focused specification process
- Output format matching other workers
- Clear focus on simplicity and user delight

#### Phase 3: Update Research Prompt
Add specification assessment section to `agent2-worker-research.md`:
- After research, assess if specification needed
- Criteria for triggering specification
- Update next_status output options

#### Phase 4: Update Other Prompts
1. `agent1-linear-reader.md`: Add status mapping for specification
2. `agent2-worker.md`: Add specification stage guidelines
3. `agent2-worker-plan.md`: Read specification document if exists
4. `agent3-linear-writer.md`: Handle specification → Needs Plan transition

#### Phase 5: Linear Status Setup
Document that Linear team needs:
- "Needs Specification" status (type: unstarted)
- "Specification In Progress" status (type: started)

### Specification Document Template

```markdown
# Specification: {issue_title}

**Issue**: {issue_identifier}
**Date**: {YYYY-MM-DD}
**Research**: {link to research doc}
**Status**: Complete

## Executive Summary

{2-3 sentences describing the user-facing outcome in plain language}

## User Experience Goals

### Primary Goal
{What does the user want to accomplish?}

### Experience Principles
- Simplicity: {How will this be simpler than alternatives?}
- Delight: {What makes this delightful?}
- Polish: {What details matter?}

## User Flows

### Happy Path
1. {Step 1}
2. {Step 2}
...

### Edge Cases
- {Edge case 1}: {How handled?}
...

## Interface Specifications

### Visual/UI Elements
{If applicable - what does the user see?}

### Interactions
{How does the user interact?}

### Feedback
{What feedback does the user receive?}

## Success Metrics

- {Metric 1}: {How measured?}
...

## Out of Scope

{What this specification explicitly does NOT cover}

## Open Questions

{Any remaining questions for human review}
```

### Risks

1. **Over-triggering**: Risk of triggering specification for tasks that don't need it
   - Mitigation: Clear criteria in research prompt, erring on the side of NOT triggering

2. **Specification Creep**: Risk of specification becoming too detailed/prescriptive
   - Mitigation: Prompt emphasizes simplicity, minimal specification

3. **Workflow Confusion**: Adding optional stages complicates the state machine
   - Mitigation: Clear documentation, status type mapping handles it

4. **Linear Status Creation**: Statuses must exist in Linear before use
   - Mitigation: Document requirement, could add script later

### Testing Strategy

1. **Unit**: Update parser tests to recognize 'specification' stage
2. **Integration**: Test full workflow with specification stage
3. **Manual**: Create test issue, verify specification triggers correctly

## Questions for Human Review

1. Should specification agent use haiku (fast) or sonnet (thorough)? Recommend: sonnet for quality
2. Should there be a "fast-track" option for specification similar to research-implement? Recommend: No, keep it focused
3. What's the timeout for specification stage? Recommend: Same as research (4 hours)

## Files to Create/Modify

### Create
- `ralph/prompts/agent2-worker-specification.md` (~100 lines)
- `thoughts/specifications/` directory

### Modify
- `ralph/prompts/agent1-linear-reader.md` (~10 lines added)
- `ralph/prompts/agent2-worker.md` (~5 lines added)
- `ralph/prompts/agent2-worker-research.md` (~30 lines added)
- `ralph/prompts/agent2-worker-plan.md` (~10 lines added)
- `ralph/prompts/agent3-linear-writer.md` (~5 lines added)
- `ralph/src/types.ts` (~5 lines changed)
- `ralph/src/lib/parsers.ts` (~10 lines changed)

**Total Estimated Changes**: ~175 lines across 9 files

## Next Steps

Ready for planning phase.
