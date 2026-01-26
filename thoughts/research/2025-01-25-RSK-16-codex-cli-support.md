# RSK-16: Support ChatGPT Codex CLI

**Issue**: [RSK-16](https://linear.app/robin-sidekick/issue/RSK-16/support-chatgpt-codex-cli)
**Date**: 2025-01-25
**Agent**: quick-phoenix-1769392910
**Stage**: Research

## Summary

This document analyzes the existing `ralph.sh` shell script to understand how it supports both Claude Code and ChatGPT Codex, and identifies what needs to be added to the Node.js implementation to achieve feature parity.

## Current State

### ralph.sh (Shell Script) - Full Feature Parity

The shell script already supports both providers with these key features:

#### 1. Provider Selection
```bash
# Supported via --provider flag
./ralph.sh --provider claude   # Default
./ralph.sh --provider codex
```

#### 2. Model Selection
```bash
# Claude models via --model flag
./ralph.sh --model opus|sonnet|haiku

# Codex models via environment variables
CODEX_MODEL=gpt-5.2-codex  # Default model
CODEX_REASONING_EFFORT=high|medium|extra_high  # Default: high
```

#### 3. Mode Selection
```bash
./ralph.sh plan     # Plan mode (uses PROMPT_plan.md)
./ralph.sh          # Build mode (uses PROMPT_build.md)
```

#### 4. Iteration Control
```bash
./ralph.sh 20       # Max 20 iterations
./ralph.sh plan 5   # Plan mode, max 5 iterations
```

### Node.js Implementation - Claude Only

The current Node.js implementation (`ralph/src/`) only supports Claude Code:

| Feature | Shell Script | Node.js |
|---------|-------------|---------|
| Claude provider | ✅ | ✅ |
| Codex provider | ✅ | ❌ |
| Model selection | ✅ | Hardcoded opus |
| Reasoning effort | ✅ | ❌ |
| Raw JSON logging | ✅ | ✅ (RSK-14) |
| Terminal logging | ✅ | ✅ (RSK-17) |
| Rate limit handling | ✅ | ✅ (Claude only) |
| Max iterations | ✅ | ❌ |
| Mode selection | ✅ | ❌ |

## Output Format Differences

### Claude Code JSON Streaming

**Event Types:**
- `system` with `subtype`: init, status, compact_boundary, task_notification
- `assistant` with nested `message.content[]` containing tool_use and text items
- `result` with `modelUsage` breakdown by model

**Structure:**
```json
{"type": "system", "subtype": "init", "model": "...", "tools": [...]}
{"type": "assistant", "message": {"model": "...", "usage": {...}, "content": [...]}}
{"type": "result", "total_cost_usd": 0.5, "duration_ms": 1000, "modelUsage": {...}}
```

**Key Fields:**
- `parent_tool_use_id`: Identifies subagent context (null for main agent)
- `message.usage.cache_creation_input_tokens` / `cache_read_input_tokens`: For context % tracking
- `message.content[].type`: "tool_use" or "text"
- `message.content[].name`: Tool name (e.g., "Task", "Read", "Bash")

### ChatGPT Codex JSON Streaming

**Event Types:**
- `thread.started` / `thread.completed`
- `turn.started` / `turn.completed` / `turn.failed`
- `item.started` / `item.completed`
- `error`

**Item Types (within item.completed):**
- `command_execution`: Shell commands run by Codex
- `file_change`: File modifications
- `reasoning`: Internal reasoning (thinking)
- `agent_message`: Messages to user
- `mcp_tool_call`: MCP tool invocations
- `web_search`: Web search operations
- `plan_update`: Plan modifications

**Structure:**
```json
{"type": "thread.started", "thread_id": "..."}
{"type": "item.completed", "item": {"id": "...", "type": "agent_message", "text": "..."}}
{"type": "item.completed", "item": {"type": "command_execution", "command": "...", "exit_code": 0}}
{"type": "item.completed", "item": {"type": "file_change", "changes": [{"kind": "update", "path": "..."}]}}
{"type": "item.completed", "item": {"type": "reasoning", "text": "..."}}
{"type": "turn.completed", "usage": {"input_tokens": 1000, "cached_input_tokens": 500, "output_tokens": 100}}
```

**Key Differences:**
- Token usage in `turn.completed`, not per-message
- No subagent concept (flat structure)
- Explicit exit codes for commands
- File changes have structured `changes[]` array with `kind` and `path`
- No cost tracking in the output (unlike Claude)

## CLI Invocation Differences

### Claude Code CLI
```bash
cat prompt.md | claude -p \
    --dangerously-skip-permissions \
    --output-format=stream-json \
    --model opus \
    --verbose
```

### Codex CLI
```bash
cat prompt.md | codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    --json \
    --model gpt-5.2-codex \
    --output-last-message /tmp/last-message.txt \
    -c "model_reasoning_effort=\"high\""
```

**Key Differences:**
| Aspect | Claude | Codex |
|--------|--------|-------|
| Permission flag | `--dangerously-skip-permissions` | `--dangerously-bypass-approvals-and-sandbox` |
| JSON output flag | `--output-format=stream-json` | `--json` |
| Model config | `--model opus` | `--model gpt-5.2-codex` |
| Additional options | `--verbose` | `--output-last-message <file>` |
| Reasoning config | N/A | `-c "model_reasoning_effort=..."` |

## Implementation Requirements

### 1. New Provider Abstraction

Create a provider interface that both Claude and Codex can implement:

```typescript
interface LLMProvider {
  name: 'claude' | 'codex';
  spawn(options: ProviderOptions, agentNumber?: number): Promise<ProviderResult>;
}

interface ProviderOptions {
  prompt: string;
  model: string;
  allowedTools?: string[];
  reasoningEffort?: 'low' | 'medium' | 'high' | 'extra_high';
}

interface ProviderResult {
  output: string;
  rateLimited: boolean;
  retryAfterMs?: number;
  cost: number;
  duration: number;
  exitCode: number;
}
```

### 2. Codex-Specific Module (`ralph/src/lib/codex.ts`)

Needs to:
- Spawn `codex exec` with correct flags
- Process Codex JSON stream (different event types than Claude)
- Track token usage from `turn.completed` events
- Handle rate limits (different patterns than Claude)
- Format output for terminal display

### 3. Configuration Updates

```typescript
interface RalphConfig {
  workingDirectory: string;
  linearTeamId?: string;
  gitBranch: string;
  staleTimeoutHours: number;
  noWorkSleepMinutes: number;
  errorSleepMinutes: number;

  // New fields
  provider: 'claude' | 'codex';
  model: string;  // 'opus' | 'sonnet' | 'haiku' | 'gpt-5.2-codex' | etc.
  reasoningEffort?: 'low' | 'medium' | 'high' | 'extra_high';  // Codex only
  maxIterations?: number;
  mode?: 'plan' | 'build';
}
```

### 4. Output Logger Compatibility

The existing output logger (RSK-14, RSK-17) should work for both providers:
- Raw JSON logging: Already provider-agnostic (logs any JSON line)
- Terminal logging: Needs Codex-specific formatting

### 5. Rate Limit Handling

Current patterns in `rate-limit.ts`:
```typescript
const rateLimitPatterns = [
  /rate.?limit/i,
  /hit your limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /usage.?limit/i,
];
```

May need to add Codex-specific patterns and parse different error formats.

## Files to Create/Modify

### New Files
1. `ralph/src/lib/codex.ts` - Codex CLI spawner with JSON stream processing
2. `ralph/src/lib/provider.ts` - Provider abstraction/factory

### Modified Files
1. `ralph/src/types.ts` - Add provider types, update ClaudeOptions to ProviderOptions
2. `ralph/src/config.ts` - Add provider, model, reasoningEffort, maxIterations
3. `ralph/src/index.ts` - Use provider abstraction instead of direct Claude calls
4. `ralph/src/lib/claude.ts` - Implement provider interface
5. `ralph/src/lib/rate-limit.ts` - Add Codex-specific rate limit patterns

## Complexity Assessment

**Not straightforward** - This is a significant feature addition:
1. New provider abstraction layer
2. Different JSON parsing logic for Codex
3. Configuration system expansion
4. Testing with both providers

## Next Status

**Needs Plan** - This task requires a detailed implementation plan before coding.

## Open Questions

1. Should we support environment variables for config (like shell script) or require config file?
2. Should Agent 1 and Agent 3 (Linear tools) also support Codex, or keep them Claude-only?
3. How should we handle the lack of cost tracking in Codex output?
4. Should we add CLI arguments to `npm start` for provider/model selection?

## References

- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [Codex Non-Interactive Mode](https://developers.openai.com/codex/noninteractive/)
- [Claude Code CLI Documentation](https://claude.ai/code)
