# Oneshot: Persistent Pod Names Across Loops

**Issue**: RSK-27
**Date**: 2026-01-26
**Status**: Complete

## What Was Done

Implemented persistent pod naming so that a Ralph session maintains the same pod name (e.g., "ivory-iguana") across all loops. Previously, each loop generated a new name like `20260126-054653-ivory-iguana`. Now:

1. Pod name (adjective-animal) is generated once at startup in `main()`
2. The pod name persists for the entire Ralph session
3. Agent instance identifiers now use the format: `{pod-name} / Loop {n} / Agent {n} (Role)`
4. Output directory structure remains: `ralph/.output/{pod-name}/loop-{n}/agent-{n}.log`

The new naming hierarchy:
- **Pod**: e.g., "ivory-iguana" (persists for entire npm start session)
- **Loop number**: 0, 1, 2, etc. (increments each iteration)
- **Agent**: Agent 1 (Linear Reader), Agent 2 (Worker), Agent 3 (Linear Writer)

## Files Changed

- `ralph/src/lib/loop-instance-name.ts` - Added `generatePodName()` function that returns just the adjective-animal part
- `ralph/src/index.ts` - Generate pod name once at startup, pass to `runLoop()`, update agent prompt templates to use new format
- `ralph/src/lib/output-logger.ts` - Simplified to use pod name directly instead of extracting from old format

## Verification

- TypeScript: PASS
- Build: PASS
- Tests: N/A (no test suite)
- Lint: N/A (no lint script)

## Notes

- The `generateLoopInstanceName()` function is kept for backwards compatibility but marked as deprecated
- The `getLoopInstanceNameDisplay()` helper is no longer used but kept in case external code depends on it
- Console output at startup now shows `Pod: {podName}` instead of changing each loop
