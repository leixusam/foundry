// Provider abstraction for LLM CLI tools (Claude Code and ChatGPT Codex)

export type ProviderName = 'claude' | 'codex';

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'extra_high';

export interface ProviderOptions {
  prompt: string;
  model?: string;
  allowedTools?: string[];
  // Codex-specific
  reasoningEffort?: CodexReasoningEffort;
}

export interface ProviderResult {
  output: string;           // Raw streaming output (newline-delimited JSON)
  finalOutput: string;      // Extracted final text message
  rateLimited: boolean;
  retryAfterMs?: number;
  cost: number;             // Total cost USD (estimated for Codex)
  costEstimated: boolean;   // true if cost is approximated
  duration: number;         // Duration in ms
  exitCode: number;
  tokenUsage: {
    input: number;
    output: number;
    cached: number;
  };
}

export interface LLMProvider {
  readonly name: ProviderName;
  spawn(options: ProviderOptions, agentNumber?: number): Promise<ProviderResult>;
}

// Factory function - will be populated after provider implementations are defined
let createClaudeProviderFn: (() => LLMProvider) | null = null;
let createCodexProviderFn: (() => LLMProvider) | null = null;

export function registerClaudeProvider(factory: () => LLMProvider): void {
  createClaudeProviderFn = factory;
}

export function registerCodexProvider(factory: () => LLMProvider): void {
  createCodexProviderFn = factory;
}

export function createProvider(name: ProviderName): LLMProvider {
  switch (name) {
    case 'claude':
      if (!createClaudeProviderFn) {
        throw new Error('Claude provider not registered. Import claude.ts first.');
      }
      return createClaudeProviderFn();
    case 'codex':
      if (!createCodexProviderFn) {
        throw new Error('Codex provider not registered. Import codex.ts first.');
      }
      return createCodexProviderFn();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
