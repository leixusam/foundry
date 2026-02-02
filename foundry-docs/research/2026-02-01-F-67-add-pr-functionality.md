# Research: Add PR Functionality

**Issue**: F-67
**Date**: 2026-02-01
**Status**: Complete

## Summary

This research explores adding a configuration option to control whether Foundry merges directly to main (current behavior) or creates pull requests for user review. This involves changes to configuration, agent prompts, Linear statuses, and potentially the agent orchestration logic.

## Requirements Analysis

### Core Requirement
Add a configuration option `FOUNDRY_MERGE_MODE` (or similar) with two modes:
1. **merge** (default): Current behavior - merge directly to main after validation/oneshot
2. **pr**: Create a pull request instead of merging, allowing human review

### Key Decisions Needed

1. **Status Flow After PR Creation**
   - Should "Generated PR" be a `completed` status (agent is done)?
   - Or should it be `started` status where agent waits for approval then merges?

2. **GitHub Org Variability**
   - Different orgs have different PR review/approval requirements
   - Some require code owners, some require CI, some require N approvals
   - Foundry cannot know these requirements automatically

3. **Prompt Injection Strategy**
   - Use separate prompt files per mode?
   - Or inject conditional instructions into existing prompts?

## Codebase Analysis

### Relevant Files

#### Configuration System
- `src/config.ts` - Configuration loading and parsing (lines 252-294)
  - Uses environment variables with defaults
  - Follows pattern: `getXxx()` functions that parse env vars
  - Configuration object built in `buildConfig()` function
- `src/types.ts` - Type definitions for `FoundryConfig` interface (lines 79-105)
  - Add new field like `mergeMode: 'merge' | 'pr'`

#### Prompt System
- `src/lib/prompts.ts` - Simple prompt loader
  - `loadPrompt(name)` reads from `prompts/{name}.md`
- `prompts/agent2-worker-oneshot.md` - Contains merge logic (Step 7-8, lines 159-214)
- `prompts/agent2-worker-validate.md` - Contains merge logic (Step 7, lines 160-207)
- `.foundry/prompts/` - Prompts copied to project for runtime use
- `src/index.ts` - Main loop, builds agent prompts (lines 268-291, 351-410)

#### Status System
- `src/lib/linear-api.ts` - Defines `FOUNDRY_STATUS_DEFINITIONS` (lines 22-38)
  - Each status has: `name`, `type` (backlog/unstarted/started/completed/canceled), `color`
  - Would need to add: `∞ PR Created` or `∞ Needs Review`

#### Agent 3 (Linear Writer)
- `prompts/agent3-linear-writer.md` - Updates status based on `merge_status` and `next_status`
  - Already handles `merge_status: blocked` scenario
  - Would need new handling for `merge_status: pr_created`

### Existing Patterns

#### Configuration Pattern
```typescript
// In config.ts - env var parsing
function getMergeMode(): 'merge' | 'pr' {
  const envMode = process.env.FOUNDRY_MERGE_MODE?.toLowerCase();
  if (envMode === 'pr') return 'pr';
  return 'merge'; // Default
}

// In types.ts
export interface FoundryConfig {
  // ... existing fields
  mergeMode: 'merge' | 'pr';
}
```

#### Prompt Injection Pattern
Currently, prompts are static markdown files. The main loop injects dynamic context (pod name, loop number, team key) at the top of the prompt (see `src/index.ts:97-114`).

Options for conditional behavior:
1. **Environment variable in prompt**: Add `## Merge Mode Configuration\n**Mode**: ${config.mergeMode}` to prompt context
2. **Separate prompt files**: Create `agent2-worker-oneshot-pr.md` and load based on mode
3. **Post-process prompt**: Replace markers in prompt with mode-specific instructions

### Dependencies

- GitHub CLI (`gh`) for PR creation - already expected for Foundry usage
- Linear MCP for status updates - already integrated
- Git operations - already implemented in prompts

## Implementation Considerations

### Approach A: Configuration with Conditional Prompt Injection

**Description**: Add `FOUNDRY_MERGE_MODE` config, inject mode into prompt context, update prompts to check mode before merging.

**Pros**:
- Single source of truth for prompts
- Minimal code changes
- Easy to understand

**Cons**:
- Prompts become more complex with conditional logic
- Agent must interpret and follow conditionals

**Changes Required**:
1. `src/types.ts`: Add `mergeMode: 'merge' | 'pr'` to `FoundryConfig`
2. `src/config.ts`: Add `getMergeMode()` parser and include in `buildConfig()`
3. `src/index.ts`: Add merge mode to agent prompt context
4. `prompts/agent2-worker-oneshot.md`: Add conditional logic for PR creation
5. `prompts/agent2-worker-validate.md`: Add conditional logic for PR creation
6. `prompts/agent3-linear-writer.md`: Handle `merge_status: pr_created`
7. `src/lib/linear-api.ts`: Add new status(es)

### Approach B: Separate Prompt Files Per Mode

