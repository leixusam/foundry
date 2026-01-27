# Oneshot: Set up MCP during the initial configuration as well

**Issue**: RSK-38
**Date**: 2026-01-25
**Status**: Complete

## What Was Done

Extended the Ralph initialization wizard to configure the Linear MCP server alongside the Linear CLI configuration. When a user enters their Linear API key during setup, the same key is now used to:

1. Configure the Linear CLI (existing behavior via `.ralph.env`)
2. Configure the Linear MCP server (new behavior via `.mcp.json`)

This ensures users only need to enter their API key once during setup, and both integrations are automatically configured.

## Files Changed

- `ralph/src/init.ts` - Added `saveMcpConfig()` function and integrated it into `saveCredentials()`
- `.gitignore` - Added `.mcp.json` to prevent committing API keys

## Implementation Details

### New `saveMcpConfig()` Function

The function:
- Reads existing `.mcp.json` if present (preserving other MCP servers)
- Creates or updates the `linear` server configuration
- Uses the standard Linear MCP URL: `https://mcp.linear.app/mcp`
- Writes the config with proper JSON formatting

### Security Consideration

Added `.mcp.json` to `.gitignore` since it contains the API key in the Authorization header. This prevents accidentally committing sensitive credentials to version control.

## Verification

- TypeScript: PASS
- Build: PASS

## Notes

The `.mcp.json` file format follows the Claude Code MCP configuration standard:
```json
{
  "mcpServers": {
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.app/mcp",
      "headers": {
        "Authorization": "Bearer <api_key>"
      }
    }
  }
}
```
