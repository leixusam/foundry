import { execSync } from 'child_process';
import { SafetyNetResult } from '../types.js';

// Check for uncommitted changes and push them with a safety-net commit
export async function gitSafetyNetPush(iteration: number): Promise<SafetyNetResult> {
  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

    if (!status) {
      return { pushed: false };
    }

    console.log('   Safety net: Found uncommitted changes');

    // Get list of changed files
    const filesCommitted = status.split('\n').map(line => line.substring(3));

    // Stage all changes
    execSync('git add -A');

    // Commit with safety net message
    const message = `[SAFETY-NET] Uncommitted changes from loop iteration ${iteration}

This commit was created by the Node.js safety net, not by Agent 2.
This indicates Agent 2 may have crashed or failed to commit its work.
Investigate if this happens frequently.

Files:
${filesCommitted.map(f => `- ${f}`).join('\n')}`;

    execSync(`git commit -m ${JSON.stringify(message)}`);

    // Get commit hash
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

    // Push
    execSync('git push origin main');

    return {
      pushed: true,
      commitHash,
      filesCommitted,
    };
  } catch (error) {
    console.error('Safety net git error:', error);
    return { pushed: false };
  }
}

// Pull latest changes from remote
export function gitPull(): boolean {
  try {
    execSync('git pull origin main', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get current branch
export function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}
