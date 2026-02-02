# F-67: Add PR Functionality - Implementation Plan

## Overview

Add a configuration option `FOUNDRY_MERGE_MODE` that controls whether Foundry merges directly to main (current behavior) or creates pull requests for human review. This gives users control over their deployment workflow and enables human oversight before code reaches production.

## Current State Analysis

### Configuration System
- `src/config.ts` - Uses `getXxx()` pattern for parsing env vars, `buildConfig()` assembles final config
- `src/types.ts` - `FoundryConfig` interface defines all config fields
- `src/lib/setup.ts` - `LoadedConfig` interface for `.foundry/env` persistence, `loadExistingConfig()` and `saveEnvConfig()` for I/O

### Onboarding Flows
- `src/index.ts:runMinimalSetup()` - Simplified flow when user runs `foundry` without config
- `src/lib/init-project.ts:configProject()` - Full wizard when user runs `foundry config`

### Prompt System
- `src/lib/prompts.ts` - `loadPrompt(name)` reads from `prompts/{name}.md`
- `prompts/agent2-worker-oneshot.md` - Contains merge logic in Steps 7-8 (lines 157-268)
- `prompts/agent2-worker-validate.md` - Contains merge logic in Steps 7-7.5 (lines 160-317)
- `prompts/agent3-linear-writer.md` - Handles `merge_status` values in status updates

### Linear Statuses
- `src/lib/linear-api.ts` - `FOUNDRY_STATUS_DEFINITIONS` array defines all ∞ statuses

### Key Discoveries
- No existing test framework - need to set up Vitest
- Prompts use static markdown files; no templating system exists
- The merge logic in oneshot/validate prompts includes both instructions AND output format sections
- Agent 3 already handles `merge_status: blocked` - pattern exists for new status

## Desired End State

After implementation:
1. Users can set `FOUNDRY_MERGE_MODE=pr` to have Foundry create PRs instead of merging
2. Both `foundry` and `foundry config` prompt for merge mode preference
3. When PR mode is enabled:
   - Agent 2 creates a PR with descriptive title/body and Foundry footer
   - Agent 2 outputs `merge_status: pr_created`
   - Agent 3 updates Linear status to `∞ Awaiting Merge`
   - Linear comment includes PR link
4. Default behavior (`merge`) remains unchanged for backward compatibility
5. Unit tests cover config parsing and prompt template insertion

### Verification
- `npm run test` passes all new unit tests
- `npm run typecheck` passes
- Manual test: Run Foundry with `FOUNDRY_MERGE_MODE=pr`, verify PR is created
- Manual test: Run Foundry with default config, verify merge behavior unchanged

## What We're NOT Doing

- Approval-then-merge flow (agent waiting for PR approval) - too complex for V1
- Custom PR templates via config - can add later
- Draft PR mode - can add later as third option
- Automatic rebase when PR has conflicts - human responsibility

## Implementation Approach

Use **modular prompt fragments with variable insertion**:
- Base prompts (`agent2-worker-oneshot.md`, `agent2-worker-validate.md`) contain a `{{MERGE_INSTRUCTIONS}}` placeholder
- Fragment files (`prompts/fragments/merge-direct.md`, `prompts/fragments/merge-pr.md`) contain mode-specific instructions and output format
- At runtime, `loadPrompt()` is enhanced to support template variables
- This is deterministic - agent sees only one code path, no conditionals to interpret

---

## Phase 1: Test Framework Setup

### Overview
Set up Vitest for unit testing. This enables test-driven development for subsequent phases.

### Changes Required

#### 1. Install Vitest

```bash
npm install -D vitest
```

#### 2. Update package.json

**File**: `package.json`

Add test script:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### 3. Create Vitest Config

**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

#### 4. Create Test Directory Structure

```
src/
  lib/
    __tests__/
      config.test.ts      # Config parsing tests
      prompts.test.ts     # Prompt loading tests
```

### Success Criteria

#### Automated Verification
- [x] `npm install` completes without errors
- [x] `npm run test` runs (even with no tests yet)
- [x] `npm run typecheck` passes

---

## Phase 2: Configuration System

### Overview
Add `mergeMode` to the configuration system with proper typing, parsing, and persistence.

### Changes Required

#### 1. Add Type Definition

**File**: `src/types.ts`

Add after line 5 (after `CodexReasoningEffort`):
```typescript
export type MergeMode = 'merge' | 'pr';
```

Add to `FoundryConfig` interface (after `fullCheckIntervalMinutes`):
```typescript
  // Merge mode configuration
  mergeMode: MergeMode;
```

