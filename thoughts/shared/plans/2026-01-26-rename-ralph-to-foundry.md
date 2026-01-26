# Rename Ralph to Foundry - Implementation Plan

## Overview

Rename the product from "Ralph" to "Foundry" across the entire codebase, including:
- Package name: `@leixusam/ralph` → `@leixusam/foundry`
- CLI command: `ralph` → `foundry`
- Runtime directory: `.ralph/` → `.foundry/`
- Environment prefix: `RALPH_*` → `FOUNDRY_*`
- Linear status prefix: `[RL]` → `∞`

Core concepts remain unchanged: **pod**, **loop**, **agent**.

## Current State Analysis

Based on research (`thoughts/shared/research/2026-01-26-rename-ralph-to-foundry.md`):
- 383 occurrences of "ralph" across 60+ files
- 5 environment variables with `RALPH_` prefix
- 14 Linear statuses with `[RL]` prefix
- Runtime data in `.ralph/` directory

## Desired End State

After this plan is complete:
- `npm install -g @leixusam/foundry && foundry init && foundry` works
- All user-facing text says "Foundry" not "Ralph"
- Linear statuses use `∞` prefix (e.g., `∞ Needs Research`)
- Configuration uses `FOUNDRY_*` environment variables
- Runtime data stored in `.foundry/` directory
- `npm run build` and `npm run typecheck` pass

## What We're NOT Doing

