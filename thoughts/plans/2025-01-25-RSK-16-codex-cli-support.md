# RSK-16: Implementation Plan - Support ChatGPT Codex CLI

## Overview

This plan adds ChatGPT Codex CLI support to the Ralph Node.js implementation, achieving feature parity with the existing `ralph.sh` shell script. The implementation introduces a provider abstraction layer that allows switching between Claude Code and ChatGPT Codex providers.

## Goals

1. Support both Claude Code and ChatGPT Codex as LLM providers
2. Achieve feature parity with `ralph.sh` shell script capabilities
3. Handle the different JSON streaming output formats between providers
4. Maintain compatibility with existing output logging (RSK-14, RSK-17)
5. Add configuration options for provider selection and Codex-specific settings

## Design Decisions

### Decision 1: Provider Abstraction Layer

Create a unified provider interface that both Claude and Codex implement:

```typescript
interface LLMProvider {
  name: 'claude' | 'codex';
  spawn(options: ProviderOptions, agentNumber: number): Promise<ProviderResult>;
}
```

**Why**: Keeps the main orchestration loop (`index.ts`) provider-agnostic. Adding new providers in the future becomes straightforward.

### Decision 2: Configuration via Environment Variables + Config File

Support both environment variables (like shell script) and future config file:

| Setting | Env Variable | Config File | Default |
|---------|--------------|-------------|---------|
| Provider | `RALPH_PROVIDER` | `provider` | `claude` |
| Claude Model | `RALPH_CLAUDE_MODEL` | `claudeModel` | `opus` |
| Codex Model | `CODEX_MODEL` | `codexModel` | `gpt-5.2-codex` |
| Codex Reasoning Effort | `CODEX_REASONING_EFFORT` | `codexReasoningEffort` | `high` |
| Max Iterations | `RALPH_MAX_ITERATIONS` | `maxIterations` | `0` (unlimited) |

**Why**: Environment variables provide easy CLI overrides and backwards compatibility with `ralph.sh` patterns. Config file for persistent settings.

### Decision 3: Separate Provider Modules

Keep Claude and Codex logic in separate files:
- `ralph/src/lib/claude.ts` - Existing, refactored to implement provider interface
- `ralph/src/lib/codex.ts` - New file for Codex-specific logic
- `ralph/src/lib/provider.ts` - Factory and interface definitions

**Why**: Separation of concerns. Each provider has significantly different JSON parsing logic.

### Decision 4: Codex-Only for Agent 2 (Worker)

Initially limit Codex support to Agent 2:
- Agent 1 (Linear Reader): Always Claude (Haiku for cost efficiency)
- Agent 2 (Worker): Claude or Codex (configurable)
- Agent 3 (Linear Writer): Always Claude (Haiku for cost efficiency)

**Why**:
- Agent 1 and 3 only interact with Linear MCP tools - no benefit from Codex
- Agent 2 does the actual coding work where Codex may excel
- Reduces complexity of initial implementation
- Can be expanded later if needed

### Decision 5: Cost Tracking Approximation for Codex

Codex doesn't provide `total_cost_usd` in output. We'll:
1. Track token counts from `turn.completed` events
2. Apply approximate pricing based on model
3. Mark cost as "estimated" in session stats

**Why**: Maintains parity with Claude's cost reporting for comparison purposes.

## Output Format Comparison

### Claude Code JSON Events

| Event Type | Subtype | Description |
|------------|---------|-------------|
| `system` | `init` | Session start with model and tools |
| `system` | `status` | Status updates (e.g., "compacting") |
| `system` | `compact_boundary` | Context compaction notification |
| `system` | `task_notification` | Subagent completion |
| `assistant` | - | Messages with content array |
| `result` | - | Session end with stats |

Key fields:
- `parent_tool_use_id`: null for main agent, populated for subagent
- `message.usage.cache_creation_input_tokens`
- `message.content[].type`: "tool_use" or "text"

### ChatGPT Codex JSON Events

| Event Type | Description |
|------------|-------------|
| `thread.started` | Session start |
| `thread.completed` | Session end |
| `turn.started` | Turn begin |
| `turn.completed` | Turn end with usage stats |
| `item.started` | Item begin |
| `item.completed` | Item details |
| `error` | Error message |

Item types within `item.completed`:
- `command_execution`: Shell commands with exit code
- `file_change`: File modifications with `changes[]` array
- `reasoning`: Internal reasoning (thinking)
- `agent_message`: Messages to user
- `mcp_tool_call`: MCP tool invocations
- `web_search`: Web searches
- `plan_update`: Plan modifications

Key differences:
- Token usage in `turn.completed`, not per-message
- No subagent concept (flat structure)
- No cost tracking in output
- Explicit exit codes for commands