#### 2. Add Config Parser

**File**: `src/config.ts`

Add import for `MergeMode`:
```typescript
import { FoundryConfig, ProviderName, ClaudeModel, CodexReasoningEffort, CodexAgentReasoningConfig, MergeMode } from './types.js';
```

Add parser function (after `getFullCheckInterval()`):
```typescript
// Parse merge mode (default: merge)
function getMergeMode(): MergeMode {
  const envMode = process.env.FOUNDRY_MERGE_MODE?.toLowerCase();
  if (envMode === 'pr') return 'pr';
  return 'merge'; // Default: direct merge
}
```

Add to `buildConfig()` return object:
```typescript
    // Merge mode
    mergeMode: getMergeMode(),
```

Update help text in `parseCLIArgs()` to include:
```typescript
  FOUNDRY_MERGE_MODE           Merge mode: merge (default) or pr
```

#### 3. Add to LoadedConfig

**File**: `src/lib/setup.ts`

Add import:
```typescript
import { ProviderName, ClaudeModel, CodexReasoningEffort, InitResult, MergeMode } from '../types.js';
```

Add to `LoadedConfig` interface:
```typescript
  mergeMode?: MergeMode;
```

Update `loadExistingConfig()` to parse merge mode:
```typescript
  const mergeMode = getValue('FOUNDRY_MERGE_MODE');
  if (mergeMode === 'merge' || mergeMode === 'pr') {
    config.mergeMode = mergeMode;
  }
```

Update `saveEnvConfig()` to write merge mode (after max iterations section):
```typescript
  lines.push('');
  lines.push('# Merge mode: "merge" (direct to main) or "pr" (create pull request)');
  lines.push(`FOUNDRY_MERGE_MODE=${config.mergeMode || 'merge'}`);
```

#### 4. Write Unit Tests

**File**: `src/lib/__tests__/config.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('getMergeMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns "merge" by default', async () => {
    delete process.env.FOUNDRY_MERGE_MODE;
    // Dynamic import to get fresh module
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('merge');
  });

  it('returns "pr" when FOUNDRY_MERGE_MODE=pr', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'pr';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('pr');
  });

  it('returns "pr" when FOUNDRY_MERGE_MODE=PR (case insensitive)', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'PR';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('pr');
  });

  it('returns "merge" for invalid values', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'invalid';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('merge');
  });
});
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes
- [x] `npm run test` passes all config tests
- [x] Setting `FOUNDRY_MERGE_MODE=pr` and running `node -e "console.log(require('./dist/config.js').getConfig().mergeMode)"` outputs `pr`

---

## Phase 3: Onboarding Flows

### Overview
Add merge mode prompt to both the simplified (`foundry`) and full (`foundry config`) onboarding flows.

### Changes Required

#### 1. Update Simplified Flow

**File**: `src/index.ts`

In `runMinimalSetup()`, after provider auto-selection (around line 557), add:

```typescript
    // Prompt for merge mode
    console.log('\nMerge Mode Options:');
    console.log('  merge - Merge directly to main after validation (default)');
    console.log('  pr    - Create a pull request for human review');
    console.log('');
    const mergeModeInput = await promptWithDefault(rl, 'Merge mode [merge/pr]', 'merge');
    const mergeMode = mergeModeInput === 'pr' ? 'pr' : 'merge';
```

Update the `newConfig` object to include:
```typescript
      mergeMode,
```

Update `process.env` assignment to include:
```typescript
    process.env.FOUNDRY_MERGE_MODE = mergeMode;
```

#### 2. Update Full Config Wizard

**File**: `src/lib/init-project.ts`

Add import for `MergeMode`:
```typescript
import { ProviderName, ClaudeModel, CodexReasoningEffort, MergeMode } from '../types.js';
```

In `configProject()`, after the Advanced Options section (around line 243), add a new section:

```typescript
    // ═══════════════════════════════════════════════════════════════════════════
    // Merge Mode Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Merge Mode ───\n');

    let mergeMode: MergeMode = existingConfig.mergeMode || 'merge';

    console.log('When Foundry completes work on a ticket:');
    console.log('  merge - Merge directly to main (autonomous)');
    console.log('  pr    - Create a pull request for human review');
    console.log('');

    const mergeModeInput = await promptWithDefault(
      rl,
      `Merge mode [merge/pr] (${mergeMode})`,
      mergeMode
    );
    if (mergeModeInput === 'pr' || mergeModeInput === 'merge') {
      mergeMode = mergeModeInput;
    }

    console.log('');
