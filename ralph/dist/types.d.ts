export type ProviderName = 'claude' | 'codex';
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'extra_high';
export interface ClaudeOptions {
    prompt: string;
    model: 'sonnet' | 'opus' | 'haiku';
    allowedTools?: string[];
}
export interface ClaudeResult {
    output: string;
    rateLimited: boolean;
    retryAfterMs?: number;
    cost: number;
    duration: number;
    exitCode: number;
}
export interface RalphConfig {
    workingDirectory: string;
    linearTeamId?: string;
    gitBranch: string;
    staleTimeoutHours: number;
    noWorkSleepMinutes: number;
    errorSleepMinutes: number;
    provider: ProviderName;
    claudeModel: ClaudeModel;
    codexModel: string;
    codexReasoningEffort: CodexReasoningEffort;
    maxIterations: number;
}
//# sourceMappingURL=types.d.ts.map