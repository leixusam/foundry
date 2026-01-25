# Ralph v2: Linear-Orchestrated Autonomous Agent System

## Overview

Ralph v2 is a complete rewrite of the autonomous AI development system. It replaces the current bash-based loop with a Node.js orchestrator that uses Linear as the state machine for task management. The system runs three specialized Claude agents per loop iteration, with strict separation of concerns:

- **Agent 1 (Linear Reader)**: Reads from Linear, selects work, claims issues
- **Agent 2 (Worker)**: Executes development work, writes to repo, never touches Linear
- **Agent 3 (Linear Writer)**: Updates Linear with results, never touches code

This architecture enables parallel agent execution across multiple VMs, crash recovery via timeouts, and a complete audit trail in Linear.

---

## Current State Analysis

### What Exists Now

The current system (`ralph.sh`) is a 732-line bash script that:

1. Reads a prompt file (`PROMPT_build.md` or `PROMPT_plan.md`)
2. Pipes it to `claude -p --output-format=stream-json`
3. Processes the JSON stream with elaborate jq filters
4. Handles rate limits by parsing reset times
5. Git pushes after each iteration
6. Loops indefinitely

**Key files:**
- `ralph.sh:532-538` - Claude spawning: `cat "$PROMPT_FILE" | claude -p --dangerously-skip-permissions --output-format=stream-json`
- `PROMPT_build.md` - Agent reads `IMPLEMENTATION_PLAN.md` to pick tasks
- `IMPLEMENTATION_PLAN.md` - Markdown file with checkbox task tracking
- `.mcp.json` - Linear MCP configuration already exists

### Problems with Current Approach

1. **File-based state**: `IMPLEMENTATION_PLAN.md` is fragile, can have merge conflicts
2. **No parallel safety**: Multiple agents would corrupt the state file
3. **No crash recovery**: If agent dies, task state is undefined
4. **Monolithic session**: One long session does everything
5. **No audit trail**: No structured log of what was attempted/completed

---

## Desired End State

### System Behavior

A Node.js process runs continuously on an ephemeral VM. Each loop iteration:

1. **Agent 1** queries Linear, finds highest-priority ready issue, claims it by updating status to "X In Progress", outputs complete issue details
2. **Agent 2** receives issue details, executes the appropriate work (research/plan/implement/validate/oneshot), commits and pushes to main
3. **Agent 3** receives work results, posts detailed comment to Linear, updates status to next stage
4. **Node.js** performs safety-net git push for any uncommitted changes (with special commit message)
5. Loop continues

### Verification

The system is working correctly when:

- [ ] Linear issues move through statuses automatically
- [ ] Each issue has a complete comment trail of agent work
- [ ] Artifacts appear in `thoughts/` folder with proper naming
- [ ] Code changes are committed and pushed to main
- [ ] Stale "In Progress" issues (>4 hours) are automatically reset
- [ ] Multiple VMs can work from the same Linear workspace without collision

---

## What We're NOT Doing (v1 Scope)

