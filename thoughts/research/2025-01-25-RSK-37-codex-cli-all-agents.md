# Research: Support codex CLI for all three agents

**Issue**: RSK-37
**Date**: 2025-01-25
**Status**: Complete

## Summary

This ticket requires enabling Codex CLI as an alternative to Claude Code for all three Ralph agents. The key challenge is that Agent 1 (Linear Reader) and Agent 3 (Linear Writer) require Linear MCP access, and Codex CLI handles MCP configuration differently than Claude Code.

## Requirements Analysis

From the issue description:
1. Enable Codex CLI for Agent 1 (currently hardcoded to Claude)
2. Ensure Codex CLI works for Agent 2 (already supported)
3. Enable Codex CLI for Agent 3 (currently hardcoded to Claude)
4. Specifically: Look up how Codex CLI uses MCP for Linear integration

## Codebase Analysis

### Relevant Files

- `ralph/src/index.ts` - Main loop that spawns all 3 agents (lines 63-299)
- `ralph/src/lib/provider.ts` - Provider abstraction interface
- `ralph/src/lib/claude.ts` - Claude Code CLI spawner with `allowedTools` support
- `ralph/src/lib/codex.ts` - Codex CLI spawner (no `allowedTools` implementation)
- `ralph/src/config.ts` - Configuration including provider selection

### Current State

| Agent | Current Provider | MCP Tools Required | Codex Support |
|-------|-----------------|-------------------|---------------|
| Agent 1 (Linear Reader) | Hardcoded Claude | `mcp__linear__*` | ❌ |
| Agent 2 (Worker) | Configurable | None (uses all tools) | ✅ |
| Agent 3 (Linear Writer) | Hardcoded Claude | `mcp__linear__*` | ❌ |

### Code References

**Agent 1 hardcoded to Claude** (`index.ts:68`):
```typescript
const agent1Provider = createProvider('claude');
// ...
const agent1Result = await agent1Provider.spawn({
  prompt: agent1Prompt,
  model: 'opus',
  allowedTools: ['mcp__linear__*'],  // Restricts to Linear MCP tools only
}, 1);
```

**Agent 3 hardcoded to Claude** (`index.ts:218`):
```typescript
const agent3Provider = createProvider('claude');
// ...
const agent3Result = await agent3Provider.spawn({
  prompt: writerPrompt,
  model: 'sonnet',
  allowedTools: ['mcp__linear__*'],
}, 3);
```

**Codex provider ignores allowedTools** (`codex.ts:179-185`):
```typescript
// Note: options.allowedTools is received but never used
const args = [
  'exec',
  '--dangerously-bypass-approvals-and-sandbox',
  '--json',
  '--model', model,
  '-c', `model_reasoning_effort="${reasoningEffort}"`,
];
```

### Existing Patterns

Claude Code uses `--allowedTools` CLI flag to restrict which tools are available:
```bash
claude -p --allowedTools mcp__linear__* ...
```

## How Codex CLI Uses MCP

### Configuration Method

Codex CLI uses a centralized configuration file at `~/.codex/config.toml` for MCP servers. All configured MCP servers are available to all Codex sessions.

**Adding Linear MCP to Codex:**
```bash
codex mcp add linear --url https://mcp.linear.app/mcp
```

Or manually in `~/.codex/config.toml`:
```toml
[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
```

### Key Differences from Claude Code

| Aspect | Claude Code | Codex CLI |
|--------|-------------|-----------|
| MCP config location | `mcp.json` (per-project) or global | `~/.codex/config.toml` (global only) |
| Tool restriction | `--allowedTools` CLI flag | Not supported - all MCP tools available |
| Per-session MCP | ❌ | ❌ |
| Tool filtering | Via CLI flag | Via `enabled_tools`/`disabled_tools` in config.toml |

### Linear MCP Server Details

Linear provides an official remote MCP server:
- **HTTP endpoint**: `https://mcp.linear.app/mcp`
- **SSE endpoint**: `https://mcp.linear.app/sse`
- **Auth**: OAuth 2.1 with dynamic client registration

Claude Code configuration:
```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
    }
  }
}
```

Codex configuration:
```bash
codex mcp add linear --url https://mcp.linear.app/mcp
```

