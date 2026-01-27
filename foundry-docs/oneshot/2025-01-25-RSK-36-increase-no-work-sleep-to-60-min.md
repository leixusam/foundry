# Oneshot: Change no-work wait period from 15 minutes to 1 hour

**Issue**: RSK-36
**Date**: 2025-01-25
**Status**: Complete

## What Was Done

Changed the `noWorkSleepMinutes` configuration value from 15 to 60 minutes. This is the time Ralph waits before checking for new issues when there are no more issues to work on.

## Files Changed

- `ralph/src/config.ts` - Updated `noWorkSleepMinutes` default value from 15 to 60

## Verification

- Tests: N/A (no test suite)
- TypeScript: PASS
- Build: PASS
- Lint: N/A (no lint script)

## Notes

- The change follows the same pattern as RSK-12, which previously changed this value from 5 minutes to 15 minutes
- This is a simple config change with no behavioral impact beyond the wait time
- The value is used in `ralph/src/index.ts:84-85` where it logs "Sleeping X minutes..." and then sleeps for `noWorkSleepMinutes * 60 * 1000` milliseconds
