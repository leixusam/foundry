# Oneshot: Add a warning that coding agents can make mistakes when we run foundry every time

**Issue**: F-54
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Added a safety warning banner that displays every time Foundry starts. The warning informs users that:
- Foundry uses AI coding agents (Claude Code, Codex) with code permissions
- Coding agents may make mistakes
- Actions could be harmful to the system
- Users should review changes before merging to production
- Running in a sandboxed environment or VM is recommended

## Files Changed

- `src/index.ts` - Added `displaySafetyWarning()` function and call it after the banner in `main()`

## Verification

- TypeScript: PASS
- Build: PASS
- Lint: N/A (no lint script)
- Tests: N/A (no test script)

## Notes

The warning is displayed immediately after the ASCII banner and before the update check notification. The warning uses box-drawing characters for a clear visual presentation that fits the terminal aesthetic of the project.
