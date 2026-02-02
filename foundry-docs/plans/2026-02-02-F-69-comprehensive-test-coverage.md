# Implementation Plan: Comprehensive Test Coverage for Foundry

**Issue**: F-69
**Date**: 2026-02-02
**Research**: `foundry-docs/research/2026-02-02-F-69-comprehensive-test-coverage.md`
**Specification**: N/A
**Status**: Ready for Implementation

## Overview

Add comprehensive unit test coverage across all Foundry modules. The project currently has only 11 tests covering 2 modules (~5% coverage). This plan defines a phased approach to achieve 70%+ overall coverage, prioritizing pure functions first, then modules requiring mocking.

## Success Criteria

- [ ] All new tests pass: `npm run test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint` (if available)
- [ ] Coverage target: 70%+ overall line coverage
- [ ] High priority modules: 90%+ coverage
- [ ] Medium priority modules: 70%+ coverage
- [ ] Test count increases from 11 to 80+ tests

## Phases

### Phase 1: Pure Functions - Rate Limit Module

**Goal**: Test the rate limiting utilities which are pure functions or have simple time dependencies.

**Changes**:
- `src/lib/__tests__/rate-limit.test.ts`: Create new test file

**Test Cases**:

1. `sleep()` - 2 tests
   - Returns a promise that resolves after specified time
   - Works with fake timers

2. `parseRateLimitReset()` - 10 tests
   - Parses "resets at 10:30 am (PST)" format
   - Parses "resets 12am (America/Los_Angeles)" format
   - Handles 12-hour time with PM
   - Handles 12-hour time with AM (midnight case)
   - Returns time in the future (rolls to next day if past)
   - Handles string input
   - Handles object input with `result` field
   - Handles object input with nested `message.content[0].text`
   - Returns default 5 minutes when no match
   - Adds 1-minute buffer to calculated time

3. `isRateLimitError()` - 8 tests
   - Detects "rate limit" (case insensitive)
   - Detects "too many requests"
   - Detects "quota exceeded"
   - Detects "usage limit"
   - Detects "hit your limit" (Claude-specific)
   - Detects "RateLimitError" (Codex-specific)
   - Detects "request limit reached"
   - Returns false for non-rate-limit errors

4. `handleRateLimit()` - 2 tests
   - Logs the wait time in minutes
   - Calls sleep with correct duration

5. `executeWithRateLimitRetry()` - 5 tests
   - Returns immediately if not rate limited
   - Retries on rate limit up to maxRetries
   - Returns after maxRetries exceeded
   - Uses retryAfterMs from result
   - Defaults to 5 minutes if no retryAfterMs

**Estimated Tests**: 27

**Verification**:
```bash
npm test -- src/lib/__tests__/rate-limit.test.ts
```

---

### Phase 2: Pure Functions - Loop Instance Name Module

**Goal**: Test the pod/loop name generation utilities which are fully deterministic.

**Changes**:
- `src/lib/__tests__/loop-instance-name.test.ts`: Create new test file

**Test Cases**:

1. `generatePodName()` - 4 tests
   - Returns format "adjective-animal"
   - Is deterministic for same timestamp (same second = same name)
   - Uses modulo to select from word lists
   - Produces different names for different seconds

2. `generateLoopInstanceName()` - 3 tests
   - Returns format "YYYYMMDD-HHMMSS-adjective-animal"
   - Timestamp is in UTC
   - Pod name portion matches `generatePodName()`

3. `getLoopInstanceNameDisplay()` - 5 tests
   - Extracts "adjective-animal" from new format "YYYYMMDD-HHMMSS-adjective-animal"
   - Extracts "adjective-animal" from old format "adjective-animal-YYYYMMDD-HHMMSS"
   - Handles legacy format "adjective-animal-unixTimestamp"
   - Returns full name if format unrecognized
   - Handles edge case of 2-part name

**Estimated Tests**: 12

**Verification**:
```bash
npm test -- src/lib/__tests__/loop-instance-name.test.ts
```

