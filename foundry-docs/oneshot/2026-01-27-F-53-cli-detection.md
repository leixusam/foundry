# Oneshot: Detect CLI availability during initialization

**Issue**: F-53
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Added CLI detection during Foundry initialization to check if Claude Code CLI and/or Codex CLI are installed:

1. Created `src/lib/cli-detection.ts` with functions to detect CLI availability
2. Updated `src/init.ts` to check CLI availability and show appropriate messages
3. Updated `src/index.ts` to run CLI detection at startup before initialization

### Key Behaviors

- Detects Claude Code CLI using `claude --version`
- Detects Codex CLI using `codex --version`
- If neither CLI is installed: shows installation instructions and exits
- If only one CLI is installed: auto-selects that provider without prompting
- If both CLIs are installed: prompts user to select provider (as before)

## Files Changed

- `src/lib/cli-detection.ts` - New file with CLI detection functions
- `src/init.ts` - Added CLI availability check and updated provider selection
- `src/index.ts` - Added CLI detection at startup

## Verification

- TypeScript: PASS
- Build: PASS
- Tests: N/A (no test script configured)
- Lint: N/A (no lint script configured)

## Notes

The detection uses `--version` flags as a quick check rather than actually running prompts, to avoid any delays or API calls during startup. The detection has a 5-second timeout to prevent hanging if the CLI is installed but not responding.
