import { RalphConfig } from './types.js';

// Hardcoded configuration for v1
// Future: Read from .ralph.config.json or interactive setup
export const config: RalphConfig = {
  workingDirectory: process.cwd(),
  gitBranch: 'main',
  staleTimeoutHours: 4,
  noWorkSleepMinutes: 5,
  errorSleepMinutes: 1,
};

export function getConfig(): RalphConfig {
  return config;
}
