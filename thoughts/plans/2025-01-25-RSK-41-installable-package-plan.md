# Implementation Plan: Make Ralph Installable in Other Projects

**Issue**: RSK-41
**Date**: 2025-01-25
**Research**: `thoughts/research/2025-01-25-RSK-41-installable-package-research.md`
**Specification**: N/A
**Status**: Pending Human Review

## Overview

Transform Ralph from a local folder-based tool into an installable npm package that can be added to any Node.js project. This enables Ralph to be used for autonomous development on any project, not just the Ralph repository itself.

## Key Decisions & Recommendations

Based on the research, the following decisions are recommended for human review:

### 1. Package Distribution Method: **npm Package** (Recommended)

**Recommendation**: Publish as `@leixusam/ralph` (scoped package)

**Rationale**:
- npm is the standard way to distribute Node.js tools
- Supports both local (`npm install --save-dev`) and global (`npm install -g`) installation
- Version pinning via `package.json` ensures reproducibility
- Easy updates via `npm update`
- Works with `npx @leixusam/ralph` for one-off execution

**Trade-off considered**: Copy-paste is simpler initially but has no update mechanism and requires manual intervention for each new project.

### 2. Package Scope: **@leixusam/ralph** (Scoped)

**Rationale**:
- Avoids namespace conflicts with other packages
- Clear ownership indicator
- Can be published immediately without claiming global name "ralph"

### 3. Claude Commands: **Manual Setup with Documentation**

**Rationale**:
- Claude Code discovers commands from `.claude/commands/` in the project root
- A `postinstall` script that modifies the project root is invasive
- Users should explicitly opt-in to installing Ralph's commands
- Provide a CLI command: `ralph init-commands` that copies commands

### 4. Breaking Change Policy: **Semver with Changelog**

**Rationale**:
- Use semantic versioning (major.minor.patch)
- Document breaking changes in CHANGELOG.md
- Agent prompts are "internal" - prompt changes don't constitute breaking changes
- Only API/CLI changes follow semver rules

### 5. Create-Ralph Scaffolding: **Defer** (Not in initial release)

**Rationale**:
- npm package approach is sufficient for initial release
- Scaffolding adds maintenance burden
- Can be added later if user feedback warrants it

## Success Criteria

- [ ] `npm install -g @leixusam/ralph && ralph` works from any project
- [ ] `npm install --save-dev @leixusam/ralph && npx ralph` works from any project
- [ ] `ralph --help` displays usage information
- [ ] `ralph init-commands` installs Claude Code commands to project root
- [ ] Prompts load correctly whether running from npm or local development
- [ ] Ralph can still develop itself (nested usage works)
- [ ] All tests pass: N/A (no test suite currently)
- [ ] Type check passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`

## Phases

### Phase 1: Package.json Configuration for npm Publishing

**Goal**: Configure Ralph's package.json for npm distribution

**Changes**:
- `ralph/package.json`: Add npm publishing configuration
  - Add `bin` field pointing to CLI entry point
  - Add `files` field to include `dist/`, `prompts/`, `.claude/`
  - Add `publishConfig` for scoped package
  - Add `repository`, `bugs`, `homepage` fields
  - Add `keywords` for discoverability

**New package.json fields**:
```json
{
  "name": "@leixusam/ralph",
  "bin": {
    "ralph": "./dist/cli.js"
  },
  "files": [
    "dist/**/*",
    "prompts/**/*",
    ".claude/**/*"
  ],
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/leixusam/ralph-default-files.git"
  }
}
```

**Verification**:
```bash
cd ralph && npm pack --dry-run
# Should list all files that would be included
# Verify dist/, prompts/, .claude/ are present
```

### Phase 2: CLI Entry Point with Shebang

**Goal**: Create a proper CLI entry point that works when installed via npm

**Changes**:
- `ralph/src/cli.ts`: New file - CLI entry point with shebang
  - Add `#!/usr/bin/env node` shebang
  - Import and run `main()` from existing `index.ts`
  - Handle CLI-specific concerns (version display, etc.)
- `ralph/src/index.ts`: Refactor to export `main()` function
  - Move main logic to exportable function
  - Keep module execution for backward compatibility

**File: `ralph/src/cli.ts`**:
```typescript
#!/usr/bin/env node
import { main } from './index.js';
main().catch(console.error);
```

**File: `ralph/src/index.ts`** changes:
```typescript
// Export main for CLI entry point
export async function main(): Promise<void> {
  // ... existing main() body
}

// Run if executed directly (backward compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
```

**Note**: The shebang approach is standard for npm bin scripts. The separate cli.ts file keeps concerns clean.

**Verification**:
```bash
npm run build
node dist/cli.js --help
# Should display help message
```

