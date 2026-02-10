# Oneshot: update codex model name

**Issue**: F-77
**Date**: 2026-02-10
**Status**: Complete

## What Was Done

Updated Foundry's default Codex model from `gpt-5.2`/`gpt-5.2-codex` to `gpt-5.3-codex` across runtime config and setup flows. Added a unit test to assert the new default codex model value.

## Files Changed

- `src/config.ts` - Changed default `codexModel` fallback to `gpt-5.3-codex`
- `src/index.ts` - Updated minimal setup fallback `codexModel` to `gpt-5.3-codex`
- `src/lib/init-project.ts` - Updated interactive init fallback `codexModel` to `gpt-5.3-codex`
- `src/lib/setup.ts` - Updated persisted `CODEX_MODEL` fallback to `gpt-5.3-codex`
- `src/lib/__tests__/config.test.ts` - Added coverage for codex model default and override behavior

## Verification

- Tests: PASS (`npm run test`)
- TypeScript: PASS (`npm run typecheck`)
- Lint: N/A (`npm run lint` script is not defined in this repository)
- Build: PASS (`npm run build`)

## Notes

No behavior changes outside default model fallback values.
