---
date: 2026-01-26T03:19:55Z
researcher: Claude
git_commit: bcd4d00b5c3825ca8d9c4b77af58b054e328a467
branch: main
repository: ralph-default-files
topic: "Analysis of Ralph v2 Architecture Against External Feedback"
tags: [research, codebase, ralph, architecture, feedback-analysis]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Analysis of Ralph v2 Architecture Against External Feedback

**Date**: 2026-01-26T03:19:55Z
**Researcher**: Claude
**Git Commit**: bcd4d00b5c3825ca8d9c4b77af58b054e328a467
**Branch**: main
**Repository**: ralph-default-files

## Research Question

Analyze the current Ralph implementation against detailed architecture feedback to understand which concerns have been addressed and which remain open.

## Summary

This research analyzes the current Ralph v2 implementation against 8 key feedback areas. The analysis reveals that most concerns from the feedback **have NOT been addressed** in the current implementation:

| Feedback Area | Status | Notes |
|---------------|--------|-------|
| Tool isolation (MCP) | ⚠️ Partial | Uses `--allowedTools` flag, not `--strict-mcp-config` |
| Git parallelism | ❌ Not addressed | Still pushes directly to main |
| Safety net policy | ❌ Not addressed | Still pushes potentially broken work to main |
| JSON schema output | ❌ Not addressed | YAML-ish blocks with regex parsing; parsers exist but unused |
| "Needs Human" state | ❌ Not addressed | No explicit human intervention workflow |
| Oneshot classification | ⚠️ Partial | Uses heuristics, not explicit labels |
| Run ID / heartbeat | ⚠️ Partial | Has loop instance name but no run_id correlation |
| Deterministic status transitions | ❌ Not addressed | Agent 3 decides status, not orchestrator |

## Detailed Findings

### 1. Tool Isolation (MCP Enforcement)

**Feedback Concern**: Use `--strict-mcp-config` to enforce that Agent 2 cannot touch Linear at the process boundary.

**Current Implementation**:
- Uses `--allowedTools mcp__linear__*` flag for Agent 1 and Agent 3 (`ralph/src/lib/claude.ts:199-201`)
- Agent 2 has **no CLI-level tool restrictions** - no `--allowedTools` passed (`ralph/src/index.ts:99-111`)
- Single `.mcp.json` file at project root defines Linear MCP server
- **No use of `--mcp-config` or `--strict-mcp-config`**
- **No use of `--disallowedTools`**
- Agent 2 prompts state "You do NOT have access to Linear" but this is prompt-based, not enforced

**Status**: ⚠️ Partially addressed via `--allowedTools` but not using recommended `--strict-mcp-config` approach

**Code References**:
- `ralph/src/lib/claude.ts:199-201` - allowedTools flag logic
- `ralph/src/index.ts:51-55` - Agent 1 with `['mcp__linear__*']`
- `ralph/src/index.ts:99-111` - Agent 2 with no tool restrictions
- `.mcp.json` - Global Linear MCP configuration

---

### 2. Git Parallelism / Push to Main

**Feedback Concern**: "Multiple VMs + push directly to main" will collide. Recommend either single VM for implement, or branch-per-issue.

**Current Implementation**:
- Agent 2 pushes directly to `origin main` (`ralph/prompts/agent2-worker.md:63`)
- Safety net also pushes to `main` (`ralph/src/lib/git.ts:43`)
- No branch-per-issue workflow
- No single-VM lock for implementation
- Architecture plan explicitly states "push directly to main" in scope

**Status**: ❌ Not addressed - still pushes directly to main with multi-VM capability

**Code References**:
- `ralph/src/lib/git.ts:43` - Hardcoded `git push origin main`
- `ralph/prompts/agent2-worker.md:63` - Agent 2 instructed to push to main
- `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md:121-123` - Explicit "Not in v1" for PR workflow

---

### 3. Safety Net Policy

**Feedback Concern**: Safety net can publish broken work. Should push to quarantine branch, not main.

