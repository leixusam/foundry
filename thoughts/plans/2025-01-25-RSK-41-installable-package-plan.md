# Implementation Plan: Make Ralph Installable in Other Projects

**Issue**: RSK-41
**Date**: 2025-01-25
**Research**: `thoughts/research/2025-01-25-RSK-41-installable-package-research.md`
**Specification**: N/A
**Status**: Implemented

## Overview

Transform Ralph from a nested folder-based tool into a flat, installable npm package that can be added to any Node.js project. This involves:
1. Flattening the repository structure (removing the `ralph/` subdirectory)
2. Using `.ralph/` folder for runtime data in user projects (gitignored)
3. Keeping `thoughts/` at project root for multi-agent collaboration (committed)

This enables Ralph to be used for autonomous development on any project, not just the Ralph repository itself.

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

### 6. Repository Structure: **Flat** (No nested ralph/ folder)

**Rationale**:
- Simpler structure - one package.json, no `--prefix ralph` workarounds
- Standard layout - looks like any normal Node.js project
- Easier publishing - `npm publish` from root

**Source structure (the npm package)**:
```
ralph-default-files/        # Development repo / npm package source
├── src/                    # TypeScript source (was ralph/src/)
├── dist/                   # Compiled JavaScript
├── prompts/                # Agent prompts (was ralph/prompts/)
├── .claude/commands/       # Slash commands (was ralph/.claude/commands/)
├── thoughts/               # Work artifacts (at project root)
├── package.json            # Single package.json
└── tsconfig.json
```

**User's project structure (after installing)**:
```
their-app/
├── node_modules/@leixusam/ralph/   # Ralph code (installed by npm)
├── .ralph/                          # Runtime data (gitignored)
│   ├── env                          # Linear credentials
│   ├── output/                      # Runtime logs
│   └── attachments/                 # Downloaded files
├── .claude/commands/               # Copied by `ralph init`
├── thoughts/                        # Work artifacts (committed)
└── CLAUDE.md                       # User's project instructions (optional)
```

### 7. Runtime Data Location: **`.ralph/` folder** (gitignored)

**Rationale**:
- One gitignore entry: just `.ralph/`
- Clean project root - no dotfile clutter
- Clear separation - Ralph's runtime data vs user's code
- Easy to reset - `rm -rf .ralph` starts fresh

**Path changes**:
| Old Path | New Path |
|----------|----------|
| `.ralph.env` | `.ralph/env` |
| `.mcp.json` | `.ralph/mcp.json` |
| `ralph/.output/` | `.ralph/output/` |
| `ralph/.attachments/` | `.ralph/attachments/` |

### 8. Work Artifacts: **`thoughts/` at project root** (committed)

**Rationale**:
- Useful for multi-agent collaboration
- Research, plans, validation reports should be version controlled
- Multiple agents/sessions can build on each other's work
- Knowledge persists across sessions and machines

## Success Criteria

- [x] Repository flattened - no more `ralph/` subdirectory
- [x] `npm install -g @leixusam/ralph && ralph` works from any project
- [x] `npm install --save-dev @leixusam/ralph && npx ralph` works from any project
- [x] `ralph --help` displays usage information
- [x] `ralph init` sets up `.ralph/`, `.gitignore`, `.claude/commands/`, and `thoughts/`
- [x] `ralph init` creates `.ralph/mcp.json` with Linear MCP configuration
- [x] `ralph init` prompts for all config options (Linear, provider, model, iterations)
- [x] `ralph init` checks if Claude Code / Codex CLI are installed
- [x] Runtime data goes to `.ralph/` (env, mcp.json, output, attachments)
- [x] Work artifacts go to `thoughts/` at project root
- [x] Claude Code discovers MCP config from `.ralph/mcp.json`
- [x] Prompts load correctly whether running from npm or local development
- [x] Ralph can still develop itself (run from source during development)
- [x] Type check passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

## Phases

### Phase 0: Flatten Repository Structure [DONE]

**Goal**: Remove the nested `ralph/` folder and move everything to the repository root

