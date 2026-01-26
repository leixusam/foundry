// Loop instance name generator
// Generates unique, memorable names for loop instances (e.g., "20250125-143052-calm-pegasus")
// Timestamp prefix enables easy sorting by date/time in file explorers
// This helps identify which loop instance made comments in Linear when multiple instances work in parallel

// Word lists for generating memorable names
// Expanded lists provide more unique combinations (64 adjectives x 64 animals = 4,096 combinations)
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
function formatTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Generates a unique pod name (adjective-animal combination)
 * Example: "calm-pegasus"
 *
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each pod gets a unique name while being reproducible for debugging.
 * This name persists for the entire Ralph session (across all loops).
 */
export function generatePodName(): string {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);

  // Use Unix timestamp to deterministically select words (but with enough variation)
  // This ensures the same second always produces the same name
  const adjIndex = timestamp % ADJECTIVES.length;
  const animalIndex = Math.floor(timestamp / ADJECTIVES.length) % ANIMALS.length;

  const adjective = ADJECTIVES[adjIndex];
  const animal = ANIMALS[animalIndex];

  return `${adjective}-${animal}`;
}

/**
 * Generates a unique name for a loop instance (legacy format, kept for compatibility)
 * Format: {YYYYMMDD-HHMMSS}-{adjective}-{animal}
 * Example: "20250125-143052-calm-pegasus"
 *
 * The timestamp prefix enables easy chronological sorting in file explorers.
 * The name is deterministic based on the current timestamp (Unix seconds),
 * ensuring each loop gets a unique name while being reproducible for debugging.
 *
 * @deprecated Use generatePodName() for persistent pod names across loops
 */
export function generateLoopInstanceName(): string {
  const now = new Date();
  const humanTimestamp = formatTimestamp(now);
  const podName = generatePodName();

  return `${humanTimestamp}-${podName}`;
}

/**
 * Extracts the human-readable part of a loop instance name (adjective-animal)
 * Current format: "20250125-143052-calm-pegasus" -> "calm-pegasus"
 * Old format (backwards compatible): "calm-pegasus-20250125-143052" -> "calm-pegasus"
 * Legacy format: "red-giraffe-1706223456" -> "red-giraffe"
 */
export function getLoopInstanceNameDisplay(fullName: string): string {
  const parts = fullName.split('-');

  // Current format: YYYYMMDD-HHMMSS-adjective-animal (4 parts with timestamp first)
  // Check if first part looks like a date (8 digits)
  if (parts.length >= 4 && /^\d{8}$/.test(parts[0])) {
    // Return adjective-animal (last two parts)
    return `${parts[2]}-${parts[3]}`;
  }

  // Old format: adjective-animal-YYYYMMDD-HHMMSS or adjective-animal-unixTimestamp
  if (parts.length >= 3) {
    // Return just adjective-animal (first two parts)
    return `${parts[0]}-${parts[1]}`;
  }

  return fullName;
}
