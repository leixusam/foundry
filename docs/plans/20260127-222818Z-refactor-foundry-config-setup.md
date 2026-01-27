# Plan: Refactor Foundry Config and Setup Flow

**Created**: 2026-01-27T22:28:18Z
**Status**: Implemented
**Related**: F-55 (remove foundry init, add foundry config)

## Goals

1. **Simplify first-time user experience** - Users run `foundry`, get guided through minimal setup, loop starts
2. **Eliminate duplicated code** - Single source of truth for all setup logic
3. **Clear separation of concerns** - `foundry` = run loop, `foundry config` = full configuration

## Current State Problems

### Duplication
- CLI detection implemented differently in two places
- Linear API key prompting in two places
- Team key prompting in two places
- Provider selection in two places
- MCP config writing in two places
- Gitignore updating in two places
- Env file writing in two places

### Missing Cross-over
- `foundry config` doesn't create ∞ statuses
- `foundry config` doesn't copy prompts
- `foundry` doesn't create `foundry-docs/`
- `foundry` doesn't copy Claude commands
- `foundry` doesn't prompt for model/iterations

### Confusing UX
- Two different wizards with different features
- User doesn't know which to run first
- `foundry init` name is misleading (sounds like project init, not config)

---

## Proposed Design

### `foundry` - Run the Agent Loop

**Purpose**: Get running with minimal friction

**Behavior**:
- If credentials missing → prompt for essentials only, then start loop
- If credentials exist → start loop immediately
- Uses smart defaults for everything not explicitly configured

### `foundry config` - Full Configuration

**Purpose**: View and modify all settings

**Behavior**:
- Shows all current values
- User presses Enter to keep, or types new value
- Access to advanced options (model, iterations, etc.)

---

## Complete Side-by-Side Specification

| Step | `foundry` | `foundry config` |
|------|-----------|------------------|
| **1. Display banner** | Yes - ASCII art + version | No |
| **2. Safety warning** | Yes - AI coding agent warning | No |
| **3. Check for updates** | Yes - Non-blocking | No |
| **4. Validate git repo** | Yes - Exit if not git repo | No (config works anywhere) |
| **5. CLI detection** | Yes - Exit if neither installed | Yes - Exit if neither installed |
| **6. Create `.foundry/`** | Yes - Silent | Yes - Silent |
| **7. Create `foundry-docs/`** | Yes - Silent | Yes - Silent |
| **8. Update `.gitignore`** | Yes - Silent | Yes - Silent |
| **9. Load existing config** | Yes | Yes |
| **10. Linear API Key** | If missing: prompt | Show current, prompt to change |
| **11. Validate API Key** | Yes | Yes |
| **12. Linear Team Key** | If missing: fetch teams, auto-select if 1, else prompt | Fetch teams, show current, prompt to change |
| **13. Provider selection** | If missing: auto-select based on CLIs | Show current, prompt to change |
| **14. Claude model** | Use default (opus) | Show current, prompt to change |
| **15. Codex model + effort** | Use defaults | Show current, prompt to change |
| **16. Max iterations** | Use default (0) | Show current, prompt to change |
| **17. Save `.foundry/env`** | If values collected | Always |
| **18. Save MCP config** | If API key collected | Always |
| **19. Copy prompts** | Yes - Always | No |
| **20. Copy Claude commands** | If claude provider | If claude provider |
| **21. Check ∞ statuses** | Yes | Yes |
| **22. Create ∞ statuses** | Auto-create, show count (e.g., "Created 5 statuses, 2 already existed") | Show preview, confirm, create |
| **23. Check Codex Linear MCP** | If codex, warn if not configured | If codex, warn if not configured |
| **24. Show config summary** | Brief | Full |
| **25. Start agent loop** | Yes | No - "Run `foundry` to start" |

---

## Prompting Behavior

### `foundry` (when credentials missing)

