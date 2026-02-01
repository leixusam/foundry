# Oneshot: Agent 1 Todo Status Fallback

**Issue**: F-63
**Date**: 2026-02-01
**Status**: Complete

## What Was Done

Updated Agent 1's Linear Reader prompt to search for issues in `unstarted`-type statuses (like "Todo", "Ready") in addition to `backlog`-type statuses. This expands the pool of issues that Foundry can automatically pick up and work on.

Previously, Agent 1 only looked for issues in:
- Foundry's `∞` prefixed workflow statuses
- `backlog`-type statuses (e.g., Backlog, Triage, ∞ Backlog)

Now, Agent 1 also searches:
- `unstarted`-type statuses (e.g., Todo, Ready)

This follows Linear's status type hierarchy where "Todo" represents items that are ready to work on but haven't been started yet (different from "Backlog" which is more of a holding area).

The change explicitly documents the priority order:
1. First check Foundry's `∞` prefixed statuses (already in workflow)
2. Then backlog-type statuses (explicitly waiting for work)
3. Then unstarted-type statuses (like "Todo" - ready but not started)

Also added explicit exclusion note: do NOT pick up from standard `started`-type statuses like "In Progress" or "In Review" as those are being actively worked on by humans.

## Files Changed

- `prompts/agent1-linear-reader.md` - Updated Step 1 to document unstarted-type statuses as entry points, updated Query 1 to include Todo and other unstarted statuses, updated Step 6 to map unstarted-type statuses to research stage
- `.foundry/prompts/agent1-linear-reader.md` - Synced with main prompts file

## Verification

- TypeScript: PASS
- Build: PASS
- No tests/lint configured for prompt files

## Notes

Linear has these status categories:
- **Backlog** (type: `backlog`) - e.g., Backlog, Icebox
- **Unstarted** (type: `unstarted`) - e.g., Todo, Ready
- **Started** (type: `started`) - e.g., In Progress, In Review
- **Completed** (type: `completed`) - e.g., Done
- **Canceled** (type: `canceled`) - e.g., Canceled

The key insight is that "Todo" is NOT a backlog status - it's an `unstarted` status. This means the previous search logic that only looked for backlog-type statuses would miss issues in "Todo" status.