## Implementation Phases

### Phase 1: Type Definitions and Interfaces

**Goal**: Define the provider abstraction types and update existing types.

#### 1.1 Create `ralph/src/lib/provider.ts`

```typescript
// Provider abstraction types

export type ProviderName = 'claude' | 'codex';

export interface ProviderOptions {
  prompt: string;
  model?: string;
  allowedTools?: string[];
  // Codex-specific
  reasoningEffort?: 'low' | 'medium' | 'high' | 'extra_high';
}

export interface ProviderResult {
  output: string;           // Raw streaming output (newline-delimited JSON)
  finalOutput: string;      // Extracted final text message
  rateLimited: boolean;
  retryAfterMs?: number;
  cost: number;             // Total cost USD (estimated for Codex)
  costEstimated: boolean;   // true if cost is approximated
  duration: number;         // Duration in ms
  exitCode: number;
  tokenUsage: {
    input: number;
    output: number;
    cached: number;
  };
}

export interface LLMProvider {
  name: ProviderName;
  spawn(options: ProviderOptions, agentNumber: number): Promise<ProviderResult>;
}
```

#### 1.2 Update `ralph/src/types.ts`

Add new configuration types:

```typescript
export interface ProviderConfig {
  provider: 'claude' | 'codex';
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  codexModel: string;
  codexReasoningEffort: 'low' | 'medium' | 'high' | 'extra_high';
  maxIterations: number;
}
```

Update existing types to use provider-agnostic naming where needed.

### Phase 2: Configuration System Update

**Goal**: Add provider configuration to `config.ts`.

#### 2.1 Update `ralph/src/config.ts`

```typescript
export interface RalphConfig {
  workingDirectory: string;
  linearTeamId?: string;
  gitBranch: string;
  staleTimeoutHours: number;
  noWorkSleepMinutes: number;
  errorSleepMinutes: number;

  // Provider configuration
  provider: 'claude' | 'codex';
  claudeModel: 'opus' | 'sonnet' | 'haiku';
  codexModel: string;
  codexReasoningEffort: 'low' | 'medium' | 'high' | 'extra_high';
  maxIterations: number;
}

function loadConfig(): RalphConfig {
  return {
    workingDirectory: getRepoRoot(),
    gitBranch: 'main',
    staleTimeoutHours: 4,
    noWorkSleepMinutes: 15,
    errorSleepMinutes: 1,

    // Provider defaults (can be overridden by env vars)
    provider: (process.env.RALPH_PROVIDER as 'claude' | 'codex') || 'claude',
    claudeModel: (process.env.RALPH_CLAUDE_MODEL as 'opus' | 'sonnet' | 'haiku') || 'opus',
    codexModel: process.env.CODEX_MODEL || 'gpt-5.2-codex',
    codexReasoningEffort: (process.env.CODEX_REASONING_EFFORT as 'low' | 'medium' | 'high' | 'extra_high') || 'high',
    maxIterations: parseInt(process.env.RALPH_MAX_ITERATIONS || '0', 10),
  };
}
```

### Phase 3: Refactor Claude Module

**Goal**: Refactor `claude.ts` to implement the provider interface.

#### 3.1 Update `ralph/src/lib/claude.ts`

- Implement `LLMProvider` interface
- Export `ClaudeProvider` class or factory function
- Keep backward compatibility with existing function signatures
- Move `extractFinalOutput` to a shared utility (used by both providers)

```typescript
import { LLMProvider, ProviderOptions, ProviderResult } from './provider.js';

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude' as const;

  async spawn(options: ProviderOptions, agentNumber: number): Promise<ProviderResult> {
    // Existing spawnClaude logic, adapted to return ProviderResult
  }
}

// Factory function for easy instantiation
export function createClaudeProvider(): LLMProvider {
  return new ClaudeProvider();
}
```

### Phase 4: Create Codex Module

**Goal**: Implement the Codex provider.

#### 4.1 Create `ralph/src/lib/codex.ts`

```typescript
import { spawn } from 'node:child_process';
import { LLMProvider, ProviderOptions, ProviderResult } from './provider.js';
import { logAgentOutput, logTerminalOutput } from './output-logger.js';

export class CodexProvider implements LLMProvider {
  readonly name = 'codex' as const;

  async spawn(options: ProviderOptions, agentNumber: number): Promise<ProviderResult> {
    // 1. Build codex exec command arguments
    const args = [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--json',
      '--model', options.model || 'gpt-5.2-codex',
    ];

    if (options.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${options.reasoningEffort}"`);
    }

    // 2. Spawn process
    const process = spawn('codex', args, {
      cwd: config.workingDirectory,
      env: { ...process.env },
    });

    // 3. Feed prompt via stdin
    process.stdin.write(options.prompt);
    process.stdin.end();

    // 4. Process streaming JSON output
    // 5. Parse events and track:
    //    - item.completed events for terminal output
    //    - turn.completed events for token usage
    //    - error events for rate limit detection
    // 6. Return ProviderResult
  }

  private formatTerminalLine(event: CodexEvent): string | null {
    // Format Codex JSON events for terminal display
    // Mirrors the CODEX_JQ_FILTER logic from ralph.sh
  }

  private isRateLimitError(event: CodexEvent): boolean {
    // Detect rate limit errors in Codex output
  }

  private estimateCost(tokenUsage: TokenUsage, model: string): number {
    // Approximate cost based on token counts and model pricing
  }
}

