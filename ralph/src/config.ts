import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { RalphConfig, ProviderName, ClaudeModel, CodexReasoningEffort, CodexAgentReasoningConfig } from './types.js';
import { parseArgs } from 'util';

// Get the git repo root directory
export function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback to current directory if not in a git repo
    return process.cwd();
  }
}

// Load .ralph.env file if it exists
function loadRalphEnv(): void {
  const envPath = join(getRepoRoot(), '.ralph.env');
  if (!existsSync(envPath)) {
    return;
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      // Only set if not already in environment (env vars take precedence)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore errors reading the file
  }
}

// Load .ralph.env before reading config
loadRalphEnv();

// Parse CLI arguments
interface CLIArgs {
  provider?: ProviderName;
}

function parseCLIArgs(): CLIArgs {
  try {
    const { values } = parseArgs({
      options: {
        provider: {
          type: 'string',
          short: 'p',
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
      },
      strict: false, // Allow unknown args
    });

    // Show help if requested
    if (values.help) {
      console.log(`
Ralph v2 - Linear-orchestrated autonomous agent system

Usage:
  npm start [options]

Options:
  -p, --provider <name>  Provider to use: claude (default) or codex
  -h, --help             Show this help message

Environment Variables:
  RALPH_PROVIDER             Provider: claude (default) or codex
  RALPH_CLAUDE_MODEL         Claude model: opus (default), sonnet, or haiku
  RALPH_MAX_ITERATIONS       Limit iterations (0 = unlimited)
  CODEX_MODEL                Codex model name
  CODEX_REASONING_EFFORT     Global default: low, medium, high (default), extra_high
  CODEX_AGENT1_REASONING     Agent 1 reasoning: low, medium, high (default), extra_high
  CODEX_AGENT2_REASONING     Agent 2 reasoning: low, medium, high (default), extra_high
  CODEX_AGENT3_REASONING     Agent 3 reasoning: low, medium (default), high, extra_high

Examples:
  npm start                   # Run with Claude (default)
  npm start -- --provider codex  # Run with Codex
  npm start -- -p codex          # Short form
`);
      process.exit(0);
    }

    const result: CLIArgs = {};

    if (values.provider) {
      const provider = (values.provider as string).toLowerCase();
      if (provider === 'codex' || provider === 'claude') {
        result.provider = provider as ProviderName;
      } else {
        console.error(`Invalid provider: ${values.provider}. Must be 'claude' or 'codex'.`);
        process.exit(1);
      }
    }

    return result;
  } catch {
    return {};
  }
}

// Parse CLI args once at module load
const cliArgs = parseCLIArgs();

// Parse provider from CLI args or environment variable
function getProvider(): ProviderName {
  // CLI args take precedence over env vars
  if (cliArgs.provider) return cliArgs.provider;
  const envProvider = process.env.RALPH_PROVIDER?.toLowerCase();
  if (envProvider === 'codex') return 'codex';
  return 'claude'; // Default
}

// Parse Claude model from environment variable
function getClaudeModel(): ClaudeModel {
  const envModel = process.env.RALPH_CLAUDE_MODEL?.toLowerCase();
  if (envModel === 'sonnet') return 'sonnet';
  if (envModel === 'haiku') return 'haiku';
  return 'opus'; // Default
}

// Parse Codex reasoning effort from environment variable
function getCodexReasoningEffort(): CodexReasoningEffort {
  const envEffort = process.env.CODEX_REASONING_EFFORT?.toLowerCase();
  if (envEffort === 'low') return 'low';
  if (envEffort === 'medium') return 'medium';
  if (envEffort === 'extra_high') return 'extra_high';
  return 'high'; // Default
}

// Parse max iterations from environment variable
function getMaxIterations(): number {
  const envMax = process.env.RALPH_MAX_ITERATIONS;
  if (envMax) {
    const parsed = parseInt(envMax, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0; // Default: unlimited (0 means no limit)
}

// Parse per-agent reasoning effort from environment variables
// Agent 1 and 2 default to 'high', Agent 3 defaults to 'medium' (as specified in ticket RSK-40)
function getCodexAgentReasoning(): CodexAgentReasoningConfig {
  const globalDefault = getCodexReasoningEffort();

  function parseAgentEffort(envVar: string, defaultValue: CodexReasoningEffort): CodexReasoningEffort {
    const effort = process.env[envVar]?.toLowerCase();
    if (effort === 'low') return 'low';
    if (effort === 'medium') return 'medium';
    if (effort === 'high') return 'high';
    if (effort === 'extra_high') return 'extra_high';
    return defaultValue;
  }

  return {
    agent1: parseAgentEffort('CODEX_AGENT1_REASONING', globalDefault),
    agent2: parseAgentEffort('CODEX_AGENT2_REASONING', globalDefault),
    // Agent 3 defaults to 'medium' for cost efficiency
    agent3: parseAgentEffort('CODEX_AGENT3_REASONING', 'medium'),
  };
}

// Configuration loaded from environment variables and CLI args
// CLI args take precedence over env vars
export const config: RalphConfig = {
  workingDirectory: getRepoRoot(),
  linearApiKey: process.env.LINEAR_API_KEY,
  linearTeamId: process.env.LINEAR_TEAM_KEY,
  gitBranch: 'main',
  staleTimeoutHours: 4,
  noWorkSleepMinutes: 60,
  errorSleepMinutes: 1,

  // Provider configuration
  provider: getProvider(),
  claudeModel: getClaudeModel(),
  codexModel: process.env.CODEX_MODEL || 'gpt-5.2-codex',
  codexReasoningEffort: getCodexReasoningEffort(),
  codexAgentReasoning: getCodexAgentReasoning(),
  maxIterations: getMaxIterations(),
};

export function getConfig(): RalphConfig {
  return config;
}
