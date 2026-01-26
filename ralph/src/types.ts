// Provider types

export type ProviderName = 'claude' | 'codex';
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'extra_high';

// Agent output types

export interface DispatchResult {
  noWork?: boolean;
  reason?: string;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  issueDescription: string;
  stage: 'research' | 'specification' | 'plan' | 'implement' | 'validate' | 'oneshot';
  projectName: string;
  claimTimestamp: string;
  labels: string[];
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  existingArtifacts: {
    research?: string;
    specification?: string;
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
  stageCompleted?: 'research' | 'specification' | 'plan' | 'implement' | 'validate' | 'oneshot';
  artifactPath?: string;
  commitHash?: string;
  nextStatus?: string;
  summary?: string;
  error?: string;
  subIssues?: SubIssueRecommendation[];
}

// Sub-issue recommendation for breaking down large issues
export interface SubIssueRecommendation {
  title: string;           // Sub-issue title (e.g., "RSK-20a: Implement API layer")
  description: string;     // Sub-issue description
  planSection: string;     // Reference to plan section (e.g., "Phase 2: API Layer")
  estimatedScope: string;  // Brief scope estimate (e.g., "~400 lines, 3 endpoints")
}

export interface LinearUpdateResult {
  commentPosted: boolean;
  statusUpdated: boolean;
  newStatus?: string;
  error?: string;
}

// Claude CLI types

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

// Git types

export interface SafetyNetResult {
  pushed: boolean;
  commitHash?: string;
  filesCommitted?: string[];
}

// Config types

export interface RalphConfig {
  workingDirectory: string;
  linearTeamId?: string;
  gitBranch: string;
  staleTimeoutHours: number;
  noWorkSleepMinutes: number;
  errorSleepMinutes: number;

  // Provider configuration
  provider: ProviderName;
  claudeModel: ClaudeModel;
  codexModel: string;
  codexReasoningEffort: CodexReasoningEffort;
  maxIterations: number;
}
