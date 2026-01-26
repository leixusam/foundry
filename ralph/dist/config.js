import { execSync } from 'child_process';
// Get the git repo root directory
function getRepoRoot() {
    try {
        return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    }
    catch {
        // Fallback to current directory if not in a git repo
        return process.cwd();
    }
}
// Parse provider from environment variable
function getProvider() {
    const envProvider = process.env.RALPH_PROVIDER?.toLowerCase();
    if (envProvider === 'codex')
        return 'codex';
    return 'claude'; // Default
}
// Parse Claude model from environment variable
function getClaudeModel() {
    const envModel = process.env.RALPH_CLAUDE_MODEL?.toLowerCase();
    if (envModel === 'sonnet')
        return 'sonnet';
    if (envModel === 'haiku')
        return 'haiku';
    return 'opus'; // Default
}
// Parse Codex reasoning effort from environment variable
function getCodexReasoningEffort() {
    const envEffort = process.env.CODEX_REASONING_EFFORT?.toLowerCase();
    if (envEffort === 'low')
        return 'low';
    if (envEffort === 'medium')
        return 'medium';
    if (envEffort === 'extra_high')
        return 'extra_high';
    return 'high'; // Default
}
// Parse max iterations from environment variable
function getMaxIterations() {
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
export const config = {
    workingDirectory: getRepoRoot(),
    gitBranch: 'main',
    staleTimeoutHours: 4,
    noWorkSleepMinutes: 15,
    errorSleepMinutes: 1,
    // Provider configuration
    provider: getProvider(),
    claudeModel: getClaudeModel(),
    codexModel: process.env.CODEX_MODEL || 'gpt-5.2-codex',
    codexReasoningEffort: getCodexReasoningEffort(),
    maxIterations: getMaxIterations(),
};
export function getConfig() {
    return config;
}
//# sourceMappingURL=config.js.map