export function createCodexProvider(): LLMProvider {
  return new CodexProvider();
}
```

#### Key Codex Parsing Logic

```typescript
// Token tracking from turn.completed
interface CodexTurnComplete {
  type: 'turn.completed';
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
}

// Item parsing for terminal output
interface CodexItemComplete {
  type: 'item.completed';
  item: {
    type: 'command_execution' | 'file_change' | 'reasoning' | 'agent_message' | ...;
    // Type-specific fields
  };
}

// Rate limit detection patterns
const codexRateLimitPatterns = [
  /rate.?limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /usage.?limit/i,
];
```

### Phase 5: Provider Factory

**Goal**: Create a factory to instantiate the correct provider.

#### 5.1 Add to `ralph/src/lib/provider.ts`

```typescript
import { createClaudeProvider } from './claude.js';
import { createCodexProvider } from './codex.js';
import { config } from '../config.js';

export function createProvider(name?: ProviderName): LLMProvider {
  const providerName = name || config.provider;

  switch (providerName) {
    case 'claude':
      return createClaudeProvider();
    case 'codex':
      return createCodexProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

### Phase 6: Update Main Orchestration

**Goal**: Update `index.ts` to use the provider abstraction.

#### 6.1 Update `ralph/src/index.ts`

```typescript
import { createProvider, ProviderName } from './lib/provider.js';

async function runLoop(loopInstanceName: string, iteration: number): Promise<void> {
  // ... existing setup ...

  // Agent 1: Always Claude (cost-efficient for Linear operations)
  const agent1Provider = createProvider('claude');
  const agent1Result = await agent1Provider.spawn({
    prompt: agent1Prompt,
    model: 'haiku',  // Use haiku for Agent 1 (cost efficiency)
    allowedTools: ['mcp__linear__*'],
  }, 1);

  // ... agent 1 result processing ...

  // Agent 2: Use configured provider (Claude or Codex)
  const agent2Provider = createProvider();  // Uses config.provider
  const agent2Result = await agent2Provider.spawn({
    prompt: agent2Prompt,
    model: config.provider === 'codex' ? config.codexModel : config.claudeModel,
    reasoningEffort: config.provider === 'codex' ? config.codexReasoningEffort : undefined,
  }, 2);

  // ... agent 2 result processing ...

  // Agent 3: Always Claude (cost-efficient for Linear operations)
  const agent3Provider = createProvider('claude');
  const agent3Result = await agent3Provider.spawn({
    prompt: agent3Prompt,
    model: 'haiku',  // Use haiku for Agent 3 (cost efficiency)
    allowedTools: ['mcp__linear__*'],
  }, 3);

  // ... rest of loop ...
}

// Add max iterations check
async function main() {
  let iteration = 0;

  while (config.maxIterations === 0 || iteration < config.maxIterations) {
    await runLoop(loopInstanceName, iteration);
    iteration++;
  }

  console.log(`Reached max iterations: ${config.maxIterations}`);
}
```

### Phase 7: Update Rate Limit Handling

**Goal**: Ensure rate limit detection works for both providers.

#### 7.1 Update `ralph/src/lib/rate-limit.ts`

Add Codex-specific rate limit patterns:

```typescript
// Claude patterns (existing)
const claudeRateLimitPatterns = [
  /rate.?limit/i,
  /hit your limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /usage.?limit/i,
];

// Codex patterns (may differ)
const codexRateLimitPatterns = [
  /rate.?limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /RateLimitError/i,
];

export function isRateLimitError(text: string, provider: 'claude' | 'codex'): boolean {
  const patterns = provider === 'claude' ? claudeRateLimitPatterns : codexRateLimitPatterns;
  return patterns.some(pattern => pattern.test(text));
}
```

### Phase 8: Terminal Output Formatting

**Goal**: Format Codex events for terminal display matching `ralph.sh` output style.

#### 8.1 Terminal Output Mapping

| Codex Event | Terminal Format |
|-------------|-----------------|
| `item.completed` (command_execution) | `🔧 [codex] {command} (exit {code})` |
| `item.completed` (file_change) | `📝 [codex] {kind} {path}` |
| `item.completed` (reasoning) | `💭 [codex] {first line}` |
| `item.completed` (agent_message) | `💬 [codex] {text}` |
| `error` | `⚠️ [codex] {message}` |
| Session end | `📊 CODEX SESSION END\n   Tokens: in={in} cached={cached} out={out}` |

This matches the `CODEX_JQ_FILTER` in `ralph.sh`.

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `ralph/src/lib/provider.ts` | New | Provider interface and factory |
| `ralph/src/lib/codex.ts` | New | Codex CLI spawner with JSON parsing |
| `ralph/src/types.ts` | Edit | Add provider configuration types |
| `ralph/src/config.ts` | Edit | Add provider config loading from env vars |
| `ralph/src/lib/claude.ts` | Edit | Implement provider interface |
| `ralph/src/lib/rate-limit.ts` | Edit | Add Codex rate limit patterns |
| `ralph/src/index.ts` | Edit | Use provider abstraction for Agent 2 |

## Verification Steps

### Build & Type Check
```bash
npm run build      # Should succeed
npm run typecheck  # Should pass with no errors
npm run lint       # Should pass
```

### Manual Testing

1. **Default (Claude) mode**:
   ```bash
   npm start
   # Should behave identically to current behavior
   ```

2. **Codex mode**:
   ```bash
   RALPH_PROVIDER=codex npm start
   # Should use Codex for Agent 2
   ```

3. **Codex with custom settings**:
   ```bash
   RALPH_PROVIDER=codex \
   CODEX_MODEL=gpt-5.2-codex \
   CODEX_REASONING_EFFORT=extra_high \
   npm start
   ```

4. **Max iterations**:
   ```bash
   RALPH_MAX_ITERATIONS=3 npm start
   # Should stop after 3 loops
   ```

### Output Logging Verification

Check that `.ralph/output/{loop-name}/loop-{n}/` contains:
- `agent-2.log`: Raw JSON from Codex (different format than Claude)
- `agent-2-terminal.log`: Formatted terminal output

## Success Criteria

1. ✅ `RALPH_PROVIDER=codex` uses Codex for Agent 2
2. ✅ `CODEX_MODEL` and `CODEX_REASONING_EFFORT` env vars are respected
3. ✅ Terminal output shows Codex-formatted events (🔧, 📝, 💭, 💬)
4. ✅ Raw JSON logging works for Codex output format
5. ✅ Rate limits are detected for both providers
6. ✅ Token usage is tracked and reported
7. ✅ Cost is estimated for Codex (with "estimated" marker)
8. ✅ Agent 1 and Agent 3 continue to use Claude (not configurable)
9. ✅ Max iterations configuration works
10. ✅ Default behavior (no env vars) is unchanged (Claude opus)

## Risks and Mitigations

### Risk 1: Codex CLI Not Installed
**Impact**: Runtime failure
**Mitigation**:
- Check for `codex` binary at startup when provider is codex
- Clear error message: "Codex CLI not found. Install from https://..."

### Risk 2: Codex Output Format Changes
**Impact**: Parsing failures
**Mitigation**:
- Log raw JSON for debugging
- Graceful fallback for unknown event types
- Version check if Codex provides one

### Risk 3: Cost Estimation Inaccuracy
**Impact**: Misleading cost reporting
**Mitigation**:
- Clearly mark as "estimated" in all outputs
- Provide link to OpenAI pricing page
- Update pricing constants as needed

### Risk 4: Different Tool Availability
**Impact**: Agent 2 may lack tools it needs
**Mitigation**:
- Research Codex MCP tool support before implementation
- Fall back to Claude if critical tools unavailable

## Open Questions (Resolved)

1. **Q: Should Agents 1 and 3 support Codex?**
   **A: No** - They only interact with Linear MCP tools. No benefit from Codex.

2. **Q: Environment variables or config file?**
   **A: Both** - Env vars for easy CLI overrides, config file for persistent settings.

3. **Q: How to handle missing cost in Codex output?**
   **A: Estimate** - Calculate from token counts with known pricing, mark as estimated.

## Future Enhancements (Out of Scope)

1. Config file support (`.ralph.config.json`)
2. Web UI for provider selection
3. Codex support for Agents 1 and 3 (if MCP tools become available)
4. Provider-specific prompt optimization
5. A/B testing between providers

## References

- Research: `thoughts/research/2025-01-25-RSK-16-codex-cli-support.md`
- Shell script: `ralph.sh`
- Codex CLI Reference: https://developers.openai.com/codex/cli/reference/
- Claude Code CLI: https://claude.ai/code
