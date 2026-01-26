# Oneshot: Agent 3 should use Claude sonnet / Codex medium

**Issue**: RSK-34
**Date**: 2026-01-26
**Status**: Complete

## What Was Done

Changed Agent 3 (Linear Writer) from using Claude haiku to Claude sonnet for better quality Linear updates. The haiku model was considered too lightweight for writing comprehensive status updates to Linear.

## Files Changed

- `ralph/src/index.ts` - Changed Agent 3 model from 'haiku' to 'sonnet' at line 183

## Verification

- TypeScript: PASS
- Build: PASS

## Notes

Agent 3 is currently hardcoded to always use Claude (not Codex) per the design decision in the codebase comment: "AGENT 3: Linear Writer (always Claude for cost efficiency)". The Codex medium reasoning effort mentioned in the ticket title would only apply if Agent 3 is ever changed to support Codex as a provider.
