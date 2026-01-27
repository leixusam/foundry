# Research + Implementation: Remove safety net and unused parser code

**Issue**: RSK-32
**Date**: 2026-01-25
**Mode**: Fast-Track (Straightforward Task)
**Status**: Implemented - Awaiting Validation

## Task Summary

Clean up code that is no longer needed:
1. Safety net functionality (auto-commit/push of uncommitted changes) - no longer needed with branch-per-issue workflow
2. Structured output parsers - built but never used; agents communicate via raw text

## Straightforward Assessment

- Files changed: 4 (<=5 check)
- Scope: Pure deletion of dead code (clear check)
- Dependencies: None (check)
- Breaking changes: No (check)
- New patterns: No - only deletion (check)
- Security impact: None (check)
- Migrations: None (check)

## Implementation Details

### Files Changed

1. **`ralph/src/lib/git.ts`** - Removed `gitSafetyNetPush()` function (52 lines)
   - Kept `gitPull()` and `getCurrentBranch()` which are still used
   - Removed import of `SafetyNetResult` type

2. **`ralph/src/lib/parsers.ts`** - Deleted entire file (~311 lines)
   - Removed `parseDispatchResult()` - never called
   - Removed `parseWorkResult()` - never called
   - Removed `parseLinearUpdate()` - never called

3. **`ralph/src/index.ts`** - Removed safety net integration
   - Removed `gitSafetyNetPush` from import
   - Removed safety net section after Agent 3 (lines 190-199)

4. **`ralph/src/types.ts`** - Removed unused type interfaces
   - Removed `DispatchResult` interface
   - Removed `WorkResult` interface
   - Removed `SubIssueRecommendation` interface
   - Removed `LinearUpdateResult` interface
   - Removed `SafetyNetResult` interface
   - Removed "Agent output types" and "Git types" section headers

### Approach

Direct deletion of dead code. The ticket provided precise line numbers and function names, which were verified and found to be accurate. Changes were minimal and focused - only removed what was specified.

## Verification Results

- TypeScript: PASS (`npm run typecheck` - no errors)
- Build: PASS (`npm run build` - compiles successfully)
- Orphaned imports: NONE (verified with grep for deleted types/functions)

## Success Criteria for Validation

- [x] `gitSafetyNetPush()` function removed
- [x] Safety net no longer called in main loop
- [x] `parsers.ts` file deleted
- [x] Unused type interfaces removed
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] No orphaned imports

## Notes

- The prerequisite RSK-29 (branch-per-issue workflow) was already completed
- With branch-per-issue, if Agent 2 crashes, partial work stays on the feature branch rather than polluting main
- The parsers were designed for structured output parsing but agents use raw text successfully
- Total lines removed: ~370 lines of dead code
