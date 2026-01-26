// Loop instance name generator
// Generates unique, memorable names for loop instances (e.g., "calm-pegasus-20250125-143052")
// This helps identify which loop instance made comments in Linear when multiple instances work in parallel
// Word lists for generating memorable names
// Expanded lists provide more unique combinations (60 adjectives x 60 animals = 3,600 combinations)
const ADJECTIVES = [
    // Colors
    'red', 'blue', 'green', 'purple', 'orange', 'yellow', 'silver', 'golden',
    'crimson', 'azure', 'emerald', 'violet', 'amber', 'ivory', 'bronze', 'copper',
    // Qualities
    'swift', 'calm', 'bold', 'wise', 'keen', 'bright', 'quick', 'steady',
    'noble', 'brave', 'gentle', 'fierce', 'proud', 'silent', 'clever', 'nimble',
    // Cosmic/Nature
    'cosmic', 'lunar', 'solar', 'stellar', 'crystal', 'mystic', 'arctic', 'tropic',
    'misty', 'frozen', 'blazing', 'radiant', 'shadow', 'thunder', 'starlit', 'ancient',
    // Additional
    'vivid', 'serene', 'mighty', 'agile', 'lofty', 'daring', 'loyal', 'gallant',
    'gleaming', 'glowing', 'shining', 'dusk', 'dawn', 'twilight', 'velvet', 'marble',
];
const ANIMALS = [
    // Safari/Wild
    'giraffe', 'zebra', 'falcon', 'otter', 'panda', 'koala', 'eagle', 'dolphin',
    'tiger', 'wolf', 'bear', 'hawk', 'owl', 'fox', 'lynx', 'raven',
    'leopard', 'cheetah', 'jaguar', 'panther', 'gazelle', 'antelope', 'bison', 'mustang',
    // Mythical
    'phoenix', 'dragon', 'griffin', 'unicorn', 'pegasus', 'sphinx', 'hydra', 'kraken',
    'chimera', 'basilisk', 'wyvern', 'manticore', 'cerberus', 'hippogriff', 'thunderbird', 'leviathan',
    // Ocean/Sky
    'shark', 'whale', 'seal', 'penguin', 'pelican', 'heron', 'condor', 'albatross',
    'stingray', 'orca', 'narwhal', 'walrus', 'osprey', 'harrier', 'kestrel', 'merlin',
    // Additional
    'badger', 'mongoose', 'wolverine', 'marten', 'viper', 'cobra', 'python', 'iguana',
];
/**
 * Formats a date as YYYYMMDD-HHMMSS (human-readable timestamp)
 * Example: "20250125-143052"
 */
function formatTimestamp(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}
/**
 * Generates a unique name for a loop instance
 * Format: {adjective}-{animal}-{YYYYMMDD-HHMMSS}
 * Example: "calm-pegasus-20250125-143052"
 *
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each loop gets a unique name while being reproducible for debugging.
 * The human-readable timestamp format makes it easy to identify when a loop ran.
 */
export function generateLoopInstanceName() {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const humanTimestamp = formatTimestamp(now);
    // Use Unix timestamp to deterministically select words (but with enough variation)
    // This ensures the same second always produces the same name
    const adjIndex = timestamp % ADJECTIVES.length;
    const animalIndex = Math.floor(timestamp / ADJECTIVES.length) % ANIMALS.length;
    const adjective = ADJECTIVES[adjIndex];
    const animal = ANIMALS[animalIndex];
    return `${adjective}-${animal}-${humanTimestamp}`;
}
/**
 * Extracts the human-readable part of a loop instance name (without timestamp)
 * New format: "calm-pegasus-20250125-143052" -> "calm-pegasus"
 * Old format (backwards compatible): "red-giraffe-1706223456" -> "red-giraffe"
 */
export function getLoopInstanceNameDisplay(fullName) {
    const parts = fullName.split('-');
    // New format has 4 parts: adjective-animal-YYYYMMDD-HHMMSS
    // Old format has 3 parts: adjective-animal-unixTimestamp
    if (parts.length >= 3) {
        // Return just adjective-animal (first two parts)
        return `${parts[0]}-${parts[1]}`;
    }
    return fullName;
}
//# sourceMappingURL=loop-instance-name.js.map