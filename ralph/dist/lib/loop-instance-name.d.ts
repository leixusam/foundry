/**
 * Generates a unique name for a loop instance
 * Format: {adjective}-{animal}-{timestamp}
 * Example: "red-giraffe-1706223456"
 *
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each loop gets a unique name while being reproducible for debugging.
 */
export declare function generateLoopInstanceName(): string;
/**
 * Extracts the human-readable part of a loop instance name (without timestamp)
 * Example: "red-giraffe-1706223456" -> "red-giraffe"
 */
export declare function getLoopInstanceNameDisplay(fullName: string): string;
//# sourceMappingURL=loop-instance-name.d.ts.map