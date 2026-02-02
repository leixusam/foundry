import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { FoundryConfig, ProviderName, ClaudeModel, CodexReasoningEffort, CodexAgentReasoningConfig } from './types.js';
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

// Check if current directory is inside a git repository
export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Load .foundry/env file if it exists
function loadFoundryEnv(): void {
  const envPath = join(getRepoRoot(), '.foundry', 'env');
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

// Load .foundry/env before reading config
loadFoundryEnv();

// Parse CLI arguments
interface CLIArgs {
  provider?: ProviderName;
  gcpAutoStop?: boolean;
}

function parseCLIArgs(): CLIArgs {
  try {
    const { values } = parseArgs({
      options: {
        provider: {
          type: 'string',
          short: 'p',
        },
        'gcp-auto-stop': {
          type: 'boolean',
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
Foundry - Linear-orchestrated autonomous agent system

Usage:
  npm start [options]

Options:
  -p, --provider <name>  Provider to use: claude (default) or codex
  --gcp-auto-stop        Auto-stop GCP VM when no work available
  -h, --help             Show this help message

Environment Variables:
  FOUNDRY_PROVIDER             Provider: claude (default) or codex
  FOUNDRY_CLAUDE_MODEL         Claude model: opus (default), sonnet, or haiku
  FOUNDRY_MAX_ITERATIONS       Limit iterations (0 = unlimited)
  FOUNDRY_RATE_LIMIT_MAX_RETRIES  Max retries on rate limit (default: 3)
  FOUNDRY_GCP_AUTO_STOP        Auto-stop GCP VM when no work (true/false)
  CODEX_MODEL                Codex model name
  CODEX_REASONING_EFFORT     Global default: low, medium, high (default), extra_high
  CODEX_AGENT1_REASONING     Agent 1 reasoning: low, medium, high (default), extra_high
  CODEX_AGENT2_REASONING     Agent 2 reasoning: low, medium, high (default), extra_high
  CODEX_AGENT3_REASONING     Agent 3 reasoning: low, medium (default), high, extra_high

Examples:
  npm start                      # Run with Claude (default)
  npm start -- --provider codex  # Run with Codex
  npm start -- -p codex          # Short form
  npm start -- --gcp-auto-stop   # Auto-stop VM when no work available
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

    if (values['gcp-auto-stop']) {
      result.gcpAutoStop = true;
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
  const envProvider = process.env.FOUNDRY_PROVIDER?.toLowerCase();
  if (envProvider === 'codex') return 'codex';
  return 'claude'; // Default
}

// Parse Claude model from environment variable
function getClaudeModel(): ClaudeModel {
  const envModel = process.env.FOUNDRY_CLAUDE_MODEL?.toLowerCase();
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
  const envMax = process.env.FOUNDRY_MAX_ITERATIONS;
  if (envMax) {
    const parsed = parseInt(envMax, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0; // Default: unlimited (0 means no limit)
}

// Parse rate limit max retries from environment variable
function getRateLimitMaxRetries(): number {
  const envMax = process.env.FOUNDRY_RATE_LIMIT_MAX_RETRIES;
  if (envMax) {
    const parsed = parseInt(envMax, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 3; // Default: 3 retries
}

// Parse GCP auto-stop from CLI args or environment variable
function getGcpAutoStop(): boolean {
  // CLI args take precedence over env vars
  if (cliArgs.gcpAutoStop) return true;
  const envVal = process.env.FOUNDRY_GCP_AUTO_STOP?.toLowerCase();
  return envVal === 'true' || envVal === '1';
}

// Parse quick check interval (default: 5 minutes)
function getQuickCheckInterval(): number {
  const envVal = process.env.FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return 5; // Default: 5 minutes
}

// Parse full check interval (default: 120 minutes = 2 hours)
function getFullCheckInterval(): number {
  const envVal = process.env.FOUNDRY_FULL_CHECK_INTERVAL_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return 120; // Default: 120 minutes (2 hours)
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

// Build config from current environment
function buildConfig(): FoundryConfig {
  return {
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

    // Rate limit configuration
    rateLimitMaxRetries: getRateLimitMaxRetries(),

    // GCP configuration
    gcpAutoStop: getGcpAutoStop(),

    // Quick check configuration
    quickCheckIntervalMinutes: getQuickCheckInterval(),
    fullCheckIntervalMinutes: getFullCheckInterval(),
  };
}

// Initial config loaded at startup
export let config: FoundryConfig = buildConfig();

/**
 * Gets the current config.
 * If reload is true, rebuilds config from process.env (useful after env changes).
 */
export function getConfig(reload = false): FoundryConfig {
  if (reload) {
    config = buildConfig();
  }
  return config;
}