## Implementation Considerations

### Approach

There are two viable approaches:

#### Approach A: Full Provider Flexibility (Recommended)
Make all three agents configurable to use either Claude or Codex. This requires:
1. Change `createProvider('claude')` to `createProvider(config.provider)` for Agent 1 and Agent 3
2. Add prerequisite check that Linear MCP is configured in Codex before allowing Codex for Agent 1/3
3. Handle the fact that Codex doesn't support `--allowedTools` (accept that Agent 1/3 will have access to all tools when using Codex)

#### Approach B: Linear-Specific Provider Override
Keep Agent 1 and Agent 3 on Claude regardless of the global provider setting, since they specifically need Linear MCP tools. Only Agent 2 would be configurable.

**Recommendation**: Approach A is preferred because:
- User explicitly chooses Codex, so they accept the tool access model
- Maintains consistency in the provider selection model
- Linear MCP still works in Codex (just with all tools available)

### Risks

1. **No tool restriction in Codex**: Agent 1/3 would have access to all tools, not just Linear MCP
   - Mitigation: The prompt instructs the agent to only use Linear tools
   - Risk Level: Low - agents follow instructions well

2. **Linear MCP not configured**: If user runs with Codex but hasn't configured Linear MCP
   - Mitigation: Add check in initialization to verify Linear MCP is available
   - Could check `codex mcp list` output for "linear"

3. **OAuth flow**: Linear MCP uses OAuth which may require browser authentication
   - Mitigation: First run will prompt for auth, subsequent runs use cached token
   - Should document this in README

### Testing Strategy

1. **Unit test**: Verify Codex provider is created for all agents when configured
2. **Integration test**: Run full loop with Codex provider and verify Linear operations work
3. **Manual test**:
   - Configure `codex mcp add linear --url https://mcp.linear.app/mcp`
   - Run Ralph with `--provider codex`
   - Verify Agent 1 can read Linear issues
   - Verify Agent 3 can update Linear issues

## Specification Assessment

This feature does NOT need a UX specification because:
- Pure backend/infrastructure changes
- No user-facing UI components
- Follows existing CLI configuration patterns
- No new user flows (just extending existing provider selection)

**Needs Specification**: No

## Questions for Human Review

1. **Tool restriction trade-off**: Accept that Agent 1/3 will have access to all tools when using Codex? (Prompt-based restriction only)

2. **Prerequisite check**: Should Ralph refuse to start with Codex if Linear MCP isn't configured? Or just warn and continue?

3. **Per-agent provider**: Should we support different providers per agent (e.g., Agent 1=Claude, Agent 2=Codex, Agent 3=Claude)?

## Implementation Summary

### Changes Required

1. **`ralph/src/index.ts`**:
   - Line 68: Change `createProvider('claude')` to `createProvider(config.provider)`
   - Line 218: Change `createProvider('claude')` to `createProvider(config.provider)`
   - Remove `allowedTools` when using Codex (since it's not supported)

2. **`ralph/src/lib/codex.ts`**:
   - Log a warning if `allowedTools` is passed (since it's ignored)

3. **`ralph/src/init.ts`** (or new file):
   - Add check for Linear MCP configuration when using Codex
   - Run `codex mcp list` and verify "linear" is present

4. **`ralph/src/config.ts`**:
   - Optionally add per-agent provider configuration (for future flexibility)

### Files Affected

| File | Change Type | Description |
|------|-------------|-------------|
| `ralph/src/index.ts` | Modify | Use config.provider for all 3 agents |
| `ralph/src/lib/codex.ts` | Modify | Add warning for ignored allowedTools |
| `ralph/src/init.ts` | Modify | Add Linear MCP check for Codex |
| `ralph/README.md` | Modify | Document Codex MCP setup requirements |

### Estimated Scope

- ~50-100 lines of code changes
- 4 files modified
- Follows existing patterns
- Straightforward changes

## Next Steps

Ready for planning phase.

## References

- [OpenAI Codex MCP Documentation](https://developers.openai.com/codex/mcp/)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [Linear MCP Server Documentation](https://linear.app/docs/mcp)
- [Linear MCP Changelog](https://linear.app/changelog/2025-05-01-mcp)
