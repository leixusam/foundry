# Oneshot: 5 minute checking needs to be improved

**Issue**: F-74
**Date**: 2026-02-02
**Status**: Complete

## What Was Done

Modified the 5-minute quick check logic to exclude blocked tickets from triggering Agent 1 loops.

The issue was that when Foundry ran overnight, the quick check kept finding tickets in the `∞ Blocked` status and triggering unnecessary Agent 1 runs every 5 minutes. The `∞ Blocked` status has type `'started'` (not `'completed'` or `'canceled'`), so it wasn't being filtered out by the existing type-based filter.

The fix adds a compound filter using Linear SDK's `and` operator to exclude:
1. **By type**: `completed` and `canceled` statuses (existing filter)
2. **By name**: `∞ Blocked` status (new filter)

## Files Changed

- `src/lib/linear-quick-check.ts` - Added import for `FOUNDRY_STATUS_PREFIX` and modified the state filter to use a compound `and` condition that excludes blocked status by name
- `src/lib/__tests__/linear-quick-check.test.ts` - Updated tests to expect the new filter structure with blocked status exclusion

## Verification

- Tests: PASS (178 tests)
- TypeScript: PASS
- Build: PASS

## Notes

The filter now uses the pattern:
```typescript
state: {
  and: [
    { type: { nin: ['completed', 'canceled'] } },
    { name: { neq: '∞ Blocked' } }
  ]
}
```

This ensures only truly actionable tickets trigger Agent 1:
- Not completed tickets
- Not canceled tickets
- Not blocked tickets (which require human intervention)
