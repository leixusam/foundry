import { spawn } from 'child_process';
import { ClaudeResult, ClaudeOptions } from '../types.js';
import { parseRateLimitReset, isRateLimitError } from './rate-limit.js';

export async function spawnClaude(options: ClaudeOptions): Promise<ClaudeResult> {
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

    console.log(`   Spawning: claude ${args.slice(0, 5).join(' ')} ...`);

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

          // Log assistant messages (non-subagent)
          if (json.type === 'assistant' && !json.parent_tool_use_id) {
            const content = json.message?.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'text' && item.text) {
                  const preview = item.text.length > 100
                    ? item.text.substring(0, 100) + '...'
                    : item.text;
                  console.log(`   ${preview.replace(/\n/g, ' ')}`);
                }
              }
            }
          }
        } catch {
          // Not JSON or parse error, ignore
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`   stderr: ${text}`);
      }
    });

    proc.on('close', (code) => {
      console.log(`   Session complete: $${cost.toFixed(4)}, ${Math.round(duration / 1000)}s`);

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
