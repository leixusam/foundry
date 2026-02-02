import { execSync } from 'child_process';

// Result of CLI availability detection
export interface CliAvailability {
  claude: boolean;
  codex: boolean;
}

/**
 * Checks if Claude Code CLI is installed.
 * Uses `claude --version` to verify the binary exists.
 */
export function isClaudeCliInstalled(): boolean {
  try {
    execSync('claude --version', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if Codex CLI is installed.
 * Uses `codex --version` to verify the binary exists.
 */
export function isCodexCliInstalled(): boolean {
  try {
    execSync('codex --version', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects which coding CLIs are available on the system.
 * Returns an object indicating availability of each CLI.
 */
export function detectAvailableClis(): CliAvailability {
  return {
    claude: isClaudeCliInstalled(),
    codex: isCodexCliInstalled(),
  };
}

/**
 * Checks if at least one coding CLI is available.
 * Returns true if either Claude or Codex CLI is installed.
 */
export function hasAnyCli(availability: CliAvailability): boolean {
  return availability.claude || availability.codex;
}
