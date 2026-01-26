import { execSync } from 'child_process';
import { getConfig } from '../config.js';

// Pull latest changes from remote
export function gitPull(): boolean {
  const config = getConfig();
  try {
    execSync('git pull origin main', { stdio: 'pipe', cwd: config.workingDirectory });
    return true;
  } catch {
    return false;
  }
}

// Get current branch
export function getCurrentBranch(): string {
  const config = getConfig();
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8', cwd: config.workingDirectory }).trim();
  } catch {
    return 'unknown';
  }
}