**Current Implementation**:
- Safety net runs unconditionally after Agent 3 (`ralph/src/index.ts:179`)
- Uses `git add -A` to stage all changes (`ralph/src/lib/git.ts:24`)
- Commits with `[SAFETY-NET]` message (`ralph/src/lib/git.ts:27-36`)
- **Pushes directly to `origin main`** (`ralph/src/lib/git.ts:43`)
- No validation of repo health before pushing
- No quarantine branch concept
- No check that work is complete or tests pass

**Status**: ❌ Not addressed - still pushes potentially broken partial work to main

**Code References**:
- `ralph/src/lib/git.ts:6-56` - Full safety net implementation
- `ralph/src/lib/git.ts:43` - Push to main
- `ralph/src/lib/git.ts:24` - Unconditional `git add -A`

---

### 4. JSON Schema Output

**Feedback Concern**: Use `--json-schema` for validated structured output instead of YAML-ish blocks.

**Current Implementation**:
- Agent outputs expected in YAML-ish format (e.g., `DISPATCH_RESULT:`, `WORK_RESULT:`)
- Custom regex-based parsers exist (`ralph/src/lib/parsers.ts:4-305`)
- **Parsers are NEVER actually used** - orchestrator passes raw text between agents
- No `--json-schema` flag used when spawning Claude (`ralph/src/lib/claude.ts:190-196`)
- Agent 3 reads Agent 2's output as natural language, not structured data

**Status**: ❌ Not addressed - uses YAML-ish blocks with regex parsing; parsers exist but unused

**Code References**:
- `ralph/src/lib/parsers.ts:4-168` - `parseDispatchResult()` (unused)
- `ralph/src/lib/parsers.ts:170-271` - `parseWorkResult()` (unused)
- `ralph/src/lib/parsers.ts:273-305` - `parseLinearUpdate()` (unused)
- `ralph/src/index.ts:117-118` - Raw text passed to Agent 3, no parsing

---

### 5. "Needs Human" State

**Feedback Concern**: Add explicit "Needs Human" / "Blocked (Human)" state for missing requirements, ambiguous tickets, etc.

**Current Implementation**:
- Workflow has "Blocked" and "Won't Do" in Canceled category
- **No "Needs Human" or "Blocked (Human)" state**
- Failures keep current status and retry on next loop
- Agent 3 prompt says "any failure → Keep current status" (`ralph/prompts/agent3-linear-writer.md:64`)
- System will churn and retry forever if requirements are unclear

**Status**: ❌ Not addressed - no explicit human intervention workflow

**Code References**:
- `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md:312-318` - Status definitions
- `ralph/prompts/agent3-linear-writer.md:64` - Failure handling keeps status

---

### 6. Oneshot Classification

**Feedback Concern**: Make "Oneshot" an explicit label, not a heuristic. If keeping heuristics, make them conservative.

**Current Implementation**:
- Uses heuristics for oneshot classification (`ralph/prompts/agent1-linear-reader.md:84-85`):
  - Labels: `chore`, `bug`, `small`, `quick-fix`, `trivial`, `hotfix`
  - Estimates: XS, S
- **No explicit "Oneshot" label requirement**
- Heuristics appear aggressive (any "bug" label triggers oneshot)

**Status**: ⚠️ Partially addressed - uses heuristics, not explicit label; not conservative

**Code References**:
- `ralph/prompts/agent1-linear-reader.md:84-85` - Oneshot heuristics
- `ralph/prompts/agent1-linear-reader.md:86` - "Use STAGED otherwise"

---

### 7. Run ID / Heartbeat

**Feedback Concern**: Add unique run_id in claim comment, include in subsequent comments, use for timeout reset validation.

**Current Implementation**:
- Has "loop instance name" (`ralph/src/lib/loop-instance-name.ts:60-74`)
- Format: `{adjective}-{animal}-{YYYYMMDD-HHMMSS}` (e.g., `calm-pegasus-20250125-143052`)
- Included in claim comments and completion comments
- **BUT: Timeout detection does NOT check run_id correlation**
- Agent 1 checks for "Agent Claimed" comment timestamp, not matching run_id
- No heartbeat mechanism