```

Update the `newConfig` object to include `mergeMode`:
```typescript
    const newConfig: LoadedConfig = {
      linearApiKey: apiKey,
      linearTeamKey: teamKey,
      provider,
      claudeModel,
      codexModel,
      codexReasoningEffort: codexEffort,
      maxIterations,
      mergeMode,
    };
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds

#### Manual Verification
- [ ] Run `foundry` in a fresh project - merge mode prompt appears after provider selection
- [ ] Run `foundry config` - merge mode section appears in wizard
- [ ] After setup, `.foundry/env` contains `FOUNDRY_MERGE_MODE=<selected value>`

---

## Phase 4: Linear Status

### Overview
Add the `∞ Awaiting Merge` status to Linear for PR mode workflow.

### Changes Required

#### 1. Add Status Definition

**File**: `src/lib/linear-api.ts`

Add to `FOUNDRY_STATUS_DEFINITIONS` array (after `∞ Blocked`, before `∞ Done`):
```typescript
  { name: `${FOUNDRY_STATUS_PREFIX} Awaiting Merge`, type: 'completed', color: '#5e6ad2' },
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes

#### Manual Verification
- [ ] Run `foundry config` on a project - new status is created in Linear
- [ ] Verify in Linear UI: `∞ Awaiting Merge` appears as a completed-type status

---

## Phase 5: Prompt Template System

### Overview
Enhance the prompt loading system to support variable insertion, then create modular prompt fragments for merge modes.

### Changes Required

#### 1. Enhance Prompt Loader

**File**: `src/lib/prompts.ts`

Update the module to support template variables:

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getRepoRoot } from '../config.js';

// Get the package directory for fallback prompts
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '../..');

/**
 * Loads a prompt from .foundry/prompts/ (preferred) or package prompts/ (fallback).
 * Supports template variables in the format {{VARIABLE_NAME}}.
 *
 * @param name - Prompt name without .md extension
 * @param variables - Optional object of variable names to values for template substitution
 * @returns The prompt content with variables substituted
 */
export function loadPrompt(name: string, variables?: Record<string, string>): string {
  // Try .foundry/prompts/ first (project-local)
  const projectPromptPath = join(getRepoRoot(), '.foundry', 'prompts', `${name}.md`);

  // Fallback to package prompts/
  const packagePromptPath = join(PACKAGE_ROOT, 'prompts', `${name}.md`);

  let promptPath: string;
  if (existsSync(projectPromptPath)) {
    promptPath = projectPromptPath;
  } else if (existsSync(packagePromptPath)) {
    promptPath = packagePromptPath;
  } else {
    throw new Error(`Prompt not found: ${name}`);
  }

  let content = readFileSync(promptPath, 'utf-8');

  // Substitute template variables
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }
  }

  return content;
}

/**
 * Loads a prompt fragment from the fragments/ subdirectory.
 *
 * @param name - Fragment name without .md extension (e.g., 'merge-direct')
 * @returns The fragment content
 */
export function loadPromptFragment(name: string): string {
  // Try .foundry/prompts/fragments/ first
  const projectFragmentPath = join(getRepoRoot(), '.foundry', 'prompts', 'fragments', `${name}.md`);

  // Fallback to package prompts/fragments/
  const packageFragmentPath = join(PACKAGE_ROOT, 'prompts', 'fragments', `${name}.md`);

  let fragmentPath: string;
  if (existsSync(projectFragmentPath)) {
    fragmentPath = projectFragmentPath;
  } else if (existsSync(packageFragmentPath)) {
    fragmentPath = packageFragmentPath;
  } else {
    throw new Error(`Prompt fragment not found: ${name}`);
  }

  return readFileSync(fragmentPath, 'utf-8');
}
```

#### 2. Write Prompt Loader Tests

**File**: `src/lib/__tests__/prompts.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock config to avoid side effects
vi.mock('../../config.js', () => ({
  getRepoRoot: () => '/mock/repo',
}));

describe('loadPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('substitutes template variables', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('Hello {{NAME}}, mode is {{MODE}}.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test', { NAME: 'World', MODE: 'pr' });

    expect(result).toBe('Hello World, mode is pr.');
  });

  it('returns content unchanged when no variables provided', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('No variables here.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test');

    expect(result).toBe('No variables here.');
  });

  it('replaces multiple occurrences of same variable', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{{X}} and {{X}} again.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test', { X: 'value' });

    expect(result).toBe('value and value again.');
  });
});
```

