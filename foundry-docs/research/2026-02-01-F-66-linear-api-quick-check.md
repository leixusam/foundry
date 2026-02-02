# Research: Use Linear API for Quick Ticket Check

**Issue**: F-66
**Date**: 2026-02-01
**Status**: Complete

## Summary

This research investigates using Linear's GraphQL API to perform lightweight checks for non-completed tickets, enabling a two-tier polling strategy: quick API checks every 5 minutes, with full Agent 1 checks as a fallback every 2 hours.

## Requirements Analysis

From the ticket:

1. **Quick Check**: Use Linear API/CLI to check if there are tickets NOT in a "done" status
2. **Two-Tier Polling**:
   - Quick API check: Every 5 minutes
   - Full Agent 1 check (fallback): Every 2 hours
3. **Status Categories**: The "done" check should include any status in the canonical `completed` or `canceled` state categories (not just `∞ Done`)
4. **Team Scoping**: Should be scoped to the configured team
5. **Logging**: Output findings to command line
6. **Trigger Logic**: Only spawn Agent 1 if there ARE non-completed tickets

## Codebase Analysis

### Relevant Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/index.ts:67-179` | Main loop (`runLoop`) | Contains the current polling logic and "no work" handling |
| `src/index.ts:548-688` | Main entry (`main`) | Contains the main while loop and sleep intervals |
| `src/config.ts:226-250` | Config builder | Defines `noWorkSleepMinutes: 60` (hardcoded) |
| `src/types.ts:79-101` | Type definitions | `FoundryConfig` interface |
| `src/lib/linear-api.ts` | Linear SDK wrapper | Existing Linear API code using `@linear/sdk` |
| `src/lib/setup.ts:27` | Setup helpers | Re-exports `createLinearClient` |

### Current Polling Logic

In `src/index.ts`:

```typescript
// Line 154-179: When no work is found
if (agent1Output.includes('no_work: true') || agent1Output.includes('NO_WORK')) {
  console.log('No work available.');
  // GCP auto-stop logic...
  console.log(`Sleeping ${config.noWorkSleepMinutes} minutes...`);
  await sleep(config.noWorkSleepMinutes * 60 * 1000);  // Currently 60 minutes
  return;
}
```

The current flow:
1. Agent 1 runs full Linear MCP check
2. If `no_work: true` in output, sleep for 60 minutes
3. Repeat

### LINEAR_API_KEY Access

The API key is available via:
- `config.linearApiKey` (from `getConfig()`)
- Loaded from `process.env.LINEAR_API_KEY`
- Or from `.foundry/env` file

This is already used in `src/index.ts:188` for downloading attachments.

### Existing Linear SDK Usage

The codebase uses `@linear/sdk` v31.0.0. The SDK supports:

```typescript
import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey });
const issues = await client.issues({
  first: 1,
  filter: {
    team: { key: { eq: teamKey } },
    state: { type: { nin: ['completed', 'canceled'] } }
  }
});

const hasUncompletedWork = issues.nodes.length > 0;
```

Key SDK capabilities verified:
- `IssueFilter.state` accepts `WorkflowStateFilter`
- `WorkflowStateFilter.type` accepts `StringComparator`
- `StringComparator.nin` supports "not in array" filtering

### Linear State Types

Linear's canonical workflow state types (from ticket research + SDK types):
- `triage`
- `backlog`
- `unstarted` (e.g., "Todo")
- `started` (e.g., "In Progress")
- `completed` (e.g., "Done")
- `canceled`

**For this feature**: Check `nin: ['completed', 'canceled']` to find any non-finished work.

## Implementation Considerations

### Approach

**Recommended: Two-Tier Check System**

