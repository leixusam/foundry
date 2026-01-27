# Oneshot: Agent 1 should filter for status when getting issues from linear MCP

**Issue**: RSK-48
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Updated the Agent 1 prompt (`prompts/agent1-linear-reader.md`) to filter issues by status when calling the Linear MCP, specifically to exclude completed/canceled issues from being fetched. This reduces context window clutter and improves efficiency.

The Linear MCP's `list_issues` tool supports filtering by a single `state` parameter but does not support exclusion filtering. The solution instructs Agent 1 to make targeted queries for specific statuses:
- Backlog issues (entry points)
- `∞ Needs *` statuses (ready for work)
- `∞ ... In Progress` statuses (to check for stale claims)
- `∞ Blocked` issues (for awareness)

Agent 1 is explicitly instructed NOT to query for completed or canceled statuses.

## Files Changed

- `prompts/agent1-linear-reader.md` - Updated Step 2 to make targeted status-based queries instead of fetching all issues; added safety note to Step 4 Hard Filters

## Verification

- Tests: N/A (no test script)
- TypeScript: PASS
- Lint: N/A (no lint script)
- Build: PASS

## Notes

- The Linear MCP `state` parameter only accepts a single state name, not a list or exclusion pattern
- Making multiple parallel queries for specific statuses is more efficient than fetching everything and filtering in memory
- Agent 1 can make parallel tool calls within a single message to minimize latency
- Added a safety note in Hard Filters to verify completed/canceled issues don't slip through
