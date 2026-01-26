# RSK-17: Persist Terminal Log

**Agent**: red-phoenix-1769390592
**Date**: 2025-01-25
**Status**: Complete

## Summary

Added terminal output logging to persist all formatted console output (what's printed to the shell) separately from the raw LLM JSON output that was added in RSK-14.

## Task Analysis

RSK-17 is a child of RSK-14, which implemented raw LLM output logging. The parent task already established:
- Folder structure: `.ralph/output/{loop-name}/loop-{n}/`
- Raw output files: `agent-{n}.log`
- Infrastructure in `output-logger.ts`

RSK-17 extends this by adding terminal output logging.

## Implementation

### Files Modified

1. **ralph/src/lib/output-logger.ts**
   - Added `getAgentTerminalLogPath()` function to generate terminal log file paths
   - Added `logTerminalOutput()` exported function to persist terminal output
   - Terminal logs saved to `agent-{n}-terminal.log` files

2. **ralph/src/lib/claude.ts**
   - Imported `logTerminalOutput` function
   - Added terminal logging for:
     - Spawn info messages (command and working directory)
     - All formatted JSON output (session init, tool calls, text, results)
     - stderr output

### Folder Structure (Updated)

```
.ralph/
└── output/
    └── {loop-name}/           # e.g., red-phoenix/
        └── loop-{n}/          # e.g., loop-0/
            ├── agent-1.log            # Raw LLM JSON (from RSK-14)
            ├── agent-1-terminal.log   # Terminal output (NEW)
            ├── agent-2.log
            ├── agent-2-terminal.log   # Terminal output (NEW)
            ├── agent-3.log
            └── agent-3-terminal.log   # Terminal output (NEW)
```

### Difference Between Log Types

| File | Content | Format |
|------|---------|--------|
| `agent-{n}.log` | Raw Claude streaming output | JSON lines (one per line) |
| `agent-{n}-terminal.log` | Formatted console output | Human-readable text with ANSI colors |

## Verification

- [x] TypeScript compilation passes (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] Code follows existing patterns from RSK-14

## Next Status

**Needs Validate** - Implementation complete, ready for validation testing.