---

### Phase 3: Pure Functions - Attachment Downloader (URL Extraction)

**Goal**: Test the URL parsing and extraction functions which are pure (no I/O).

**Changes**:
- `src/lib/__tests__/attachment-downloader.test.ts`: Create new test file

**Test Cases**:

1. `extractLinearUrls()` - 10 tests
   - Extracts URL from markdown image syntax `![alt](url)`
   - Uses alt text as filename when it has extension
   - Falls back to URL path for filename
   - Handles multiple URLs in one string
   - Deduplicates URLs (returns unique set)
   - Generates unique ID from URL hash
   - Handles standalone URLs (not in markdown syntax)
   - Handles mixed markdown images and standalone URLs
   - Returns empty array for no matches
   - Decodes URL-encoded filenames

2. `parseAgent1Attachments()` - 5 tests
   - Extracts URLs from entire output
   - Marks section URLs as "attachment" source
   - Marks embedded URLs as "embedded" source
   - Deduplicates across sections
   - Handles output with no attachments section

3. `ensureAttachmentDir()` - 3 tests (requires fs mocking)
   - Creates directory if not exists
   - Returns correct path
   - Works when directory already exists

**Estimated Tests**: 18

**Verification**:
```bash
npm test -- src/lib/__tests__/attachment-downloader.test.ts
```

---

### Phase 4: Provider Factory Module

**Goal**: Test the provider registration and factory pattern.

**Changes**:
- `src/lib/__tests__/provider.test.ts`: Create new test file

**Test Cases**:

1. `registerClaudeProvider()` - 2 tests
   - Registers factory function
   - Allows re-registration

2. `registerCodexProvider()` - 2 tests
   - Registers factory function
   - Allows re-registration

3. `createProvider()` - 5 tests
   - Returns Claude provider when registered
   - Returns Codex provider when registered
   - Throws when Claude provider not registered
   - Throws when Codex provider not registered
   - Throws for unknown provider name

**Estimated Tests**: 9

**Verification**:
```bash
npm test -- src/lib/__tests__/provider.test.ts
```

---

### Phase 5: Stats Logger Module

**Goal**: Test the statistics tracking with mocked file system.

**Changes**:
- `src/lib/__tests__/stats-logger.test.ts`: Create new test file

**Test Cases**:

1. `initLoopStats()` - 2 tests
   - Sets current pod name and loop number
   - Records start time

2. `logAgentStats()` - 6 tests
   - Creates initial stats structure
   - Adds agent stats to current loop
   - Calculates loop totals
   - Calculates grand totals
   - Removes duplicate agent entries (retry case)
   - Sorts agents by number

3. `finalizeLoopStats()` - 2 tests
   - Sets completedAt timestamp
   - Does nothing if not initialized

4. `parseContextMetrics()` - 5 tests
   - Counts compaction events (type="system", subtype="compact_boundary")
   - Tracks max context percent from assistant messages
   - Handles non-JSON lines gracefully
   - Returns 0s for empty output
   - Handles malformed JSON

**Estimated Tests**: 15

**Verification**:
```bash
npm test -- src/lib/__tests__/stats-logger.test.ts
```

---

### Phase 6: Output Logger Module

**Goal**: Test the file-based output logging with mocked file system.

**Changes**:
- `src/lib/__tests__/output-logger.test.ts`: Create new test file

**Test Cases**:

1. `initLoopLogger()` - 2 tests
   - Sets current pod name and loop number
   - Allows re-initialization for new loop

2. `logAgentOutput()` - 4 tests
   - Creates directory if needed
   - Appends line to correct log file
   - Does nothing if not initialized
   - Handles file write errors silently

3. `logTerminalOutput()` - 4 tests
   - Creates directory if needed
   - Appends text to terminal log file
   - Does nothing if not initialized
   - Handles file write errors silently

4. `getCurrentOutputDir()` - 2 tests
   - Returns correct path when initialized
   - Returns null when not initialized

