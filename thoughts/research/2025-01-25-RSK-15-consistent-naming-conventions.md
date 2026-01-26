# RSK-15: Consistent Naming Conventions Research

## Issue Summary

The Ralph v2 autonomous development system has three key hierarchical concepts that need consistent naming throughout the codebase, documentation, prompts, and debug output:

1. **Pod** - An `npm start` instance (the outer orchestration layer)
2. **Loop** - An iteration within a pod (loop 0, loop 1, loop 2, etc.)
3. **Agent** - An individual Claude Code instance within a loop (Agent 1, Agent 2, Agent 3)

This research documents the current state of naming throughout the codebase and identifies inconsistencies.

---

## Current Terminology Usage

### 1. Pod (npm start instance)

**Desired Definition**: The outer layer representing an entire `npm start` invocation. Multiple pods can run on multiple machines in parallel.

**Current State**: The "Pod" concept is **NOT explicitly used anywhere** in the codebase.

| Context | Current Term Used | Location |
|---------|-------------------|----------|
| Architecture docs | "NODE.JS ORCHESTRATOR" | `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md:86` |
| README concept | Not mentioned | N/A |
| Console output | "Ralph v2" | `ralph/src/index.ts:163` |
| Comments | "orchestrator" | Architecture docs only |

**Finding**: The concept of a "pod" exists implicitly but has no formal naming. The `while(true)` loop in `main()` represents the pod's continuous execution, but it's never called a "pod."

---

### 2. Loop (Iteration within a Pod)

**Desired Definition**: A single complete execution cycle containing three sequential agent runs.

**Current State**: "Loop" is used somewhat consistently but with terminology overlap.

| Context | Current Term | Location |
|---------|--------------|----------|
| Main function | `iteration` variable | `ralph/src/index.ts:167` |
| Console output | "LOOP ${iteration}" | `ralph/src/index.ts:17` |
| Safety net commits | "loop iteration ${iteration}" | `ralph/src/lib/git.ts:27` |
| Output logger | `currentLoopNumber` | `ralph/src/lib/output-logger.ts:9` |
| Error logs | "Loop ${iteration} error" | `ralph/src/index.ts:174` |
| Architecture docs | "LOOP ITERATION" | Plan document |
| Directory structure | `loop-${currentLoopNumber}` | `ralph/src/lib/output-logger.ts:35` |

**Findings**:
1. "Loop" and "iteration" are used **interchangeably** - inconsistent
2. The variable is named `iteration` but displayed as "LOOP" in console output
3. The term is clear but could be more consistent

---

### 3. Agent (Claude Code Instance)

**Desired Definition**: An individual Claude Code instance. Three agents run sequentially per loop:
- Agent 1: Linear Reader
- Agent 2: Worker
- Agent 3: Linear Writer

**Current State**: Agent naming is relatively consistent but has one major confusion point.

| Context | Current Term | Location |
|---------|--------------|----------|
| Console output | "Agent 1:", "Agent 2:", "Agent 3:" | `ralph/src/index.ts:25,63,97` |
| Prompt files | `agent1-linear-reader.md`, `agent2-worker.md`, `agent3-linear-writer.md` | `ralph/prompts/` |
| Prompt headers | "# Agent 1: Linear Reader", etc. | Prompt files |
| Log files | `agent-${agentNumber}.log` | `ralph/src/lib/output-logger.ts:36` |
| Function param | `agentNumber` (1, 2, or 3) | Throughout codebase |

**Agent Name (Loop Instance Identifier)**:

This is where a significant naming confusion exists.

| Context | Current Term | Location |
|---------|--------------|----------|
| File name | `agent-name.ts` | `ralph/src/lib/agent-name.ts` |
| Function name | `generateAgentName()` | `ralph/src/lib/agent-name.ts:26` |
| Variable in index.ts | `agentName` | `ralph/src/index.ts:12` |
| Console output | "Agent Name: ${agentName}" | `ralph/src/index.ts:18` |
| Output logger variable | `currentLoopName` | `ralph/src/lib/output-logger.ts:8` |
| Function param | `agentName` in `initLoopLogger()` | `ralph/src/lib/output-logger.ts:75` |
| Comments | "agent loop instances" | `ralph/src/lib/agent-name.ts:2` |
| Linear comments | "Agent Claimed \| {agent name}" | Prompts |
| Session stats | "Agent Name: ${agentName}" | `ralph/src/index.ts:122` |
| Documentation | "Agent Loop Naming System" | `thoughts/research-implement/2025-01-25-RSK-13-agent-naming-system.md:1` |

**Findings**:
1. **Major Confusion**: The term "agent name" (e.g., `red-giraffe-1737848125`) actually identifies a **loop instance**, not an individual agent
2. In `output-logger.ts`, the same value is stored as `currentLoopName` (correct) but receives parameter named `agentName` (confusing)
3. The documentation title "Agent Loop Naming System" is actually clearer than the code variable names
4. Three agents share the same "agent name" per loop, which is semantically confusing

---

## Inconsistencies Summary

### Critical Issues

1. **"Agent Name" vs "Loop Instance ID"**
   - The memorable name (e.g., `red-giraffe-1737848125`) identifies the **loop**, not an individual agent
   - All three agents share this name within a single loop
   - Variable names like `agentName` and `currentLoopName` refer to the same thing but use different terms
   - This is the **most significant naming inconsistency**

