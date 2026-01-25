# Linear Reader Agent Implementation Plan

**Created**: 2026-01-25T22:23:00Z
**Status**: Pending approval

## Goal

Implement the Linear Reader agent (Agent 1) for the Ralph v2 system. This agent will:
1. Check for stale "In Progress" issues and reset them
2. Find the highest-priority issue ready for work
3. Claim it by updating status and posting a comment
4. Output complete issue details in YAML format for the Worker agent

## Acceptance Criteria

- [ ] Agent successfully queries Linear for "In Progress" issues
- [ ] Agent correctly identifies stale issues (>4 hours) and resets them
- [ ] Agent finds ready work in correct priority order
- [ ] Agent correctly decides between ONESHOT vs STAGED workflow
- [ ] Agent claims issues by updating status and posting comment
- [ ] Agent outputs valid DISPATCH_RESULT YAML block
- [ ] All edge cases handled (no work, parsing errors, etc.)
- [ ] Unit tests pass
- [ ] Integration test with real Linear API works

## Current State Analysis

### What Exists
- `prompts/agent1-linear-reader.md` - detailed prompt specification
- `src/index.ts` - orchestrator that calls Agent 1
- `src/lib/parsers.ts` - YAML parser for DISPATCH_RESULT
- `src/lib/prompts.ts` - prompt loader
- `src/lib/claude.ts` - Claude CLI spawner
- `src/types.ts` - TypeScript interfaces

### What's Missing
The Linear Reader is currently just a **prompt** that gets sent to a Claude instance. The actual implementation needs to be written as executable TypeScript code that:
1. Uses Linear MCP tools to query/update issues
2. Implements the stale issue detection logic
3. Implements the priority/sorting logic
4. Decides between ONESHOT vs STAGED
5. Claims issues and posts comments
6. Outputs DISPATCH_RESULT YAML

### Workflow Gap
The prompt mentions statuses like:
- "Needs Research", "Research In Progress"
- "Needs Plan", "Plan In Progress"
- "Needs Implement", "Implement In Progress"
- "Needs Validate", "Validate In Progress"
- "Oneshot In Progress"

But the actual Linear team only has:
- Backlog
- Todo
- In Progress
- Done
- Canceled
- Duplicate

**Decision needed**: Should we create custom workflow states in Linear, or adapt the implementation to use the existing states?

## Approach

### Option 1: Use Claude Agent (Current)
Keep the current approach where we spawn a Claude instance with the prompt and let it use Linear MCP tools. This is what the code currently does.

**Pros:**
- Flexible - Claude can adapt to changes
- Less code to maintain
- Leverages Claude's reasoning

**Cons:**
- Slower (full LLM call each loop)
- More expensive
- Less deterministic
- Harder to debug

### Option 2: Write TypeScript Implementation
Replace the prompt-based approach with direct TypeScript code that calls Linear MCP tools programmatically.

**Pros:**
- Fast and deterministic
- Easy to test and debug
- No LLM cost for Agent 1
- Full control over logic

**Cons:**
- More code to write and maintain
- Less flexible to changes

### Recommendation: Option 2 (TypeScript Implementation)

Agent 1 has a very clear, deterministic workflow that doesn't require LLM reasoning. We should implement it in TypeScript for speed, cost, and reliability.

**However**, I notice the current codebase structure expects to spawn Claude for Agent 1. This means we'd need to refactor the orchestrator to support both code-based and prompt-based agents.

## Implementation Plan

### Phase 1: Linear Workflow Setup

**Questions for User:**
1. Should we create custom workflow states in Linear (Needs Research, etc.) or use labels/priorities with the existing states?
2. Do you want to keep the Claude-based approach or switch to TypeScript?

**Assuming TypeScript approach and custom Linear states:**

1. Create Linear workflow states:
   - Needs Research
   - Research In Progress
   - Needs Plan
   - Plan In Progress
   - Needs Implement
   - Implement In Progress
   - Needs Validate
   - Validate In Progress
   - Oneshot In Progress
   - (Keep existing: Done, Canceled, Duplicate)

2. Update config to store team ID and state mappings

### Phase 2: Linear MCP Client Wrapper

Create `src/lib/linear-client.ts` with helper functions:

```typescript
// Issue queries
async function getIssuesByStatus(status: string): Promise<Issue[]>
async function getIssue(id: string): Promise<Issue>

// Issue updates
async function updateIssueStatus(id: string, status: string): Promise<void>
async function createComment(issueId: string, body: string): Promise<void>

// Context gathering
async function getIssueComments(issueId: string): Promise<Comment[]>
async function getIssueStatuses(): Promise<WorkflowState[]>

// Helpers
function parseClaimTimestamp(comments: Comment[]): Date | null
function isStale(claimTime: Date, timeoutHours: number): boolean
```

This wrapper will call the Linear MCP tools but provide a cleaner API.

### Phase 3: Core Agent Logic

Create `src/agents/linear-reader.ts`:

```typescript
export async function runLinearReader(): Promise<DispatchResult>
```