**Estimated Tests**: 12

**Verification**:
```bash
npm test -- src/lib/__tests__/output-logger.test.ts
```

---

### Phase 7: Config Module (Expand Existing)

**Goal**: Expand existing config tests to cover all environment variables and functions.

**Changes**:
- `src/lib/__tests__/config.test.ts`: Expand existing test file

**Test Cases (new)**:

1. `getRepoRoot()` - 3 tests
   - Returns git repo root when in repo
   - Falls back to cwd when not in repo
   - Handles execSync failure

2. `isGitRepository()` - 2 tests
   - Returns true when in git repo
   - Returns false when not in repo

3. `getConfig()` - Environment variable tests - 15 tests
   - `FOUNDRY_PROVIDER`: claude (default), codex
   - `FOUNDRY_CLAUDE_MODEL`: opus (default), sonnet, haiku
   - `FOUNDRY_MAX_ITERATIONS`: 0 (default/unlimited), positive number, invalid value
   - `FOUNDRY_RATE_LIMIT_MAX_RETRIES`: 3 (default), custom value
   - `FOUNDRY_GCP_AUTO_STOP`: false (default), true, "1"
   - `FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES`: 5 (default), custom value
   - `FOUNDRY_FULL_CHECK_INTERVAL_MINUTES`: 120 (default), custom value
   - `CODEX_REASONING_EFFORT`: high (default), low, medium, extra_high
   - Per-agent reasoning: `CODEX_AGENT1_REASONING`, `CODEX_AGENT2_REASONING`, `CODEX_AGENT3_REASONING`

4. `getConfig(reload)` - 2 tests
   - Returns cached config by default
   - Rebuilds config when reload=true

**Estimated Tests**: 22 (adding to existing 4)

**Verification**:
```bash
npm test -- src/lib/__tests__/config.test.ts
```

---

### Phase 8: CLI Detection Module

**Goal**: Test CLI availability detection with mocked execSync.

**Changes**:
- `src/lib/__tests__/cli-detection.test.ts`: Create new test file

**Test Cases**:

1. `isClaudeCliInstalled()` - 3 tests
   - Returns true when `claude --version` succeeds
   - Returns false when command fails
   - Handles timeout gracefully

2. `isCodexCliInstalled()` - 3 tests
   - Returns true when `codex --version` succeeds
   - Returns false when command fails
   - Handles timeout gracefully

3. `detectAvailableClis()` - 3 tests
   - Returns correct availability object
   - Both false when neither installed
   - Both true when both installed

4. `hasAnyCli()` - 4 tests
   - Returns true if claude available
   - Returns true if codex available
   - Returns true if both available
   - Returns false if neither available

**Estimated Tests**: 13

**Verification**:
```bash
npm test -- src/lib/__tests__/cli-detection.test.ts
```

---

### Phase 9: Git Utilities Module

**Goal**: Test git command wrappers with mocked execSync.

**Changes**:
- `src/lib/__tests__/git.test.ts`: Create new test file

**Test Cases**:

1. `gitPull()` - 3 tests
   - Returns true on success
   - Returns false on failure
   - Uses correct working directory

2. `getCurrentBranch()` - 3 tests
   - Returns branch name on success
   - Returns "unknown" on failure
   - Uses correct working directory

**Estimated Tests**: 6

**Verification**:
```bash
npm test -- src/lib/__tests__/git.test.ts
```

---

### Phase 10: Version Module

**Goal**: Test package.json reading with mocked file system.

**Changes**:
- `src/lib/__tests__/version.test.ts`: Create new test file

**Test Cases**:

1. `getVersion()` - 3 tests
   - Returns version from package.json
   - Returns "unknown" if file not found
   - Returns "unknown" if JSON parse fails

2. `getPackageName()` - 3 tests
   - Returns name from package.json
   - Returns "@leixusam/foundry" if file not found
   - Handles parse errors gracefully

**Estimated Tests**: 6