1. **Interactive setup script** - Future enhancement, hardcode config for now
2. **Agent-created Linear tickets** - Humans create tickets for now
3. **PR workflow** - Push directly to main (can add PR flow later)
4. **Web dashboard** - CLI output only
5. **Metrics/analytics** - Basic logging only
6. **Multi-repo support** - One repo per deployment

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NODE.JS ORCHESTRATOR                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         LOOP ITERATION                                  │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ AGENT 1: Linear Reader                                          │   │ │
│  │  │                                                                  │   │ │
│  │  │ Tools: Linear MCP ONLY                                          │   │ │
│  │  │ Model: claude-sonnet (fast, structured)                         │   │ │
│  │  │                                                                  │   │ │
│  │  │ Actions:                                                         │   │ │
│  │  │ 1. Check for stale "In Progress" issues (>4hr) → reset them     │   │ │
│  │  │ 2. Query issues ready for work                                  │   │ │
│  │  │ 3. Select highest priority issue                                │   │ │
│  │  │ 4. Decide stage: oneshot | research | plan | implement | validate│   │ │
│  │  │ 5. Claim issue (update status + post comment with timestamp)    │   │ │
│  │  │ 6. Output complete issue details for Agent 2                    │   │ │
│  │  │                                                                  │   │ │
│  │  │ Output Format:                                                   │   │ │
│  │  │ DISPATCH_RESULT:                                                 │   │ │
│  │  │   issue_id: <uuid>                                              │   │ │
│  │  │   issue_identifier: ENG-123                                     │   │ │
│  │  │   issue_title: <title>                                          │   │ │
│  │  │   issue_description: <full description from Linear>            │   │ │
│  │  │   stage: research|plan|implement|validate|oneshot              │   │ │
│  │  │   project_name: <project>                                       │   │ │
│  │  │   claim_timestamp: <ISO timestamp>                              │   │ │
│  │  │   labels: [<label1>, <label2>]                                  │   │ │
│  │  │   priority: <urgent|high|medium|low|none>                       │   │ │
│  │  │   existing_artifacts: |                                         │   │ │
│  │  │     research: thoughts/research/2025-01-24-ENG-123-foo.md      │   │ │
│  │  │     plan: thoughts/plans/2025-01-24-ENG-123-foo.md             │   │ │
│  │  │   comments_summary: |                                           │   │ │
│  │  │     <summary of relevant human/agent comments>                  │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                              │                                          │ │
│  │                              │ Parsed by Node.js                        │ │
│  │                              ▼                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ AGENT 2: Worker                                                  │   │ │
│  │  │                                                                  │   │ │
│  │  │ Tools: Full Claude Code toolset EXCEPT Linear MCP               │   │ │
│  │  │ Model: claude-opus (heavy lifting)                              │   │ │
│  │  │                                                                  │   │ │
│  │  │ Receives:                                                        │   │ │
│  │  │ - Complete issue details from Agent 1 output                    │   │ │
│  │  │ - Stage to execute (research/plan/implement/validate/oneshot)  │   │ │
│  │  │                                                                  │   │ │
│  │  │ Guardrails:                                                      │   │ │
│  │  │ - If input is unclear/incomplete → output error, do no work     │   │ │
│  │  │ - If issue_id missing → abort                                   │   │ │
│  │  │ - If stage missing → abort                                      │   │ │
│  │  │                                                                  │   │ │
│  │  │ Actions (varies by stage):                                       │   │ │
│  │  │ - Read/write files in thoughts/ folder                          │   │ │
│  │  │ - Read/write source code                                         │   │ │
│  │  │ - Run tests, typecheck, lint                                     │   │ │
│  │  │ - Git commit and push to main                                    │   │ │
│  │  │                                                                  │   │ │
│  │  │ Output Format:                                                   │   │ │
│  │  │ WORK_RESULT:                                                     │   │ │
│  │  │   success: true|false                                           │   │ │
│  │  │   stage_completed: research|plan|implement|validate|oneshot    │   │ │
│  │  │   artifact_path: thoughts/research/2025-01-25-ENG-123-foo.md   │   │ │
│  │  │   commit_hash: a1b2c3d (if committed)                           │   │ │
│  │  │   next_status: "Needs Plan" (the Linear status to set)         │   │ │
│  │  │   summary: |                                                     │   │ │
│  │  │     <detailed description of what was done>                     │   │ │
│  │  │   error: |                                                       │   │ │
│  │  │     <if failed, what went wrong>                                │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                              │                                          │ │
│  │                              │ Parsed by Node.js                        │ │
│  │                              ▼                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ AGENT 3: Linear Writer                                          │   │ │
│  │  │                                                                  │   │ │
│  │  │ Tools: Linear MCP ONLY                                          │   │ │
│  │  │ Model: claude-haiku (simple, fast)                              │   │ │
│  │  │                                                                  │   │ │
│  │  │ Receives:                                                        │   │ │
│  │  │ - Agent 1 output (issue details)                                │   │ │
│  │  │ - Agent 2 output (work results)                                 │   │ │
│  │  │                                                                  │   │ │
│  │  │ Guardrails:                                                      │   │ │
│  │  │ - If Agent 2 output is unclear → post error comment, no status │   │ │
│  │  │   change                                                         │   │ │
│  │  │ - If issue_id missing from Agent 1 → abort                      │   │ │
│  │  │                                                                  │   │ │
│  │  │ Actions:                                                         │   │ │
│  │  │ 1. Post detailed comment with work results                      │   │ │
│  │  │ 2. Update issue status to next stage (if successful)           │   │ │
│  │  │                                                                  │   │ │
│  │  │ Output Format:                                                   │   │ │
│  │  │ LINEAR_UPDATE:                                                   │   │ │
│  │  │   comment_posted: true                                          │   │ │
│  │  │   status_updated: true|false                                    │   │ │
│  │  │   new_status: "Needs Plan"                                      │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                              │                                          │ │
│  │                              ▼                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │ NODE.JS: Safety Net                                              │   │ │
│  │  │                                                                  │   │ │
│  │  │ 1. Check for uncommitted changes: git status --porcelain        │   │ │
│  │  │ 2. If changes exist:                                             │   │ │
│  │  │    - git add -A                                                  │   │ │
│  │  │    - git commit -m "[SAFETY-NET] Uncommitted changes from       │   │ │
│  │  │      loop iteration {N} - Agent 2 may have crashed"             │   │ │
│  │  │    - git push origin main                                        │   │ │
│  │  │ 3. Log if safety net was triggered (should be rare)             │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Handle rate limits, errors, sleep, continue to next iteration              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Linear Status State Machine

