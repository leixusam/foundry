import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { RalphConfig, ProviderName, ClaudeModel, CodexReasoningEffort } from './types.js';

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

// Parse provider from environment variable
function getProvider(): ProviderName {
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

// Configuration loaded from environment variables
// Future: Read from .ralph.config.json or interactive setup
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
  maxIterations: getMaxIterations(),
};

export function getConfig(): RalphConfig {
  return config;
}
