# Oneshot: add an option for oneshot-only

**Issue**: F-78
**Date**: 2026-02-10
**Status**: Complete

## What Was Done

Added a new workflow mode configuration with `staged` (default) and `oneshot` (oneshot-only). The new option is available in `foundry config` only, and when enabled it instructs Agent 1 to always dispatch tickets to the oneshot stage.

## Files Changed

- `src/types.ts` - Added `WorkflowMode` type and `workflowMode` in `FoundryConfig`
- `src/config.ts` - Added `FOUNDRY_WORKFLOW_MODE` parsing and config field
- `src/lib/setup.ts` - Added workflow mode load/save support in `.foundry/env`
- `src/lib/init-project.ts` - Added workflow mode selection to `foundry config`
- `src/index.ts` - Added Agent 1 oneshot-only override instructions and runtime summary output
- `src/cli.ts` - Updated CLI help environment variable list
- `src/lib/__tests__/config.test.ts` - Added workflow mode config tests
- `README.md` - Documented workflow mode and updated merge mode docs

## Verification

- Tests: PASS (`npm run test`)
- TypeScript: PASS (`npm run typecheck`)
- Build: PASS (`npm run build`)
- Lint: N/A (no lint script in this repository)

## Notes

`runMinimalSetup()` intentionally does not prompt for workflow mode, satisfying the requirement that this option only appears in `foundry config`.