```
                                    ┌─────────────┐
                                    │   Backlog   │
                                    │  (Triage)   │
                                    └──────┬──────┘
                                           │ Human moves to ready
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AGENT-MANAGED FLOW                               │
│                                                                               │
│  ┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐  │
│  │ Needs Research  │──────│ Research In Progress │──────│ Needs Plan      │  │
│  └─────────────────┘      └─────────────────────┘      └────────┬────────┘  │
│         │                         │                              │           │
│         │ (small task)            │ (>4hr timeout)               │           │
│         │                         ▼                              │           │
│         │                  Reset to previous                     │           │
│         │                                                        ▼           │
│         │                 ┌─────────────────────┐      ┌─────────────────┐  │
│         │                 │   Plan In Progress  │◄─────│    (claimed)    │  │
│         │                 └──────────┬──────────┘      └─────────────────┘  │
│         │                            │                                       │
│         │                            ▼                                       │
│         │                 ┌─────────────────────┐                           │
│         │                 │   Needs Implement   │                           │
│         │                 └──────────┬──────────┘                           │
│         │                            │                                       │
│         │                            ▼                                       │
│         │                 ┌─────────────────────┐                           │
│         │                 │Implement In Progress│                           │
│         │                 └──────────┬──────────┘                           │
│         │                            │                                       │
│         │                            ▼                                       │
│         │                 ┌─────────────────────┐                           │
│         │                 │   Needs Validate    │                           │
│         │                 └──────────┬──────────┘                           │
│         │                            │                                       │
│         │                            ▼                                       │
│         │                 ┌─────────────────────┐                           │
│         │                 │Validate In Progress │                           │
│         │                 └──────────┬──────────┘                           │
│         │                            │                                       │
│         │                            ▼                                       │
│         │                 ┌─────────────────────┐                           │
│         └────────────────►│Oneshot In Progress  │                           │
│                           └──────────┬──────────┘                           │
│                                      │                                       │
│                                      ▼                                       │
│                           ┌─────────────────────┐                           │
│                           │        Done         │                           │
│                           └─────────────────────┘                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

Status Categories (Linear built-in):
- Backlog: Backlog
- Unstarted: Needs Research, Needs Plan, Needs Implement, Needs Validate
- Started: Research In Progress, Plan In Progress, Implement In Progress,
           Validate In Progress, Oneshot In Progress
- Completed: Done
- Canceled: Blocked, Won't Do
```

### Linear Comment Format

All agent comments follow a consistent format for parseability and audit trail:

**Agent 1 - Claiming:**
```markdown
🤖 **Agent Claimed** | 2025-01-25T14:32:17Z

**Stage**: Research
**Timeout**: 4 hours (will reset if no update by 2025-01-25T18:32:17Z)
```

