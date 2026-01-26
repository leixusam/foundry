# Implementation Plan: Integrate Linear CLI

**Issue**: RSK-21
**Date**: 2026-01-25
**Research**: thoughts/research/2026-01-25-RSK-21-linear-cli-integration.md
**Specification**: N/A
**Status**: Implementation Complete

## Overview

Implement automatic creation of Ralph-specific workflow statuses in Linear during first-run initialization. This improves the setup experience by eliminating the need for users to manually create custom statuses. All Ralph statuses will be prefixed with `[RL]` (Ralph Loop) to avoid conflicts with existing user workflows.

## Technical Approach

### Key Design Decisions

1. **Full Status Isolation**: Create all Ralph statuses with `[RL]` prefix rather than reusing existing user statuses. This ensures predictable behavior regardless of user's existing workflow configuration.

2. **SDK-Based Status Creation**: Use `@linear/sdk` to create workflow states via Linear's GraphQL API, since Linear MCP tools don't support status creation.

3. **Environment-Based Authentication**: API key stored in `LINEAR_API_KEY` environment variable, consistent with typical Linear SDK usage.

4. **Automatic First-Run Detection**: Check for presence of `[RL]` statuses on startup. If missing, run interactive initialization.

5. **Interactive CLI Wizard**: Guide user through setup with clear explanation of what will be created, requiring confirmation before making changes.

### Required Statuses

| Category | Status Name | Linear Type |
|----------|-------------|-------------|
| Backlog | `[RL] Backlog` | backlog |
| Ready | `[RL] Needs Research` | unstarted |
| Ready | `[RL] Needs Specification` | unstarted |
| Ready | `[RL] Needs Plan` | unstarted |
| Ready | `[RL] Needs Implement` | unstarted |
| Ready | `[RL] Needs Validate` | unstarted |
| In Progress | `[RL] Research In Progress` | started |
| In Progress | `[RL] Specification In Progress` | started |
| In Progress | `[RL] Plan In Progress` | started |
| In Progress | `[RL] Implement In Progress` | started |
| In Progress | `[RL] Validate In Progress` | started |
| In Progress | `[RL] Oneshot In Progress` | started |
| Done | `[RL] Done` | completed |
| Canceled | `[RL] Canceled` | canceled |

**Total**: 14 statuses

## Success Criteria

- [x] Ralph detects first-run (no `[RL]` statuses exist) and prompts user for initialization
- [x] User can provide Linear API key during initialization
- [x] All 14 `[RL]` prefixed statuses are created in the target team
- [x] Subsequent runs detect existing statuses and skip initialization
- [x] All agent prompts use `[RL]` prefixed status names
- [x] All tests pass: `npm run typecheck`
- [x] Type check passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

## Phases

### Phase 1: Add Linear SDK Dependency and Types

**Goal**: Add the `@linear/sdk` package and define types for status management.

**Changes**:
- `ralph/package.json`: Add `@linear/sdk` dependency
- `ralph/src/types.ts`: Add types for workflow states and initialization

**New Types**:
```typescript
// Workflow state types from Linear
export interface WorkflowState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  position: number;
}

// Status definition for Ralph
export interface RalphStatusDefinition {
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
}

// Initialization result
export interface InitResult {
  success: boolean;
  created: string[];
  existing: string[];
  errors: string[];
}
```

**Verification**:
```bash
cd ralph && npm install
npm run typecheck
```

### Phase 2: Create Linear API Client Module

**Goal**: Create a wrapper module for Linear SDK operations that handles authentication and status management.

**Changes**:
- `ralph/src/lib/linear-api.ts`: New file with Linear SDK wrapper

**Module Responsibilities**:
1. Initialize Linear client with API key
2. List existing workflow states for a team
3. Create new workflow states
4. Check if Ralph statuses exist
5. Create missing Ralph statuses

**Key Functions**:
```typescript
export function createLinearClient(apiKey: string): LinearClient;
export async function listWorkflowStates(client: LinearClient, teamId: string): Promise<WorkflowState[]>;
export async function createWorkflowState(client: LinearClient, teamId: string, state: RalphStatusDefinition): Promise<WorkflowState>;
export async function getRalphStatusNames(): string[];
export async function ensureRalphStatuses(client: LinearClient, teamId: string): Promise<InitResult>;
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 3: Create Initialization Module

**Goal**: Create the main initialization logic with interactive CLI experience.

**Changes**:
- `ralph/src/init.ts`: New file with initialization flow

**Flow**:
1. Check if `LINEAR_API_KEY` environment variable is set
2. If not, prompt user to enter it (with instructions for getting one)
3. Prompt for team key/ID (e.g., "RSK")
4. List existing statuses, show which `[RL]` statuses need to be created
5. Confirm with user before creating
6. Create missing statuses
7. Report success/failure

**Key Functions**:
```typescript
export async function checkInitialized(teamId: string): Promise<boolean>;
export async function runInitialization(): Promise<InitResult>;
export async function promptForApiKey(): Promise<string>;
export async function promptForTeamId(): Promise<string>;
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 4: Integrate Initialization into Main Entry Point