Steps:
1. **Check stale issues**
   - Query all "In Progress" statuses
   - For each, get comments and find "Agent Claimed" timestamp
   - If >4 hours, post timeout comment and reset to "Needs X"

2. **Find ready work**
   - Query in priority order: Needs Validate → Needs Implement → Needs Plan → Needs Research
   - Sort by priority (Urgent→High→Medium→Low→None) then createdAt (oldest first)
   - Take first result

3. **Decide stage**
   - Check labels for ONESHOT indicators (chore, bug, small, etc.)
   - Check estimate for XS/S
   - Otherwise use status to determine stage

4. **Claim issue**
   - Update to "X In Progress" status
   - Post claim comment with timestamp

5. **Gather context**
   - Read all comments
   - Look for artifact paths
   - Summarize human/agent comments

6. **Output result**
   - Format as DispatchResult object
   - Return to orchestrator

### Phase 4: Orchestrator Integration

Update `src/index.ts`:

```typescript
// Replace Agent 1 section:
import { runLinearReader } from './agents/linear-reader.js';

const dispatch = await runLinearReader();
// No need to parse - direct object

if (dispatch.noWork) { ... }
```

### Phase 5: Testing

1. **Unit tests** (`tests/linear-reader.test.ts`):
   - Test stale detection logic
   - Test priority sorting
   - Test ONESHOT vs STAGED decision
   - Test YAML output formatting
   - Mock Linear client

2. **Integration test** (`tests/integration/linear-reader-e2e.test.ts`):
   - Create test issues in Linear
   - Run agent
   - Verify status updates
   - Verify comments posted
   - Clean up test data

## Data Shapes

### Issue from Linear
```typescript
interface LinearIssue {
  id: string;           // UUID
  identifier: string;   // ENG-123
  title: string;
  description: string;
  status: string;
  labels: string[];
  priority: 0 | 1 | 2 | 3 | 4;  // 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
  estimate?: number;    // Story points or similar
  createdAt: string;    // ISO timestamp
  project?: { name: string };
}
```

### Comment
```typescript
interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: { name: string };
}
```

### DispatchResult (Already defined in types.ts)
```typescript
interface DispatchResult {
  noWork?: boolean;
  reason?: string;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  issueDescription: string;
  stage: 'research' | 'plan' | 'implement' | 'validate' | 'oneshot';
  projectName: string;
  claimTimestamp: string;
  labels: string[];
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  existingArtifacts: {
    research?: string;
    plan?: string;
  };
  commentsSummary: string;
}
```

## Risks and Failure Modes

### Risk 1: Linear API Rate Limits
**Mitigation**: Add rate limit handling in linear-client wrapper, implement exponential backoff

### Risk 2: Stale Timestamp Parsing Fails
**Mitigation**: Use robust regex, handle malformed comments gracefully, log warnings

### Risk 3: Multiple Agents Racing
**Scenario**: If running multiple Ralph instances, they could claim the same issue
**Mitigation**:
- Use Linear's optimistic locking (update only if status hasn't changed)
- Add "claimed_by" field in comment to identify which instance
- For v1, document single-instance requirement

### Risk 4: Custom Workflow States Not Supported
**Mitigation**: Fall back to using labels if Linear doesn't support custom states in the API tier

### Risk 5: Missing MCP Tools
**Mitigation**: Verify all required Linear MCP tools are available, add error handling

## Questions for User

1. **Workflow approach**: Should I create custom Linear workflow states, or use existing states with labels?

2. **Implementation approach**: Do you want to keep the Claude-based approach (current) or switch to TypeScript implementation (recommended)?

3. **Team configuration**: What's the Linear team ID you want to use? (I see "Robin Sidekick" with ID `8a89639e-aee6-4270-9530-ea0e0e4fa98f`)

4. **Multi-instance**: Will you run multiple Ralph instances simultaneously, or just one?

5. **Timeout configuration**: Is 4 hours the right timeout, or should it be configurable?

## Test Strategy

### Unit Tests
- Mock Linear client responses
- Test all logic paths (stale, priority sorting, ONESHOT decision)
- Test edge cases (no work, malformed data)
- Use Jest or Node's built-in test runner

### Integration Tests
- Create test issues in Linear (use test team or labels to identify)
- Run agent end-to-end
- Verify Linear state changes
- Clean up test data after

### Manual Testing
- Create various test issues with different priorities/labels
- Run Ralph and observe behavior
- Check Linear for correct status updates and comments

## Success Criteria

1. Agent correctly identifies and resets stale issues
2. Agent picks the right issue according to priority rules
3. Agent correctly decides ONESHOT vs STAGED
4. Agent claims issues with proper status and comment
5. Agent outputs valid DispatchResult
6. No crashes or unhandled errors
7. All tests pass
8. Documentation updated

## Timeline (No Estimates)

This is a complex implementation with multiple phases. The work will be broken down into:
1. User decisions (workflow states, implementation approach)
2. Linear setup (if needed)
3. Client wrapper implementation
4. Core agent logic
5. Integration and testing
6. Documentation

Each phase will be completed before moving to the next.

---

**Update Log**

- 2026-01-25T22:23:00Z - Initial plan created
