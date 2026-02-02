---
date: 2026-02-02T04:24:19Z
researcher: Claude
git_commit: 09917912b9311038ea416bede5a82e78f51d0564
branch: foundry/F-67
repository: leixusam/foundry
topic: "Foundry Implementation Overview"
tags: [research, codebase, architecture, overview]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Foundry Implementation Overview

**Date**: 2026-02-02T04:24:19Z
**Researcher**: Claude
**Git Commit**: 09917912b9311038ea416bede5a82e78f51d0564
**Branch**: foundry/F-67
**Repository**: leixusam/foundry

## Research Question

Document how the Foundry implementation works and identify the key parts of the implementation.

## Summary

Foundry is a Linear-orchestrated autonomous development system that uses a three-agent pipeline to process tickets. Agent 1 (Linear Reader) selects work from Linear, Agent 2 (Worker) executes the development work, and Agent 3 (Linear Writer) updates Linear with results. The system supports both Claude Code and Codex CLI as LLM providers, uses a custom workflow with `∞` prefixed statuses in Linear, and implements rate limiting, statistics tracking, and output logging infrastructure.

## Detailed Findings

### 1. Main Entry Point and Loop

The main entry point is `src/index.ts:597` (`main()` function).

**Startup Sequence:**
1. Displays banner and safety warning (`src/index.ts:598-599`)
2. Checks for updates (`src/index.ts:602-603`)
3. Validates git repository exists (`src/index.ts:606-618`)
4. Creates directories: `.foundry/`, `foundry-docs/` (`src/index.ts:621-623`)
5. Checks CLI availability (Claude Code or Codex) (`src/index.ts:626-630`)
6. Syncs prompts from package to project (`src/index.ts:633`)
7. Runs minimal setup if credentials missing (`src/index.ts:644-654`)
8. Creates Linear `∞` workflow statuses if needed (`src/index.ts:675-698`)
9. Generates pod name for session (`src/index.ts:712`)
10. Enters main loop (`src/index.ts:717-726`)

**Main Loop (`src/index.ts:68-448`):**
- Runs indefinitely or until `maxIterations` reached
- Each iteration:
  1. Spawns Agent 1 to select work from Linear
  2. Downloads any attachments from the Linear issue
  3. Spawns Agent 2 to execute the work
  4. Spawns Agent 3 to update Linear with results
  5. Logs statistics and output

**No Work Polling (`src/index.ts:155-218`):**
When Agent 1 reports no work:
- Two-tier polling system: quick API checks every 5 minutes, full Agent 1 check every 2 hours
- Quick check uses direct Linear API (`src/lib/linear-quick-check.ts`)
- GCP auto-stop option for VM instances

### 2. Provider System

Located in `src/lib/provider.ts`, `src/lib/claude.ts`, `src/lib/codex.ts`.

**Architecture:**
- Factory pattern with manual provider registration
- Providers self-register at module load time
- Common interface `LLMProvider` with `spawn()` method

**Provider Interface (`src/lib/provider.ts:32-35`):**
```typescript
interface LLMProvider {
  readonly name: ProviderName;
  spawn(options: ProviderOptions, agentNumber?: number): Promise<ProviderResult>;
}
```

**Result Contract (`src/lib/provider.ts:16-30`):**
- `output`: Raw streaming output (newline-delimited JSON)
- `finalOutput`: Extracted final text message
- `rateLimited`: Boolean flag for rate limiting
- `cost`: Dollar amount (estimated for Codex)
- `tokenUsage`: Input, output, and cached token counts
- `duration`: Execution time in milliseconds

**Claude Provider (`src/lib/claude.ts:356-403`):**
- Spawns `claude` CLI with `--dangerously-skip-permissions`, `--output-format=stream-json`
- Supports `--allowedTools` for per-session tool restriction
- Extracts exact cost from API response

**Codex Provider (`src/lib/codex.ts:169-321`):**
- Spawns `codex exec` with `--dangerously-bypass-approvals-and-sandbox`, `--json`
- Does not support per-session tool restriction (uses global MCP config)
- Estimates cost using hardcoded pricing table

### 3. Agent Pipeline

**Agent 1: Linear Reader (`prompts/agent1-linear-reader.md`):**
- Queries Linear using MCP tools (`mcp__linear__*`)
- Selects best available issue based on priorities and filters
- Claims issue by updating status to `∞ ... In Progress`
- Outputs issue context for Agent 2

