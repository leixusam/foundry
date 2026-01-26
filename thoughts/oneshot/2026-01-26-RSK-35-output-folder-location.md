# Oneshot: Output files are not in the right folder

**Issue**: RSK-35
**Date**: 2026-01-26
**Status**: Complete

## What Was Done

Relocated Ralph's output folder from project root `.ralph/output/` to `ralph/.output/` and updated the pod naming format to prefix with timestamp for better sorting.

### Changes Made:

1. **Output folder location**: Changed from `.ralph/output/` to `ralph/.output/`
   - Ralph is designed as a plugin added to project folders
   - Keeping outputs inside `ralph/` keeps the parent project root clean
   - Makes Ralph installation self-contained

2. **Pod naming format**: Changed from `{adjective}-{animal}-{timestamp}` to `{timestamp}-{adjective}-{animal}`
   - Old format: `calm-pegasus-20250125-143052`
   - New format: `20250125-143052-calm-pegasus`
   - Timestamp prefix enables chronological sorting in file explorers

3. **Backwards compatibility**: Updated `getLoopInstanceNameDisplay()` to handle both old and new formats

## Files Changed

- `ralph/src/lib/output-logger.ts` - Updated output directory path from `.ralph/output` to `ralph/.output`
- `ralph/src/lib/loop-instance-name.ts` - Updated name format to prefix with timestamp, updated display function for backwards compatibility
- `.gitignore` - Updated to gitignore `ralph/.output/` instead of `.ralph/output/`
- `ralph/CLAUDE.md` - Updated documentation for new output location and naming format

## Verification

- TypeScript: PASS
- Build: PASS
- Tests: N/A (no test suite configured)

## Notes

- The `getLoopInstanceNameDisplay()` function maintains backwards compatibility with three name formats:
  1. Current: `20250125-143052-calm-pegasus` (timestamp-adjective-animal)
  2. Old: `calm-pegasus-20250125-143052` (adjective-animal-timestamp)
  3. Legacy: `red-giraffe-1706223456` (adjective-animal-unixTimestamp)

- Output folder structure: `ralph/.output/{loop-name}/{loop-number}/agent-{n}.log`
