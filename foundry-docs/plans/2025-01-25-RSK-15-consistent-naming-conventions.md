# RSK-15: Implementation Plan - Consistent Naming Conventions

## Overview

This plan addresses the naming inconsistencies identified in the research phase. The main issue is that the current "agent name" (e.g., `red-giraffe-1737848125`) actually identifies a **loop instance**, not an individual agent. This is semantically confusing because all three agents within a loop share this same name.

## Decision: Option B with Pod Preparation

Based on the research, I'm choosing **Option B (Rename to "Loop Instance Name")** with preparation for Option C:

- **Why not Option A (Keep "Agent Name" but Clarify)**: This doesn't address the core semantic confusion. The name "agent name" for something that identifies a loop will continue to confuse future developers.

- **Why Option B (Recommended)**: It's semantically accurate and clearly distinguishes loop identity from agent identity. The changes are moderate and can be done atomically.

- **Why prepare for Option C**: RSK-18 ("Update the name of the pod") is blocked by this issue. We should ensure our naming scheme is extensible to support pod naming without requiring further renames.

## Terminology Glossary

| Concept | Term | Variable Name | Display Format | Description |
|---------|------|---------------|----------------|-------------|
| Outer Instance | **Pod** | `podName` | `red-giraffe` | An `npm start` invocation (future - RSK-18) |
| Execution Cycle | **Loop** | `loopNumber` | `loop 0`, `loop 1` | A complete iteration within a pod |
| Loop Identifier | **Loop Instance Name** | `loopInstanceName` | `red-giraffe-1737848125` | Unique identifier for a loop instance |
| Claude Instance | **Agent** | `agentNumber` | `Agent 1`, `Agent 2`, `Agent 3` | An individual Claude Code instance within a loop |

## Implementation Phases

### Phase 1: Core Code Renaming

**Goal**: Rename the core identifier from "agent name" to "loop instance name" in source code.

#### 1.1 Rename `agent-name.ts` → `loop-instance-name.ts`

File: `ralph/src/lib/agent-name.ts` → `ralph/src/lib/loop-instance-name.ts`

Changes:
```typescript
// Before:
// Agent name generator
// Generates unique, memorable names for agent loop instances

// After:
// Loop instance name generator
// Generates unique, memorable names for loop instances
```

- Rename file from `agent-name.ts` to `loop-instance-name.ts`
- Update function names:
  - `generateAgentName()` → `generateLoopInstanceName()`
  - `getAgentNameDisplay()` → `getLoopInstanceNameDisplay()`
- Update all comments to refer to "loop instance" instead of "agent"

#### 1.2 Update `output-logger.ts`

File: `ralph/src/lib/output-logger.ts`

Changes:
- Line 5: Update import from `agent-name.js` to `loop-instance-name.js`
- Line 5: `getAgentNameDisplay` → `getLoopInstanceNameDisplay`
- Parameter rename in `initLoopLogger`: `agentName` → `loopInstanceName`
- Keep `currentLoopName` variable as-is (already correctly named)

#### 1.3 Update `index.ts`

File: `ralph/src/index.ts`

Changes:
- Line 6: Update import
  - Before: `import { generateAgentName } from './lib/agent-name.js';`
  - After: `import { generateLoopInstanceName } from './lib/loop-instance-name.js';`
- Line 12: Rename variable
  - Before: `const agentName = generateAgentName();`
  - After: `const loopInstanceName = generateLoopInstanceName();`
- Line 15: Update function call
  - Before: `initLoopLogger(agentName, iteration);`
  - After: `initLoopLogger(loopInstanceName, iteration);`
- Line 18: Update console output
  - Before: `console.log(\`Agent Name: ${agentName}\`);`
  - After: `console.log(\`Loop Instance: ${loopInstanceName}\`);`
- Lines 28-36, 67-71, 100-104, 122: Update all references from `agentName` to `loopInstanceName`

### Phase 2: Prompt Updates

**Goal**: Update agent prompts to use consistent terminology.

#### 2.1 Update `index.ts` prompt injections

The prompts injected at runtime (lines 28-36, 67-71, 100-104) should be updated:

```typescript
// Before (line 28-35):
const agent1Prompt = `## Agent Instance

You are agent instance: **${agentName}**

This name identifies your loop instance...`

// After:
const agent1Prompt = `## Loop Instance

You are part of loop instance: **${loopInstanceName}**

This name identifies the loop you're running in...`
```

Similar updates for Agent 2 and Agent 3 prompt sections.

#### 2.2 Update `agent1-linear-reader.md`

File: `ralph/prompts/agent1-linear-reader.md`

Changes to Line 107-114 (comment format):
```markdown
# Before:
Agent Claimed | {agent name} | {TIMESTAMP}

**Agent**: {agent name}

# After:
Agent Claimed | {loop instance name} | {TIMESTAMP}

