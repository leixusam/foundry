import { DispatchResult, WorkResult, ClaudeResult } from '../types.js';
export declare function loadPrompt(name: string): Promise<string>;
export declare function buildWorkerPrompt(dispatch: DispatchResult): Promise<string>;
export declare function buildWriterPrompt(dispatch: DispatchResult, workResult: WorkResult | null, claudeResult: ClaudeResult): Promise<string>;
//# sourceMappingURL=prompts.d.ts.map