**Agent 3 - Success:**
```markdown
🤖 **Stage Complete** | 2025-01-25T15:47:23Z

**Stage**: Research → Needs Plan
**Duration**: 1h 15m

## Summary
Analyzed the codebase for dark mode implementation. Found existing theme context
in `src/contexts/ThemeContext.tsx`. Identified 47 components needing updates.

## Artifacts
- Research: `thoughts/research/2025-01-25-ENG-123-dark-mode.md`
- Commit: `a1b2c3d`

## Key Findings
- Existing Tailwind config supports dark mode via class strategy
- 12 components already have dark variants
- Recommend CSS variable approach for consistent theming

## Next Steps
Ready for planning stage.
```

**Agent 3 - Failure:**
```markdown
🤖 **Stage Failed** | 2025-01-25T15:47:23Z

**Stage**: Implement (status unchanged)
**Duration**: 2h 03m

## Error
TypeScript compilation failed with 3 errors in `src/components/Button.tsx`.

## Attempted
- Tried union type approach
- Tried generic type parameter
- Both failed due to existing Button interface constraints

## Artifacts
- Partial work: `thoughts/implement/2025-01-25-ENG-123-dark-mode.md`

## Will Retry
Next loop iteration will attempt this stage again.
```

**Agent 1 - Timeout Reset:**
```markdown
🤖 **Timeout Reset** | 2025-01-25T18:45:00Z

Resetting stale claim from 2025-01-25T14:32:17Z.
Issue was in "Research In Progress" for over 4 hours with no completion.
Will be picked up by next available agent.
```

---

## Agent Specifications

### Agent 1: Linear Reader

**Purpose**: Query Linear, select work, claim issues, output complete context for Agent 2

**Model**: `claude-sonnet` (fast, good at structured output)

**Tools**: Linear MCP only (`mcp__linear__*`)

**Prompt**: See `prompts/agent1-linear-reader.md`

**Key Behaviors**:

1. **Stale Issue Detection**
   - Query all issues with status containing "In Progress"
   - Parse most recent `🤖 **Agent Claimed**` comment for timestamp
   - If timestamp > 4 hours ago, reset status and post timeout comment

