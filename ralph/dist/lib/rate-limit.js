// Rate limit detection and handling utilities
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function handleRateLimit(retryAfterMs) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    console.log(`Rate limited. Sleeping ${minutes} minute(s)...`);
    await sleep(retryAfterMs);
}
// Parse rate limit reset time from Claude error messages
export function parseRateLimitReset(jsonOrText) {
    let text = '';
    if (typeof jsonOrText === 'string') {
        text = jsonOrText;
    }
    else if (jsonOrText && typeof jsonOrText === 'object') {
        const json = jsonOrText;
        text = String(json.result || '');
        if (!text && json.message && typeof json.message === 'object') {
            const msg = json.message;
            if (Array.isArray(msg.content) && msg.content[0]?.text) {
                text = String(msg.content[0].text);
            }
        }
    }
    // Try to extract reset time from message like "resets at 10:30 am"
    const match = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3]?.toLowerCase();
        if (period === 'pm' && hours !== 12) {
            hours += 12;
        }
        else if (period === 'am' && hours === 12) {
            hours = 0;
        }
        const now = new Date();
        const resetTime = new Date();
        resetTime.setHours(hours, minutes, 0, 0);
        // If reset time is in the past, assume it's tomorrow
        if (resetTime <= now) {
            resetTime.setDate(resetTime.getDate() + 1);
        }
        const msUntilReset = resetTime.getTime() - now.getTime();
        // Add 1 minute buffer
        return msUntilReset + 60000;
    }
    // Default: wait 5 minutes
    return 5 * 60 * 1000;
}
// Check if an error message indicates a rate limit
export function isRateLimitError(text) {
    const rateLimitPatterns = [
        /rate.?limit/i,
        /hit your limit/i,
        /too many requests/i,
        /quota exceeded/i,
        /usage.?limit/i,
    ];
    return rateLimitPatterns.some(pattern => pattern.test(text));
}
//# sourceMappingURL=rate-limit.js.map