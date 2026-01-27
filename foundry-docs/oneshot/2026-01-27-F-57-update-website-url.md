# Oneshot: Update our project website to https://foundry.tryrobin.ai/

**Issue**: F-57
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Added the `homepage` field to package.json with the new website URL `https://foundry.tryrobin.ai/`. This field was not previously set in the package configuration.

When npm publish is run in the future, this URL will be linked as the project website on the npm registry page.

## Files Changed

- `package.json` - Added `homepage` field with value `https://foundry.tryrobin.ai/`

## Verification

- Tests: N/A (no test script configured)
- TypeScript: PASS
- Lint: N/A (no lint script configured)

## Notes

- The `homepage` field is the standard npm way to specify a project's website URL
- This change will take effect the next time `npm publish` is run
- No npm publish was performed as per the ticket instructions