```
┌─────────────────────────────────────────────────────────────────┐
│                      Main Loop                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐                                    │
│  │  Quick API Check        │◄──── Every 5 minutes               │
│  │  (lightweight SDK call) │                                    │
│  └───────────┬─────────────┘                                    │
│              │                                                  │
│              ▼                                                  │
│    ┌───────────────────┐                                        │
│    │ Non-completed     │                                        │
│    │ tickets exist?    │                                        │
│    └─────────┬─────────┘                                        │
│              │                                                  │
│         Yes  │  No                                              │
│              │                                                  │
│    ┌─────────▼─────────┐    ┌────────────────────┐              │
│    │ Run Agent 1       │    │ Check fallback     │              │
│    │ (full MCP check)  │    │ timer (2 hours)    │              │
│    └───────────────────┘    └─────────┬──────────┘              │
│                                       │                         │
│                               Expired │ Not expired             │
│                                       │                         │
│                   ┌───────────────────┴───────────────────┐     │
│                   │                                       │     │
│            ┌──────▼──────┐                       ┌────────▼───┐ │
│            │ Run Agent 1 │                       │ Sleep 5min │ │
│            │ (fallback)  │                       │ (no Agent) │ │
│            └─────────────┘                       └────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### New Files

1. **`src/lib/linear-quick-check.ts`** (new)
   - `checkForUncompletedTickets(apiKey: string, teamKey: string): Promise<QuickCheckResult>`
   - Returns: `{ hasWork: boolean, ticketCount: number }`

### Modified Files

1. **`src/config.ts`**
   - Add `quickCheckIntervalMinutes: number` (default: 5)
   - Add `fullCheckIntervalMinutes: number` (default: 120)

2. **`src/types.ts`**
   - Add new config fields to `FoundryConfig`
   - Add `QuickCheckResult` interface

3. **`src/index.ts`**
   - Add quick check loop before Agent 1
   - Track last full check time
   - Add logging for quick check results

### Configuration Options

New environment variables:
```
FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES=5     # Default: 5
FOUNDRY_FULL_CHECK_INTERVAL_MINUTES=120    # Default: 120
```

### Logging Output

Example console output:
```
[Quick Check] Checking for uncompleted tickets...
[Quick Check] Found 3 uncompleted tickets. Triggering Agent 1.

OR

[Quick Check] Checking for uncompleted tickets...
[Quick Check] No uncompleted tickets found. Waiting 5 minutes...
[Quick Check] Fallback check due in 115 minutes.
```

### Risks

1. **API Rate Limits**: Linear API has rate limits. Every 5 minutes should be safe, but we should handle rate limit errors gracefully.

2. **SDK Dependency**: Using the SDK adds some overhead vs raw GraphQL. However, it's already a dependency and provides type safety.

3. **Team Scoping**: The check must be scoped to the configured team to avoid seeing tickets from other teams.

4. **False Negatives**: If the API check fails or returns incorrect data, the fallback ensures Agent 1 still runs periodically.

### Testing Strategy

1. **Unit Tests**: Mock `LinearClient.issues()` to test quick check logic
2. **Integration Test**: Verify query returns correct results against real Linear workspace
3. **End-to-End**: Run full loop and verify polling behavior

### Alternative Approaches Considered

1. **Linear CLI (`@linear/cli`)**: Not suitable - only supports `lin new` and `lin checkout`, no query capabilities.

2. **Raw GraphQL fetch**: Would work but adds complexity. SDK is cleaner and already available.

3. **Webhook-based**: Would require hosting a webhook endpoint. Overkill for this use case.

## Specification Assessment

This feature is **backend/infrastructure only** with no user-facing UX changes. It affects:
- Polling frequency (internal optimization)
- Console log output (informational)

**Needs Specification**: No

The implementation is straightforward and follows existing patterns in the codebase.

## Questions for Human Review

1. **Team vs Workspace**: Should the quick check be team-scoped (current plan) or workspace-wide?
   - Recommendation: Team-scoped to match current behavior

2. **Include Archived**: Should the check include archived tickets?
   - Recommendation: No (match current Agent 1 behavior)

3. **Error Handling**: If quick check fails, should we:
   - a) Fall back to Agent 1 immediately
   - b) Retry after 1 minute
   - c) Wait for next scheduled check
   - Recommendation: Option (a) - fail fast to Agent 1

## Next Steps

Ready for planning phase. Key implementation tasks:

1. Create `src/lib/linear-quick-check.ts` with SDK-based query
2. Add new config fields and environment variables
3. Modify main loop to implement two-tier checking
4. Add logging output
5. Handle error cases (rate limits, API failures)
