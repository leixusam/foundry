import { spawn } from 'child_process';
import { ClaudeResult, ClaudeOptions } from '../types.js';
import { parseRateLimitReset, isRateLimitError } from './rate-limit.js';

// ANSI color codes
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Track subagent ID -> description mapping
const subagentMap = new Map<string, string>();

// Helper: Extract short model name
function modelName(model: string | null | undefined): string {
  if (!model) return '?';
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return model;
}

// Helper: Calculate context usage percentage (168K effective limit)
function contextPct(usage: { cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): number {
  const total = (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  return Math.floor((total * 100) / 168000);
}

// Helper: Clean up file paths for display
function cleanPath(path: string): string {
  return path
    .replace(/\/home\/ubuntu\/repos\/[^/]+\//g, '')
    .replace(/\/Users\/[^/]+\/repos\/[^/]+\//g, '');
}

// Helper: Extract the most useful value from tool input
function extractToolValue(input: Record<string, unknown>): string {
  if (input.file_path) return cleanPath(String(input.file_path));
  if (input.path && input.pattern) return `${input.pattern} in ${cleanPath(String(input.path))}`;
  if (input.pattern) return String(input.pattern);
  if (input.command) return String(input.command).substring(0, 80).replace(/\n/g, ' ');
  if (input.query) return String(input.query).substring(0, 80);
  if (input.content) return '(content)';
  if (input.todos) return '(todos)';
  return JSON.stringify(input).substring(0, 80).replace(/\n/g, ' ');
}

// Format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Process a single JSON line and return formatted output
function processJsonLine(json: Record<string, unknown>): string | null {
  // System init
  if (json.type === 'system' && json.subtype === 'init') {
    const tools = Array.isArray(json.tools) ? json.tools.length : 0;
    return `${BOLD}\n🚀 SESSION START\n   Model: ${json.model}\n   Tools: ${tools} available${RESET}`;
  }

  // System status
  if (json.type === 'system' && json.subtype === 'status') {
    return `${DIM}⏳ ${String(json.status).toUpperCase()}...${RESET}`;
  }

  // Context compaction
  if (json.type === 'system' && json.subtype === 'compact_boundary') {
    const metadata = json.compact_metadata as { pre_tokens?: number } | undefined;
    const preTokens = metadata?.pre_tokens ? Math.floor(metadata.pre_tokens / 1000) : '?';
    return `${DIM}📦 Context compacted (was ${preTokens}k tokens)${RESET}`;
  }

  // Task notification
  if (json.type === 'system' && json.subtype === 'task_notification') {
    return `${GREEN}✅ DONE: ${json.summary}${RESET}`;
  }

  // Result (session end)
  if (json.type === 'result') {
    const modelUsage = json.modelUsage as Record<string, {
      inputTokens?: number;
      outputTokens?: number;
      cacheReadInputTokens?: number;
      cacheCreationInputTokens?: number;
      costUSD?: number;
    }> | undefined;

    let totalIn = 0, totalOut = 0, totalCacheRead = 0, totalCacheWrite = 0;
    const modelBreakdown: string[] = [];

    if (modelUsage) {
      for (const [model, usage] of Object.entries(modelUsage)) {
        const inTokens = usage.inputTokens || 0;
        const outTokens = usage.outputTokens || 0;
        const cacheRead = usage.cacheReadInputTokens || 0;
        const cacheWrite = usage.cacheCreationInputTokens || 0;
        const cost = usage.costUSD || 0;

        totalIn += inTokens;
        totalOut += outTokens;
        totalCacheRead += cacheRead;
        totalCacheWrite += cacheWrite;

        const shortModel = model.split('-')[1] || model;
        modelBreakdown.push(
          `${shortModel}: in=${formatNumber(inTokens)} out=${formatNumber(outTokens)} ` +
          `cache_read=${formatNumber(cacheRead)} cache_write=${formatNumber(cacheWrite)} $${cost.toFixed(2)}`
        );
      }
    }

    const durationSec = Math.floor((json.duration_ms as number || 0) / 1000);
    const totalCost = (json.total_cost_usd as number || 0).toFixed(2);
    const numTurns = json.num_turns || 0;

    return `${BOLD}\n📊 SESSION END
   Duration: ${durationSec}s
   Cost: $${totalCost}
   Turns: ${numTurns}
   ${modelBreakdown.join('\n   ')}
   TOTAL: in=${formatNumber(totalIn)} out=${formatNumber(totalOut)} cache_read=${formatNumber(totalCacheRead)} cache_write=${formatNumber(totalCacheWrite)}${RESET}`;
  }

  // Assistant messages
  if (json.type === 'assistant') {
    const message = json.message as {
      model?: string;
      usage?: { cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
      content?: Array<{ type: string; name?: string; text?: string; id?: string; input?: Record<string, unknown> }>;
    } | undefined;

    const model = modelName(message?.model);
    const pct = message?.usage ? contextPct(message.usage) : 0;
    const parentId = json.parent_tool_use_id as string | null;
    const content = message?.content || [];

    const lines: string[] = [];

    for (const item of content) {
      if (item.name === 'Task') {
        // Main agent spawning a subagent
        const input = item.input as { description?: string; subagent_type?: string } | undefined;
        const desc = input?.description || 'unknown';
        const agentType = input?.subagent_type || 'unknown';

        // Store mapping for later
        if (item.id) {
          subagentMap.set(item.id, desc);
        }

        lines.push(`${YELLOW}\n🤖 [${model}/main/${pct}%] SPAWN: ${desc}\n   Agent: ${agentType}${RESET}`);
      } else if (item.name === 'TaskOutput') {
        // Skip TaskOutput messages
        continue;
      } else if (item.type === 'tool_use') {
        const value = item.input ? extractToolValue(item.input) : '';
        if (parentId === null) {
          // Main agent tool call
          lines.push(`${DIM}🔧 [${model}/main/${pct}%] ${item.name}: ${value}${RESET}`);
        } else {
          // Subagent tool call - resolve parent ID to description
          const parentDesc = subagentMap.get(parentId) || parentId;
          lines.push(`${DIM}   [${model}/${parentDesc}] ${item.name}: ${value}${RESET}`);
        }
      } else if (item.type === 'text' && item.text) {
        if (parentId === null) {
          // Main agent text - show full text
          lines.push(`💬 [${model}/main/${pct}%] ${item.text}`);
        }
        // Skip subagent text to reduce noise
      }
    }

    return lines.length > 0 ? lines.join('\n') : null;
  }

  return null;
}

export async function spawnClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  // Clear subagent map for new session
  subagentMap.clear();

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--dangerously-skip-permissions',
      '--output-format=stream-json',
      '--model', options.model,
      '--verbose',
    ];

    // Add allowed tools restriction if specified
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    console.log(`${BOLD}Spawning: claude ${args.join(' ')}${RESET}`);

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

      // Parse streaming JSON output
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);

          // Check for rate limits
          if (json.error === 'rate_limit') {
            rateLimited = true;
            retryAfterMs = parseRateLimitReset(json);
          }

          if (json.type === 'result' && json.is_error) {
            const resultText = String(json.result || '');
            if (isRateLimitError(resultText)) {
              rateLimited = true;
              retryAfterMs = parseRateLimitReset(json);
            }
          }

          // Capture final stats
          if (json.type === 'result') {
            cost = json.total_cost_usd || 0;
            duration = json.duration_ms || 0;
          }

          // Process and log the line
          const formatted = processJsonLine(json);
          if (formatted) {
            console.log(formatted);
          }
        } catch {
          // Not JSON or parse error, ignore
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`${DIM}stderr: ${text}${RESET}`);
      }
    });

    proc.on('close', (code) => {
      resolve({
        output,
        rateLimited,
        retryAfterMs,
        cost,
        duration,
        exitCode: code || 0,
      });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// Extract the final text output from Claude's streaming JSON
export function extractFinalOutput(streamOutput: string): string {
  const lines = streamOutput.split('\n');
  let lastTextContent = '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const json = JSON.parse(line);

      // Look for assistant messages at the top level (not subagent)
      if (json.type === 'assistant' && !json.parent_tool_use_id) {
        const content = json.message?.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'text' && item.text) {
              lastTextContent = item.text;
            }
          }
        }
      }

      // Also check result type for final output
      if (json.type === 'result' && !json.is_error && json.result) {
        lastTextContent = String(json.result);
      }
    } catch {
      // Not JSON, ignore
    }
  }

  return lastTextContent;
}
