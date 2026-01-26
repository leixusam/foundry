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

// Linear workflow state types

export type LinearStateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface WorkflowState {
  id: string;
  name: string;
  type: LinearStateType;
  position: number;
}

// Ralph status definition for creating workflow states
export interface RalphStatusDefinition {
  name: string;
  type: LinearStateType;
}

// Initialization result
export interface InitResult {
  success: boolean;
  created: string[];
  existing: string[];
  errors: string[];
}

// Attachment types

export interface AttachmentInfo {
  id: string;
  url: string;
  filename: string;
  source: 'attachment' | 'embedded';
}

export interface DownloadResult {
  success: boolean;
  attachments: DownloadedAttachment[];
  errors: string[];
}

export interface DownloadedAttachment {
  originalUrl: string;
  localPath: string;
  filename: string;
}

// Per-agent reasoning effort configuration for Codex
export interface CodexAgentReasoningConfig {
  agent1: CodexReasoningEffort;
  agent2: CodexReasoningEffort;
  agent3: CodexReasoningEffort;
}

// Config types

export interface RalphConfig {
  workingDirectory: string;
  linearApiKey?: string;
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
  codexAgentReasoning: CodexAgentReasoningConfig;
  maxIterations: number;
}
