import { spawn, execSync } from 'child_process';
import { getConfig } from '../config.js';
import { logAgentOutput, logTerminalOutput } from './output-logger.js';
import { LLMProvider, ProviderOptions, ProviderResult, registerCodexProvider, CodexReasoningEffort } from './provider.js';
import { isRateLimitError } from './rate-limit.js';

// ANSI color codes
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Codex pricing per 1M tokens (approximate, based on OpenAI pricing)
// These are estimates and may need updating
const CODEX_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.2-codex': { input: 2.00, output: 8.00 },
  'gpt-5-codex': { input: 2.00, output: 8.00 },
  'gpt-4-codex': { input: 1.50, output: 6.00 },
  'default': { input: 2.00, output: 8.00 },
};

// Codex JSON event types
interface CodexTurnCompleted {
  type: 'turn.completed';
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
}

interface CodexItemCompleted {
  type: 'item.completed';
  item: {
    id: string;
    type: 'command_execution' | 'file_change' | 'reasoning' | 'agent_message' | 'mcp_tool_call' | 'web_search' | 'plan_update';
    command?: string;
    exit_code?: number;
    aggregated_output?: string;
    changes?: Array<{ kind: string; path: string }>;
    text?: string;
  };
}

interface CodexError {
  type: 'error';
  message?: string;
  error?: string;
}

type CodexEvent = CodexTurnCompleted | CodexItemCompleted | CodexError | { type: string };