**Verification**:
```bash
npm test -- src/lib/__tests__/version.test.ts
```

---

### Phase 11: Linear Quick Check Module

**Goal**: Test Linear API integration with mocked @linear/sdk.

**Changes**:
- `src/lib/__tests__/linear-quick-check.test.ts`: Create new test file

**Test Cases**:

1. `checkForUncompletedTickets()` - 7 tests
   - Returns hasWork=true with ticket count when issues exist
   - Returns hasWork=false with count=0 when no issues
   - Filters by team key
   - Excludes completed and canceled states
   - Returns error object on API failure
   - Handles network errors
   - Second query gets count (up to 50)

**Estimated Tests**: 7

**Verification**:
```bash
npm test -- src/lib/__tests__/linear-quick-check.test.ts
```

---

## Testing Strategy

### Unit Tests (Primary Focus)
- Test pure functions directly with various inputs
- Mock external dependencies (fs, child_process, @linear/sdk)
- Use Vitest fake timers (`vi.useFakeTimers()`) for time-dependent tests
- Aim for edge cases and error conditions

### Mocking Patterns (From Existing Tests)
```typescript
// Module mocking
vi.mock('fs', () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }));

// Environment variable testing
const originalEnv = process.env;
beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});
afterEach(() => {
  process.env = originalEnv;
});

// Typed mock functions
const mockFn = vi.mocked(someFunction);
```

### Test File Structure
```
src/lib/__tests__/
├── config.test.ts              (expand existing)
├── prompts.test.ts             (existing, no changes)
├── rate-limit.test.ts          (new - Phase 1)
├── loop-instance-name.test.ts  (new - Phase 2)
├── attachment-downloader.test.ts (new - Phase 3)
├── provider.test.ts            (new - Phase 4)
├── stats-logger.test.ts        (new - Phase 5)
├── output-logger.test.ts       (new - Phase 6)
├── cli-detection.test.ts       (new - Phase 8)
├── git.test.ts                 (new - Phase 9)
├── version.test.ts             (new - Phase 10)
└── linear-quick-check.test.ts  (new - Phase 11)
```

## Coverage Configuration

Add coverage configuration to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

Add script to `package.json`:
```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Count Summary

| Phase | Module | New Tests |
|-------|--------|-----------|
| 1 | rate-limit | 27 |
| 2 | loop-instance-name | 12 |
| 3 | attachment-downloader | 18 |
| 4 | provider | 9 |
| 5 | stats-logger | 15 |
| 6 | output-logger | 12 |
| 7 | config (expand) | 22 |
| 8 | cli-detection | 13 |
| 9 | git | 6 |
| 10 | version | 6 |
| 11 | linear-quick-check | 7 |
| **Total** | | **147** |

Starting from 11 existing tests, the total will be **~158 tests**.

## Rollback Plan

All changes are additive (new test files) with one exception (expanding config.test.ts). To rollback:

1. Delete newly created test files in `src/lib/__tests__/`
2. Revert changes to `vitest.config.ts` if coverage config was added
3. Revert changes to `package.json` if test:coverage script was added
4. Restore original `config.test.ts` if needed

Since tests don't affect production code, rollback risk is minimal.

## Notes

### Dependencies
- No new dependencies needed - Vitest provides all required functionality
- `@vitest/coverage-v8` may need to be installed for coverage reports

### Private Functions
Some private functions (e.g., `sanitizeFilename` in attachment-downloader) should be tested indirectly through public APIs rather than exported for testing.

### Time-Sensitive Tests
Use `vi.useFakeTimers()` and `vi.setSystemTime()` for:
- `parseRateLimitReset()` tests
- `generatePodName()` tests (uses Unix timestamp)
- `sleep()` and `handleRateLimit()` tests

### CI Integration
Consider adding coverage checks to CI pipeline after implementation:
```yaml
- run: npm run test:coverage
- run: npx vitest run --coverage.enabled --coverage.thresholds.lines=70
```
