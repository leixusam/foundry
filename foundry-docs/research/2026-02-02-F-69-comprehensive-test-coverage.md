# Research: Comprehensive Test Coverage for Foundry

**Issue**: F-69
**Date**: 2026-02-02
**Status**: Complete

## Summary

This research documents the current testing infrastructure in Foundry and provides a comprehensive plan for adding test coverage across all modules. The project currently has minimal test coverage (2 test files covering only config and prompts modules). A comprehensive test suite is needed to ensure reliability of the autonomous agent system.

## Requirements Analysis

The ticket requests "comprehensive test coverage for how project works today." Based on the attached research document (2026-02-02-foundry-implementation-overview.md), this means testing:

1. The core agent pipeline (provider abstraction, spawning)
2. Rate limiting and retry logic
3. Configuration management
4. Prompt loading and templating
5. Statistics and output logging
6. Linear integration (quick check)
7. Attachment downloading
8. Utility functions (loop names, git, CLI detection)

## Current Test Infrastructure

### Existing Setup
- **Test Framework**: Vitest v4.0.18
- **Configuration**: `vitest.config.ts` with `environment: 'node'`
- **Test Pattern**: `src/**/*.test.ts`
- **Commands**: `npm test` (run) and `npm run test:watch` (watch mode)

### Existing Tests
Only 2 test files exist:
1. `src/lib/__tests__/config.test.ts` - Tests merge mode configuration (4 tests)
2. `src/lib/__tests__/prompts.test.ts` - Tests prompt loading and templating (7 tests)

Total: **11 tests** covering approximately 5% of the codebase.

## Codebase Analysis

### Modules Requiring Test Coverage

| Module | File | Testability | Priority | Notes |
|--------|------|-------------|----------|-------|
| Rate Limiting | `src/lib/rate-limit.ts` | High | High | Pure functions, easy to test |
| Loop Instance Name | `src/lib/loop-instance-name.ts` | High | High | Pure functions, deterministic |
| Provider Factory | `src/lib/provider.ts` | Medium | High | Factory pattern, needs mocking |
| Stats Logger | `src/lib/stats-logger.ts` | Medium | Medium | File I/O, needs mocking |
| Output Logger | `src/lib/output-logger.ts` | Medium | Medium | File I/O, needs mocking |
| Attachment Downloader | `src/lib/attachment-downloader.ts` | Medium | Medium | URL parsing is pure, download needs mocking |
| Config | `src/config.ts` | High | High | Partially tested, needs more coverage |
| Prompts | `src/lib/prompts.ts` | High | Medium | Already tested |
| Linear Quick Check | `src/lib/linear-quick-check.ts` | Low | Medium | External API, needs heavy mocking |
| CLI Detection | `src/lib/cli-detection.ts` | Medium | Low | Exec calls, needs mocking |
| Git Utils | `src/lib/git.ts` | Medium | Low | Exec calls, needs mocking |
| Version | `src/lib/version.ts` | High | Low | Simple file read |
| Claude Provider | `src/lib/claude.ts` | Low | Low | Spawns external CLI |
| Codex Provider | `src/lib/codex.ts` | Low | Low | Spawns external CLI |
| Main Loop | `src/index.ts` | Low | Low | Integration-level, complex setup |

### Relevant Files to Test

#### High Priority (Pure Functions)

**`src/lib/rate-limit.ts`**
- `parseRateLimitReset(jsonOrText)` - Extracts reset time from error messages
- `isRateLimitError(text)` - Pattern matching for rate limit errors
- `sleep()` and `handleRateLimit()` - Can test with mocked timers
- `executeWithRateLimitRetry()` - Retry logic

**`src/lib/loop-instance-name.ts`**
- `generatePodName()` - Deterministic name generation
- `generateLoopInstanceName()` - Full name with timestamp
- `getLoopInstanceNameDisplay()` - Extracts display name from full name

**`src/lib/attachment-downloader.ts`**
- `extractLinearUrls(markdown)` - URL extraction from markdown
- `parseAgent1Attachments(output)` - Parsing attachment metadata
- `ensureAttachmentDir(identifier)` - Directory creation
- `sanitizeFilename()` (private but testable via exports)

#### Medium Priority (Requires Mocking)

**`src/lib/stats-logger.ts`**
- `initLoopStats()`, `logAgentStats()`, `finalizeLoopStats()`
- `parseContextMetrics()` - Can be tested with sample JSON

