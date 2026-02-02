# Oneshot: Improve the initial checking of Claude Code and Codex CLI existence

**Issue**: F-65
**Date**: 2026-02-01
**Status**: Complete

## What Was Done

Improved the CLI detection startup experience by providing real-time feedback as each CLI check completes. Previously, the checks for Claude Code and Codex ran sequentially with no user feedback during the 2-3 second detection period. Now:

1. The user sees "checking..." status while each CLI is being detected
2. As soon as each check completes, the result is displayed immediately
3. Uses `process.stdout.write` with carriage return (`\r`) to update the line in place

### Before
```
Detecting CLIs...
  Claude Code: ✓ installed
  Codex CLI:   ✗ not found
```
(All shown at once after ~2-3 seconds)

### After
```
Detecting CLIs...
  Claude Code: checking...    <- shown immediately
  Claude Code: ✓ installed    <- updates when Claude check completes
  Codex CLI:   checking...    <- shown immediately after Claude
  Codex CLI:   ✗ not found    <- updates when Codex check completes
```

## Files Changed

- `src/lib/setup.ts` - Modified `checkAndDisplayCliAvailability()` to display real-time status for each CLI check as it completes, instead of waiting for both checks to finish

## Verification

- TypeScript: PASS
- Build: PASS
- No tests or lint scripts configured in this project

## Notes

- The implementation uses `process.stdout.write()` with carriage return for in-place updates
- Extra spaces at the end of the status line ensure "checking..." is fully overwritten
- No changes needed to `cli-detection.ts` since individual functions were already properly separated
