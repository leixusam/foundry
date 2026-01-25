// Agent output types

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
}