2. **Work Selection**
   - Query issues with status: Needs Research | Needs Plan | Needs Implement | Needs Validate
   - Prioritize by:
     1. Blocking relationships (issues blocking others go first)
     2. Priority labels (Urgent > High > Medium > Low)
     3. Stage progress (Validate > Implement > Plan > Research - finish what's started)
     4. Age (older issues first)

3. **Stage Decision**
   - **Oneshot**: Labels include "chore", "bug", "small", "quick-fix", "trivial", OR estimated XS/S
   - **Staged**: Everything else, use current status to determine stage

4. **Claiming**
   - Update status to "X In Progress"
   - Post claiming comment with timestamp
   - Output complete issue details (see format above)

5. **Output Requirements**
   Agent 1 MUST output everything Agent 2 needs to do its work. Agent 2 will NEVER query Linear.

   Required fields:
   - `issue_id`: Linear UUID
   - `issue_identifier`: Human-readable ID (e.g., ENG-123)
   - `issue_title`: Issue title
   - `issue_description`: Complete description from Linear
   - `stage`: The work type to execute
   - `project_name`: Project name for context
   - `claim_timestamp`: When claimed (for duration tracking)
   - `labels`: All labels on the issue
   - `priority`: Issue priority
   - `existing_artifacts`: Paths to any existing research/plan files (parsed from previous comments)
   - `comments_summary`: Summary of relevant human comments (requirements, clarifications)

### Agent 2: Worker

**Purpose**: Execute development work based on Agent 1's output

**Model**: `claude-opus` (heavy lifting, complex reasoning)

**Tools**: Full Claude Code toolset EXCEPT Linear MCP

**Variants**: 5 worker prompts based on stage

**Input Validation (Guardrails)**:

Agent 2 MUST validate its input before doing any work:

```markdown
## Input Validation

Before starting work, verify you have received valid input:

1. Check for DISPATCH_RESULT block in your prompt
2. Verify required fields are present and non-empty:
   - issue_id
   - issue_identifier
   - issue_title
   - stage

If ANY of these are missing or the input is unclear:

1. Output immediately:
   ```
   WORK_RESULT:
     success: false
     error: |
       Invalid input from Agent 1. Missing required field: {field_name}
       Cannot proceed without complete issue context.
   ```

2. Do NOT attempt any work
3. Do NOT make assumptions about what the issue might be
4. Do NOT read files or make changes

This guardrail prevents wasted work and potential damage from unclear instructions.
```

**Stage-Specific Behaviors**:

#### Research Worker (`prompts/agent2-worker-research.md`)

1. Read existing codebase to understand current state
2. Identify patterns, constraints, and integration points
3. Document findings in `thoughts/research/YYYY-MM-DD-{identifier}-{slug}.md`
4. Git commit and push
5. Output artifact path and summary

#### Plan Worker (`prompts/agent2-worker-plan.md`)

1. Read research document (path from `existing_artifacts`)
2. Create detailed implementation plan
3. Write to `thoughts/plans/YYYY-MM-DD-{identifier}-{slug}.md`
4. Git commit and push
5. Output artifact path and summary

#### Implement Worker (`prompts/agent2-worker-implement.md`)

1. Read plan document (path from `existing_artifacts`)
2. Implement changes phase by phase
3. Run tests, typecheck, lint after each phase
4. Update plan document with progress notes
5. Git commit and push
6. Output commit hash and summary

#### Validate Worker (`prompts/agent2-worker-validate.md`)

1. Read plan document for success criteria
2. Run all automated verification commands
3. Document results in `thoughts/validation/YYYY-MM-DD-{identifier}-{slug}.md`
4. Git commit and push
5. Output validation results

#### Oneshot Worker (`prompts/agent2-worker-oneshot.md`)

1. Understand the issue
2. Quick research if needed
3. Implement the fix/feature
4. Run tests, typecheck, lint
5. Document in `thoughts/oneshot/YYYY-MM-DD-{identifier}-{slug}.md`
6. Git commit and push
7. Output complete summary

**Output Format**:

```
WORK_RESULT:
  success: true|false
  stage_completed: research|plan|implement|validate|oneshot
  artifact_path: thoughts/{stage}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: a1b2c3d
  next_status: "Needs Plan"|"Needs Implement"|"Needs Validate"|"Done"
  summary: |
    <Detailed description of what was accomplished>
  error: |
    <If failed, what went wrong and what was attempted>
```

### Agent 3: Linear Writer

**Purpose**: Update Linear with work results

**Model**: `claude-haiku` (simple task, fast execution)

**Tools**: Linear MCP only

**Input Validation (Guardrails)**:

```markdown
## Input Validation

Before updating Linear, verify you have valid inputs:

1. From Agent 1 output:
   - issue_id (required - need this to update the right issue)
   - issue_identifier (required - for comment formatting)
   - claim_timestamp (required - for duration calculation)

2. From Agent 2 output:
   - success (required - determines comment format)
   - If success=true: next_status, summary, artifact_path
   - If success=false: error

If issue_id is missing:
```
LINEAR_UPDATE:
  comment_posted: false
  status_updated: false
  error: Cannot update Linear - missing issue_id from Agent 1
```

If Agent 2 output is malformed:
- Post an error comment noting the issue
- Do NOT change status
- Output with status_updated: false
```

**Actions**:

1. Calculate duration from `claim_timestamp` to now
2. Format appropriate comment (success or failure)
3. Post comment to issue
4. If successful, update status to `next_status`
5. Output confirmation

---

## Node.js Implementation

### Project Structure

```
ralph/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Entry point, main loop
│   ├── config.ts                   # Environment config (hardcoded for v1)
│   ├── lib/
│   │   ├── claude.ts               # Claude CLI spawning
│   │   ├── git.ts                  # Git operations
│   │   ├── parsers.ts              # Parse agent outputs
│   │   └── rate-limit.ts           # Rate limit handling
│   └── types.ts                    # TypeScript types
├── prompts/
│   ├── agent1-linear-reader.md
│   ├── agent2-worker-research.md
│   ├── agent2-worker-plan.md
│   ├── agent2-worker-implement.md
│   ├── agent2-worker-validate.md
│   ├── agent2-worker-oneshot.md
│   └── agent3-linear-writer.md
├── thoughts/                       # Created at runtime
│   ├── research/
│   ├── plans/
│   ├── validation/
│   └── oneshot/
└── .mcp.json                       # Linear MCP config
```

### Main Loop (`src/index.ts`)

```typescript
import { spawnClaude } from './lib/claude';
import { parseDispatchResult, parseWorkResult, parseLinearUpdate } from './lib/parsers';
import { gitSafetyNetPush } from './lib/git';
import { sleep, handleRateLimit } from './lib/rate-limit';
import { loadPrompt, buildWorkerPrompt, buildWriterPrompt } from './lib/prompts';
import { DispatchResult, WorkResult } from './types';

async function runLoop(iteration: number): Promise<void> {
  console.log(`\n${'='.repeat(24)} LOOP ${iteration} ${'='.repeat(24)}\n`);
  const loopStart = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 1: Linear Reader
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔍 Agent 1: Linear Reader starting...');

  const agent1Result = await spawnClaude({
    prompt: await loadPrompt('agent1-linear-reader'),
    model: 'sonnet',
  });

  if (agent1Result.rateLimited) {
    await handleRateLimit(agent1Result.retryAfterMs);
    return; // Retry loop
  }

  const dispatch = parseDispatchResult(agent1Result.output);

  if (!dispatch || dispatch.noWork) {
    console.log(`No work available: ${dispatch?.reason || 'unknown'}`);
    console.log('Sleeping 5 minutes...');
    await sleep(5 * 60 * 1000);
    return;
  }

  console.log(`📋 Selected: ${dispatch.issueIdentifier} - ${dispatch.issueTitle}`);
  console.log(`   Stage: ${dispatch.stage}`);
  console.log(`   Priority: ${dispatch.priority}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Worker
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n🔨 Agent 2: ${dispatch.stage} Worker starting...`);

  const workerPrompt = await buildWorkerPrompt(dispatch);

  const agent2Result = await spawnClaude({
    prompt: workerPrompt,
    model: 'opus',
  });

  // Even if rate limited, we continue to Agent 3 to log the issue
  const workResult = parseWorkResult(agent2Result.output);

  if (workResult) {
    console.log(`   Success: ${workResult.success}`);
    console.log(`   Artifact: ${workResult.artifactPath || 'none'}`);
    if (workResult.commitHash) {
      console.log(`   Commit: ${workResult.commitHash}`);
    }
  } else {
    console.log('   ⚠️  Could not parse work result');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Linear Writer
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📝 Agent 3: Linear Writer starting...');

  const writerPrompt = await buildWriterPrompt(dispatch, workResult, agent2Result);

  const agent3Result = await spawnClaude({
    prompt: writerPrompt,
    model: 'haiku',
  });

  const linearUpdate = parseLinearUpdate(agent3Result.output);

  if (linearUpdate) {
    console.log(`   Comment posted: ${linearUpdate.commentPosted}`);
    console.log(`   Status updated: ${linearUpdate.statusUpdated}`);
    if (linearUpdate.newStatus) {
      console.log(`   New status: ${linearUpdate.newStatus}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE.JS: Safety Net
  // ═══════════════════════════════════════════════════════════════════════════
  const safetyNetResult = await gitSafetyNetPush(iteration);

  if (safetyNetResult.pushed) {
    console.log(`\n⚠️  SAFETY NET: Pushed uncommitted changes`);
    console.log(`   Commit: ${safetyNetResult.commitHash}`);
    console.log(`   This should be rare - investigate if it happens frequently`);
  }

  // Loop stats
  const duration = Math.round((Date.now() - loopStart) / 1000);
  console.log(`\n✅ Loop ${iteration} complete in ${duration}s`);
}