**Loop Instance**: {loop instance name}
```

Note: The header "Agent Claimed" is fine - it's the agent doing the claiming, but the identifier is the loop instance name.

#### 2.3 Update `agent3-linear-writer.md`

File: `ralph/prompts/agent3-linear-writer.md`

Changes to comment format sections (Lines 22-37, 42-53):
```markdown
# Before:
**Stage Complete** | {agent name} | {current timestamp}
**Agent**: {agent name from session stats}

# After:
**Stage Complete** | {loop instance name} | {current timestamp}
**Loop Instance**: {loop instance name from session stats}
```

### Phase 3: Documentation Updates

**Goal**: Update documentation to use consistent terminology and explain the hierarchy.

#### 3.1 Update Architecture Document

File: `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md`

Add a new section after the overview explaining the naming hierarchy:

```markdown
## Naming Conventions

Ralph v2 uses a three-level naming hierarchy:

1. **Pod**: An `npm start` instance (the outer orchestration layer). Named like `red-dolphin` with adjective-animal format. Multiple pods can run in parallel on different machines. *(Note: Pod naming will be implemented in RSK-18)*

2. **Loop**: An iteration within a pod (loop 0, loop 1, loop 2). Each loop contains three sequential agent runs.

3. **Agent**: An individual Claude Code instance within a loop:
   - Agent 1: Linear Reader
   - Agent 2: Worker
   - Agent 3: Linear Writer

4. **Loop Instance Name**: A unique identifier for a specific loop instance, formatted as `{adjective}-{animal}-{timestamp}` (e.g., `red-giraffe-1737848125`). This identifier:
   - Is shared by all three agents within the same loop
   - Is included in Linear comments for attribution
   - Allows tracking which loop instance made which changes
```

#### 3.2 Update Research Document Title

File: `thoughts/research-implement/2025-01-25-RSK-13-agent-naming-system.md`

- Update title from "Agent Loop Naming System" to "Loop Instance Naming System"
- Update any internal references from "agent name" to "loop instance name"

### Phase 4: Verify Console Output

After implementation, the console output should look like:

```
======================== LOOP 0 ========================
Loop Instance: red-giraffe-1737848125
Output Dir: .ralph/output/red-giraffe/loop-0

Agent 1: Linear Reader starting...
```

Note: "Agent 1", "Agent 2", "Agent 3" labels remain unchanged - these correctly identify individual agents.

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `ralph/src/lib/agent-name.ts` | Rename + Edit | → `loop-instance-name.ts`, update functions |
| `ralph/src/lib/output-logger.ts` | Edit | Update import, parameter name |
| `ralph/src/index.ts` | Edit | Update imports, variable names, console output, prompts |
| `ralph/prompts/agent1-linear-reader.md` | Edit | Update comment format description |
| `ralph/prompts/agent3-linear-writer.md` | Edit | Update comment format description |
| `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md` | Edit | Add naming conventions section |
| `thoughts/research-implement/2025-01-25-RSK-13-agent-naming-system.md` | Edit | Update title and terminology |

## Verification Steps

1. **Build passes**: `npm run build` succeeds
2. **Typecheck passes**: `npm run typecheck` succeeds
3. **Lint passes**: `npm run lint` succeeds
4. **Grep verification**: No remaining references to "agentName" or "agent name" in contexts where "loop instance name" is meant
5. **Console output review**: Start the system and verify the output uses correct terminology

## Success Criteria

1. All source code uses `loopInstanceName` instead of `agentName` for the loop identifier
2. Console output says "Loop Instance:" instead of "Agent Name:"
3. Prompt documentation correctly distinguishes between "loop instance name" and "agent"
4. Linear comment formats use "Loop Instance" instead of "Agent" for the identifier
5. Architecture documentation explains the Pod → Loop → Agent hierarchy
6. The system builds and runs correctly with no functional changes
7. RSK-18 is unblocked and can proceed with implementing pod naming

## Risks and Mitigations

1. **Risk**: Existing Linear comments use old format
   - **Mitigation**: This is fine - old comments are historical record. New comments will use new format.

2. **Risk**: Output directory structure already uses `loopNameDisplay`
   - **Mitigation**: The output-logger already uses `currentLoopName` internally, so directory structure won't change. This is good.

3. **Risk**: Breaking change if other systems parse the console output
   - **Mitigation**: Currently no external systems depend on console output format. This is a low-risk change.

## Implementation Order

Execute phases in order (1 → 2 → 3 → 4). Within Phase 1, do file rename first, then update imports, then update variable names.

## Notes for RSK-18 (Pod Naming)

This implementation prepares for RSK-18 by:
1. Clearly separating "loop instance name" from "agent"
2. Documenting the pod → loop → agent hierarchy
3. Leaving room for a `podName` to be added that generates at `npm start` time
4. The loop instance name could eventually become `{pod-name}-loop-{n}` or remain separate

---

## References

- Research: `thoughts/research/2025-01-25-RSK-15-consistent-naming-conventions.md`
- Blocked by this: RSK-18 (Update the name of the pod)
