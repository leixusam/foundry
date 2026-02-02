# Implementation Plan: Linear API Quick Check for Ticket Polling

**Issue**: F-66
**Date**: 2026-02-01
**Research**: [foundry-docs/research/2026-02-01-F-66-linear-api-quick-check.md](../research/2026-02-01-F-66-linear-api-quick-check.md)
**Specification**: N/A (internal infrastructure optimization)
**Status**: Ready for Implementation

## Overview

Implement a two-tier polling system to reduce unnecessary Agent 1 invocations:
1. **Quick API Check** (every 5 minutes): Lightweight Linear SDK call to check if any non-completed tickets exist
2. **Full Agent 1 Check** (fallback every 2 hours): Full agent invocation to catch any edge cases

This optimization reduces compute costs by avoiding full agent spawns when no work is available.

## Success Criteria

- [ ] Quick check runs every 5 minutes using Linear SDK
- [ ] Agent 1 only triggers when quick check finds uncompleted tickets
- [ ] Full Agent 1 runs as fallback every 2 hours regardless of quick check
- [ ] Quick check filters to configured team only
- [ ] Quick check excludes `completed` and `canceled` status types
- [ ] Console logging shows quick check activity
- [ ] API failures fall back to Agent 1 immediately
- [ ] All tests pass: `npm run typecheck`
- [ ] Build succeeds: `npm run build`

## Phases

### Phase 1: Add Types and Configuration

**Goal**: Define new types and configuration options for the two-tier polling system.

**Changes**:
- `src/types.ts`: Add `QuickCheckResult` interface and new config fields to `FoundryConfig`
- `src/config.ts`: Add parsing for new environment variables and config builder updates

**Details**:

1. In `src/types.ts`, add after line 101:
```typescript
// Quick check result
export interface QuickCheckResult {
  hasWork: boolean;
  ticketCount: number;
  error?: string;
}
```

2. In `src/types.ts`, add to `FoundryConfig` interface:
```typescript
// Quick check configuration
quickCheckIntervalMinutes: number;
fullCheckIntervalMinutes: number;
```

3. In `src/config.ts`, add parsing functions:
```typescript
// Parse quick check interval (default: 5 minutes)
function getQuickCheckInterval(): number {
  const envVal = process.env.FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return 5; // Default: 5 minutes
}

// Parse full check interval (default: 120 minutes = 2 hours)
function getFullCheckInterval(): number {
  const envVal = process.env.FOUNDRY_FULL_CHECK_INTERVAL_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return 120; // Default: 120 minutes (2 hours)
}
```

4. Update `buildConfig()` to include new fields:
```typescript
quickCheckIntervalMinutes: getQuickCheckInterval(),
fullCheckIntervalMinutes: getFullCheckInterval(),
```

**Verification**:
```bash
npm run typecheck
```

### Phase 2: Create Quick Check Module

**Goal**: Implement the lightweight Linear API check in a new module.

**Changes**:
- `src/lib/linear-quick-check.ts`: New file with quick check implementation

**Details**:

Create `src/lib/linear-quick-check.ts`:
```typescript
import { LinearClient } from '@linear/sdk';
import { QuickCheckResult } from '../types.js';

/**
 * Performs a lightweight check for uncompleted tickets in a Linear team.
 *
 * This queries the Linear API for issues that are NOT in 'completed' or 'canceled'
 * status types, scoped to the specified team.
 *
 * @param apiKey - Linear API key
 * @param teamKey - Team key (e.g., "F")
 * @returns QuickCheckResult with hasWork boolean and ticket count
 */
export async function checkForUncompletedTickets(
  apiKey: string,
  teamKey: string
): Promise<QuickCheckResult> {
  try {
    const client = new LinearClient({ apiKey });

    // Query for issues not in completed or canceled states
    // Using first: 1 for efficiency - we only need to know if ANY exist
    const issues = await client.issues({
      first: 1,
      filter: {
        team: { key: { eq: teamKey } },
        state: { type: { nin: ['completed', 'canceled'] } }
      }
    });

    const hasWork = issues.nodes.length > 0;

    // If we found at least one, get the actual count (capped at 50 for efficiency)
    let ticketCount = 0;
    if (hasWork) {
      const countResult = await client.issues({
        first: 50,
        filter: {
          team: { key: { eq: teamKey } },
          state: { type: { nin: ['completed', 'canceled'] } }
        }
      });
      ticketCount = countResult.nodes.length;
    }

    return { hasWork, ticketCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hasWork: false,
      ticketCount: 0,
      error: errorMessage
    };
  }
}
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 3: Integrate Quick Check into Main Loop

**Goal**: Modify the main loop to use two-tier polling with quick check and fallback.

**Changes**:
- `src/index.ts`: Replace simple sleep with two-tier checking logic

**Details**:

The main loop changes occur in two places:

1. **Add imports** at top of `src/index.ts`:
```typescript
import { checkForUncompletedTickets } from './lib/linear-quick-check.js';
```

2. **Replace the no-work handling block** (lines 154-179 in current code).

The new logic:
- Track last full Agent 1 check time
- When no work found, enter quick check loop:
  - Every `quickCheckIntervalMinutes`, call quick check API
  - If tickets found, break loop and run Agent 1
  - If no tickets and `fullCheckIntervalMinutes` since last full check, run Agent 1 anyway
  - Log all activity to console

**Updated no-work block**:
```typescript
// Check if there's no work (look for the signal in the output)
if (agent1Output.includes('no_work: true') || agent1Output.includes('NO_WORK')) {
  console.log('No work available.');

  // If GCP auto-stop is enabled, check if we're on GCP and stop the instance
  if (config.gcpAutoStop) {
    console.log('GCP auto-stop is enabled. Checking if running on GCP...');
    const onGcp = await isRunningOnGcp();
    if (onGcp) {
      console.log('Running on GCP VM. Initiating instance stop...');
      const stopped = await stopGcpInstance();
      if (stopped) {
        console.log('Instance stop command issued. VM will shut down shortly.');
        await sleep(10000);
        process.exit(0);
      } else {
        console.log('Failed to stop GCP instance. Falling back to quick check.');
      }
    } else {
      console.log('Not running on GCP VM. Falling back to quick check.');
    }
  }

  // Two-tier polling: quick check loop with fallback
  const fullCheckIntervalMs = config.fullCheckIntervalMinutes * 60 * 1000;
  const quickCheckIntervalMs = config.quickCheckIntervalMinutes * 60 * 1000;
  let lastFullCheck = Date.now(); // Agent 1 just ran

  while (true) {
    console.log(`\n[Quick Check] Sleeping ${config.quickCheckIntervalMinutes} minutes...`);
    await sleep(quickCheckIntervalMs);

    // Check if fallback is due
    const timeSinceFullCheck = Date.now() - lastFullCheck;
    const fallbackDue = timeSinceFullCheck >= fullCheckIntervalMs;

    if (fallbackDue) {
      console.log('[Quick Check] Fallback interval reached. Running full Agent 1 check.');
      return; // Exit to let main loop run Agent 1
    }

    // Perform quick check
    if (!config.linearApiKey || !config.linearTeamId) {
      console.log('[Quick Check] Missing Linear credentials. Falling back to Agent 1.');
      return;
    }

    console.log('[Quick Check] Checking for uncompleted tickets...');
    const result = await checkForUncompletedTickets(config.linearApiKey, config.linearTeamId);

    if (result.error) {
      console.log(`[Quick Check] Error: ${result.error}. Falling back to Agent 1.`);
      return; // Error - let Agent 1 handle it
    }

    if (result.hasWork) {
      console.log(`[Quick Check] Found ${result.ticketCount} uncompleted ticket(s). Triggering Agent 1.`);
      return; // Work found - run Agent 1
    }

    // No work found - continue quick check loop
    const minutesUntilFallback = Math.round((fullCheckIntervalMs - timeSinceFullCheck) / 60000);
    console.log(`[Quick Check] No uncompleted tickets. Fallback in ${minutesUntilFallback} minutes.`);
  }
}
```

**Verification**:
```bash
npm run typecheck
npm run build
npm run dev  # Test locally if possible
```

### Phase 4: Update Documentation

**Goal**: Document the new environment variables.

**Changes**:
- `src/config.ts`: Update help text with new environment variables

**Details**:

Add to the help text in `parseCLIArgs()` (around line 99-109):
```
  FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES   Quick check interval (default: 5)
  FOUNDRY_FULL_CHECK_INTERVAL_MINUTES    Full check fallback interval (default: 120)
```

**Verification**:
```bash
npm run build
npm start -- --help  # Verify help text updated
```

## Testing Strategy

### Unit Testing
The quick check module is designed for testability:
- Mock `LinearClient.issues()` to test different scenarios
- Test error handling when API fails
- Test correct filtering by team and status types

### Manual Integration Testing
1. Set `FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES=1` for faster testing
2. Run Foundry with no uncompleted tickets - verify quick check loop
3. Create a ticket in Linear - verify quick check detects it
4. Verify console output matches expected format

### Verification Commands
```bash
# Type check
npm run typecheck

# Build
npm run build

# Manual test with short intervals
FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES=1 FOUNDRY_FULL_CHECK_INTERVAL_MINUTES=5 npm start
```

## Rollback Plan

If issues are discovered:
1. Revert the changes to `src/index.ts` to restore original sleep behavior
2. The new module `src/lib/linear-quick-check.ts` can remain (unused)
3. Config changes are backward compatible (new fields have defaults)

Quick rollback: set `FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES=60` and `FOUNDRY_FULL_CHECK_INTERVAL_MINUTES=60` to effectively disable quick check behavior.

## Notes

### API Rate Limits
Linear's API rate limits are generous (typically 10,000 requests/hour). A check every 5 minutes = 12 requests/hour, well within limits.

### Error Handling Strategy
On any API error, immediately fall back to Agent 1 (fail-fast). This ensures we don't miss work due to transient API issues.

### GCP Auto-Stop Interaction
The GCP auto-stop check runs BEFORE the quick check loop starts. If GCP auto-stop triggers, the quick check loop never runs. This is intentional - if we want to stop the VM, we don't need to quick check first.

### Future Enhancements
- Add metrics for quick check hit rate
- Consider websocket/webhook integration for real-time updates
- Add configurable status type filtering