- Renaming GitHub repository (separate task)
- Updating 66 historical thought documents (they're historical record)
- Backwards compatibility for `RALPH_*` env vars (clean break)
- Changing core concepts: pod, loop, agent

---

## Phase 1: Package & CLI Identity

### Overview
Update npm package configuration to change the package name and CLI command.

### Changes Required:

#### 1. package.json

**File**: `package.json`

```json
{
  "name": "@leixusam/foundry",
  "version": "0.1.0",
  "description": "Linear-orchestrated autonomous agent system",
  "bin": {
    "foundry": "./dist/cli.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/leixusam/ralph-default-files.git"
  },
  "keywords": [
    "ai",
    "autonomous",
    "linear",
    "developer",
    "agent",
    "claude",
    "foundry"
  ]
}
```

Changes:
- Line 2: `"name": "@leixusam/ralph"` → `"@leixusam/foundry"`
- Line 3: `"version": "2.0.0"` → `"0.1.0"` (fresh start)
- Line 8: `"ralph": "./dist/cli.js"` → `"foundry": "./dist/cli.js"`
- Add `"foundry"` to keywords

#### 2. package-lock.json

**File**: `package-lock.json`

Will be regenerated after `npm install`. Changes:
- Line 2: `"name": "@leixusam/ralph"` → `"@leixusam/foundry"`
- Line 8: `"name": "@leixusam/ralph"` → `"@leixusam/foundry"`

### Success Criteria:

#### Automated Verification:
- [x] `npm install` succeeds
- [x] `package-lock.json` shows `@leixusam/foundry`

---

## Phase 2: Source Code Types & Names

### Overview
Rename type definitions and exported names from `Ralph*` to `Foundry*`.

### Changes Required:

#### 1. src/types.ts

**File**: `src/types.ts`

| Line | Old | New |
|------|-----|-----|
| 35 | `RalphStatusDefinition` | `FoundryStatusDefinition` |
| 79 | `RalphConfig` | `FoundryConfig` |

#### 2. src/config.ts

**File**: `src/config.ts`

| Line | Old | New |
|------|-----|-----|
| 4 | `import { RalphConfig, ...` | `import { FoundryConfig, ...` |
| 217 | `export const config: RalphConfig` | `export const config: FoundryConfig` |
| 241 | `export function getConfig(): RalphConfig` | `export function getConfig(): FoundryConfig` |

#### 3. src/lib/linear-api.ts

**File**: `src/lib/linear-api.ts`

| Line | Old | New |
|------|-----|-----|
| 2 | `import { ..., RalphStatusDefinition, ...` | `import { ..., FoundryStatusDefinition, ...` |
| 17 | `interface RalphStatusWithColor extends RalphStatusDefinition` | `interface FoundryStatusWithColor extends FoundryStatusDefinition` |
| 62 | `state: RalphStatusWithColor` | `state: FoundryStatusWithColor` |

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes

---

## Phase 3: Runtime Directory

### Overview
Change all references from `.ralph/` to `.foundry/`.

### Changes Required:

#### 1. src/config.ts

**File**: `src/config.ts`

| Line | Old | New |
|------|-----|-----|
| 17-18 | `loadRalphEnv` | `loadFoundryEnv` |
| 19 | `join(getRepoRoot(), '.ralph', 'env')` | `join(getRepoRoot(), '.foundry', 'env')` |
| 48 | `loadRalphEnv()` | `loadFoundryEnv()` |

#### 2. src/lib/init-project.ts

**File**: `src/lib/init-project.ts`

| Line | Old | New |
|------|-----|-----|
| 83 | `join(projectRoot, '.ralph')` | `join(projectRoot, '.foundry')` |
| 171 | `'Saved configuration to .ralph/env'` | `'Saved configuration to .foundry/env'` |
| 187 | `'Configured Linear MCP in .ralph/mcp.json'` | `'Configured Linear MCP in .foundry/mcp.json'` |
| 191 | `'.ralph/'` | `'.foundry/'` |
| 196 | `'# Ralph runtime data'` | `'# Foundry runtime data'` |
| 197 | `'Added .ralph/ to .gitignore'` | `'Added .foundry/ to .gitignore'` |
| 200-201 | `.ralph/` references | `.foundry/` |

#### 3. src/lib/output-logger.ts

**File**: `src/lib/output-logger.ts`

| Line | Old | New |
|------|-----|-----|
| ~16 | `join(config.workingDirectory, '.ralph', 'output')` | `join(config.workingDirectory, '.foundry', 'output')` |

#### 4. src/lib/stats-logger.ts

**File**: `src/lib/stats-logger.ts`

| Line | Old | New |
|------|-----|-----|
| ~86 | `'.ralph', 'output'` | `'.foundry', 'output'` |

#### 5. src/lib/attachment-downloader.ts

**File**: `src/lib/attachment-downloader.ts`

| Line | Old | New |
|------|-----|-----|
| ~78 | `'.ralph', 'attachments'` | `'.foundry', 'attachments'` |

#### 6. src/lib/claude.ts

**File**: `src/lib/claude.ts`

| Line | Old | New |
|------|-----|-----|
| ~202-203 | `'.ralph', 'mcp.json'` | `'.foundry', 'mcp.json'` |

#### 7. .gitignore

**File**: `.gitignore`

| Line | Old | New |
|------|-----|-----|
| 19 | `# Ralph runtime data` | `# Foundry runtime data` |
| 20-21 | `.ralph/` | `.foundry/` |

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `grep -r "\.ralph" src/` returns no matches

---

## Phase 4: Environment Variables

### Overview
Change environment variable prefix from `RALPH_` to `FOUNDRY_`.

### Changes Required:

#### 1. src/config.ts

**File**: `src/config.ts`

| Line | Old | New |
|------|-----|-----|
| 79 | `Ralph v2 - Linear-orchestrated...` | `Foundry - Linear-orchestrated...` |
| 90 | `RALPH_PROVIDER` | `FOUNDRY_PROVIDER` |
| 91 | `RALPH_CLAUDE_MODEL` | `FOUNDRY_CLAUDE_MODEL` |
| 92 | `RALPH_MAX_ITERATIONS` | `FOUNDRY_MAX_ITERATIONS` |
| 93 | `RALPH_RATE_LIMIT_MAX_RETRIES` | `FOUNDRY_RATE_LIMIT_MAX_RETRIES` |
| 94 | `RALPH_GCP_AUTO_STOP` | `FOUNDRY_GCP_AUTO_STOP` |
| 139 | `process.env.RALPH_PROVIDER` | `process.env.FOUNDRY_PROVIDER` |
| 146 | `process.env.RALPH_CLAUDE_MODEL` | `process.env.FOUNDRY_CLAUDE_MODEL` |
| 163 | `process.env.RALPH_MAX_ITERATIONS` | `process.env.FOUNDRY_MAX_ITERATIONS` |
| 175 | `process.env.RALPH_RATE_LIMIT_MAX_RETRIES` | `process.env.FOUNDRY_RATE_LIMIT_MAX_RETRIES` |
| 189 | `process.env.RALPH_GCP_AUTO_STOP` | `process.env.FOUNDRY_GCP_AUTO_STOP` |

#### 2. src/cli.ts

**File**: `src/cli.ts`

| Line | Old | New |
|------|-----|-----|
| 20 | `RALPH_PROVIDER` | `FOUNDRY_PROVIDER` |
| 21 | `RALPH_CLAUDE_MODEL` | `FOUNDRY_CLAUDE_MODEL` |
| 22 | `RALPH_MAX_ITERATIONS` | `FOUNDRY_MAX_ITERATIONS` |

#### 3. src/lib/init-project.ts

**File**: `src/lib/init-project.ts`

| Line | Old | New |
|------|-----|-----|
| 148 | `# Ralph Configuration` | `# Foundry Configuration` |
| 149 | `# Generated by ralph init` | `# Generated by foundry init` |
| 156 | `RALPH_PROVIDER=` | `FOUNDRY_PROVIDER=` |
| 159 | `RALPH_CLAUDE_MODEL=` | `FOUNDRY_CLAUDE_MODEL=` |
| 166 | `RALPH_MAX_ITERATIONS=` | `FOUNDRY_MAX_ITERATIONS=` |

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `grep -r "RALPH_" src/` returns no matches (except RALPH_STATUS_* which is Phase 5)

---

## Phase 5: Linear Status Prefix

### Overview
Change Linear status prefix from `[RL]` to `∞`.

### Changes Required:

#### 1. src/lib/linear-api.ts

**File**: `src/lib/linear-api.ts`

| Line | Old | New |
|------|-----|-----|
| 5 | `export const RALPH_STATUS_PREFIX = '[RL]';` | `export const FOUNDRY_STATUS_PREFIX = '∞';` |
| 22-36 | All `${RALPH_STATUS_PREFIX}` references | `${FOUNDRY_STATUS_PREFIX}` |
| 86 | `getRalphStatusNames` | `getFoundryStatusNames` |
| 91 | `checkRalphStatusesExist` | `checkFoundryStatusesExist` |
| 100 | `ensureRalphStatuses` | `ensureFoundryStatuses` |

Resulting status names:
- `∞ Backlog`
- `∞ Needs Research`
- `∞ Needs Specification`
- `∞ Needs Plan`
- `∞ Needs Implement`
- `∞ Needs Validate`
- `∞ Research In Progress`
- `∞ Specification In Progress`
- `∞ Plan In Progress`
- `∞ Implement In Progress`
- `∞ Validate In Progress`
- `∞ Oneshot In Progress`
- `∞ Done`
- `∞ Canceled`

#### 2. src/init.ts

**File**: `src/init.ts`

Update all imports and references:
- `RALPH_STATUS_PREFIX` → `FOUNDRY_STATUS_PREFIX`
- `RALPH_STATUS_DEFINITIONS` → `FOUNDRY_STATUS_DEFINITIONS`
- `getRalphStatusNames` → `getFoundryStatusNames`
- `checkRalphStatusesExist` → `checkFoundryStatusesExist`
- `ensureRalphStatuses` → `ensureFoundryStatuses`

#### 3. src/index.ts

**File**: `src/index.ts`

| Line | Old | New |
|------|-----|-----|
| 415 | `'[RL] statuses not found'` | `'∞ statuses not found'` |
| 420 | `'Failed to create [RL] statuses'` | `'Failed to create ∞ statuses'` |
| 426 | `'[RL] Statuses: ✓ configured'` | `'∞ Statuses: ✓ configured'` |

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `grep -r "\[RL\]" src/` returns no matches
- [x] `grep -r "RALPH_STATUS" src/` returns no matches

---

## Phase 6: User-Facing Strings

### Overview
Update all user-facing text from "Ralph" to "Foundry".

### Changes Required:

#### 1. src/cli.ts

**File**: `src/cli.ts`

| Line | Old | New |
|------|-----|-----|
| 9 | `Ralph - Autonomous Product Development Agent` | `Foundry - Autonomous Product Development Agent` |
| 12 | `ralph` | `foundry` |
| 13 | `ralph init` | `foundry init` |
| 14 | `ralph --help` | `foundry --help` |
| 15 | `ralph --version` | `foundry --version` |
| 24 | GitHub URL (keep as-is for now, or update if repo renamed) | - |
| 30 | version `2.0.0` | `0.1.0` |

#### 2. src/lib/init-project.ts

**File**: `src/lib/init-project.ts`

| Line | Old | New |
|------|-----|-----|
| 60 | `║     Ralph - Setup Wizard` | `║     Foundry - Setup Wizard` |
| 233 | `║  ✓ Ralph initialized!` | `║  ✓ Foundry initialized!` |
| 236 | `Run \`ralph\` to start the loop` | `Run \`foundry\` to start the loop` |

#### 3. src/index.ts

**File**: `src/index.ts`

| Line | Old | New |
|------|-----|-----|
| 371 | `Ralph v2 starting...` | `Foundry starting...` |
| 397 | `Cannot start Ralph without Linear configuration.` | `Cannot start Foundry without Linear configuration.` |
| 408 | `Cannot start Ralph without Linear configuration.` | `Cannot start Foundry without Linear configuration.` |

#### 4. src/config.ts

**File**: `src/config.ts`

| Line | Old | New |
|------|-----|-----|
| 79 | `Ralph v2 - Linear-orchestrated autonomous agent system` | `Foundry - Linear-orchestrated autonomous agent system` |

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `grep -ri "ralph" src/` returns only the branch pattern `ralph/` and GitHub URL (which stays)

---

## Phase 7: Documentation

### Overview
Update README, CLAUDE.md, and prompts with new naming.

### Changes Required:

#### 1. README.md

Full rewrite with s/Ralph/Foundry/g and s/ralph/foundry/g:
- Title: `# Foundry - Autonomous Product Development Agent`
- Installation: `npm install -g @leixusam/foundry`
- Commands: `foundry init`, `foundry`
- Directory: `.foundry/` instead of `.ralph/`
- Env vars: `FOUNDRY_PROVIDER`, `FOUNDRY_CLAUDE_MODEL`, etc.
- Statuses: `∞ Needs Research`, `∞ Done`, etc.

#### 2. CLAUDE.md

Update project description and configuration references:
- Title/header
- Runtime directory references
- Environment variable references

#### 3. prompts/agent1-linear-reader.md

Update status prefix documentation:
- `[RL]` → `∞` in all status examples
- Update any "Ralph" references to "Foundry"

#### 4. Other prompts (agent2-worker*.md, agent3-linear-writer.md)

Search and replace any "Ralph" references to "Foundry".

### Success Criteria:

#### Automated Verification:
- [ ] `grep -ri "ralph" README.md` returns no matches (except historical references if any)
- [ ] `grep -ri "\[RL\]" prompts/` returns no matches

#### Manual Verification:
- [ ] README reads correctly and makes sense
- [ ] Help text (`foundry --help`) displays correctly

---

## Phase 8: Verification & Cleanup

### Overview
Build, typecheck, and verify the rename is complete.

### Changes Required:

#### 1. Delete package-lock.json and regenerate

```bash
rm package-lock.json
npm install
```

#### 2. Build and typecheck

```bash
npm run build
npm run typecheck
```

#### 3. Verify no remaining references

```bash
# Should return only intentional references (like git branch pattern)
grep -ri "ralph" src/ --include="*.ts"
grep -ri "\[RL\]" src/ --include="*.ts"
grep -ri "RALPH_" src/ --include="*.ts"
```

#### 4. Test CLI

```bash
node dist/cli.js --help
node dist/cli.js --version
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `node dist/cli.js --help` shows "Foundry" branding
- [ ] `node dist/cli.js --version` shows "0.1.0"

#### Manual Verification:
- [ ] `foundry init` wizard shows "Foundry" branding
- [ ] Linear statuses created with `∞` prefix
- [ ] `.foundry/` directory created (not `.ralph/`)

---

## Testing Strategy

### Unit Tests
No automated tests exist currently. Manual verification required.

### Integration Testing

1. **Fresh init test**:
   ```bash
   cd /tmp && mkdir test-foundry && cd test-foundry
   git init
   node ~/repos/ralph-default-files/dist/cli.js init
   # Verify .foundry/ created, not .ralph/
   ls -la .foundry/
   cat .foundry/env  # Should show FOUNDRY_* vars
   ```

2. **Build verification**:
   ```bash
   cd ~/repos/ralph-default-files
   npm run build
   npm run typecheck
   ```

### Manual Testing Steps

1. Run `node dist/cli.js --help` - verify "Foundry" appears
2. Run `node dist/cli.js init` in a test directory
3. Verify `.foundry/env` contains `FOUNDRY_*` variables
4. Verify `.gitignore` has `.foundry/` entry

---

## References

- Research document: `thoughts/shared/research/2026-01-26-rename-ralph-to-foundry.md`
- Original RSK-41 plan: `thoughts/plans/2025-01-25-RSK-41-installable-package-plan.md`
