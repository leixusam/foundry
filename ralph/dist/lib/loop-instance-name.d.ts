/**
 * Generates a unique name for a loop instance
 * Format: {adjective}-{animal}-{YYYYMMDD-HHMMSS}
 * Example: "calm-pegasus-20250125-143052"
 *
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each loop gets a unique name while being reproducible for debugging.
 * The human-readable timestamp format makes it easy to identify when a loop ran.
 */
export declare function generateLoopInstanceName(): string;
/**
 * Extracts the human-readable part of a loop instance name (without timestamp)
 * New format: "calm-pegasus-20250125-143052" -> "calm-pegasus"
 * Old format (backwards compatible): "red-giraffe-1706223456" -> "red-giraffe"
 */
export declare function getLoopInstanceNameDisplay(fullName: string): string;
//# sourceMappingURL=loop-instance-name.d.ts.map