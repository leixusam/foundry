# RSK-14: Persist LLM Agent Output Logs

**Issue**: [RSK-14](https://linear.app/robin-sidekick/issue/RSK-14/persist-llm-agent-output-logs)
**Date**: 2025-01-25
**Agent**: arctic-lynx-1769385382
**Stage**: Research + Implement (Fast-track)

## Summary

Implemented a nested folder structure for persisting LLM agent output logs, similar to the functionality in `ralph.sh` but with better organization for traceability.

## Research Findings

### Existing Patterns

1. **ralph.sh (bash script)**: Persists all raw JSON streaming output to a single `output.log` file (line 354)
   - Logs every line via: `echo "$line" >> "$LOG_FILE"`
   - Simple but becomes very large over time

2. **Node.js Ralph v2**: Had no file persistence - only console output
   - `claude.ts` processes JSON streaming output and formats for console
   - No logging to disk

3. **Agent Naming (RSK-13)**: Recently implemented naming system provides loop names
   - Format: `{adjective}-{animal}-{timestamp}` (e.g., "arctic-lynx-1769385382")
   - Display format extracts `{adjective}-{animal}` for human readability

### Requirements from Ticket

1. Persist all LLM output logs to files
2. Nested folder structure:
   - Level 1: Loop name (e.g., `arctic-lynx/`)
   - Level 2: Loop number (e.g., `loop-0/`, `loop-1/`)
   - Level 3: Individual agent files (`agent-1.log`, `agent-2.log`, `agent-3.log`)
3. Location: `.ralph/output/` folder (under working directory)
4. Git ignored to prevent large files in repository

## Implementation

### Files Created/Modified

1. **NEW: `ralph/src/lib/output-logger.ts`**
   - `initLoopLogger(agentName, loopNumber)`: Initializes logging context for a loop iteration
   - `logAgentOutput(agentNumber, line)`: Persists a line of output to the appropriate agent log file
   - `getCurrentOutputDir()`: Returns current output directory path for diagnostics
   - Uses the human-readable part of agent name (without timestamp) for folder names

2. **MODIFIED: `ralph/src/lib/claude.ts`**
   - Added import for `logAgentOutput`
   - Extended `spawnClaude()` function signature to accept optional `agentNumber` parameter
   - Added logging call in stdout handler to persist raw JSON lines

3. **MODIFIED: `ralph/src/index.ts`**
   - Added imports for `initLoopLogger` and `getCurrentOutputDir`
   - Added `initLoopLogger()` call at the start of each loop iteration
   - Added console output showing the output directory path
   - Added agent number parameter to all three `spawnClaude()` calls (1, 2, 3)

4. **MODIFIED: `.gitignore`**
   - Added `.ralph/output/` to exclude output logs from git

### Folder Structure

```
.ralph/
└── output/
    └── {loop-name}/           # e.g., arctic-lynx/
        └── loop-{n}/          # e.g., loop-0/
            ├── agent-1.log    # Linear Reader output
            ├── agent-2.log    # Worker output
            └── agent-3.log    # Linear Writer output
```

### Key Design Decisions

1. **Human-readable folder names**: Uses `arctic-lynx` instead of `arctic-lynx-1769385382` for cleaner organization
2. **Silent failures**: Logging errors don't interrupt the main process - logging is non-critical
3. **Async but fire-and-forget**: Uses `logAgentOutput().catch(() => {})` to avoid blocking
4. **Raw JSON preservation**: Logs raw lines exactly as received from Claude CLI (like ralph.sh)
5. **Directory creation on demand**: Creates folders only when needed using `recursive: true`

## Verification

- [x] TypeScript compiles without errors (`npm run build`)
- [x] Output logger module created and exported
- [x] Claude module updated to accept agent number
- [x] Index module initializes logger and passes agent numbers
- [x] .gitignore updated to exclude output folder

## Next Status

**Needs Validate** - The implementation should be tested by running the Ralph loop and verifying:
1. Output folders are created with correct structure
2. Agent log files contain raw JSON streaming output
3. Multiple loops create separate loop folders
4. Files are properly excluded from git
