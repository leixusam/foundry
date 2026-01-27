import { execSync } from 'child_process';

// Result of CLI availability detection
export interface CliAvailability {
  claude: boolean;
  codex: boolean;
}

/**
 * Checks if Claude Code CLI is installed and working.
 * Uses `claude -p` with a simple "hello" prompt to verify it's functional.
 */
export function isClaudeCliInstalled(): boolean {
  try {
    // Use `claude -p` with echo to stdin, with a short timeout
    // The `--print` flag outputs the response to stdout
    execSync('echo "Say hello" | claude -p --print 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 30000, // 30 second timeout
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    // Also try just checking if the binary exists with --version
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
}

/**
 * Checks if Codex CLI is installed and working.
 * Uses `codex --version` to verify it's functional.
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
