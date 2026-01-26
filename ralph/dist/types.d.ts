export type ProviderName = 'claude' | 'codex';
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'extra_high';
export interface DispatchResult {
    noWork?: boolean;
    reason?: string;
    issueId: string;
    issueIdentifier: string;
    issueTitle: string;
    issueDescription: string;
    stage: 'research' | 'plan' | 'implement' | 'validate' | 'oneshot';
    projectName: string;
    claimTimestamp: string;
    labels: string[];
    priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
    existingArtifacts: {
        research?: string;
        plan?: string;
    };
    parentIssue: string;
    subIssues: string;
    blockingIssues: string;
    blockedByIssues: string;
    relatedContext: string;
    commentsSummary: string;
}
export interface WorkResult {
    success: boolean;
    stageCompleted?: 'research' | 'plan' | 'implement' | 'validate' | 'oneshot';
    artifactPath?: string;
    commitHash?: string;
    nextStatus?: string;
    summary?: string;
    error?: string;
    subIssues?: SubIssueRecommendation[];
}
export interface SubIssueRecommendation {
    title: string;
    description: string;
    planSection: string;
    estimatedScope: string;
}
export interface LinearUpdateResult {
    commentPosted: boolean;
    statusUpdated: boolean;
    newStatus?: string;
    error?: string;
}
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
export interface SafetyNetResult {
    pushed: boolean;
    commitHash?: string;
    filesCommitted?: string[];
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