async function main(): Promise<void> {
  console.log('🚀 Ralph v2 starting...');
  console.log(`   Working directory: ${process.cwd()}`);

  let iteration = 0;

  while (true) {
    try {
      await runLoop(iteration);
      iteration++;
    } catch (error) {
      console.error(`\n❌ Loop ${iteration} error:`, error);
      console.log('Sleeping 1 minute before retry...');
      await sleep(60 * 1000);
    }
  }
}

main().catch(console.error);
```

### Claude Spawning (`src/lib/claude.ts`)

```typescript
import { spawn } from 'child_process';
import { ClaudeResult, ClaudeOptions } from '../types';

export async function spawnClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--dangerously-skip-permissions',
      '--output-format=stream-json',
      '--model', options.model,
      '--verbose',
    ];

    console.log(`   Spawning: claude ${args.join(' ')}`);

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    proc.stdin.write(options.prompt);
    proc.stdin.end();

    let output = '';
    let rateLimited = false;
    let retryAfterMs: number | undefined;
    let cost = 0;
    let duration = 0;

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;

      // Stream to console for visibility
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);

          // Check for rate limits
          if (json.error === 'rate_limit' ||
              (json.type === 'result' && json.is_error &&
               String(json.result).includes('hit your limit'))) {
            rateLimited = true;
            retryAfterMs = parseRateLimitReset(json);
          }

          // Capture final stats
          if (json.type === 'result') {
            cost = json.total_cost_usd || 0;
            duration = json.duration_ms || 0;
          }

          // Log assistant messages
          if (json.type === 'assistant' && !json.parent_tool_use_id) {
            const content = json.message?.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'text') {
                  console.log(`   💬 ${item.text.substring(0, 100)}...`);
                }
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      console.error(`   stderr: ${chunk.toString()}`);
    });

    proc.on('close', (code) => {
      console.log(`   Session complete: $${cost.toFixed(2)}, ${Math.round(duration/1000)}s`);

      resolve({
        output,
        rateLimited,
        retryAfterMs,
        cost,
        duration,
        exitCode: code || 0,
      });
    });

    proc.on('error', reject);
  });
}

