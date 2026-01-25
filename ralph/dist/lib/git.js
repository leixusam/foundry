import { execSync } from 'child_process';
import { getConfig } from '../config.js';
// Check for uncommitted changes and push them with a safety-net commit
export async function gitSafetyNetPush(iteration) {
    const config = getConfig();
    const execOpts = { encoding: 'utf-8', cwd: config.workingDirectory };
    try {
        // Check for uncommitted changes
        const status = execSync('git status --porcelain', execOpts).trim();
        if (!status) {
            return { pushed: false };
        }
        console.log('   Safety net: Found uncommitted changes');
        // Get list of changed files
        const filesCommitted = status.split('\n').map(line => line.substring(3));
        // Stage all changes
        execSync('git add -A', { cwd: config.workingDirectory });
        // Commit with safety net message
        const message = `[SAFETY-NET] Uncommitted changes from loop iteration ${iteration}

This commit was created by the Node.js safety net, not by Agent 2.
This indicates Agent 2 may have crashed or failed to commit its work.
Investigate if this happens frequently.

Files:
${filesCommitted.map(f => `- ${f}`).join('\n')}`;
        execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: config.workingDirectory });
        // Get commit hash
        const commitHash = execSync('git rev-parse --short HEAD', execOpts).trim();
        // Try to push (may fail if no remote)
        try {
            execSync('git push origin main', { cwd: config.workingDirectory, stdio: 'pipe' });
        }
        catch {
            console.log('   Safety net: Could not push (no remote or push failed)');
        }
        return {
            pushed: true,
            commitHash,
            filesCommitted,
        };
    }
    catch (error) {
        console.error('Safety net git error:', error);
        return { pushed: false };
    }
}
// Pull latest changes from remote
export function gitPull() {
    const config = getConfig();
    try {
        execSync('git pull origin main', { stdio: 'pipe', cwd: config.workingDirectory });
        return true;
    }
    catch {
        return false;
    }
}
// Get current branch
export function getCurrentBranch() {
    const config = getConfig();
    try {
        return execSync('git branch --show-current', { encoding: 'utf-8', cwd: config.workingDirectory }).trim();
    }
    catch {
        return 'unknown';
    }
}
//# sourceMappingURL=git.js.map