### Phase 3: Fix Prompt Path Resolution for npm Installation

**Goal**: Ensure prompts load correctly whether Ralph is running from npm package or local development

**Changes**:
- `ralph/src/lib/prompts.ts`: Update path resolution logic
  - Detect if running from npm package vs local development
  - Compute path relative to package root, not compiled file location
  - Add fallback for both installation modes

**Current code** (`prompts.ts`):
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(__dirname, '../../prompts');
```

**Updated code**:
```typescript
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPromptsDir(): string {
  // When running from npm package: dist/lib/prompts.js
  // prompts/ is sibling to dist/ in package root
  const npmPath = join(__dirname, '../../prompts');
  if (existsSync(npmPath)) {
    return npmPath;
  }

  // Fallback: local development structure
  // This path should also work, but check explicitly for clarity
  const devPath = join(__dirname, '../../prompts');
  if (existsSync(devPath)) {
    return devPath;
  }

  throw new Error(`Cannot find prompts directory. Checked: ${npmPath}`);
}

const promptsDir = getPromptsDir();
```

**Verification**:
```bash
# Test 1: Local development
npm run build && node dist/cli.js --help

# Test 2: Simulated npm install
npm pack
cd /tmp && mkdir test-project && cd test-project
npm init -y
npm install ../path/to/ralph/leixusam-ralph-2.0.0.tgz
npx ralph --help
```

### Phase 4: Add `ralph init-commands` CLI Command

**Goal**: Provide a command to install Claude Code commands into the target project

**Changes**:
- `ralph/src/cli.ts`: Add command parsing for `init-commands`
- `ralph/src/lib/init-commands.ts`: New file - logic to copy commands

**Logic for `init-commands`**:
1. Find the git repo root (or current directory if not in git repo)
2. Create `.claude/commands/` directory if it doesn't exist
3. Copy all `.md` files from Ralph's `.claude/commands/` to project root
4. Report what was installed

**File: `ralph/src/lib/init-commands.ts`**:
```typescript
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { getRepoRoot } from '../config.js';

export async function initCommands(): Promise<void> {
  const projectRoot = getRepoRoot();
  const targetDir = join(projectRoot, '.claude', 'commands');

  // Find Ralph's commands directory
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourceDir = join(__dirname, '../../.claude/commands');

  if (!existsSync(sourceDir)) {
    console.error('Error: Ralph commands directory not found');
    process.exit(1);
  }

  // Create target directory
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    console.log(`Created ${targetDir}`);
  }

  // Copy command files
  const files = readdirSync(sourceDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const src = join(sourceDir, file);
    const dest = join(targetDir, file);
    copyFileSync(src, dest);
    console.log(`Installed: .claude/commands/${file}`);
  }

  console.log(`\nInstalled ${files.length} Claude Code command(s).`);
  console.log('Restart Claude Code to use them.');
}
```

**Verification**:
```bash
cd /tmp/test-project
npx ralph init-commands
ls -la .claude/commands/
# Should show installed command files
```

### Phase 5: Add Update Notifications

**Goal**: Notify users when a newer version of Ralph is available

**Changes**:
- `ralph/package.json`: Add `update-notifier` dependency
- `ralph/src/cli.ts`: Check for updates on startup

**Implementation**:
```typescript
// At the top of cli.ts after shebang
import updateNotifier from 'update-notifier';
import pkg from '../package.json' assert { type: 'json' };

// Check for updates (non-blocking)
updateNotifier({ pkg }).notify();
```

**Note**: `update-notifier` is lightweight and non-intrusive. It caches update checks and only shows a message after 1+ day since last check.

**Alternative without dependency**: Skip this phase if we want to avoid adding dependencies. Users can check npm for updates manually.

**Verification**:
```bash
# After publishing a new version, the old version should show:
# "Update available 2.0.0 → 2.1.0"
# "Run npm install -g @leixusam/ralph to update"
```

### Phase 6: Documentation and README Updates

**Goal**: Update documentation to explain installation and usage

**Changes**:
- `ralph/README.md`: Complete rewrite with installation instructions
  - Installation options (global, local, npx)
  - Configuration (`.ralph.env`, environment variables)
  - Usage examples
  - Updating Ralph
  - Claude Code commands setup
- `CHANGELOG.md`: Create changelog for version tracking

**README.md structure**:
```markdown
# Ralph - Autonomous Product Development Agent

## Installation

### Global Installation (Recommended)
npm install -g @leixusam/ralph

### Local Project Installation
npm install --save-dev @leixusam/ralph

### One-off Execution
npx @leixusam/ralph

## Setup

### 1. Configure Linear
Create `.ralph.env` in your project root:
LINEAR_API_KEY=lin_api_xxxxx
LINEAR_TEAM_KEY=your-team-id

