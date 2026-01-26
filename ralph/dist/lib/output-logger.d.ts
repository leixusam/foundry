/**
 * Initializes the output logger for a new loop iteration
 * @param loopInstanceName - The full loop instance name (e.g., "arctic-lynx-1234567")
 * @param loopNumber - The loop iteration number (0, 1, 2, ...)
 */
export declare function initLoopLogger(loopInstanceName: string, loopNumber: number): void;
/**
 * Logs a line of output for a specific agent (raw LLM JSON)
 * @param agentNumber - The agent number (1, 2, or 3)
 * @param line - The raw line of output to log (typically JSON from Claude)
 */
export declare function logAgentOutput(agentNumber: number, line: string): Promise<void>;
/**
 * Logs terminal output for a specific agent (formatted shell output)
 * @param agentNumber - The agent number (1, 2, or 3)
 * @param text - The formatted text that was printed to the terminal
 */
export declare function logTerminalOutput(agentNumber: number, text: string): Promise<void>;
/**
 * Gets the current output directory for diagnostics
 */
export declare function getCurrentOutputDir(): string | null;
//# sourceMappingURL=output-logger.d.ts.map