**Agent 2: Worker (`prompts/agent2-worker.md`):**
- Dispatcher that loads stage-specific instruction files
- Stages: `oneshot`, `research`, `specification`, `plan`, `implement`, `validate`
- Does NOT have access to Linear (relies on Agent 1's context)
- Outputs structured `WORK_RESULT` block

**Agent 3: Linear Writer (`prompts/agent3-linear-writer.md`):**
- Receives context from both Agent 1 and Agent 2
- Attaches branch links to Linear issues
- Posts comments summarizing work performed
- Updates issue status based on stage outcome

**Agent Communication:**
- Unidirectional flow: Agent 1 → Agent 2 → Agent 3
- Context accumulation: each agent's output appended to next agent's prompt
- Agent 2's `WORK_RESULT` contains: `commit_hash`, `branch_name`, `merge_status`, `next_status`, `sub_issues`

### 4. Prompt Loading System

Located in `src/lib/prompts.ts`.

**Two-Tier Fallback:**
1. Project-local: `.foundry/prompts/{name}.md`
2. Package default: `prompts/{name}.md`

**Template Variable Substitution:**
- Pattern: `{{VARIABLE_NAME}}`
- Variables substituted at load time via `loadPrompt(name, variables)`

**Fragment System:**
- Reusable sections in `prompts/fragments/`
- `merge-direct.md` and `merge-pr.md` for different merge modes
- Embedded during setup via `copyPromptsToProject()` (`src/lib/setup.ts:409-431`)

### 5. Configuration Management

Located in `src/config.ts` and `src/lib/setup.ts`.

**Configuration Sources (precedence order):**
1. CLI arguments (`--provider`, `--gcp-auto-stop`)
2. Environment variables (`FOUNDRY_*`, `CODEX_*`, `LINEAR_*`)
3. `.foundry/env` file
4. Hardcoded defaults

**Key Configuration (`src/types.ts:80-109`):**
```typescript
interface FoundryConfig {
  workingDirectory: string;
  linearApiKey?: string;
  linearTeamId?: string;
  provider: 'claude' | 'codex';
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  codexModel: string;
  mergeMode: 'merge' | 'pr';
  maxIterations: number;
  // ... and more
}
```

**Files Created During Setup:**
- `.foundry/env` - Configuration file
- `.foundry/mcp.json` - MCP server configuration
- `.foundry/prompts/*.md` - Synced prompt files
- `.claude/commands/*.md` - Claude Code commands
- `foundry-docs/README.md` - Documentation structure

### 6. Linear Integration

Located in `src/lib/linear-api.ts` and `src/lib/linear-quick-check.ts`.

**Direct API (via @linear/sdk):**
- Workflow state management: create, list, check, delete
- Team lookup and API key validation
- Used during setup and quick checks

**MCP Integration (via agents):**
- Agents use `mcp__linear__*` tools for issue operations
- MCP config stored in `.foundry/mcp.json`
- Connects to `https://mcp.linear.app/mcp`

**Custom Workflow Statuses (`src/lib/linear-api.ts:22-39`):**
All prefixed with `∞` to avoid conflicts:
- Backlog: `∞ Backlog`
- Ready: `∞ Needs Research/Specification/Plan/Implement/Validate`
- In Progress: `∞ Research/Specification/Plan/Implement/Validate/Oneshot In Progress`, `∞ Blocked`
- Complete: `∞ Awaiting Merge`, `∞ Done`
- Canceled: `∞ Canceled`

**Quick Check System (`src/lib/linear-quick-check.ts:14-55`):**
- Lightweight polling without spawning agents
- Queries Linear API directly for uncompleted tickets
- Two-stage query: first checks if ANY work exists (1 item), then gets count

### 7. Rate Limiting and Retries

Located in `src/lib/rate-limit.ts`.

**Rate Limit Detection (`src/lib/rate-limit.ts:127-145`):**
- 9 regex patterns for detecting rate limit errors
- Covers Claude, Codex, and generic patterns

**Reset Time Parser (`src/lib/rate-limit.ts:48-125`):**
- Parses "resets at 10:30 am (PST)" format
- Handles both abbreviations (PST, EST) and IANA names (America/Los_Angeles)
- Adds 1-minute buffer to calculated wait time

**Retry Executor (`src/lib/rate-limit.ts:163-188`):**
- `executeWithRateLimitRetry()` wraps operations
- Configurable max retries (default: 3)
- Sleeps for reset time before retry

### 8. Statistics Tracking

Located in `src/lib/stats-logger.ts`.

**Data Structure:**
- `PodStats`: Aggregates across entire session
- `LoopStats`: Per-iteration statistics
- `AgentStats`: Per-agent metrics (tokens, cost, duration)

**Output File:**
`.foundry/output/{pod-name}/stats.json`

**Metrics Tracked:**
- Token usage: input, output, cached
- Cost (exact for Claude, estimated for Codex)
- Duration in seconds
- Context window usage percentage
- Compaction events (context truncation)
- Exit codes and rate limiting

### 9. Output Logging

Located in `src/lib/output-logger.ts`.

**Directory Structure:**
```
.foundry/output/
└── {pod-name}/
    ├── stats.json
    └── loop-{n}/
        ├── agent-1.log          (raw JSON)
        ├── agent-1-terminal.log (formatted)
        ├── agent-2.log
        ├── agent-2-terminal.log
        ├── agent-3.log
        └── agent-3-terminal.log
```

**Pod Name Generation (`src/lib/loop-instance-name.ts:60-73`):**
- Format: `adjective-animal` (e.g., "calm-pegasus")
- 64 adjectives × 64 animals = 4,096 combinations
- Deterministic based on timestamp

### 10. Attachment Downloading

Located in `src/lib/attachment-downloader.ts`.

**Process:**
1. Extracts issue identifier from Agent 1's output
2. Queries Linear API for issue attachments
3. Downloads to `.foundry/attachments/{identifier}/`
4. Provides paths to Agent 2 for image analysis

## Architecture Documentation

### Directory Structure

```
src/
├── index.ts              # Main loop entry point
├── cli.ts                # CLI command router
├── config.ts             # Configuration management
├── types.ts              # TypeScript type definitions
└── lib/
    ├── provider.ts           # Provider abstraction
    ├── claude.ts             # Claude Code provider
    ├── codex.ts              # Codex CLI provider
    ├── prompts.ts            # Prompt loading
    ├── setup.ts              # Setup utilities
    ├── init-project.ts       # Config wizard
    ├── linear-api.ts         # Linear SDK wrapper
    ├── linear-quick-check.ts # Lightweight polling
    ├── rate-limit.ts         # Rate limit handling
    ├── stats-logger.ts       # Statistics tracking
    ├── output-logger.ts      # Output file management
    ├── loop-instance-name.ts # Pod name generation
    ├── attachment-downloader.ts # Linear attachments
    ├── git.ts                # Git utilities
    ├── gcp.ts                # GCP VM management
    ├── version.ts            # Version info
    └── update-checker.ts     # npm update checks

prompts/
├── agent1-linear-reader.md
├── agent2-worker.md
├── agent2-worker-*.md        # Stage-specific worker prompts
├── agent3-linear-writer.md
└── fragments/
    ├── merge-direct.md
    └── merge-pr.md
```

### Key Design Patterns

1. **Provider Factory**: Pluggable LLM providers with self-registration
2. **Agent Pipeline**: Sequential agents with output passing for coordination
3. **Two-Tier Polling**: Lightweight API checks with periodic full agent runs
4. **Prompt Fragment System**: Reusable sections with variable substitution
5. **Custom Linear Workflow**: `∞` prefix namespace for Foundry-managed statuses
6. **Configuration Cascade**: CLI args → env vars → file → defaults

## Code References

- Entry point: `src/index.ts:597`
- Main loop: `src/index.ts:68-448`
- Provider interface: `src/lib/provider.ts:32-35`
- Claude spawn: `src/lib/claude.ts:187-318`
- Codex spawn: `src/lib/codex.ts:173-320`
- Prompt loading: `src/lib/prompts.ts:19-46`
- Setup flow: `src/lib/setup.ts:299-400`
- Linear statuses: `src/lib/linear-api.ts:22-39`
- Quick check: `src/lib/linear-quick-check.ts:14-55`
- Rate limiting: `src/lib/rate-limit.ts:163-188`
- Stats tracking: `src/lib/stats-logger.ts:255-311`
- Config build: `src/config.ts:260-291`

## Related Research

- [2026-02-01-F-66-linear-api-quick-check.md](/Users/lei/repos/foundry/foundry-docs/research/2026-02-01-F-66-linear-api-quick-check.md)
- [2026-02-01-F-67-add-pr-functionality.md](/Users/lei/repos/foundry/foundry-docs/research/2026-02-01-F-67-add-pr-functionality.md)
- [2025-01-25-RSK-16-codex-cli-support.md](/Users/lei/repos/foundry/foundry-docs/research/2025-01-25-RSK-16-codex-cli-support.md)
- [2026-01-25-RSK-43-claude-rate-limit-waiting.md](/Users/lei/repos/foundry/foundry-docs/research/2026-01-25-RSK-43-claude-rate-limit-waiting.md)

## Open Questions

None - this is a documentation of the current implementation state.