**`src/lib/output-logger.ts`**
- `initLoopLogger()`, `logAgentOutput()`, `logTerminalOutput()`

**`src/lib/provider.ts`**
- `registerClaudeProvider()`, `registerCodexProvider()`
- `createProvider()` - Factory function

**`src/config.ts` (expand existing)**
- `getRepoRoot()` - Git command execution
- `isGitRepository()` - Git detection
- `getConfig()` with various environment variables
- All the private `get*()` helper functions

### Existing Patterns

The existing tests show established patterns:
1. Use `vi.mock()` for module mocking
2. Use `vi.resetModules()` and dynamic imports for env var testing
3. Store and restore `process.env` in beforeEach/afterEach
4. Use `vi.mocked()` for typed mock functions

### Dependencies

Current test dependencies in `package.json`:
- `vitest: ^4.0.18`

No additional test libraries are needed. Vitest provides:
- Built-in mocking (`vi.mock`, `vi.fn`, `vi.spyOn`)
- Fake timers (`vi.useFakeTimers`)
- Snapshot testing
- Code coverage

## Implementation Considerations

### Approach

The recommended approach is to add tests incrementally by module priority:

**Phase 1: High Priority Pure Functions**
1. `rate-limit.test.ts` - Rate limit parsing and detection
2. `loop-instance-name.test.ts` - Name generation and parsing
3. `attachment-downloader.test.ts` - URL extraction and parsing

**Phase 2: Medium Priority with Mocking**
4. `provider.test.ts` - Provider factory registration
5. `stats-logger.test.ts` - Stats tracking (with fs mocking)
6. `output-logger.test.ts` - Output logging (with fs mocking)
7. Expand `config.test.ts` - Additional configuration options

**Phase 3: Lower Priority**
8. `cli-detection.test.ts` - CLI availability (with execSync mocking)
9. `git.test.ts` - Git utilities (with execSync mocking)
10. `version.test.ts` - Version reading
11. `linear-quick-check.test.ts` - Linear API (with @linear/sdk mocking)

### File Structure

```
src/lib/__tests__/
├── config.test.ts          (existing, expand)
├── prompts.test.ts         (existing)
├── rate-limit.test.ts      (new)
├── loop-instance-name.test.ts (new)
├── attachment-downloader.test.ts (new)
├── provider.test.ts        (new)
├── stats-logger.test.ts    (new)
├── output-logger.test.ts   (new)
├── cli-detection.test.ts   (new)
├── git.test.ts             (new)
├── version.test.ts         (new)
└── linear-quick-check.test.ts (new)
```

### Risks

1. **Time sensitivity**: `parseRateLimitReset()` depends on current time for calculating wait durations. Use `vi.useFakeTimers()` with a fixed date.

2. **External dependencies**: Linear SDK, file system, child_process all need mocking. The existing tests already demonstrate fs mocking patterns.

3. **Module initialization**: Some modules (config.ts) run code at import time. Tests need `vi.resetModules()` to get fresh imports.

4. **Private functions**: Some useful functions to test are not exported (e.g., `sanitizeFilename` in attachment-downloader). Consider exporting for testability or testing indirectly through public functions.

### Testing Strategy

**Unit Tests** (primary focus):
- Test pure functions directly with various inputs
- Mock external dependencies (fs, child_process, @linear/sdk)
- Use fake timers for time-dependent tests
- Aim for edge cases and error conditions

**Integration Tests** (future consideration):
- The main loop (`src/index.ts`) is complex and would benefit from integration tests
- Provider spawning could be tested against actual CLIs in CI
- These are out of scope for initial test coverage

### Test Coverage Goals

Initial target: **70% line coverage** across unit-testable modules
- High priority modules: 90%+ coverage
- Medium priority modules: 70%+ coverage
- Low priority modules: Basic happy path coverage

## Specification Assessment

This feature does NOT need a UX specification because:
- Pure backend/infrastructure changes with no user-facing impact
- Adding tests does not affect user experience
- Following standard testing patterns

**Needs Specification**: No

## Questions for Human Review

1. Should we add coverage reporting to CI/CD pipeline?
2. Any specific edge cases or scenarios that should be prioritized?
3. Should we configure coverage thresholds to enforce minimum coverage?
4. Are there any modules that should NOT be tested (intentionally low coverage)?

## Next Steps

Ready for planning phase. The implementation plan will detail:
- Exact test cases for each module
- Estimated test count per module
- Order of implementation
- Coverage configuration