function parseRateLimitReset(json: any): number {
  // Extract reset time from rate limit message
  // Similar to current ralph.sh logic
  const text = json.result || json.message?.content?.[0]?.text || '';
  const match = text.match(/resets?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

  if (match) {
    // Parse time and calculate ms until reset
    // For now, default to 5 minutes
    return 5 * 60 * 1000;
  }

  return 5 * 60 * 1000; // Default 5 minutes
}
```

### Git Safety Net (`src/lib/git.ts`)

```typescript
import { execSync } from 'child_process';

interface SafetyNetResult {
  pushed: boolean;
  commitHash?: string;
  filesCommitted?: string[];
}

export async function gitSafetyNetPush(iteration: number): Promise<SafetyNetResult> {
  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

    if (!status) {
      return { pushed: false };
    }

    console.log(`   Safety net: Found uncommitted changes`);

    // Get list of changed files
    const filesCommitted = status.split('\n').map(line => line.substring(3));

    // Stage all changes
    execSync('git add -A');

    // Commit with safety net message
    const message = `[SAFETY-NET] Uncommitted changes from loop iteration ${iteration}

This commit was created by the Node.js safety net, not by Agent 2.
This indicates Agent 2 may have crashed or failed to commit its work.
Investigate if this happens frequently.

Files:
${filesCommitted.map(f => `- ${f}`).join('\n')}`;

    execSync(`git commit -m ${JSON.stringify(message)}`);

    // Get commit hash
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

    // Push
    execSync('git push origin main');

    return {
      pushed: true,
      commitHash,
      filesCommitted,
    };
  } catch (error) {
    console.error('Safety net git error:', error);
    return { pushed: false };
  }
}
```

---

## Thoughts Folder Structure

All implementation artifacts live in the repo, not in Linear:

```
thoughts/
├── research/
│   └── YYYY-MM-DD-{identifier}-{slug}.md
├── plans/
│   └── YYYY-MM-DD-{identifier}-{slug}.md
├── validation/
│   └── YYYY-MM-DD-{identifier}-{slug}.md
└── oneshot/
    └── YYYY-MM-DD-{identifier}-{slug}.md