**Description**: Create separate prompt files for PR mode (e.g., `agent2-worker-oneshot-pr.md`).

**Pros**:
- Cleaner prompts without conditionals
- Mode-specific instructions can be more detailed

**Cons**:
- Duplication of content between files
- Maintenance burden when updating shared logic
- More files to manage

**Changes Required**:
1. Same config changes as Approach A
2. Create new files: `agent2-worker-oneshot-pr.md`, `agent2-worker-validate-pr.md`
3. `src/lib/prompts.ts`: Modify to load mode-specific prompts
4. `src/index.ts`: Pass mode to prompt loader

### Approach C: Template-Based Prompt System

**Description**: Refactor prompts to use template variables that get replaced at runtime.

**Pros**:
- Most flexible
- Clean separation of concerns
- Could enable other future customizations

**Cons**:
- Larger refactoring effort
- More complex system
- Overkill for this single feature

### Recommended Approach: A (Conditional Prompt Injection)

Approach A is recommended because:
1. Follows existing patterns in the codebase
2. Minimal code changes
3. Single prompt file to maintain
4. Agent models are capable of following conditional instructions

## New Status Considerations

### Option 1: "∞ PR Created" as `completed` type

```typescript
{ name: `${FOUNDRY_STATUS_PREFIX} PR Created`, type: 'completed', color: '#5e6ad2' }
```

**Behavior**: Agent is done. Human reviews and merges PR manually.

**Pros**:
- Simple - agent's work is done
- Clear handoff point

**Cons**:
- Requires human to remember to merge
- No agent involvement in merge

### Option 2: "∞ Needs Review" as `started` type

```typescript
{ name: `${FOUNDRY_STATUS_PREFIX} Needs Review`, type: 'started', color: '#f2c94c' }
```

**Behavior**: Agent waits for human approval, then attempts to merge.

**Pros**:
- Agent can complete the merge after approval
- More automated

**Cons**:
- Requires polling or webhook for approval detection
- Complex to implement approval-then-merge flow
- Different orgs have different approval mechanisms
- May not be feasible for V1

### Recommended Status: "∞ PR Created" as `completed`

For V1, use `completed` type because:
1. Simpler implementation
2. Avoids complexity of approval detection
3. Matches user expectation ("I want to review before merge")
4. Can enhance to approval-then-merge in future version

### Additional Status Consideration: "∞ Awaiting PR Merge"

Alternative name that might be clearer:
```typescript
{ name: `${FOUNDRY_STATUS_PREFIX} Awaiting PR Merge`, type: 'completed', color: '#5e6ad2' }
```

## Risks

### GitHub Organization Variability
- **Risk**: Different orgs have different PR requirements
- **Mitigation**: Document that user is responsible for ensuring PR can be merged according to their org's policies
- **Future**: Could add config for required approvals, CI checks, etc.

### PR Title/Body Format
- **Risk**: Different orgs may have PR template requirements
- **Mitigation**: Generate sensible defaults, allow customization via config
- **Future**: Add `FOUNDRY_PR_TEMPLATE` config

### Branch Protection Rules
- **Risk**: Some repos may have branch protection preventing direct PR creation
- **Mitigation**: Document that agent needs appropriate permissions
- **Note**: Feature branches already work, so this shouldn't be an issue

### Merge Conflicts in PR Mode
- **Risk**: Main may advance while PR is awaiting review
- **Mitigation**: Document that human may need to rebase/resolve conflicts
- **Future**: Could add "∞ PR Needs Rebase" status

## Testing Strategy

1. **Unit Tests**: Add tests for new config parsing in `config.ts`
2. **Integration Tests**:
   - Verify prompt contains merge mode context
   - Verify correct status is used based on mode
3. **Manual Testing**:
   - Test PR creation in both oneshot and validate flows
   - Verify PR title, body, and branch name are correct
   - Verify Linear status updates correctly

## Specification Assessment

This feature **does need a UX specification** because:
- It adds a new workflow state for users to understand
- It changes the default behavior at a critical handoff point (code completion)
- Users need to understand when to use merge vs PR mode
- The status name and flow affect user experience in Linear

**Needs Specification**: Yes

## Questions for Human Review

1. **Status Type**: Should "PR Created" be a `completed` status (agent done) or `started` status (agent waits for approval)? Recommendation: `completed` for V1.

2. **Status Name**: What should the new status be called?
   - `∞ PR Created`
   - `∞ Awaiting PR Merge`
   - `∞ Review Requested`
   - Something else?

3. **PR Description**: Should Foundry include a standard footer in PR descriptions (e.g., "Generated by Foundry")?

4. **Future Scope**: Should we plan for an "approval-then-merge" flow in a future version, or is manual merge acceptable long-term?

5. **Default Behavior**: Should the default remain "merge" mode for backward compatibility, or should we default to "pr" mode for safety?

## Next Steps

Ready for specification phase to:
1. Define exact UX for PR mode workflow
2. Finalize status name and type
3. Define PR title/body format
4. Consider edge cases (conflicts, failures, etc.)