**File moves**:
```
ralph/src/           → src/
ralph/prompts/       → prompts/
ralph/.claude/       → .claude/
ralph/package.json   → package.json (merge with root)
ralph/tsconfig.json  → tsconfig.json
ralph/README.md      → README.md
ralph/CLAUDE.md      → CLAUDE.md (merge/update)
ralph/AGENTS.md      → AGENTS.md
```

**Delete**:
- Root `package.json` (proxy scripts no longer needed)
- `ralph/` directory (after moving contents)

**Update root `package.json`**:
- Merge scripts from `ralph/package.json`
- Remove `--prefix ralph` from all scripts
- Keep dependencies from `ralph/package.json`

**Update `tsconfig.json`**:
- Paths should work as-is since they're relative

**Verification**:
```bash
npm install
npm run build
npm run typecheck
# All should pass with new structure
```

### Phase 1: Update Runtime Paths to `.ralph/` Folder [DONE]

**Goal**: Change all runtime data paths from scattered locations to unified `.ralph/` folder

**Files to update**:

1. **`src/config.ts`** - Environment file path:
   ```typescript
   // Old: const envPath = join(getRepoRoot(), '.ralph.env');
   // New:
   const envPath = join(getRepoRoot(), '.ralph', 'env');
   ```

2. **`src/init.ts`** - Environment file creation:
   ```typescript
   // Old: const envPath = join(getRepoRoot(), '.ralph.env');
   // New:
   const ralphDir = join(getRepoRoot(), '.ralph');
   if (!existsSync(ralphDir)) {
     mkdirSync(ralphDir, { recursive: true });
   }
   const envPath = join(ralphDir, 'env');
   ```

3. **`src/lib/output-logger.ts`** - Output directory:
   ```typescript
   // Old: return join(config.workingDirectory, 'ralph', '.output');
   // New:
   return join(config.workingDirectory, '.ralph', 'output');
   ```

4. **`src/lib/stats-logger.ts`** - Stats output:
   ```typescript
   // Old: const outputDir = join(config.workingDirectory, 'ralph', '.output');
   // New:
   const outputDir = join(config.workingDirectory, '.ralph', 'output');
   ```

5. **`src/lib/attachment-downloader.ts`** - Attachments directory:
   ```typescript
   // Old: const ralphDir = path.join(process.cwd(), 'ralph');
   //      const attachmentsDir = path.join(ralphDir, '.attachments', issueIdentifier);
   // New (also fix: use getRepoRoot() instead of process.cwd()):
   import { getRepoRoot } from '../config.js';
   const attachmentsDir = path.join(getRepoRoot(), '.ralph', 'attachments', issueIdentifier);
   ```
   **Note**: Current code incorrectly uses `process.cwd()` instead of `config.workingDirectory`. Fix this inconsistency.

6. **`src/lib/claude.ts`** - MCP configuration path for Claude Code:
   ```typescript
   // Add --mcp-config flag to Claude spawn arguments
   const args = [
     '-p',
     '--dangerously-skip-permissions',
     '--output-format=stream-json',
     '--model', options.model,
     '--verbose',
     '--mcp-config', join(config.workingDirectory, '.ralph', 'mcp.json'),  // NEW
   ];
   ```
   **Note**: Need to verify the exact CLI flag name. May be `--mcp-config` or similar.

7. **`src/init.ts`** - MCP configuration path (if keeping this file):
   ```typescript
   // Old: const mcpPath = join(getRepoRoot(), '.mcp.json');
   // New:
   const mcpPath = join(getRepoRoot(), '.ralph', 'mcp.json');
   ```

8. **`.gitignore`** - Update patterns:
   ```gitignore
   # Old patterns:
   # .ralph.env
   # ralph/.output/
   # ralph/.attachments/

   # New pattern (one line covers all):
   .ralph/
   ```

**Verification**:
```bash
npm run build
npm start
# Check that .ralph/ directory is created with env, output/, attachments/
```

### Phase 2: Package.json Configuration for npm Publishing [DONE]

**Goal**: Configure package.json for npm distribution