#### 3. Create Prompt Fragments Directory

```bash
mkdir -p prompts/fragments
```

#### 4. Create Direct Merge Fragment

**File**: `prompts/fragments/merge-direct.md`

```markdown
### Step 7: Get Repository URL

Before merging, get the repository URL for Agent 3:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

### Step 8: Merge to Main

After all checks pass, merge the feature branch to main:

```bash
# Switch to main and update
git checkout main
git pull origin main

# Attempt merge with no-ff to preserve branch history
git merge foundry/{identifier} --no-ff -m "Merge foundry/{identifier}: {issue_title}"
```

**Handle the merge result:**

1. **Clean merge (no conflicts)**: Push to main, delete feature branch
   ```bash
   git push origin main
   git branch -d foundry/{identifier}
   git push origin --delete foundry/{identifier}
   ```
   Set `merge_status: success` in WORK_RESULT.

2. **Simple conflicts** (imports, whitespace, non-overlapping): Resolve them if obvious
   - Conflicts are purely mechanical (imports, formatting)
   - Changes don't overlap in business logic
   - Resolution is obvious and doesn't require product decisions

   After resolving:
   ```bash
   git add .
   git commit -m "Merge foundry/{identifier}: {issue_title}"
   git push origin main
   git branch -d foundry/{identifier}
   git push origin --delete foundry/{identifier}
   ```
   Set `merge_status: success` in WORK_RESULT.

3. **Complex conflicts** (business logic, requires judgment): Abort and mark blocked
   - Conflicts touch core business logic
   - Multiple approaches are possible
   - Resolution requires broader context

   ```bash
   git merge --abort
   git checkout foundry/{identifier}
   ```
   Set `merge_status: blocked` and `merge_conflict_files: [list of files]` in WORK_RESULT.

## Output Format

After completing your work and merge succeeds:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {merge commit hash on main}
  merge_status: success
  next_status: "∞ Done"
  summary: |
    {Brief description of what was done}
    Files changed: {list}
    All checks pass. Merged to main.
```

If work completes but merge is blocked:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash on feature branch}
  merge_status: blocked
  merge_conflict_files: [file1.ts, file2.ts]
  next_status: "∞ Blocked"
  summary: |
    {Brief description of what was done}
    Merge conflicts require human resolution.
    Conflicts in: {list of files}
```

If you encounter an error:

```
WORK_RESULT:
  success: false
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  error: |
    {What went wrong and why it couldn't be fixed}
```
```

#### 5. Create PR Mode Fragment

**File**: `prompts/fragments/merge-pr.md`

```markdown
### Step 7: Get Repository URL

Before creating the PR, get the repository URL:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

### Step 8: Create Pull Request

Instead of merging directly, create a pull request for human review.

```bash
# Ensure all changes are pushed to the feature branch
git push origin foundry/{identifier}

# Create the pull request
gh pr create \
  --title "{issue_identifier}: {issue_title}" \
  --body "$(cat <<'EOF'
## Summary

{Brief description of what was implemented}

## Changes

{List of key changes made}

## Testing

{How the changes were verified}

- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] Lint passes

## Linear Issue

{issue_identifier}

---
🤖 Created by [Foundry](https://github.com/leixusam/foundry) with {{PROVIDER_LINK}}
EOF
)" \
  --base main \
  --head foundry/{identifier}
```

Replace the placeholders:
- `{issue_identifier}`: The issue ID (e.g., RSK-123)
- `{issue_title}`: The issue title
- Other fields based on the work completed

**Handle the PR creation result:**

1. **PR created successfully**: Capture the PR URL from the output
   Set `merge_status: pr_created` and `pr_url: {URL}` in WORK_RESULT.

2. **PR creation failed**: Include the error
   Set `merge_status: pr_failed` and include error details in WORK_RESULT.

## Output Format

After completing your work and PR is created:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash on feature branch}
  merge_status: pr_created
  pr_url: {GitHub PR URL}
  next_status: "∞ Awaiting Merge"
  summary: |
    {Brief description of what was done}
    Files changed: {list}
    All checks pass. PR created for review.
    PR: {pr_url}
```

If PR creation fails:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash on feature branch}
  merge_status: pr_failed
  next_status: "∞ Blocked"
  summary: |
    {Brief description of what was done}
    PR creation failed: {error message}
