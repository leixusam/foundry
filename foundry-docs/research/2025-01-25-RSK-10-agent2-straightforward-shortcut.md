# Research: Update Agent 2 Prompt - Allow Direct Implementation for Straightforward Tasks

**Issue**: RSK-10
**Date**: 2025-01-25
**Status**: Complete

## Summary

The request is to update the Agent 2 prompt so that during research or planning phases, if the work is relatively straightforward, Agent 2 can proceed directly to plan and implement. However, **validate should always remain a separate step**.

## Requirements Analysis

From the issue title (transcribed from audio):
1. During research or planning, if work is straightforward, Agent 2 should be able to go straight to plan+implement
2. Validate must ALWAYS be a separate/individual step (never combined)

The intent is to reduce the number of round-trips/sessions for simple work while maintaining the quality gate of separate validation.

## Codebase Analysis

### Relevant Files

The Agent 2 system uses stage-specific prompt files:

1. **`ralph/prompts/agent2-worker.md`** (line 2602) - Generic worker prompt that describes all stages
2. **`ralph/prompts/agent2-worker-research.md`** (line 169) - Research stage prompt
3. **`ralph/prompts/agent2-worker-plan.md`** (line 158) - Plan stage prompt
4. **`ralph/prompts/agent2-worker-implement.md`** (line 132) - Implement stage prompt
5. **`ralph/prompts/agent2-worker-validate.md`** (line 173) - Validate stage prompt
6. **`ralph/prompts/agent2-worker-oneshot.md`** (line 155) - Oneshot stage prompt (already combines all except validate)

### Current Workflow

The current workflow is strictly sequential:
1. **Research** → produces `thoughts/research/*.md`, transitions to "Needs Plan"
2. **Plan** → produces `thoughts/plans/*.md`, transitions to "Needs Implement"
3. **Implement** → executes plan phases, transitions to "Needs Validate"
4. **Validate** → produces `thoughts/validation/*.md`, transitions to "Done" or back to "Needs Implement"

There's also **ONESHOT** for small tasks (labeled chore, bug, small, etc.) which does everything in one session but doesn't have a separate validate phase (it just runs npm commands and commits).

### Key Insight: The "Oneshot" Pattern

The oneshot prompt (`agent2-worker-oneshot.md`) already demonstrates the "do everything in one session" pattern:
- Quick research
- Make changes
- Verify (run tests/typecheck/lint)
- Document (brief)
- Commit and push

The difference is that oneshot doesn't create a separate validation report or go through the formal validate phase.

### Dependencies

- `ralph/prompts/agent1-linear-reader.md` - Determines which stage to dispatch based on issue status and labels
- Linear workflow statuses: Backlog → Needs Research → Research In Progress → Needs Plan → Plan In Progress → Needs Implement → Implement In Progress → Needs Validate → Validate In Progress → Done

## Implementation Considerations

### Approach Options

**Option 1: Modify Research Prompt Only**
- Add a "Straightforward Task Detection" section to research prompt
- If detected as straightforward, allow combining research + plan + implement
- Always output next_status: "Needs Validate"

**Option 2: Create New "Accelerated" Stage**
- Add a new stage type "accelerated" that combines research+plan+implement
- Requires changes to Agent 1 and the orchestration

**Option 3: Add "Fast-Track" Logic to Both Research and Plan Prompts**
- Both research and plan prompts get ability to fast-track
- Research can skip to implement (after creating plan inline)
- Plan can proceed directly to implement
- Both always require separate validate

### Recommended Approach: Option 1 (Simplest)

Modify the research prompt to include:
1. A "Straightforward Assessment" step after understanding requirements
2. Criteria for what counts as "straightforward"
3. If straightforward: do quick research, create inline plan, implement, then set next_status to "Needs Validate"
4. If not straightforward: follow normal research-only flow

This keeps validate mandatory and separate while allowing flexibility in research phase.

### Criteria for "Straightforward"

Suggested criteria (can be refined):
- Single file change or small number of files (<5)
- Clear, well-defined scope
- No complex dependencies
- No breaking changes to existing APIs
- No new architectural patterns needed
- Similar to existing patterns in codebase
- No security-sensitive changes
- No database migrations

### Files to Change

1. **`ralph/prompts/agent2-worker-research.md`** - Primary change
   - Add straightforward assessment section
   - Add fast-track implementation flow
   - Modify output format to include combined artifacts

2. **`ralph/prompts/agent2-worker.md`** - Minor update
   - Update documentation to reflect new capability

3. Optionally: **`ralph/prompts/agent2-worker-plan.md`** - If we want plan to also be able to fast-track to implement

### Risks

1. **Quality risk**: Fast-tracking might skip important considerations
   - Mitigation: Keep validate as mandatory separate step
   - Mitigation: Define clear "straightforward" criteria

2. **Consistency risk**: Mixed output formats
   - Mitigation: Still produce plan document (can be brief) even in fast-track
   - Mitigation: Clear documentation of what artifacts exist

3. **Debugging risk**: Harder to trace what happened
   - Mitigation: Always document in a combined research+plan document

### Testing Strategy

1. Test with genuinely straightforward task (single file config change)
2. Test with complex task (ensure it follows normal flow)
3. Verify validate phase is always required after fast-track

## Questions for Human Review

1. Should the plan prompt also be able to fast-track to implement, or just research?
2. What are the exact criteria for "straightforward"? Should we allow the agent to use judgment or provide a strict checklist?
3. Should fast-track create separate research and plan documents, or a combined document?

## Next Steps

Ready for planning phase. The plan should detail:
1. Exact changes to research prompt
2. New output format for fast-track mode
3. Success criteria for the change
