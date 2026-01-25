import { execSync } from 'child_process';
import { RalphConfig } from './types.js';

// Get the git repo root directory
function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback to current directory if not in a git repo
    return process.cwd();
  }
}

// Hardcoded configuration for v1
// Future: Read from .ralph.config.json or interactive setup
export const config: RalphConfig = {
  workingDirectory: getRepoRoot(),
  gitBranch: 'main',
  staleTimeoutHours: 4,
  noWorkSleepMinutes: 15,
  errorSleepMinutes: 1,
};

export function getConfig(): RalphConfig {
  return config;
}
