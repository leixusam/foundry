// Provider types

export type ProviderName = 'claude' | 'codex';
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'extra_high';

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