```

If you encounter an error during implementation:

```
WORK_RESULT:
  success: false
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  error: |
    {What went wrong and why it couldn't be fixed}
```
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes
- [x] `npm run test` passes prompt loader tests
- [x] Fragment files exist in `prompts/fragments/`

---

## Phase 6: Update Base Prompts

### Overview
Refactor base prompts to use `{{MERGE_INSTRUCTIONS}}` placeholder and remove the hardcoded merge logic.

### Changes Required

#### 1. Update Oneshot Worker Prompt

**File**: `prompts/agent2-worker-oneshot.md`

Replace Steps 7-8 and Output Format sections (lines 157-268) with:

```markdown
{{MERGE_INSTRUCTIONS}}

## Important Notes

- Oneshot means ONE session - don't over-think it
- If the task is more complex than expected, complete what you can and note it
- Keep the documentation minimal but useful
- Always commit and push before outputting WORK_RESULT
- If tests fail and you can't fix them quickly, that's a failure - let it go back to the queue
```

#### 2. Update Validate Worker Prompt

**File**: `prompts/agent2-worker-validate.md`

Replace Steps 7-7.5 and Output Format sections (lines 160-278) with:

```markdown
{{MERGE_INSTRUCTIONS}}

## When to Use `∞ Blocked`

If you cannot proceed due to unclear requirements or need human decision-making, use this output:

```
WORK_RESULT:
  success: false
  stage_completed: validate
  branch_name: foundry/{identifier}
  repo_url: {git remote URL}
  next_status: "∞ Blocked"
  error: |
    Cannot proceed - human input required.

    ## What's Blocked
    {Describe what is unclear or needs decision}

    ## Options
    1. {Option A}
    2. {Option B}

    ## Questions for Human
    - {Question 1}
    - {Question 2}
```

Use `∞ Blocked` when:
- Success criteria are ambiguous and cannot be objectively verified
- Test failures reveal issues that need product decisions to resolve
- Validation reveals behavior that may or may not be correct depending on intent
- External systems or test environments are unavailable and need human intervention

## Important Notes

- Be thorough - this is the last check before production
- If validation fails, the issue goes back to `∞ Needs Implement`
- Document everything - the validation report is the audit trail
- Always commit and push before outputting WORK_RESULT
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes
- [x] Prompts contain `{{MERGE_INSTRUCTIONS}}` placeholder

---

## Phase 7: Integrate Prompt Assembly in Main Loop

### Overview
Update `src/index.ts` to assemble prompts with the correct merge fragment based on configuration.

### Changes Required

#### 1. Update Imports

**File**: `src/index.ts`

Update import from prompts.ts:
```typescript
import { loadPrompt, loadPromptFragment } from './lib/prompts.js';
```

#### 2. Create Helper Function

Add a helper function to build the worker prompt with merge instructions:

```typescript
/**
 * Builds the complete worker prompt by inserting the appropriate merge fragment.
 * @param baseName - Base prompt name (e.g., 'agent2-worker-oneshot')
 * @param config - Foundry configuration
 * @param stage - Stage name for output format (e.g., 'oneshot', 'validate')
 * @param workflow - Workflow type (e.g., 'oneshot', 'staged')
 * @param artifactDir - Directory for artifacts (e.g., 'oneshot', 'validation')
 */
function buildWorkerPrompt(
  baseName: string,
  config: FoundryConfig,
  stage: string,
  workflow: string,
  artifactDir: string
): string {
  // Load the appropriate merge fragment based on config
  const fragmentName = config.mergeMode === 'pr' ? 'merge-pr' : 'merge-direct';

  // Determine provider link for PR footer
  const providerLink = config.provider === 'codex'
    ? '[Codex](https://openai.com/codex)'
    : '[Claude Code](https://claude.ai/claude-code)';

  // Load fragment and substitute its variables
  let mergeInstructions = loadPromptFragment(fragmentName);
  mergeInstructions = mergeInstructions
    .replace(/\{\{STAGE\}\}/g, stage)
    .replace(/\{\{WORKFLOW\}\}/g, workflow)
    .replace(/\{\{ARTIFACT_DIR\}\}/g, artifactDir)
    .replace(/\{\{PROVIDER_LINK\}\}/g, providerLink);

  // Load base prompt and insert merge instructions
  const basePrompt = loadPrompt(baseName);
  return basePrompt.replace('{{MERGE_INSTRUCTIONS}}', mergeInstructions);
}
```

#### 3. Update Agent 2 Worker Prompt Loading

In `runLoop()`, update the worker prompt loading (around line 267):

For the standard worker flow, the existing code loads `agent2-worker` which dispatches to specific prompts. We need to update where oneshot and validate prompts are loaded.

Actually, looking at the code more carefully - the dispatch happens inside `agent2-worker.md` which loads sub-prompts. We need to trace this flow.

Let me check the agent2-worker.md to understand the dispatch:

**File**: `prompts/agent2-worker.md`

This prompt dispatches to `agent2-worker-oneshot.md` or `agent2-worker-validate.md` based on the stage. The loading happens through Claude/Codex reading the file system.

**Alternative approach**: Instead of modifying the dispatch, we inject the merge mode and provider into the agent context, and the fragment handles substitution at prompt-loading time by the agent.

**Simpler approach**: Pass merge mode context to Agent 2, and have the base prompts include conditional instructions. Wait - we decided against conditionals.

**Best approach**: The fragments should be pre-assembled into the oneshot/validate prompts before they're copied to `.foundry/prompts/`. This happens in `copyPromptsToProject()`.

Update `src/lib/setup.ts` function `copyPromptsToProject()`:

```typescript
/**
 * Copies prompts from package to .foundry/prompts/.
 * Assembles prompts with merge fragment based on current config.
 */
export function copyPromptsToProject(): void {
  const sourceDir = join(PACKAGE_ROOT, 'prompts');
  const destDir = join(ensureFoundryDir(), 'prompts');
  const fragmentsSourceDir = join(sourceDir, 'fragments');
  const fragmentsDestDir = join(destDir, 'fragments');

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  if (!existsSync(sourceDir)) {
    console.log('Warning: Prompts directory not found in package.');
    return;
  }

  // Copy fragment files
  if (existsSync(fragmentsSourceDir)) {
    if (!existsSync(fragmentsDestDir)) {
      mkdirSync(fragmentsDestDir, { recursive: true });
    }
    const fragmentFiles = readdirSync(fragmentsSourceDir).filter((f) => f.endsWith('.md'));
    for (const file of fragmentFiles) {
      copyFileSync(join(fragmentsSourceDir, file), join(fragmentsDestDir, file));
    }
  }

  // Copy prompt files
  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  let copied = 0;

  for (const file of files) {
    copyFileSync(join(sourceDir, file), join(destDir, file));
    copied++;
  }

  console.log(`   Prompts synced (${copied} files)`);
}
```

Then in `src/index.ts`, update `runLoop()` to assemble the prompts with fragments before passing to Agent 2.

Actually, the cleanest approach is:

1. Keep base prompts with `{{MERGE_INSTRUCTIONS}}` placeholder
2. At runtime in `runLoop()`, when building `workerPrompt`, load and assemble the prompt with the fragment
3. The assembled prompt is what gets passed to Agent 2

Update the worker prompt building in `runLoop()` (around line 267):

```typescript
  // Determine which worker prompt to use based on stage from Agent 1's output
  // The agent2-worker.md dispatches to specific prompts, but we need to inject
  // merge instructions into those prompts. We do this by adding merge context
  // to the prompt that Agent 2 receives.

  // Load merge fragment based on config
  const mergeFragmentName = config.mergeMode === 'pr' ? 'merge-pr' : 'merge-direct';
  const providerLink = config.provider === 'codex'
    ? '[Codex](https://openai.com/codex)'
    : '[Claude Code](https://claude.ai/claude-code)';

  // Build worker prompt by combining the base prompt with agent 1's output
  const workerBasePrompt = await loadPrompt('agent2-worker');
  const workerPrompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 2 (Worker)

This identifier format is: Pod Name / Loop Number / Agent Number (Role).
- **Pod Name**: ${podName} - persists for this entire Foundry session
- **Loop Number**: ${iteration} - increments each time Foundry processes a new ticket
- **Agent**: Agent 2 (Worker) - your role in this loop

## Linear Team Configuration

**Team Key**: ${config.linearTeamId}

This team key is used for all Linear MCP tool calls. While you don't make Linear calls directly, this context may be passed to other agents.

## Merge Mode Configuration

**Merge Mode**: ${config.mergeMode}
**Provider**: ${config.provider}
**Provider Link**: ${providerLink}

When you reach the merge/PR step, use the **${mergeFragmentName}** fragment instructions.

---

## Context from Linear (gathered by Agent 1)

${agent1Output}
${attachmentSection}
---

${workerBasePrompt}`;
```

Hmm, this is getting complex. Let me simplify:

**Simplest approach**:
1. The worker prompts (oneshot, validate) contain the `{{MERGE_INSTRUCTIONS}}` placeholder
2. When `copyPromptsToProject()` runs, it reads config and substitutes the placeholder with the appropriate fragment
3. This way, the prompts in `.foundry/prompts/` are already fully assembled

This means prompts are assembled at setup time, not runtime. If user changes `FOUNDRY_MERGE_MODE`, they need to run `foundry` again which re-syncs prompts.

Update `copyPromptsToProject()` in `src/lib/setup.ts`:

```typescript
import { loadExistingConfig } from './setup.js'; // Already in same file

/**
 * Copies prompts from package to .foundry/prompts/.
 * Assembles prompts with merge fragment based on current config.
 */
export function copyPromptsToProject(): void {
  const sourceDir = join(PACKAGE_ROOT, 'prompts');
  const fragmentsDir = join(sourceDir, 'fragments');
  const destDir = join(ensureFoundryDir(), 'prompts');

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  if (!existsSync(sourceDir)) {
    console.log('Warning: Prompts directory not found in package.');
    return;
  }

  // Load current config to determine merge mode
  const config = loadExistingConfig();
  const mergeMode = config.mergeMode || 'merge';
  const provider = config.provider || 'claude';

  // Load the appropriate merge fragment
  const fragmentName = mergeMode === 'pr' ? 'merge-pr.md' : 'merge-direct.md';
  const fragmentPath = join(fragmentsDir, fragmentName);
  let mergeFragment = '';
  if (existsSync(fragmentPath)) {
    mergeFragment = readFileSync(fragmentPath, 'utf-8');

    // Substitute provider link in fragment
    const providerLink = provider === 'codex'
      ? '[Codex](https://openai.com/codex)'
      : '[Claude Code](https://claude.ai/claude-code)';
    mergeFragment = mergeFragment.replace(/\{\{PROVIDER_LINK\}\}/g, providerLink);
  }

  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  let copied = 0;

  for (const file of files) {
    let content = readFileSync(join(sourceDir, file), 'utf-8');

    // For worker prompts, substitute merge instructions and stage-specific placeholders
    if (file === 'agent2-worker-oneshot.md') {
      content = content.replace('{{MERGE_INSTRUCTIONS}}',
        mergeFragment
          .replace(/\{\{STAGE\}\}/g, 'oneshot')
          .replace(/\{\{WORKFLOW\}\}/g, 'oneshot')
          .replace(/\{\{ARTIFACT_DIR\}\}/g, 'oneshot')
      );
    } else if (file === 'agent2-worker-validate.md') {
      content = content.replace('{{MERGE_INSTRUCTIONS}}',
        mergeFragment
          .replace(/\{\{STAGE\}\}/g, 'validate')
          .replace(/\{\{WORKFLOW\}\}/g, 'staged')
          .replace(/\{\{ARTIFACT_DIR\}\}/g, 'validation')
      );
    }

    writeFileSync(join(destDir, file), content);
    copied++;
  }

  console.log(`   Prompts synced (${copied} files)`);
}
```

Add `writeFileSync` to the imports at top of `src/lib/setup.ts`:
```typescript
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  copyFileSync,
  readdirSync,
} from 'fs';
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes
- [x] `npm run test` passes
- [x] `npm run build` succeeds