// Helper: Clean up file paths for display
function cleanPath(path: string): string {
  return path
    .replace(/\/home\/ubuntu\/repos\/[^/]+\//g, '')
    .replace(/\/Users\/[^/]+\/repos\/[^/]+\//g, '');
}

// Helper: Clean up command for display
function cleanCommand(cmd: string): string {
  return cmd
    .replace(/^\/bin\/zsh -lc /, '')
    .replace(/^\/bin\/bash -lc /, '')
    .replace(/^['"]|['"]$/g, '');
}

// Helper: Truncate string to max length
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

// Format a single Codex JSON event for terminal display
function formatCodexEvent(event: CodexEvent): string | null {
  if (event.type === 'item.completed') {
    const itemEvent = event as CodexItemCompleted;
    const item = itemEvent.item;

    switch (item.type) {
      case 'command_execution': {
        const cmd = cleanCommand(item.command || '');
        const shortCmd = truncate(cmd.replace(/\n/g, ' '), 80);
        const exitCode = item.exit_code ?? 0;

        if (exitCode === 0) {
          return `${DIM}🔧 [codex] ${shortCmd}${RESET}`;
        } else {
          let output = `${DIM}⚠️ [codex] ${shortCmd} (exit ${exitCode})${RESET}`;
          if (item.aggregated_output) {
            const shortOutput = truncate(item.aggregated_output, 80);
            output += `\n${DIM}↳ [codex] ${shortOutput}${RESET}`;
          }
          return output;
        }
      }

      case 'file_change': {
        if (item.changes && item.changes.length > 0) {
          return item.changes
            .map(change => `${DIM}📝 [codex] ${change.kind || 'update'} ${cleanPath(change.path)}${RESET}`)
            .join('\n');
        }
        return `${DIM}📝 [codex] file_change${RESET}`;
      }

      case 'reasoning': {
        // Extract first line of reasoning (often a header like **Planning**)
        const text = item.text || '';
        const firstLine = text.split('\n')[0] || '';
        const cleanLine = firstLine.replace(/^\*\*|\*\*$/g, '');
        return `💭 [codex] ${cleanLine}`;
      }

      case 'agent_message': {
        return `${BOLD}💬 [codex] ${item.text || ''}${RESET}`;
      }

      default:
        return null;
    }
  }

  if (event.type === 'error') {
    const errorEvent = event as CodexError;
    const message = errorEvent.message || errorEvent.error || 'error';
    return `${YELLOW}⚠️ [codex] ${message}${RESET}`;
  }

  return null;
}

// Estimate cost based on token usage and model
function estimateCost(
  tokenUsage: { input: number; output: number; cached: number },
  model: string
): number {
  const pricing = CODEX_PRICING[model] || CODEX_PRICING['default'];

  // Input tokens (non-cached) - cached tokens are typically free or discounted
  const inputCost = ((tokenUsage.input - tokenUsage.cached) / 1_000_000) * pricing.input;
  const outputCost = (tokenUsage.output / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

// Extract final text output from Codex streaming JSON
function extractCodexFinalOutput(streamOutput: string): string {
  const lines = streamOutput.split('\n');
  let lastAgentMessage = '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const json = JSON.parse(line);

      if (json.type === 'item.completed' && json.item?.type === 'agent_message') {
        lastAgentMessage = json.item.text || '';
      }
    } catch {
      // Not JSON, ignore
    }
  }

  return lastAgentMessage;
}

// Codex provider implementation
class CodexProvider implements LLMProvider {
  readonly name = 'codex' as const;

  async spawn(options: ProviderOptions, agentNumber?: number): Promise<ProviderResult> {
    const config = getConfig();
    const model = options.model || config.codexModel;
    const reasoningEffort: CodexReasoningEffort = options.reasoningEffort || config.codexReasoningEffort;

    // Warn if allowedTools is specified (Codex doesn't support per-session tool restriction)
    if (options.allowedTools && options.allowedTools.length > 0) {
      console.warn(`${YELLOW}⚠️  Warning: allowedTools option is ignored by Codex CLI.${RESET}`);
      console.warn(`${YELLOW}   Codex uses global MCP configuration from ~/.codex/config.toml${RESET}`);
    }

    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        '--dangerously-bypass-approvals-and-sandbox',
        '--json',
        '--model', model,
        '-c', `model_reasoning_effort="${reasoningEffort}"`,
      ];

      const spawnMsg = `${BOLD}Spawning: codex ${args.join(' ')}${RESET}`;
      const cwdMsg = `${DIM}   Working directory: ${config.workingDirectory}${RESET}`;
      console.log(spawnMsg);
      console.log(cwdMsg);

      // Log spawn info to terminal log
      if (agentNumber !== undefined) {
        logTerminalOutput(agentNumber, spawnMsg).catch(() => {});
        logTerminalOutput(agentNumber, cwdMsg).catch(() => {});
      }

      const proc = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: config.workingDirectory,
        env: { ...process.env },
      });

      // Feed prompt via stdin
      proc.stdin.write(options.prompt);
      proc.stdin.end();

      let output = '';
      let rateLimited = false;
      let retryAfterMs: number | undefined;
      const startTime = Date.now();

      // Token tracking
      const tokenUsage = { input: 0, output: 0, cached: 0 };

      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;

        // Parse streaming JSON output line by line
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;

          // Skip non-JSON lines (like "Reading prompt from stdin...")
          if (!line.startsWith('{')) continue;

          // Persist raw line to output log file
          if (agentNumber !== undefined) {
            logAgentOutput(agentNumber, line).catch(() => {});
          }

          try {
            const json = JSON.parse(line) as CodexEvent;

            // Track token usage from turn.completed events
            if (json.type === 'turn.completed') {
              const turnEvent = json as CodexTurnCompleted;
              tokenUsage.input += turnEvent.usage.input_tokens || 0;
              tokenUsage.output += turnEvent.usage.output_tokens || 0;
              tokenUsage.cached += turnEvent.usage.cached_input_tokens || 0;
            }

            // Check for rate limits in error events
            if (json.type === 'error') {
              const errorEvent = json as CodexError;
              const errorText = errorEvent.message || errorEvent.error || '';
              if (isRateLimitError(errorText)) {
                rateLimited = true;
                // Default wait time for Codex rate limits (5 minutes)
                retryAfterMs = 5 * 60 * 1000;
              }
            }

            // Format and display the event
            const formatted = formatCodexEvent(json);
            if (formatted) {
              console.log(formatted);
              if (agentNumber !== undefined) {
                logTerminalOutput(agentNumber, formatted).catch(() => {});
              }
            }
          } catch {
            // Not valid JSON, ignore
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text && !text.includes('Reading prompt from stdin')) {
          const stderrMsg = `${DIM}stderr: ${text}${RESET}`;
          console.error(stderrMsg);
          if (agentNumber !== undefined) {
            logTerminalOutput(agentNumber, stderrMsg).catch(() => {});
          }
        }
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        const cost = estimateCost(tokenUsage, model);

        // Format session end summary
        const sessionEnd = `${BOLD}📊 CODEX SESSION END
   Tokens: in=${tokenUsage.input.toLocaleString()} cached=${tokenUsage.cached.toLocaleString()} out=${tokenUsage.output.toLocaleString()}
   Duration: ${Math.floor(duration / 1000)}s
   Cost: ~$${cost.toFixed(4)} (estimated)${RESET}`;
        console.log(sessionEnd);
        if (agentNumber !== undefined) {
          logTerminalOutput(agentNumber, sessionEnd).catch(() => {});
        }

        resolve({
          output,
          finalOutput: extractCodexFinalOutput(output),
          rateLimited,
          retryAfterMs,
          cost,
          costEstimated: true, // Codex cost is always estimated
          duration,
          exitCode: code || 0,
          tokenUsage,
        });
      });

      proc.on('error', (err) => {
        if (err.message.includes('ENOENT')) {
          reject(new Error('Codex CLI not found. Install from https://github.com/openai/codex'));
        } else {
          reject(new Error(`Failed to spawn codex: ${err.message}`));
        }
      });
    });
  }
}

// Factory function
export function createCodexProvider(): LLMProvider {
  return new CodexProvider();
}

// Check if Linear MCP is configured in Codex
export function checkCodexLinearMcpConfigured(): boolean {
  try {
    const result = execSync('codex mcp list', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return result.toLowerCase().includes('linear');
  } catch {
    return false;
  }
}

// Register the Codex provider
registerCodexProvider(createCodexProvider);
