# Oneshot: Agent 1 Backlog Fallback Search

**Issue**: F-58
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Updated Agent 1's Linear Reader prompt to explicitly query ALL backlog-type statuses when searching for work, not just `∞ Backlog`. This ensures that if no tickets are in Foundry's `∞ Backlog` status, Agent 1 will also check other backlog statuses like the standard `Backlog` or `Triage` statuses.

The prompt already documented this capability but the step-by-step instructions only told Agent 1 to query `∞ Backlog`. This fix aligns the instructions with the documented behavior.

## Files Changed

- `.foundry/prompts/agent1-linear-reader.md` - Updated Step 2 (Query 1) to explicitly instruct Agent 1 to query all backlog-type statuses identified in Step 1, not just `∞ Backlog`

## Verification

- TypeScript: PASS
- No tests/lint configured for prompt files

## Notes

This change addresses the scenario observed in the field where `∞ Backlog` was empty but the regular `Backlog` status had 4 available issues (F-52, F-53, F-55, F-58). With this fix, Agent 1 will now find and claim work from any backlog-type status.
