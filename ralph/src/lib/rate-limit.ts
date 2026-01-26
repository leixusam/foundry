// Rate limit detection and handling utilities

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handleRateLimit(retryAfterMs: number): Promise<void> {
  const minutes = Math.ceil(retryAfterMs / 60000);
  console.log(`Rate limited. Sleeping ${minutes} minute(s)...`);
  await sleep(retryAfterMs);
}

// Timezone abbreviation to UTC offset mapping (hours)
const TIMEZONE_OFFSETS: Record<string, number> = {
  // US Timezones
  'PST': -8, 'PDT': -7,
  'MST': -7, 'MDT': -6,
  'CST': -6, 'CDT': -5,
  'EST': -5, 'EDT': -4,
  // Common others
  'UTC': 0, 'GMT': 0,
};

// Get UTC offset for an IANA timezone name (e.g., "America/Los_Angeles")
function getIANATimezoneOffset(tz: string): number | null {
  try {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return null; // Invalid timezone
  }
}

// Get UTC offset from timezone string (abbreviation or IANA name)
function getTimezoneOffset(tz: string): number | null {
  // Check abbreviation mapping first
  const abbrevOffset = TIMEZONE_OFFSETS[tz.toUpperCase()];
  if (abbrevOffset !== undefined) {
    return abbrevOffset;
  }
  // Try as IANA timezone name
  return getIANATimezoneOffset(tz);
}

// Parse rate limit reset time from Claude error messages
export function parseRateLimitReset(jsonOrText: unknown): number {
  let text = '';

  if (typeof jsonOrText === 'string') {
    text = jsonOrText;
  } else if (jsonOrText && typeof jsonOrText === 'object') {
    const json = jsonOrText as Record<string, unknown>;
    text = String(json.result || '');
    if (!text && json.message && typeof json.message === 'object') {
      const msg = json.message as Record<string, unknown>;
      if (Array.isArray(msg.content) && msg.content[0]?.text) {
        text = String(msg.content[0].text);
      }
    }
  }

  // Try to extract reset time from message like "resets at 10:30 am (PST)" or "resets 12am (America/Los_Angeles)"
  // Pattern matches: time, optional am/pm, optional timezone in parentheses
  const match = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:\(([^)]+)\))?/i);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3]?.toLowerCase();
    const timezoneStr = match[4]?.trim();

    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }

    const now = new Date();

    // Calculate reset time with timezone awareness
    let resetTime: Date;

    if (timezoneStr) {
      const tzOffset = getTimezoneOffset(timezoneStr);
      if (tzOffset !== null) {
        // Create reset time in the specified timezone
        // Convert "hours:minutes in timezone X" to UTC
        // Reset time in UTC: take the specified time and subtract the timezone offset
        const resetUTCHours = hours - tzOffset;

        resetTime = new Date();
        resetTime.setUTCHours(resetUTCHours, minutes, 0, 0);

        // If reset time is in the past, assume it's tomorrow
        if (resetTime <= now) {
          resetTime.setUTCDate(resetTime.getUTCDate() + 1);
        }
      } else {
        // Unknown timezone - fall back to local time
        console.log(`Unknown timezone "${timezoneStr}", using local time`);
        resetTime = new Date();
        resetTime.setHours(hours, minutes, 0, 0);
        if (resetTime <= now) {
          resetTime.setDate(resetTime.getDate() + 1);
        }
      }
    } else {
      // No timezone specified - assume local time (existing behavior)
      resetTime = new Date();
      resetTime.setHours(hours, minutes, 0, 0);
      if (resetTime <= now) {
        resetTime.setDate(resetTime.getDate() + 1);
      }
    }

    const msUntilReset = resetTime.getTime() - now.getTime();
    // Add 1 minute buffer
    return msUntilReset + 60000;
  }

  // Default: wait 5 minutes
  return 5 * 60 * 1000;
}

// Rate limit patterns for both Claude and Codex
const rateLimitPatterns = [
  // Common patterns
  /rate.?limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /usage.?limit/i,
  // Claude-specific
  /hit your limit/i,
  // Codex-specific
  /RateLimitError/i,
  /request limit reached/i,
  /exceeded.*quota/i,
];

// Check if an error message indicates a rate limit
export function isRateLimitError(text: string): boolean {
  return rateLimitPatterns.some(pattern => pattern.test(text));
}

// Rate limit retry configuration
export interface RateLimitRetryConfig {
  maxRetries: number;
}

export const DEFAULT_RETRY_CONFIG: RateLimitRetryConfig = {
  maxRetries: 3,
};

// Result type for operations that can be rate limited
export interface RateLimitableResult {
  rateLimited: boolean;
  retryAfterMs?: number;
}

// Execute an operation with automatic retry on rate limits
export async function executeWithRateLimitRetry<T extends RateLimitableResult>(
  operation: () => Promise<T>,
  config: RateLimitRetryConfig,
  agentName: string
): Promise<T> {
  let attempt = 0;

  while (true) {
    const result = await operation();

    if (!result.rateLimited) {
      return result;
    }

    attempt++;
    if (attempt >= config.maxRetries) {
      console.log(`[Rate Limit] ${agentName} rate limited ${attempt} times, max retries reached. Continuing...`);
      return result;
    }

    const waitMs = result.retryAfterMs || 5 * 60 * 1000;
    console.log(`[Rate Limit] ${agentName} rate limited (attempt ${attempt}/${config.maxRetries}). Waiting for reset...`);
    await handleRateLimit(waitMs);
    console.log(`[Rate Limit] Retrying ${agentName}...`);
  }
}
