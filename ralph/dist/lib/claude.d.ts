import { ClaudeResult, ClaudeOptions } from '../types.js';
import { LLMProvider } from './provider.js';
export declare function spawnClaude(options: ClaudeOptions, agentNumber?: number): Promise<ClaudeResult>;
export declare function extractFinalOutput(streamOutput: string): string;
export declare function createClaudeProvider(): LLMProvider;
//# sourceMappingURL=claude.d.ts.map