**Goal**: Add initialization check to the main loop startup.

**Changes**:
- `ralph/src/index.ts`: Add initialization check before main loop
- `ralph/src/config.ts`: Add `linearApiKey` and `linearTeamId` to config

**Config Additions**:
```typescript
// In RalphConfig interface
linearApiKey?: string;
linearTeamId?: string;
```

**Entry Point Logic**:
```typescript
async function main(): Promise<void> {
  const config = getConfig();

  // Check if initialization is needed
  if (!config.linearApiKey) {
    console.log('Linear API key not configured.');
    console.log('Run with LINEAR_API_KEY environment variable or run initialization.');
    await runInitialization();
    return;
  }

  const isInitialized = await checkInitialized(config.linearTeamId);
  if (!isInitialized) {
    console.log('Ralph statuses not found in Linear. Running initialization...');
    await runInitialization();
  }

  // Continue with main loop...
}
```

**Verification**:
```bash
npm run typecheck
npm run build
# Manual test: Run without LINEAR_API_KEY set, verify initialization prompt appears
```

### Phase 5: Update Agent Prompts with [RL] Prefix

**Goal**: Update all agent prompts to use `[RL]` prefixed status names.

**Changes**:
- `ralph/prompts/agent1-linear-reader.md`: Update status name references
- `ralph/prompts/agent3-linear-writer.md`: Update status name references
- `ralph/prompts/agent2-worker.md`: Update any status references (if any)
- `ralph/prompts/agent2-worker-*.md`: Check and update all stage-specific prompts

**Status Name Mappings**:
| Old Name | New Name |
|----------|----------|
| Backlog | [RL] Backlog |
| Needs Research | [RL] Needs Research |
| Needs Specification | [RL] Needs Specification |
| Needs Plan | [RL] Needs Plan |
| Needs Implement | [RL] Needs Implement |
| Needs Validate | [RL] Needs Validate |
| Research In Progress | [RL] Research In Progress |
| Specification In Progress | [RL] Specification In Progress |
| Plan In Progress | [RL] Plan In Progress |
| Implement In Progress | [RL] Implement In Progress |
| Validate In Progress | [RL] Validate In Progress |
| Oneshot In Progress | [RL] Oneshot In Progress |
| Done | [RL] Done |
| Canceled | [RL] Canceled |
| Blocked | [RL] Blocked |

**Verification**:
```bash
# Search for old status names to ensure all are updated
grep -r "Needs Research" ralph/prompts/ --include="*.md" | grep -v "\[RL\]"
grep -r "In Progress" ralph/prompts/ --include="*.md" | grep -v "\[RL\]"
```

### Phase 6: Add Readline Support for Interactive Prompts

**Goal**: Add proper readline support for interactive user input during initialization.

**Changes**:
- `ralph/src/lib/readline.ts`: New file with readline utilities

**Key Functions**:
```typescript
export async function prompt(question: string): Promise<string>;
export async function confirm(question: string): Promise<boolean>;
export async function selectFromList(question: string, options: string[]): Promise<string>;
```

**Verification**:
```bash
npm run typecheck
npm run build
```

## Testing Strategy

### Unit Testing
- Mock Linear SDK client for status creation tests
- Test initialization flow logic with various states (no statuses, some statuses, all statuses)

### Integration Testing
- Test with actual Linear API key (manual)
- Verify status creation in real Linear workspace
- Verify agents can find and use `[RL]` statuses

### Manual Verification Checklist
1. [ ] Fresh install: Run Ralph without `LINEAR_API_KEY` - prompts for key
2. [ ] First run with key: Detects missing statuses, offers to create
3. [ ] Status creation: All 14 statuses created successfully
4. [ ] Subsequent run: Detects existing statuses, skips initialization
5. [ ] Agent 1: Can find issues by `[RL]` status names
6. [ ] Agent 3: Can update issues to `[RL]` status names

## Rollback Plan

1. **Remove `[RL]` statuses from Linear**: Done manually via Linear UI
2. **Revert prompt changes**: Git revert the prompt file changes
3. **Remove SDK dependency**: Revert package.json changes
4. **Clean build**: `rm -rf ralph/dist && npm run build`

Note: This is a breaking change. Existing Ralph installations will need to either:
- Run initialization to create `[RL]` statuses
- Manually update their existing custom statuses to use `[RL]` prefix
- Continue using the old version

## Notes

### Migration for Existing Installations
Existing Ralph users who have already created the old status names will need to:
1. Run initialization to create `[RL]` statuses
2. Manually move any in-progress issues to the new `[RL]` statuses
3. Optionally delete the old non-prefixed statuses

Consider adding a migration helper in a future update.

### Security Considerations
- API key stored in environment variable only, never written to disk
- API key not logged or exposed in output
- Consider supporting Linear OAuth in future for better UX

### Future Enhancements
- Add `ralph init` CLI command for explicit initialization
- Add `ralph status` command to show current status configuration
- Support custom status prefix (e.g., `[RALPH]`, `[BOT]`)
- Add migration tool for existing installations
