# Oneshot: Create summary stats in the output folder for each pod

**Issue**: RSK-33
**Date**: 2026-01-26
**Status**: Complete

## What Was Done

Implemented a JSON-based statistics logging system that tracks comprehensive metrics for each Ralph pod run. The system:

1. Creates a `stats.json` file in each pod's output folder (`ralph/.output/{pod-name}/stats.json`)
2. Updates incrementally after each agent completes (crash-resilient design)
3. Tracks per-agent and per-loop statistics

### Metrics Tracked Per Agent

- Tokens: input, output, cached
- Cost (USD, with estimated flag for Codex)
- Maximum context window percentage used
- Number of data compaction events
- Duration in seconds
- Exit code and rate limit status

### Aggregations

- Per-loop totals (all agents combined)
- Grand totals (all loops combined)

## Files Changed

- `ralph/src/lib/stats-logger.ts` - **NEW**: Stats tracking module with interfaces and logging functions
- `ralph/src/index.ts` - Added imports and calls to log stats after each agent completes

## Example Output

```json
{
  "podName": "crimson-iguana",
  "startedAt": "2026-01-26T05:46:48.000Z",
  "updatedAt": "2026-01-26T05:52:30.000Z",
  "loops": [
    {
      "loopNumber": 0,
      "loopInstanceName": "20260126-054648-crimson-iguana",
      "startedAt": "2026-01-26T05:46:48.000Z",
      "completedAt": "2026-01-26T05:52:30.000Z",
      "agents": [
        {
          "agentNumber": 1,
          "agentName": "Linear Reader",
          "provider": "claude",
          "model": "opus",
          "tokens": { "input": 12500, "output": 800, "cached": 5000 },
          "cost": 0.15,
          "costEstimated": false,
          "maxContextWindowPercent": 8,
          "compactionCount": 0,
          "durationSeconds": 45,
          "exitCode": 0,
          "rateLimited": false,
          "completedAt": "2026-01-26T05:47:33.000Z"
        }
      ],
      "totals": {
        "tokens": { "input": 12500, "output": 800, "cached": 5000 },
        "cost": 0.15,
        "costEstimated": false,
        "durationSeconds": 45
      }
    }
  ],
  "grandTotals": {
    "loopCount": 1,
    "tokens": { "input": 12500, "output": 800, "cached": 5000 },
    "cost": 0.15,
    "costEstimated": false,
    "durationSeconds": 45
  }
}
```

## Verification

- TypeScript: PASS
- Build: PASS
- No tests configured

## Notes

- The stats file is written after each agent completes, ensuring data persistence even if the pod crashes mid-loop
- Context window percentage is calculated against Claude's 168K effective limit
- Compaction count tracks `compact_boundary` events from Claude's streaming output
- For Codex provider, costs are marked as estimated since they're calculated from token pricing rather than exact API costs