2. **"Pod" Not Defined**
   - The concept exists but has no formal terminology
   - Referred to variously as "orchestrator", "npm start instance", or just "Ralph v2"
   - No way to distinguish between multiple parallel deployments in logs/comments

3. **"Loop" vs "Iteration"**
   - Used interchangeably in code and output
   - `iteration` variable but `LOOP` in display
   - Minor but should be standardized

### Minor Issues

4. **Agent 2 Stage Names in Prompts**
   - Worker prompts use: `agent2-worker-research.md`, `agent2-worker-plan.md`, etc.
   - These are clear and consistent

5. **Linear Comment Headers**
   - Use format: `Agent Claimed | {name} | {timestamp}`
   - The "Agent Claimed" is potentially confusing since it's the loop name being included

---

## Files Requiring Updates

### Source Code

| File | Changes Needed |
|------|----------------|
| `ralph/src/lib/agent-name.ts` | Rename to `loop-instance-name.ts` or update function names |
| `ralph/src/lib/output-logger.ts` | Rename `currentLoopName` → consistent with chosen term |
| `ralph/src/index.ts` | Rename `agentName` variable → consistent with chosen term |

### Prompts

| File | Changes Needed |
|------|----------------|
| `ralph/prompts/agent1-linear-reader.md` | Update "Agent Instance" section header; clarify that name identifies the loop |
| `ralph/prompts/agent2-worker.md` | Update "Agent Instance" section header |
| `ralph/prompts/agent3-linear-writer.md` | Update "Agent Instance" section header; update comment format descriptions |

### Documentation

| File | Changes Needed |
|------|----------------|
| `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md` | Add Pod terminology; clarify hierarchy |
| `thoughts/research-implement/2025-01-25-RSK-13-agent-naming-system.md` | Update title and terminology |

### Console Output Messages

| Location | Current | Needs Update |
|----------|---------|--------------|
| `ralph/src/index.ts:18` | "Agent Name: ${agentName}" | Change to reflect loop instance |
| `ralph/src/index.ts:17` | "LOOP ${iteration}" | Already good, keep |
| `ralph/src/index.ts:122` | "Agent Name: ${agentName}" | Change to reflect loop instance |

---

## Recommendations

### Option A: Keep "Agent Name" but Clarify

Minimal changes, add documentation clarifying that "agent name" identifies the loop, not individual agents.

**Pros**: Minimal code changes
**Cons**: Semantically confusing; doesn't address the core issue

### Option B: Rename to "Loop Name" (Recommended)

Rename all references from "agent name" to "loop name" or "loop instance name":
- `agentName` → `loopName` or `loopInstanceName`
- `generateAgentName()` → `generateLoopName()`
- `agent-name.ts` → `loop-name.ts`
- "Agent Name:" → "Loop Name:" in console output

**Pros**: Semantically accurate; clearly distinguishes loop identity from agent identity
**Cons**: More code changes; needs careful find/replace

### Option C: Full Hierarchy with "Pod"

Add explicit Pod naming to the system:
- Pod: Named like `prod-alpha` or auto-generated on `npm start`
- Loop: Numbered within pod (loop 0, loop 1, loop 2)
- Agent: Agent 1, Agent 2, Agent 3 within each loop

Full identifier could be: `prod-alpha/loop-3/agent-2` or `red-giraffe/loop-0/agent-1`

**Pros**: Complete clarity; supports multi-machine debugging; future-proof
**Cons**: Most changes; may be over-engineering for current needs

---

## Proposed Terminology Glossary

Based on the issue description and analysis, here's the proposed consistent terminology:

| Concept | Term | Format/Example | Description |
|---------|------|----------------|-------------|
| Outer Instance | **Pod** | `red-giraffe` (adjective-animal) | An `npm start` invocation. Multiple pods can run in parallel on different machines. |
| Execution Cycle | **Loop** | `loop 0`, `loop 1`, `loop 2` | A complete iteration within a pod, containing three sequential agent runs. |
| Claude Instance | **Agent** | `Agent 1`, `Agent 2`, `Agent 3` | An individual Claude Code instance. Also called by role: "Linear Reader", "Worker", "Linear Writer". |
| Full Identifier | **Pod Loop Agent** | `red-giraffe / loop 2 / Agent 1` | Complete identification for debugging and attribution. |

---

## Next Steps

This research identifies the naming inconsistencies and options for resolution. The planning phase should:

1. Choose between Options A, B, or C based on desired scope
2. Create detailed implementation plan for chosen option
3. Enumerate all files and specific line changes needed
4. Determine if this is a breaking change for any existing tooling

---

## Assessment: Straightforward vs Complex

This task is **COMPLEX** because:
- Affects multiple files across code, prompts, and documentation
- Requires coordinated renaming to avoid partial updates
- Involves semantic decisions about terminology
- Has implications for Linear comment formats (public-facing)
- Should be done atomically to avoid inconsistent state

**Recommendation**: Proceed to planning phase rather than fast-track implementation.

---

## References

- Issue: RSK-15
- Related: RSK-18 (Update the name of the pod) - this issue BLOCKS RSK-18
- Architecture doc: `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md`
- Agent naming implementation: `thoughts/research-implement/2025-01-25-RSK-13-agent-naming-system.md`