**Changes to `package.json`**:
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
npm pack --dry-run
# Should list all files that would be included
# Verify dist/, prompts/, .claude/ are present
```

### Phase 3: CLI Entry Point with Shebang [DONE]

**Goal**: Create a proper CLI entry point that works when installed via npm

**Changes**:
- `src/cli.ts`: New file - CLI entry point with shebang
- `src/index.ts`: Refactor to export `main()` function

**File: `src/cli.ts`**:
```typescript
#!/usr/bin/env node
import { main } from './index.js';

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Ralph - Autonomous Product Development Agent

Usage:
  ralph              Run the main development loop
  ralph init         Initialize Ralph in current project
  ralph --help       Show this help message
  ralph --version    Show version

Environment:
  RALPH_PROVIDER     "claude" (default) or "codex"
  RALPH_CLAUDE_MODEL "opus" (default), "sonnet", or "haiku"
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  // Version from package.json
  console.log('2.0.0');
  process.exit(0);
}

if (args[0] === 'init') {
  import('./lib/init-project.js').then(m => m.initProject());
} else {
  main().catch(console.error);
}
```

**File: `src/index.ts`** changes:
```typescript
// Export main for CLI entry point
export async function main(): Promise<void> {
  // ... existing main() body
}
```

**Verification**:
```bash
npm run build
node dist/cli.js --help
# Should display help message
```

### Phase 4: Prompt Path Resolution for npm Installation [DONE]

**Goal**: Ensure prompts load correctly whether running from npm package or local development

**Changes to `src/lib/prompts.ts`**:
```typescript
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPromptsDir(): string {
  // When compiled: dist/lib/prompts.js
  // prompts/ is sibling to dist/ in package root
  const promptsPath = join(__dirname, '../../prompts');
  if (existsSync(promptsPath)) {
    return promptsPath;
  }
  throw new Error(`Cannot find prompts directory. Checked: ${promptsPath}`);
}

const promptsDir = getPromptsDir();
```

**Verification**:
```bash
# Test 1: Local development
npm run build && node dist/cli.js