#### Manual Verification
- [ ] Run `foundry` with `FOUNDRY_MERGE_MODE=pr` - check `.foundry/prompts/agent2-worker-oneshot.md` contains PR instructions
- [ ] Run `foundry` with default config - check `.foundry/prompts/agent2-worker-oneshot.md` contains merge instructions

---

## Phase 8: Update Agent Prompts (Agent 1 and Agent 3)

### Overview
Update Agent 1 to be aware of the new `∞ Awaiting Merge` status (so it doesn't pick up those issues), and update Agent 3 to handle the new `merge_status: pr_created` value.

### Changes Required

#### 1. Update Agent 1 Prompt

**File**: `prompts/agent1-linear-reader.md`

Update the status list (around line 61-64) to include the new status:

```markdown
- **Intervention status** (requires human action):
  - `∞ Blocked` - Agent needs clarification or decision before proceeding
  - `∞ Awaiting Merge` - Work complete, PR awaiting human review/merge
```

Update the "Do NOT query for" section (around lines 106-109) to include:

```markdown
**Do NOT query for**:
- `∞ Done`, `Done`, `[RL] Done` (completed)
- `∞ Canceled`, `Canceled`, `[RL] Canceled`, `Duplicate` (canceled)
- `∞ Awaiting Merge` (completed, waiting for human to merge PR)
```

#### 2. Update Agent 3 Prompt

**File**: `prompts/agent3-linear-writer.md`

Add PR handling section after the existing "If merge was blocked" section (around line 134):

```markdown
If PR was created (Agent 2 outputs `merge_status: pr_created`):

```
**PR Created** | {loop instance name} | {current timestamp}

**Stage**: {stage completed (validate or oneshot)}
**Loop Instance**: {loop instance name from session stats}
**Duration**: {loop total duration from session stats}
**Branch**: {branch_name}
**Commit**: {commit hash on feature branch}
**PR**: {pr_url}

## Status
Work completed successfully. Pull request created for human review.

## Pull Request
{pr_url}

## Next Steps
1. Review the PR at the link above
2. Approve and merge when ready
3. The Linear status will remain at `∞ Awaiting Merge` until merged

## Cost Summary
| Agent | Model | Tokens (in/out/cached) | Cost |
|-------|-------|----------------------|------|
| Agent 1 | {model} | {in}/{out}/{cached} | ${cost} |
| Agent 2 | {model} | {in}/{out}/{cached} | ${cost} |
| **Total** | - | {totals} | **${total_cost}** |
```
```

Update the "Status Updates" section to include PR handling:

```markdown
### When merge_status is "pr_created"
- **oneshot/validate complete + PR created** → `∞ Awaiting Merge`
  - This indicates the work is done and awaiting human review/merge
  - Include the PR URL in the comment
```

Add PR URL to branch linking section:

```markdown
3. **Attach PR link** (if pr_url provided in WORK_RESULT):
   ```
   mcp__linear__update_issue({
     id: "{issue_id}",
     links: [{
       url: "{pr_url}",
       title: "PR: {pr_title or identifier}"
     }]
   })
   ```
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes

#### Manual Verification
- [ ] Agent 1 does not pick up issues in `∞ Awaiting Merge` status
- [ ] When Agent 2 outputs `merge_status: pr_created`, Agent 3 updates status to `∞ Awaiting Merge`
- [ ] PR URL is attached as a link on the Linear issue
- [ ] Comment includes PR URL and appropriate messaging

---

## Phase 9: Documentation

### Overview
Update CLI help and add documentation for the new feature.

### Changes Required

#### 1. Update CLI Help

**File**: `src/cli.ts`

Add to the help text:
```typescript
  FOUNDRY_MERGE_MODE          "merge" (default) or "pr" (create pull request)
```

#### 2. Update README (if exists)

Add a section explaining merge modes:

```markdown
## Merge Modes

Foundry supports two modes for completing work:

### Direct Merge (default)
```bash
export FOUNDRY_MERGE_MODE=merge
```
Foundry merges completed work directly to main. Best for trusted autonomous operation.

### Pull Request Mode
```bash
export FOUNDRY_MERGE_MODE=pr
```
Foundry creates a pull request instead of merging. The ticket moves to `∞ Awaiting Merge` status until a human reviews and merges the PR. Best for teams that want human oversight.
```

### Success Criteria

#### Automated Verification
- [x] `npm run typecheck` passes

---

## Testing Strategy

### Unit Tests

1. **Config parsing** (`src/lib/__tests__/config.test.ts`)
   - Default value is 'merge'
   - 'pr' value is parsed correctly
   - Case insensitive
   - Invalid values default to 'merge'

2. **Prompt loading** (`src/lib/__tests__/prompts.test.ts`)
   - Template variables are substituted
   - Multiple occurrences are replaced
   - No variables = unchanged content

### Integration Tests (Manual)

1. **PR Mode Flow**
   - Set `FOUNDRY_MERGE_MODE=pr`
   - Run Foundry on a test ticket
   - Verify: PR is created with correct title, body, and footer
   - Verify: Linear status is `∞ Awaiting Merge`
   - Verify: PR URL is linked in Linear

2. **Merge Mode Flow (Regression)**
   - Set `FOUNDRY_MERGE_MODE=merge` (or unset)
   - Run Foundry on a test ticket
   - Verify: Code is merged directly to main
   - Verify: Linear status is `∞ Done`
   - Verify: Behavior unchanged from before this feature

3. **Onboarding Flow**
   - Fresh project, run `foundry`
   - Verify: Merge mode prompt appears
   - Verify: Selected value is saved to `.foundry/env`

### Test Commands

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/lib/__tests__/config.test.ts
```

---

## References

- Research document: `foundry-docs/research/2026-02-01-F-67-add-pr-functionality.md`
- Linear ticket: F-67
