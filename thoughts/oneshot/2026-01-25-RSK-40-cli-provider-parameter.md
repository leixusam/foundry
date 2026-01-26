# Oneshot: Make it easy to run it and take a parameter to start

**Issue**: RSK-40
**Date**: 2026-01-25
**Status**: Complete

## What Was Done

Added CLI parameter support for selecting the provider (Claude or Codex) when starting Ralph, plus per-agent reasoning effort configuration for Codex.

### Changes:

1. **CLI Parameter Support** (`--provider` / `-p`)
   - Added `--provider codex` or `-p codex` CLI flag to switch providers
   - Added `--help` / `-h` flag showing all options and environment variables
   - CLI arguments take precedence over environment variables

2. **Per-Agent Reasoning Effort Configuration**
   - Added `CodexAgentReasoningConfig` interface in types.ts
   - Added environment variables for per-agent configuration:
     - `CODEX_AGENT1_REASONING` - defaults to global default (high)
     - `CODEX_AGENT2_REASONING` - defaults to global default (high)
     - `CODEX_AGENT3_REASONING` - defaults to medium (as specified in ticket)
   - Display agent reasoning levels on startup when using Codex

## Files Changed

- `ralph/src/types.ts` - Added `CodexAgentReasoningConfig` interface and updated `RalphConfig`
- `ralph/src/config.ts` - Added CLI argument parsing with `parseArgs`, per-agent reasoning config
- `ralph/src/index.ts` - Updated startup and loop output to show per-agent reasoning levels

## Verification

- TypeScript: PASS
- Build: PASS
- Help output: PASS (verified `--help` shows expected output)

## Usage Examples

```bash
# Run with Claude (default)
npm start

# Run with Codex
npm start -- --provider codex
npm start -- -p codex

# Show help
npm start -- --help

# Configure per-agent reasoning via environment variables
CODEX_AGENT1_REASONING=high \
CODEX_AGENT2_REASONING=high \
CODEX_AGENT3_REASONING=medium \
npm start -- --provider codex
```

## Notes

- Agent 1 and 3 currently always use Claude (for cost efficiency), so the per-agent reasoning config is only used when the codebase is updated to support all agents using Codex
- Agent 3 defaults to 'medium' reasoning (as specified in ticket) even if global default is different
- CLI args take precedence: `npm start -- -p codex` overrides `RALPH_PROVIDER=claude`