```
$ foundry

    ███████╗ ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██████╗ ██╗   ██╗
    ...

   ⚠️  Linear credentials not configured.

   To get your API key:
     1. Go to: https://linear.app/settings/account/security/api-keys/new
     2. Enter a label (e.g., "Foundry")
     3. Click "Create key"

   Enter your Linear API key: ********
   Validating... ✓

   Fetching teams...
   Found team: Foundry (F)
   Auto-selecting as it's the only team.

   Detecting CLIs...
   Claude Code: ✓ installed
   Codex: ✗ not found
   Using provider: claude

   Creating ∞ workflow statuses...
   Created 5 statuses.

   ✓ Configuration saved!

   Working directory: /Users/lei/repos/myproject
   Branch: main
   Provider: claude
   Claude Model: opus
   Linear Team: F
   ∞ Statuses: ✓ configured
   Pod: swift-wyvern

   ═══════════════════════ LOOP 0 ═══════════════════════
   ...
```

### `foundry` (already configured)

```
$ foundry

    ███████╗ ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██████╗ ██╗   ██╗
    ...

   Working directory: /Users/lei/repos/myproject
   Branch: main
   Provider: claude
   Claude Model: opus
   Linear Team: F
   ∞ Statuses: ✓ configured
   Pod: swift-wyvern

   ═══════════════════════ LOOP 0 ═══════════════════════
   ...
```

### `foundry config` (first time)

```
$ foundry config

╔════════════════════════════════════════╗
║     Foundry - Configuration Wizard     ║
╚════════════════════════════════════════╝

Detecting CLIs...
  Claude Code: ✓ installed
  Codex: ✗ not found

─── Linear Configuration ───

To get your API key:
  1. Go to: https://linear.app/settings/account/security/api-keys/new
  2. Enter a label (e.g., "Foundry")
  3. Click "Create key"

Linear API Key: ********
Validating... ✓

Fetching teams...
Available teams:
  - F: Foundry
  - P: Personal

Select team [F]: F
Selected: Foundry (F)

─── Provider Configuration ───

Provider [claude]:
Using: claude

─── Advanced Options ───

Claude Model [opus/sonnet/haiku] (opus):
Max Iterations (0=unlimited) [0]:

─── Linear Workflow Statuses ───

Foundry will create the following statuses:
  • ∞ Unclaimed
  • ∞ Claimed
  • ∞ Working
  • ∞ Blocked
  • ∞ Validate

Create these statuses? [Y/n]: y
Created 5 statuses.

✓ Configuration saved!

Run `foundry` to start the agent loop.
```

### `foundry config` (already configured)

```
$ foundry config

╔════════════════════════════════════════╗
║     Foundry - Configuration Wizard     ║
╚════════════════════════════════════════╝

Detecting CLIs...
  Claude Code: ✓ installed
  Codex: ✗ not found

─── Linear Configuration ───

Linear API Key: ****6rg0 (configured)
  [Enter to keep, or paste new key]:

Linear Team: F - Foundry (configured)
  Available teams:
    - F: Foundry
    - P: Personal
  [Enter to keep, or select new]:

─── Provider Configuration ───

Provider: claude (configured)
  [Enter to keep, or enter claude/codex]:

─── Advanced Options ───

Claude Model: opus (configured)
  [Enter to keep, or enter opus/sonnet/haiku]:

Max Iterations: 0 (unlimited) (configured)
  [Enter to keep, or enter number]:

─── Linear Workflow Statuses ───

∞ statuses already exist. No action needed.

✓ Configuration saved!

Run `foundry` to start the agent loop.
```

---

## Shared Module: `src/lib/setup.ts`

All shared setup logic lives here:

```typescript
// Directory setup
export function ensureFoundryDir(): string
export function ensureFoundryDocsDir(): void
export function ensureGitignore(): void

// Config loading/saving
export function loadExistingConfig(): FoundryConfig
export function saveEnvConfig(config: FoundryConfig): void
export function saveMcpConfig(apiKey: string): void

// CLI detection
export function detectClis(): CliAvailability
export function hasAnyCli(availability: CliAvailability): boolean

// Linear setup
export function validateLinearApiKey(apiKey: string): Promise<boolean>
export function fetchLinearTeams(apiKey: string): Promise<TeamInfo[]>
export function checkLinearStatuses(apiKey: string, teamId: string): Promise<boolean>
export function createLinearStatuses(apiKey: string, teamId: string): Promise<StatusResult>

// Prompt helpers (used by both, with different modes)
export function promptApiKey(existing?: string): Promise<string>
export function promptTeamKey(apiKey: string, existing?: string): Promise<string>
export function promptProvider(availability: CliAvailability, existing?: string): Promise<ProviderChoice>

// File operations
export function copyPromptsToProject(): void
export function copyClaudeCommands(): void

// Codex-specific
export function checkCodexLinearMcp(): boolean
```

---

## File Changes

### New Files
- `src/lib/setup.ts` - Shared setup logic

### Modified Files
- `src/cli.ts` - Route `config` to new handler
- `src/index.ts` - Use shared setup, simplified first-run flow
- `src/lib/init-project.ts` - Rewrite to use shared setup, implement "show current + Enter to keep" UX

### Deleted/Deprecated
- `src/init.ts` - Most logic moves to `src/lib/setup.ts`

---

## Implementation Steps

### Phase 1: Create Shared Module
1. Create `src/lib/setup.ts`
2. Move/refactor these from `src/init.ts`:
   - `ensureGitignore()`
   - `saveMcpConfig()`
   - `checkInitialized()` → `checkLinearStatuses()`
   - `checkCodexLinearMcp()`
   - CLI detection logic
3. Add new shared functions:
   - `ensureFoundryDir()`
   - `ensureFoundryDocsDir()`
   - `loadExistingConfig()`
   - `saveEnvConfig()`
   - `validateLinearApiKey()`
   - `fetchLinearTeams()`
   - `createLinearStatuses()`

### Phase 2: Update `foundry` (index.ts)
1. Import from shared module
2. Add first-run setup flow:
   - Ensure directories (silent)
   - Check for credentials
   - If missing: minimal prompts → save → continue
   - If present: continue
3. Auto-create ∞ statuses with count message
4. Remove dependency on `runInitialization()`

### Phase 3: Update `foundry config` (init-project.ts)
1. Import from shared module
2. Implement "show current + Enter to keep" UX for all fields
3. Add team fetching and selection
4. Add status preview and confirmation
5. Remove duplicated logic

### Phase 4: Cleanup
1. Remove `src/init.ts` (or reduce to re-exports for backwards compat)
2. Update `src/cli.ts` routing
3. Test both flows end-to-end

---

## Test Plan

### Unit Tests
- [ ] `setup.ts` - All shared functions
- [ ] Config loading with various states (empty, partial, full)
- [ ] CLI detection mocking

### Integration Tests
- [ ] `foundry` first run (no config) → prompts → loop starts
- [ ] `foundry` with config → loop starts immediately
- [ ] `foundry config` first run → full wizard
- [ ] `foundry config` with existing → shows values, allows changes

### Manual UAT
- [ ] Fresh project: run `foundry`, complete setup, verify loop starts
- [ ] Configured project: run `foundry`, verify no prompts
- [ ] Run `foundry config`, change team, verify saved
- [ ] Run `foundry config`, press Enter through all, verify nothing changes

---

## Acceptance Criteria

1. [x] `foundry` on fresh project prompts for API key and team only, then starts loop
2. [x] `foundry` on configured project starts loop immediately (no prompts)
3. [x] `foundry config` shows all current values with "Enter to keep" UX
4. [x] `foundry config` allows changing any setting
5. [x] No duplicated setup logic between the two commands
6. [x] ∞ status creation shows count (e.g., "Created 5 statuses")
7. [x] Both commands detect CLIs and exit if neither installed
8. [x] TypeCheck passes
9. [x] Build succeeds

---

## Update Log

| Date | Change |
|------|--------|
| 2026-01-27T22:28:18Z | Initial plan created |
| 2026-01-27T22:50:00Z | Implementation complete - all acceptance criteria met |
