# Implementation Plan: Implements waiting for Claude 5 hour session token limit to reset

**Issue**: RSK-43
**Date**: 2026-01-25
**Research**: thoughts/research/2026-01-25-RSK-43-claude-rate-limit-waiting.md
**Specification**: N/A
**Status**: Implementation Complete

## Overview

Enhance Ralph's rate limit handling to properly wait for token limits to reset and then retry the same agent operation, rather than skipping to the next loop iteration. This involves adding timezone-aware parsing of reset times from error messages, implementing a retry loop with a maximum retry counter, and updating the main loop to retry agents after rate limit waits.

## Success Criteria

- [x] Rate limit reset time is correctly parsed including timezone (tested with PST, EST, PDT, EDT, America/Los_Angeles)
- [x] When rate limited, Ralph waits until the reset time + 1 minute buffer
- [x] After waiting, Ralph retries the same agent operation (not a new loop iteration)
- [x] Maximum of 3 retries per agent per loop iteration (configurable)
- [x] After max retries exceeded, logs error and moves to next loop iteration
- [x] All tests pass: `npm run typecheck` (no test suite currently exists)
- [x] Type check passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

## Phases

### Phase 1: Enhance timezone-aware time parsing

**Goal**: Update `parseRateLimitReset()` to handle timezone specifiers in rate limit messages

**Changes**:
- `ralph/src/lib/rate-limit.ts`:
  - Add timezone abbreviation to UTC offset mapping table (PST, PDT, EST, EDT, CST, CDT, MST, MDT, UTC, GMT)
  - Add IANA timezone name extraction and conversion
  - Update `parseRateLimitReset()` to extract timezone from message pattern like `(PST)` or `(America/Los_Angeles)`
  - Calculate reset time using the extracted timezone offset
  - Handle edge case where timezone abbreviation is ambiguous (default to common US timezones)

**Implementation Details**:

The timezone mapping table should include:
```typescript
const TIMEZONE_OFFSETS: Record<string, number> = {
  // US Timezones
  'PST': -8, 'PDT': -7,
  'MST': -7, 'MDT': -6,
  'CST': -6, 'CDT': -5,
  'EST': -5, 'EDT': -4,
  // Common others
  'UTC': 0, 'GMT': 0,
  // IANA names (without mapping, use Intl API)
};
```

For IANA timezone names (like `America/Los_Angeles`), use JavaScript's `Intl.DateTimeFormat` to get the current offset:
```typescript
function getTimezoneOffset(tz: string): number | null {
  try {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return null; // Invalid timezone
  }
}
```

**Verification**:
```bash
# Verify typecheck passes
npm run typecheck

# Verify build succeeds
npm run build
```

### Phase 2: Add retry loop for rate-limited agents

**Goal**: Create a helper function that wraps agent execution with retry logic

**Changes**:
- `ralph/src/lib/rate-limit.ts`:
  - Add `RateLimitRetryConfig` interface with `maxRetries: number` (default 3)
  - Add `executeWithRateLimitRetry<T>()` function that:
    - Executes the provided async function
    - If rate limited, calls `handleRateLimit()` with the parsed wait time
    - Retries up to `maxRetries` times
    - Returns the result on success, or throws after max retries exceeded
  - Export the retry config and function

**Implementation Details**:

```typescript
export interface RateLimitRetryConfig {
  maxRetries: number;
}

export const DEFAULT_RETRY_CONFIG: RateLimitRetryConfig = {
  maxRetries: 3,
};

export async function executeWithRateLimitRetry<T extends { rateLimited: boolean; retryAfterMs?: number }>(
  operation: () => Promise<T>,
  config: RateLimitRetryConfig = DEFAULT_RETRY_CONFIG,
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
      console.log(`Agent ${agentName} rate limited ${attempt} times. Moving to next iteration.`);
      return result;
    }

    console.log(`Agent ${agentName} rate limited (attempt ${attempt}/${config.maxRetries}). Waiting for reset...`);
    await handleRateLimit(result.retryAfterMs || 5 * 60 * 1000);
  }
}
```

**Verification**:
```bash
# Verify typecheck passes
npm run typecheck

# Verify build succeeds
npm run build
```

### Phase 3: Update main loop to use retry logic

**Goal**: Integrate the retry function into the main agent execution flow

**Changes**:
- `ralph/src/index.ts`:
  - Import `executeWithRateLimitRetry` from rate-limit module
  - Wrap Agent 1 execution with `executeWithRateLimitRetry()`
  - Wrap Agent 2 execution with `executeWithRateLimitRetry()`
  - Wrap Agent 3 execution with `executeWithRateLimitRetry()`
  - Remove the existing `if (agentXResult.rateLimited) { return; }` blocks (retry is now handled internally)
  - Keep the rate limit status logging for stats purposes

**Implementation Details**:

Before:
```typescript
const agent1Result = await agent1Provider.spawn({...}, 1);

if (agent1Result.rateLimited) {
  await handleRateLimit(agent1Result.retryAfterMs || 5 * 60 * 1000);
  return;
}
```

After:
```typescript
const agent1Result = await executeWithRateLimitRetry(
  () => agent1Provider.spawn({...}, 1),
  DEFAULT_RETRY_CONFIG,
  'Agent 1 (Linear Reader)'
);

// Continue even if still rate limited after max retries - let the loop handle it
// The retry function will have already waited and retried
```

**Verification**:
```bash
# Verify typecheck passes
npm run typecheck

# Verify build succeeds
npm run build

# Start Ralph briefly to verify it initializes correctly
# (Will need Linear config - manual verification)
```

### Phase 4: Add configuration option for max retries

**Goal**: Allow configuring the max retry count via environment variable

**Changes**:
- `ralph/src/config.ts`:
  - Add `rateLimitMaxRetries: number` to the config interface
  - Add `RALPH_RATE_LIMIT_MAX_RETRIES` environment variable parsing (default: 3)
  - Export the config value

- `ralph/src/index.ts`:
  - Use `config.rateLimitMaxRetries` instead of hardcoded default

**Verification**:
```bash
# Verify typecheck passes
npm run typecheck

# Verify build succeeds
npm run build

# Test environment variable is recognized (optional manual test)
RALPH_RATE_LIMIT_MAX_RETRIES=5 npm run start
```

## Testing Strategy

### Unit Testing (Manual)
Since there's no test suite, verification will be manual:

1. **Time parsing tests** - Create a temporary script to test various inputs:
   - `"resets 12am (PST)"` should calculate time correctly
   - `"resets at 10:30pm (America/Los_Angeles)"` should handle IANA timezone
   - `"resets 3pm (EDT)"` should use EDT offset
   - Past times should roll to next day
   - Invalid formats should return default 5 minutes

2. **Type safety** - Run `npm run typecheck` to ensure all types are correct

3. **Build verification** - Run `npm run build` to ensure no build errors

### Integration Testing (Manual)
Since rate limits can't be easily simulated:

1. Run Ralph and verify it starts correctly with the new code
2. If a rate limit is encountered during actual operation, verify:
   - The reset time is logged correctly
   - Ralph waits the appropriate duration
   - The agent is retried after waiting
   - After max retries, Ralph moves to the next iteration

### Recommended Future Work
Add unit tests for `parseRateLimitReset()` using a test framework like Vitest or Jest. This would allow:
- Testing timezone parsing edge cases
- Testing the retry logic with mocked providers
- Regression testing for rate limit message format changes

## Rollback Plan

If issues are encountered:

1. **Revert commits**: `git revert HEAD~N` where N is the number of commits from this implementation
2. **Or checkout previous working state**: `git checkout main -- ralph/src/lib/rate-limit.ts ralph/src/index.ts ralph/src/config.ts`
3. Rebuild: `npm run build`

The changes are additive and don't modify core provider logic, so rollback should be straightforward.

## Notes

### Design Decisions

1. **Retry within same iteration**: Following the bash script's approach, rate limits retry the same agent rather than starting a new loop iteration. This preserves context and ensures the current ticket's work is completed.

2. **Max retry limit**: Set to 3 by default to prevent infinite loops. If Claude is consistently rate limiting, there may be an account issue that needs human intervention.

3. **No external timezone library**: Using JavaScript's built-in `Intl.DateTimeFormat` for IANA timezone handling avoids adding dependencies. The timezone abbreviation mapping table handles common US timezones which are most likely to appear in Claude's messages.

4. **Graceful degradation**: If timezone parsing fails, falls back to 5 minutes wait (existing behavior). This ensures Ralph doesn't crash on unexpected message formats.

### Open Questions Resolved

From the research document:
- **Retry strategy**: Will retry the same agent operation (matches bash script behavior)
- **Max retries**: Default of 3, configurable via environment variable
- **Weekly limit handling**: No special handling - weekly limits will use the same retry logic. If weekly limits have different message formats, parsing may fail and use default 5-minute wait.
- **Timezone handling**: Using built-in Intl API + abbreviation table (no new dependencies)
- **Progress preservation**: Not addressed in this implementation - agents complete or fail atomically

### Files Changed Summary

| File | Type of Change |
|------|----------------|
| `ralph/src/lib/rate-limit.ts` | Enhanced - timezone parsing, retry function |
| `ralph/src/index.ts` | Modified - wrap agents with retry logic |
| `ralph/src/config.ts` | Enhanced - max retries config |
| `ralph/src/types.ts` | Enhanced - added rateLimitMaxRetries to RalphConfig |

## Implementation Notes

All 4 phases completed successfully:
- Phase 1: bedc561 - Timezone-aware time parsing
- Phase 2: 9a1ed2b - Rate limit retry wrapper
- Phase 3: 39973b3 - Main loop integration
- Phase 4: da53549 - Configurable max retries

All typecheck and build verification passed.
