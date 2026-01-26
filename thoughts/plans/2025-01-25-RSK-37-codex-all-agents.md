# Implementation Plan: Support codex CLI for all three agents

**Issue**: RSK-37
**Date**: 2025-01-25
**Research**: `thoughts/research/2025-01-25-RSK-37-codex-cli-all-agents.md`
**Specification**: N/A (pure infrastructure change, no UX components)
**Status**: Ready for Implementation

## Overview

Enable Codex CLI as an alternative provider for Agent 1 (Linear Reader) and Agent 3 (Linear Writer), which are currently hardcoded to use Claude. When using Codex, these agents will have access to all MCP tools (not just Linear) since Codex doesn't support per-session tool restriction, but prompt-based instructions already guide them to use only Linear tools.

## Success Criteria

- [ ] Agent 1, 2, and 3 all use `config.provider` to determine which provider to use
- [ ] When using Codex with `allowedTools`, a warning is logged (since it's ignored)
- [ ] Ralph startup checks for Linear MCP configuration when using Codex
- [ ] Type check passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Manual test: Ralph starts successfully with `--provider codex` (requires Linear MCP configured)

## Phases

### Phase 1: Add allowedTools warning to Codex provider

**Goal**: Warn users that `allowedTools` is ignored when using Codex, maintaining transparency about behavior differences.

**Changes**:
- `ralph/src/lib/codex.ts`: Add warning log when `allowedTools` is passed in options

**Details**:
In the `spawn` method, after parsing options, add:
```typescript
// Warn if allowedTools is specified (Codex doesn't support per-session tool restriction)
if (options.allowedTools && options.allowedTools.length > 0) {
  console.warn(`${YELLOW}⚠️  Warning: allowedTools option is ignored by Codex CLI.${RESET}`);
  console.warn(`${YELLOW}   Codex uses global MCP configuration from ~/.codex/config.toml${RESET}`);
}
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 2: Add Linear MCP check for Codex provider

**Goal**: Verify that Linear MCP is configured when using Codex, preventing confusing errors at runtime.

**Changes**:
- `ralph/src/lib/codex.ts`: Add function to check if Linear MCP is configured
- `ralph/src/init.ts`: Add check for Codex Linear MCP in initialization flow

**Details**:

Add to `ralph/src/lib/codex.ts`:
```typescript
// Check if Linear MCP is configured in Codex
export async function checkCodexLinearMcpConfigured(): Promise<boolean> {
  try {
    const result = execSync('codex mcp list', { encoding: 'utf-8' });
    return result.toLowerCase().includes('linear');
  } catch {
    return false;
  }
}
```

Add to `ralph/src/init.ts`:
```typescript
// Check Codex Linear MCP if using Codex provider
export async function checkCodexLinearMcp(): Promise<boolean> {
  const { checkCodexLinearMcpConfigured } = await import('./lib/codex.js');
  return checkCodexLinearMcpConfigured();
}
```

Integrate into index.ts initialization:
```typescript
// After Linear status check, if using Codex
if (config.provider === 'codex') {
  const hasLinearMcp = await checkCodexLinearMcp();
  if (!hasLinearMcp) {
    console.log('\n⚠️  Linear MCP not configured for Codex.');
    console.log('   Run: codex mcp add linear --url https://mcp.linear.app/mcp');
    process.exit(1);
  }
}
```

**Verification**:
```bash
npm run typecheck
npm run build
# Test with Codex but without Linear MCP configured (should show helpful error)
```

### Phase 3: Enable Codex for Agent 1 and Agent 3

**Goal**: Use the configured provider for all three agents instead of hardcoding Claude for Agent 1 and Agent 3.

**Changes**:
- `ralph/src/index.ts`:
  - Line 68: Change `createProvider('claude')` to `createProvider(config.provider)`
  - Line 218: Change `createProvider('claude')` to `createProvider(config.provider)`
  - Update model selection logic for Agents 1 and 3 to use Codex settings when applicable
  - Update stats logging to use correct provider name

**Details**:

For Agent 1 (around line 68):
```typescript
// Agent 1: Linear Reader
const agent1Provider = createProvider(config.provider);
// ...
const agent1Model = config.provider === 'codex' ? config.codexModel : 'opus';
const agent1Result = await agent1Provider.spawn({
  prompt: agent1Prompt,
  model: agent1Model,
  allowedTools: ['mcp__linear__*'],
  reasoningEffort: config.provider === 'codex' ? config.codexAgentReasoning.agent1 : undefined,
}, 1);
```

For Agent 3 (around line 218):
```typescript
// Agent 3: Linear Writer
const agent3Provider = createProvider(config.provider);
// ...
const agent3Model = config.provider === 'codex' ? config.codexModel : 'sonnet';
const agent3Result = await agent3Provider.spawn({
  prompt: writerPrompt,
  model: agent3Model,
  allowedTools: ['mcp__linear__*'],
  reasoningEffort: config.provider === 'codex' ? config.codexAgentReasoning.agent3 : undefined,
}, 3);
```

Update stats logging to reflect correct provider:
```typescript
// Agent 1 stats
await logAgentStats(1, config.provider, agent1Model, { ... });

// Agent 3 stats
await logAgentStats(3, config.provider, agent3Model, { ... });
```

Update console output (line 53):
```typescript
console.log(`Provider: ${config.provider}`); // Remove "(Agent 2 only)"
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 4: Update documentation

**Goal**: Document how to configure Codex MCP for Linear integration.

**Changes**:
- `ralph/README.md`: Add section on Codex MCP setup requirements

**Details**:

Add a section under "Environment Variables" or create a new "Provider Configuration" section:

```markdown
## Provider Configuration

### Using Codex CLI

When using Codex as the provider (`--provider codex` or `RALPH_PROVIDER=codex`), you must configure Linear MCP:

```bash
# Add Linear MCP to Codex configuration
codex mcp add linear --url https://mcp.linear.app/mcp

# Verify Linear MCP is configured
codex mcp list
```

**Note**: Codex CLI uses global MCP configuration (`~/.codex/config.toml`) rather than per-session tool restriction. Agent 1 and Agent 3 will have access to all configured MCP tools, but are prompted to only use Linear tools.
```

**Verification**:
```bash
# Verify README is valid markdown
cat ralph/README.md
```

## Testing Strategy

1. **Type checking**: `npm run typecheck` - ensures all TypeScript is valid
2. **Build**: `npm run build` - ensures compilation succeeds
3. **Manual test (Claude)**:
   - Run `npm start` (default Claude provider)
   - Verify all 3 agents work as before
4. **Manual test (Codex without MCP)**:
   - Temporarily ensure Linear MCP is not configured
   - Run `npm start -- --provider codex`
   - Verify helpful error message appears
5. **Manual test (Codex with MCP)**:
   - Configure Linear MCP: `codex mcp add linear --url https://mcp.linear.app/mcp`
   - Run `npm start -- --provider codex`
   - Verify Agent 1 can read Linear, Agent 2 can work, Agent 3 can write to Linear

## Rollback Plan

If issues occur:
1. Revert the changes to `index.ts` (restore hardcoded Claude for Agent 1 and Agent 3)
2. The `allowedTools` warning and MCP check are additive and can remain without breaking functionality
3. If needed, revert entire branch: `git checkout main`

## Notes

- The `allowedTools` option is kept in the spawn calls for Agents 1 and 3 for documentation purposes and so Claude still respects it when Claude is the provider
- When using Codex, agents rely on prompt instructions to stay within their intended scope (Linear tools only)
- The per-agent reasoning effort configuration (`config.codexAgentReasoning`) already exists and will be utilized for Agent 1 and Agent 3 when using Codex
- Cost estimation for Codex is approximate; actual billing may differ