```

**Naming Convention**: `YYYY-MM-DD-ENG-123-dark-mode-toggle.md`

- Date: When the artifact was created
- Identifier: Linear issue ID (e.g., ENG-123)
- Slug: Kebab-case description from issue title

**Linear stores**:
- PRD-level descriptions (what needs to be done)
- Human comments (requirements, clarifications)
- Agent comments (what was attempted, results)
- Status (current stage)
- Links to artifact files in repo

**Repo stores**:
- Research findings
- Implementation plans
- Validation reports
- All code changes

---

## Implementation Phases

### Phase 1: Project Setup

**Files to create:**
- `package.json` - Node.js project with TypeScript
- `tsconfig.json` - TypeScript configuration
- `src/index.ts` - Main loop (skeleton)
- `src/types.ts` - TypeScript types
- `src/config.ts` - Hardcoded configuration

**Success Criteria:**
- [x] `npm install` works
- [x] `npm run build` compiles TypeScript
- [x] `npm start` runs and logs "Ralph v2 starting..."

### Phase 2: Claude Spawning

**Files to create/modify:**
- `src/lib/claude.ts` - Spawn Claude CLI, stream output, parse results
- `src/lib/rate-limit.ts` - Rate limit detection and handling

**Success Criteria:**
- [x] Can spawn a simple Claude session
- [x] Output is captured and logged
- [x] Rate limits are detected

### Phase 3: Agent 1 - Linear Reader

**Files to create:**
- `prompts/agent1-linear-reader.md` - Complete prompt
- `src/lib/parsers.ts` - Parse DISPATCH_RESULT output

**Success Criteria:**
- [x] Agent 1 queries Linear successfully
- [x] Selects an issue and claims it
- [x] Outputs parseable DISPATCH_RESULT
- [x] Node.js can parse the output

### Phase 4: Agent 2 - Workers

**Files to create:**
- `prompts/agent2-worker-research.md`
- `prompts/agent2-worker-plan.md`
- `prompts/agent2-worker-implement.md`
- `prompts/agent2-worker-validate.md`
- `prompts/agent2-worker-oneshot.md`

**Success Criteria:**
- [x] Worker receives input from Agent 1 output
- [x] Validates input, refuses to work if invalid
- [x] Executes appropriate work for stage
- [x] Commits and pushes changes
- [x] Outputs parseable WORK_RESULT

### Phase 5: Agent 3 - Linear Writer

**Files to create:**
- `prompts/agent3-linear-writer.md`

**Success Criteria:**
- [x] Receives both Agent 1 and Agent 2 outputs
- [x] Posts appropriate comment to Linear
- [x] Updates status correctly
- [x] Handles errors gracefully

### Phase 6: Safety Net and Integration

**Files to modify:**
- `src/lib/git.ts` - Add safety net push
- `src/index.ts` - Complete main loop

**Success Criteria:**
- [x] Full loop executes end-to-end
- [x] Safety net catches uncommitted changes
- [x] Rate limits are handled across all agents
- [x] Loop continues indefinitely

---

## Future Enhancements (Not in v1)

### Interactive Setup Script

For deployment on ephemeral VMs:

```
$ ralph setup

Ralph v2 Setup
==============

1. Linear API Key: lin_api_xxxx
2. Linear Workspace: my-workspace
3. GitHub Remote: git@github.com:user/repo.git
4. GitHub Branch: main

Testing Linear connection... ✓
Testing GitHub connection... ✓

Configuration saved to .ralph.config.json
Ready to run: ralph start
```

### Agent-Created Tickets

A separate agent that:
- Analyzes codebase for improvements
- Creates Linear tickets for tech debt, bugs, enhancements
- Follows a specific template
- Tags appropriately

### PR Workflow

Instead of pushing to main:
- Create feature branch per issue
- Create PR when implementation complete
- Agent 3 updates Linear with PR link
- Human merges PR
- Separate agent detects merge and moves to Validate

### Multi-Repo Support

- Configuration specifies multiple repos
- Dispatcher balances work across repos
- Each repo has its own thoughts/ folder

### Metrics Dashboard

- Track tokens used per loop
- Track cost per issue
- Track success/failure rates
- Track time per stage
- Web UI for monitoring

---

## Testing Strategy

### Unit Tests

- Parser tests (DISPATCH_RESULT, WORK_RESULT, LINEAR_UPDATE)
- Rate limit detection
- Git safety net logic

### Integration Tests

- Mock Claude CLI responses
- Verify full loop execution
- Verify Linear updates (mock MCP)

### Manual Testing

1. Create a test Linear project with "ralph *" statuses
2. Create a simple test issue
3. Run ralph and observe:
   - Issue claimed correctly
   - Artifacts created in thoughts/
   - Linear comments posted
   - Status transitions work
4. Test stale issue detection by manually setting "In Progress" status
5. Test crash recovery by killing agent mid-execution

---

## References

- Current implementation: `ralph.sh`
- Claude CLI documentation: https://docs.anthropic.com/claude-code
- Linear MCP: Already configured in `.mcp.json`
- Linear API: https://developers.linear.app/