**Status**: ⚠️ Partially addressed - has loop instance name but timeout logic doesn't use run_id correlation

**Code References**:
- `ralph/src/lib/loop-instance-name.ts:60-74` - Loop instance name generation
- `ralph/prompts/agent1-linear-reader.md:108-114` - Claim comment format with loop instance
- `ralph/prompts/agent1-linear-reader.md:49-55` - Timeout detection (no run_id check)

---

### 8. Deterministic Status Transitions

**Feedback Concern**: Make status transitions deterministic in Node orchestrator, not decided by agents.

**Current Implementation**:
- Agent 2 outputs `next_status` field in WORK_RESULT (`ralph/src/types.ts:38`)
- Agent 3 has hardcoded mapping, ignores Agent 2's `next_status` (`ralph/prompts/agent3-linear-writer.md:55-67`)
- **Node orchestrator does NOT parse or validate status transitions**
- All status transitions controlled by Agent 3's prompt instructions
- Orchestrator is pass-through for text, not a decision-maker

**Status**: ❌ Not addressed - Agent 3 decides status, not orchestrator

**Code References**:
- `ralph/src/index.ts:117-118` - Raw text passed, no parsing
- `ralph/prompts/agent3-linear-writer.md:55-67` - Agent 3's status mapping
- `ralph/src/types.ts:38` - `nextStatus` field definition

---

## Architecture Documentation

### Current Agent Flow
```
Agent 1 (Linear Reader)     Agent 2 (Worker)           Agent 3 (Linear Writer)
─────────────────────────   ─────────────────────────  ─────────────────────────
Tools: mcp__linear__*       Tools: All EXCEPT Linear   Tools: mcp__linear__*
Model: haiku                Model: opus/configurable   Model: haiku

1. Query Linear             4. Read Agent 1 raw text   7. Read Agent 1 raw text
2. Select & claim issue     5. Execute work            8. Read Agent 2 raw text
3. Output DISPATCH_RESULT   6. Output WORK_RESULT      9. Post comment to Linear
   (as text, not parsed)       (as text, not parsed)  10. Update issue status
                                                       11. Output LINEAR_UPDATE
```

### Current Tool Isolation
- Agent 1: `--allowedTools mcp__linear__*`
- Agent 2: No restrictions (relies on prompt)
- Agent 3: `--allowedTools mcp__linear__*`

### Current Git Flow
- Agent 2 commits and pushes to main
- Safety net pushes any remaining changes to main
- No branches, no PRs

## Code References

### Core Files
- `ralph/src/index.ts` - Main orchestration loop
- `ralph/src/lib/claude.ts:185-217` - Claude CLI spawning with allowedTools
- `ralph/src/lib/git.ts:6-56` - Safety net implementation
- `ralph/src/lib/parsers.ts` - Unused parser functions
- `ralph/src/lib/loop-instance-name.ts` - Loop identifier generation

### Prompt Files
- `ralph/prompts/agent1-linear-reader.md` - Issue claiming and stage detection
- `ralph/prompts/agent2-worker-*.md` - Stage-specific worker prompts
- `ralph/prompts/agent3-linear-writer.md` - Linear update and status transitions

### Configuration
- `ralph/src/config.ts` - Runtime configuration
- `.mcp.json` - Linear MCP server definition

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md` - Original architecture plan
- Various research/validation docs exist for individual feature implementations

## Related Research

None directly related to this feedback analysis.

## Open Questions

1. **Why are parsers unused?** The parsing infrastructure was built but the orchestrator never adopted it. Was this intentional or incomplete?

2. **Is `--allowedTools` sufficient for tool isolation?** The feedback specifically warns that tool blocking may not reliably apply to MCP tools. Testing needed.

3. **What's the plan for multi-VM coordination?** The architecture allows multiple VMs but git conflicts are unaddressed.

4. **Should Agent 2 failures trigger human review?** Currently failures just retry forever.