# Test 2: Simulated npm install
npm pack
cd /tmp && mkdir test-project && cd test-project
npm init -y
npm install ~/repos/ralph-default-files/leixusam-ralph-2.0.0.tgz
npx ralph --help
```

### Phase 5: Add `ralph init` Command (Full Setup Wizard) [DONE]

**Goal**: Move all initialization logic from main loop to `ralph init` with a full interactive wizard

**Changes**:
1. Move all setup from `src/init.ts` into `ralph init`
2. Check if Claude Code and Codex CLI are installed
3. Prompt for all configuration with sensible defaults
4. Remove auto-initialization from main loop - just error if not configured

**Configuration options to prompt for**:
| Option | Default | Description |
|--------|---------|-------------|
| LINEAR_API_KEY | (required) | Linear API key |
| LINEAR_TEAM_KEY | (required) | Linear team identifier |
| RALPH_PROVIDER | "claude" | "claude" or "codex" |
| RALPH_CLAUDE_MODEL | "opus" | "opus", "sonnet", or "haiku" |
| RALPH_MAX_ITERATIONS | 0 | Max iterations (0 = unlimited) |
| CODEX_MODEL | "o3" | Codex model name |
| CODEX_REASONING_EFFORT | "high" | "low", "medium", "high", "extra_high" |

**New file: `src/lib/init-project.ts`**:
```typescript
import { existsSync, mkdirSync, copyFileSync, readdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { getRepoRoot } from '../config.js';

// Check if a CLI tool is installed
function isInstalled(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Prompt helper with default value
async function prompt(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: string
): Promise<string> {
  return new Promise(resolve => {
    rl.question(`${question} [${defaultValue}]: `, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

export async function initProject(): Promise<void> {
  const projectRoot = getRepoRoot();
  const __dirname = dirname(fileURLToPath(import.meta.url));

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Ralph - Setup Wizard               ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`Initializing in: ${projectRoot}`);
  console.log('');

  // 1. Check installed providers
  const claudeInstalled = isInstalled('claude');
  const codexInstalled = isInstalled('codex');

  console.log('Detected providers:');
  console.log(`  Claude Code: ${claudeInstalled ? '✓ installed' : '✗ not found'}`);
  console.log(`  Codex CLI:   ${codexInstalled ? '✓ installed' : '✗ not found'}`);
  console.log('');

  if (!claudeInstalled && !codexInstalled) {
    console.error('Error: No LLM provider found. Install Claude Code or Codex CLI first.');
    console.error('  Claude Code: npm install -g @anthropic-ai/claude-code');
    console.error('  Codex CLI:   See https://github.com/openai/codex');
    process.exit(1);
  }

  // 2. Create .ralph/ directory
  const ralphDir = join(projectRoot, '.ralph');
  if (!existsSync(ralphDir)) {
    mkdirSync(ralphDir, { recursive: true });
  }

  // 3. Load existing config if present
  const envPath = join(ralphDir, 'env');
  const existingEnv = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  const getExisting = (key: string): string => {
    const match = existingEnv.match(new RegExp(`${key}=(.+)`));
    return match ? match[1] : '';
  };

  // 4. Interactive setup
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Linear credentials
  console.log('─── Linear Configuration ───');
  console.log('Get your API key from: https://linear.app/settings/api');
  console.log('');

  const linearApiKey = getExisting('LINEAR_API_KEY')
    ? (console.log('LINEAR_API_KEY: (already set)'), getExisting('LINEAR_API_KEY'))
    : await prompt(rl, 'LINEAR_API_KEY', '');

  const linearTeamKey = getExisting('LINEAR_TEAM_KEY')
    ? (console.log('LINEAR_TEAM_KEY: (already set)'), getExisting('LINEAR_TEAM_KEY'))
    : await prompt(rl, 'LINEAR_TEAM_KEY', '');

  console.log('');

  // Provider selection
  console.log('─── Provider Configuration ───');
  const defaultProvider = claudeInstalled ? 'claude' : 'codex';
  const provider = await prompt(rl, 'Provider (claude/codex)', defaultProvider);

  let claudeModel = 'opus';
  let codexModel = 'o3';
  let codexEffort = 'high';

  if (provider === 'claude') {
    claudeModel = await prompt(rl, 'Claude model (opus/sonnet/haiku)', 'opus');
  } else {
    codexModel = await prompt(rl, 'Codex model', 'o3');
    codexEffort = await prompt(rl, 'Reasoning effort (low/medium/high/extra_high)', 'high');
  }

  console.log('');

  // Iteration limit
  console.log('─── Loop Configuration ───');
  const maxIterations = await prompt(rl, 'Max iterations (0 = unlimited)', '0');

  rl.close();

  // 5. Save configuration
  const envContent = `# Ralph Configuration
# Generated by ralph init

# Linear (required)
LINEAR_API_KEY=${linearApiKey}
LINEAR_TEAM_KEY=${linearTeamKey}

# Provider: "claude" or "codex"
RALPH_PROVIDER=${provider}

# Claude options
RALPH_CLAUDE_MODEL=${claudeModel}

# Codex options
CODEX_MODEL=${codexModel}
CODEX_REASONING_EFFORT=${codexEffort}

# Loop options (0 = unlimited)
RALPH_MAX_ITERATIONS=${maxIterations}
`;

  writeFileSync(envPath, envContent);
  console.log('');
  console.log('Saved configuration to .ralph/env');

  // 6. Configure MCP for Linear (Claude Code needs this)
  const mcpPath = join(ralphDir, 'mcp.json');
  const mcpConfig = {
    mcpServers: {
      linear: {
        type: 'http',
        url: 'https://mcp.linear.app/mcp',
        headers: {
          Authorization: `Bearer ${linearApiKey}`
        }
      }
    }
  };
  writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');
  console.log('Configured Linear MCP in .ralph/mcp.json');

  // 7. Add .ralph/ to .gitignore
  const gitignorePath = join(projectRoot, '.gitignore');
  const gitignoreEntry = '.ralph/';

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(gitignoreEntry)) {
      appendFileSync(gitignorePath, `\n# Ralph runtime data\n${gitignoreEntry}\n`);
      console.log('Added .ralph/ to .gitignore');
    }
  } else {
    writeFileSync(gitignorePath, `# Ralph runtime data\n${gitignoreEntry}\n`);
    console.log('Created .gitignore with .ralph/');
  }

  // 8. Copy Claude Code commands
  const sourceCommandsDir = join(__dirname, '../../.claude/commands');
  const targetCommandsDir = join(projectRoot, '.claude', 'commands');

  if (existsSync(sourceCommandsDir)) {
    if (!existsSync(targetCommandsDir)) {
      mkdirSync(targetCommandsDir, { recursive: true });
    }

    const files = readdirSync(sourceCommandsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      copyFileSync(join(sourceCommandsDir, file), join(targetCommandsDir, file));
    }
    console.log(`Installed ${files.length} Claude Code command(s) to .claude/commands/`);
  }

  // 9. Create thoughts/ directory
  const thoughtsDir = join(projectRoot, 'thoughts');
  if (!existsSync(thoughtsDir)) {
    mkdirSync(thoughtsDir, { recursive: true });
    console.log('Created thoughts/ directory');
  }

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  ✓ Ralph initialized!                  ║');
  console.log('║                                        ║');
  console.log('║  Run `ralph` to start the loop.        ║');
  console.log('╚════════════════════════════════════════╝');
}
```

**Update `src/index.ts`** - Remove auto-initialization, just validate:
```typescript
export async function main(): Promise<void> {
  const config = getConfig();

  // Check if initialized (credentials exist)
  if (!config.linearApiKey || !config.linearTeamKey) {
    console.error('Ralph is not configured. Run `ralph init` first.');
    process.exit(1);
  }

  // ... rest of main loop
}
```

**Delete or simplify `src/init.ts`**:
- Remove the interactive credential prompting (moved to init-project.ts)
- Keep only validation helpers if needed

**Verification**:
```bash
cd /tmp/test-project
npx ralph init
ls -la .ralph/
ls -la .claude/commands/
cat .gitignore
```

### Phase 6: Add Update Notifications (Optional)

**Goal**: Notify users when a newer version of Ralph is available

**Changes**:
- `package.json`: Add `update-notifier` dependency
- `src/cli.ts`: Check for updates on startup

**Implementation in `src/cli.ts`**:
```typescript
import updateNotifier from 'update-notifier';
import pkg from '../package.json' assert { type: 'json' };

// Check for updates (non-blocking)
updateNotifier({ pkg }).notify();
```

**Note**: This adds a dependency. Can be skipped if we want to keep Ralph dependency-minimal.

### Phase 6: Add Update Notifications (Optional) [SKIPPED]

Per plan, this phase is optional and deferred.

### Phase 7: Documentation Updates [DONE]

**Goal**: Update documentation to reflect new structure

**Files to update**:
- `README.md`: Installation and usage instructions
- `CLAUDE.md`: Updated paths and structure
- `AGENTS.md`: Build commands without `--prefix ralph`

**README.md structure**:
```markdown
# Ralph - Autonomous Product Development Agent

## Installation

### Global Installation (Recommended)
npm install -g @leixusam/ralph

### Local Project Installation
npm install --save-dev @leixusam/ralph

## Setup

ralph init

This creates:
- `.ralph/env` - Add your Linear API key here
- `.ralph/` added to `.gitignore`
- `.claude/commands/` - Claude Code slash commands
- `thoughts/` - Work artifact directory

## Usage

ralph              # Run main loop
ralph init         # Initialize in current project
ralph --help       # Show help

## Developing Ralph

# Clone the repo
git clone https://github.com/leixusam/ralph-default-files
cd ralph-default-files

# Install and build
npm install
npm run build

# Run from source
npm start
```

**Verification**:
- Manual review of documentation
- Test installation flow from README

## Testing Strategy

### Unit Testing
No existing test suite. Consider adding tests for:
- `prompts.ts` path resolution (different installation contexts)
- `init-project.ts` initialization logic
- CLI argument parsing

### Integration Testing
1. **Local Development Flow**:
   ```bash
   cd ralph-default-files
   npm install
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
   npm install ~/repos/ralph-default-files/leixusam-ralph-2.0.0.tgz
   npx ralph --help
   npx ralph init
   ls -la .ralph/
   ls -la .claude/commands/
   ```

4. **Self-Development Test**:
   ```bash
   cd ~/repos/ralph-default-files
   npm start
   # Ralph should work on itself
   # Runtime data in .ralph/
   # Work artifacts in thoughts/
   ```

### Manual Acceptance Testing
- [ ] Global install + run works
- [ ] Local install + npx works
- [ ] `--help` displays correctly
- [ ] `ralph init` creates .ralph/, .gitignore entry, .claude/commands/, thoughts/
- [ ] Runtime data goes to .ralph/ (output, attachments)
- [ ] Prompts load in both dev and npm modes
- [ ] Ralph can still develop itself (run from source)

## Rollback Plan

If issues arise after npm publish:
1. `npm unpublish @leixusam/ralph@{version}` (within 72 hours)
2. Or publish a patch version with fixes
3. Users can pin to previous version: `npm install @leixusam/ralph@2.0.0`

For local development, git revert to the commit before these changes.

## Estimated Scope

| Phase | LOC Change (Est.) | Files |
|-------|-------------------|-------|
| 0: Flatten structure | ~0 (file moves) | ~15 files moved |
| 1: Runtime paths + MCP | ~70 | 8 (config, init, output-logger, stats-logger, attachment-downloader, claude, codex, .gitignore) |
| 2: package.json | ~20 | 1 |
| 3: CLI entry | ~50 | 2 |
| 4: Prompt paths | ~20 | 1 |
| 5: ralph init (full wizard + MCP) | ~200 | 3 (new init-project.ts, update index.ts, delete init.ts) |
| 6: Update notifier | ~10 | 2 |
| 7: Documentation | ~150 | 3 |
| 8: Cleanup | ~0 | 1 (delete legacy ralph.sh or mark deprecated) |
| **Total** | **~520** | **~14 files modified** |

This is well under the 1000 LOC threshold for sub-issues.

## Notes for Implementer

1. **Phase 0 order matters**: Flatten the structure first, then make code changes. This avoids having to update paths twice.

2. **Shebang handling**: TypeScript won't preserve the shebang during compilation. Either:
   - Use a separate `cli.ts` file with `#!/usr/bin/env node` as the first line
   - Or use a build script that prepends the shebang to `dist/cli.js`

3. **ES Module considerations**: The `assert { type: 'json' }` syntax for importing JSON may require Node.js 18+ or TypeScript configuration adjustments.

4. **update-notifier**: This adds a dependency. If keeping Ralph dependency-free (except `@linear/sdk`) is important, skip Phase 6 or implement a simple version check manually.

5. **npm publish credentials**: Will need npm account setup and authentication before publishing. This is a one-time manual step not covered in the implementation.

6. **Prompt file references**: The agent prompts in `prompts/*.md` reference `thoughts/` paths - these are correct and don't need changes since `thoughts/` stays at project root.

7. **CLAUDE.md auto-discovery**: When Claude Code runs in a user's project, it will auto-discover their `CLAUDE.md` (if present) AND receive Ralph's agent prompts via stdin. Both sources combine - no special handling needed.

8. **MCP configuration discovery**: Claude Code needs to find `.ralph/mcp.json`. Update the Claude spawn command in `src/lib/claude.ts` to pass `--mcp-config .ralph/mcp.json` flag, or symlink to project root. Research the exact Claude Code CLI flag needed.

9. **Legacy `ralph.sh` script**: The file at project root contains hardcoded paths. Either remove it or mark as deprecated - it's superseded by the TypeScript implementation.

## Open Questions Resolved

1. **npm scope**: Scoped (`@leixusam/ralph`) - avoids conflicts, clear ownership
2. **Primary method**: npm package - standard, well-supported
3. **Claude commands**: Manual with `ralph init` CLI - explicit opt-in
4. **Breaking changes**: Semver with changelog
5. **create-ralph**: Deferred - not needed initially
6. **Repository structure**: Flat - no nested `ralph/` folder
7. **Runtime data**: `.ralph/` folder (gitignored)
8. **Work artifacts**: `thoughts/` at project root (committed for multi-agent collaboration)

---

**Status**: Pending human review before implementation begins.
