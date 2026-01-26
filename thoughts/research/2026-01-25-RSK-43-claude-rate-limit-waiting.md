# Research: Implements waiting for Claude 5 hour session token limit to reset

**Issue**: RSK-43
**Date**: 2026-01-25
**Status**: Complete

## Summary

Ralph needs to detect when Claude (or Codex) hits usage limits and wait for them to reset rather than failing. The existing TypeScript implementation has partial rate limit detection but doesn't implement the full waiting logic from `ralph.sh`. This task requires enhancing the rate limit handling to parse reset times from error messages and wait appropriately.

## Requirements Analysis

### From the Issue Description
1. **5-hour limit**: A rolling window token limit that resets after 5 hours
2. **Weekly limit**: A longer-term usage cap that resets weekly
3. Parse reset time from the LLM response
4. Wait for the reset rather than failing

### Rate Limit Message Formats

From analysis of `ralph.sh`, Claude rate limit messages contain:
- Text like `"You've hit your limit"` or `"hit your limit"`
- Reset time in format like `"resets 12am"` or `"resets at 10:30pm"`
- Timezone in parentheses like `"(PST)"` or `"(America/Los_Angeles)"`

Example message patterns:
```
You've hit your limit · resets 12am (PST)
You've hit your limit · resets at 10:30pm (America/Los_Angeles)
```

## Codebase Analysis

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `ralph/src/lib/rate-limit.ts:14-60` | Rate limit parsing and handling | Enhance `parseRateLimitReset()` to handle timezone-aware time parsing |
| `ralph/src/lib/rate-limit.ts:63-79` | Rate limit pattern detection | Already comprehensive, may need minor updates |
| `ralph/src/lib/claude.ts:243-258` | Rate limit detection in Claude output | Already detects rate limits correctly |
| `ralph/src/index.ts:92-95,199-200,297-298` | Rate limit handling per agent | Only calls `handleRateLimit()` and returns, needs to retry |
| `ralph/ralph.sh:566-668` | Complete bash implementation | Reference for waiting logic |

### Existing Implementation Analysis

**What's Already Done:**
1. `isRateLimitError()` correctly detects rate limit patterns
2. `parseRateLimitReset()` extracts reset time (but lacks timezone support)
3. `handleRateLimit()` logs and sleeps for the computed duration
4. Both Claude and Codex providers set `rateLimited: true` and `retryAfterMs` on rate limit detection
5. Main loop in `index.ts` handles rate limits by sleeping and returning (skipping to next iteration)

**What's Missing:**
1. **Timezone-aware time parsing** - The current `parseRateLimitReset()` doesn't handle timezone specifiers in the message
2. **Waiting behavior** - Current implementation sleeps then starts a new iteration. The bash script logic retries the same agent within the current iteration
3. **Weekly limit handling** - No special logic for detecting/handling weekly limits vs 5-hour limits

### Existing Patterns

The bash script uses this approach:
```bash
# 1. Detect rate limit by checking JSON output for specific patterns
# 2. Extract reset time string (e.g., "12am")
# 3. Extract timezone (e.g., "PST")
# 4. Calculate epoch timestamp for reset
# 5. Add 1 minute buffer
# 6. Sleep until that time
# 7. Continue the same loop iteration
```

The TypeScript already follows a similar pattern but with gaps in timezone handling.

### Dependencies

- Native JavaScript `Date` API for time calculations
- No external timezone library currently used
- `process.env.TZ` could potentially be used but is unreliable across platforms

## Implementation Considerations

### Approach

**Recommended Approach: Enhance existing implementation**

1. **Improve `parseRateLimitReset()`**:
   - Add timezone extraction from message
   - Calculate proper reset time considering timezone offset
   - Handle both "12am" and "10:30pm" formats
   - Add 1-minute buffer after reset time

2. **Update main loop behavior**:
   - When rate limited, wait and retry the same agent instead of moving to next iteration
   - Add retry counter to prevent infinite retry loops
   - Consider whether to save partial progress before waiting

3. **Add weekly limit detection** (optional):
   - Weekly limits might have different message patterns
   - May need longer wait times

### Timezone Handling

The bash script uses system `date` command with `TZ` environment variable. In Node.js, options include:

1. **Simple approach**: Assume the reset time is in the user's local timezone (may be inaccurate if Ralph runs in different timezone than Claude's server)

2. **Better approach**: Parse the timezone from the message and calculate offset:
   - Common timezone abbreviations: PST, PDT, EST, EDT, etc.
   - IANA timezone names: America/Los_Angeles, etc.
   - Use a mapping table for common abbreviations

3. **Most robust**: Use a timezone library like `luxon` or `date-fns-tz` (adds dependency)

**Recommendation**: Start with approach #2 (timezone mapping table) as it doesn't require new dependencies and covers most common cases.

### Risks

1. **Timezone parsing edge cases**: Daylight saving time transitions, unusual timezone abbreviations
2. **Message format changes**: If Claude changes how it reports rate limits, parsing may break
3. **Infinite retry loops**: If rate limit persists, need a max retry count
4. **Partial work loss**: If rate limited mid-agent, any uncommitted progress may be lost
5. **Testing difficulty**: Hard to simulate rate limits in tests

### Testing Strategy

1. **Unit tests for `parseRateLimitReset()`**:
   - Test various time formats: "12am", "10:30pm", "midnight"
   - Test with different timezones
   - Test edge cases: past times (should be next day), invalid formats

2. **Integration test mock**:
   - Mock Claude/Codex response to simulate rate limit
   - Verify waiting behavior is triggered
   - Verify retry behavior

3. **Manual testing**:
   - Actually trigger a rate limit (may be difficult)
   - Verify the wait duration is reasonable
   - Verify the retry succeeds after wait

## Specification Assessment

**Needs Specification**: No

This is a backend/infrastructure change with no user-facing UX components. The behavior is clearly defined:
- Detect rate limit
- Parse reset time
- Wait until reset + buffer
- Retry

## Questions for Human Review

1. **Retry strategy**: Should Ralph retry the same agent operation after waiting, or skip to the next iteration? (Bash script retries same operation)

2. **Max retries**: How many times should Ralph retry before giving up on a single iteration?

3. **Weekly limit handling**: Should there be special handling for weekly limits (longer waits, notifications)?

4. **Timezone handling**: Is a simple timezone mapping table sufficient, or should we add a proper timezone library?

5. **Progress preservation**: When rate limited mid-agent, should any partial progress be preserved?

## Next Steps

Ready for planning phase. Key implementation tasks:

1. Enhance `parseRateLimitReset()` with timezone support
2. Add timezone mapping table for common abbreviations
3. Update main loop to retry after rate limit wait (instead of new iteration)
4. Add max retry counter
5. Add unit tests for time parsing
6. Update documentation
