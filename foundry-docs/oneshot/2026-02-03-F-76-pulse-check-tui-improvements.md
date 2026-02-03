# Oneshot: Pulse Check TUI Improvements

**Issue**: F-76
**Date**: 2026-02-03
**Status**: Complete

## What Was Done

Renamed the "Quick Check" feature to "Pulse Check" and improved the TUI (Text User Interface) with the following changes:

1. **Terminology Update**: Replaced all "[Quick Check]" prefixes with "[Pulse Check]"
2. **Status Category Stats**: Added display of ticket counts by Linear status category (done, in progress, todo, backlog, canceled)
3. **Improved "No Work" Messaging**: Changed from "Fallback in X minutes" to "Checking again in 5 minutes (full check in X minutes)"
4. **Improved "Work Found" Messaging**: Changed from "Triggering Agent 1" to "Initiating next loop"

### Example Output (after changes)

```
[Pulse Check] Sleeping 5 minutes...
[Pulse Check] Checking for ready-to-work tickets...
[Pulse Check] Status: 90 done, 5 in progress, 2 todo, 3 backlog, 0 canceled
[Pulse Check] No ready-to-work tickets. Checking again in 5 minutes (full check in 85 minutes).
```

Or when work is found:
```
[Pulse Check] Status: 90 done, 5 in progress, 2 todo, 3 backlog, 0 canceled
[Pulse Check] Found 5 ready-to-work ticket(s). Initiating next loop.
```

## Files Changed

- `src/types.ts` - Added `StatusCategoryCounts` and `PulseCheckResult` interfaces extending `QuickCheckResult`
- `src/lib/linear-quick-check.ts` - Updated to fetch all issues and count by status category, returning `PulseCheckResult`
- `src/index.ts` - Updated all Quick Check messages to Pulse Check, added status stats display, improved messaging
- `src/lib/__tests__/linear-quick-check.test.ts` - Rewrote tests to match new implementation that counts by status category

## Verification

- Tests: PASS (182 tests)
- TypeScript: PASS
- Build: PASS

## Notes

- The new implementation fetches up to 250 issues to get accurate status counts across all categories
- Ready-to-work tickets are counted as `backlog + unstarted` status categories
- The status display uses user-friendly labels: "done" for completed, "in progress" for started, "todo" for unstarted
