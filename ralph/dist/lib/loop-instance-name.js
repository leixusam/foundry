// Loop instance name generator
// Generates unique, memorable names for loop instances (e.g., "red-giraffe-1706223456")
// This helps identify which loop instance made comments in Linear when multiple instances work in parallel
// Word lists for generating memorable names
const ADJECTIVES = [
    'red', 'blue', 'green', 'purple', 'orange', 'yellow', 'silver', 'golden',
    'swift', 'calm', 'bold', 'wise', 'keen', 'bright', 'quick', 'steady',
    'cosmic', 'lunar', 'solar', 'stellar', 'crystal', 'mystic', 'arctic', 'tropic',
];
const ANIMALS = [
    'giraffe', 'zebra', 'falcon', 'otter', 'panda', 'koala', 'eagle', 'dolphin',
    'tiger', 'wolf', 'bear', 'hawk', 'owl', 'fox', 'lynx', 'raven',
    'phoenix', 'dragon', 'griffin', 'unicorn', 'pegasus', 'sphinx', 'hydra', 'kraken',
];
/**
 * Generates a unique name for a loop instance
 * Format: {adjective}-{animal}-{timestamp}
 * Example: "red-giraffe-1706223456"
 *
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each loop gets a unique name while being reproducible for debugging.
 */
export function generateLoopInstanceName() {
    const timestamp = Math.floor(Date.now() / 1000);
    // Use timestamp to deterministically select words (but with enough variation)
    // This ensures the same timestamp always produces the same name
    const adjIndex = timestamp % ADJECTIVES.length;
    const animalIndex = Math.floor(timestamp / ADJECTIVES.length) % ANIMALS.length;
    const adjective = ADJECTIVES[adjIndex];
    const animal = ANIMALS[animalIndex];
    return `${adjective}-${animal}-${timestamp}`;
}
/**
 * Extracts the human-readable part of a loop instance name (without timestamp)
 * Example: "red-giraffe-1706223456" -> "red-giraffe"
 */
export function getLoopInstanceNameDisplay(fullName) {
    const parts = fullName.split('-');
    if (parts.length >= 3) {
        // Return everything except the last part (timestamp)
        return parts.slice(0, -1).join('-');
    }
    return fullName;
}
//# sourceMappingURL=loop-instance-name.js.map