### 2. Install Claude Code Commands (Optional)
ralph init-commands

### 3. Configure MCP for Linear
...

## Usage

ralph                    # Run main loop
ralph --help             # Show help
ralph --provider codex   # Use Codex instead of Claude
ralph init-commands      # Install Claude Code commands

## Updating

npm update -g @leixusam/ralph

## Development

For developing Ralph itself, see CONTRIBUTING.md.
```

**Verification**:
- Manual review of documentation clarity
- Test each installation method from README

### Phase 7: Repository Structure Clarification

**Goal**: Clarify the relationship between `ralph-default-files` (development repo) and `@leixusam/ralph` (npm package)

**Context from user's question**:
> "I want to use this repo really just for building the raw autonomous development agent by itself"

**Recommendation**: Keep the current structure where:
- `ralph-default-files/` is the development repository
- `ralph/` subdirectory contains the publishable package
- `thoughts/` at project root stores Ralph's work artifacts for developing Ralph

**This works because**:
1. Ralph uses `git rev-parse --show-toplevel` to find the project root
2. When developing Ralph itself, the root is `ralph-default-files/`
3. When installed in another project, the root is that project's directory
4. Artifacts (`thoughts/`) always go to the project being developed, not inside Ralph

**No code changes needed** - the architecture already supports this. Add a section to README explaining this for clarity.

**Verification**:
- Run Ralph from `ralph-default-files/` to develop itself
- Install Ralph in a test project and verify artifacts go to that project's root

## Testing Strategy

### Unit Testing
No existing test suite. Consider adding tests for:
- `prompts.ts` path resolution (different installation contexts)
- `init-commands.ts` file copying logic
- CLI argument parsing

### Integration Testing
1. **Local Development Flow**:
   ```bash
   cd ralph-default-files/ralph
   npm run build
   node dist/cli.js --help
   ```

2. **npm Pack Test**:
   ```bash
   npm pack
   # Creates leixusam-ralph-2.0.0.tgz
   ```

3. **Simulated Installation Test**:
   ```bash
   mkdir /tmp/test-project && cd /tmp/test-project
   npm init -y
   npm install ~/repos/ralph-default-files/ralph/leixusam-ralph-2.0.0.tgz
   npx ralph --help
   npx ralph init-commands
   ```

4. **Nested Development Test**:
   ```bash
   cd ~/repos/ralph-default-files
   npm start
   # Ralph should work on itself
   # thoughts/ artifacts should appear in ralph-default-files/thoughts/
   ```

### Manual Acceptance Testing
- [ ] Global install + run works
- [ ] Local install + npx works
- [ ] `--help` displays correctly
- [ ] `init-commands` installs commands
- [ ] Prompts load in both dev and npm modes
- [ ] Ralph can still develop itself

## Rollback Plan

If issues arise after npm publish:
1. `npm unpublish @leixusam/ralph@{version}` (within 72 hours)
2. Or publish a patch version with fixes
3. Users can pin to previous version: `npm install @leixusam/ralph@2.0.0`

For local development, git revert to the commit before these changes.

## Estimated Scope

| Phase | LOC Change (Est.) | Files |
|-------|-------------------|-------|
| 1: package.json | ~20 | 1 |
| 2: CLI entry | ~30 | 2 |
| 3: Prompt paths | ~30 | 1 |
| 4: init-commands | ~50 | 2 |
| 5: Update notifier | ~10 | 2 |
| 6: Documentation | ~200 | 2-3 |
| 7: Structure docs | ~50 | 1 |
| **Total** | **~390** | **~12 files** |

This is well under the 1000 LOC threshold for sub-issues.

## Notes for Implementer

1. **Shebang handling**: TypeScript won't preserve the shebang during compilation. Either:
   - Use a separate `cli.ts` file with `#!/usr/bin/env node` as the first line
   - Or use a build script that prepends the shebang to `dist/cli.js`

2. **ES Module considerations**: The `assert { type: 'json' }` syntax for importing JSON may require Node.js 18+ or TypeScript configuration adjustments.

3. **update-notifier**: This adds a dependency. If keeping Ralph dependency-free (except `@linear/sdk`) is important, skip Phase 5 or implement a simple version check manually.

4. **npm publish credentials**: Will need npm account setup and authentication before publishing. This is a one-time manual step not covered in the implementation.

## Open Questions Resolved

1. **npm scope**: Scoped (`@leixusam/ralph`) - avoids conflicts, clear ownership
2. **Primary method**: npm package - standard, well-supported
3. **Claude commands**: Manual with `init-commands` CLI - explicit opt-in
4. **Breaking changes**: Semver with changelog
5. **create-ralph**: Deferred - not needed initially

---

**Status**: Pending human review before implementation begins.
