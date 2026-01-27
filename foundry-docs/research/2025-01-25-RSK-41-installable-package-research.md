# Research: Make Ralph Installable in Other Projects

**Issue**: RSK-41
**Date**: 2025-01-25
**Status**: Complete

## Summary

This research explores options for packaging Ralph as a CLI tool that can be installed into other projects for autonomous development. The goal is to allow Ralph to be added to any Node.js project and work on Linear tickets for that project. Key considerations include npm packaging strategies, the `npm run` command behavior, nested usage (Ralph developing Ralph), project structure patterns, and update mechanisms.

## Requirements Analysis

From the issue description, the user wants:
1. **Easy installation** - via npx, npm install, or even copy-paste
2. **Flexible command execution** - ability to run `npm run` from project root vs ralph folder
3. **Self-development capability** - Ralph should still be usable to develop the Ralph project itself (nested structure)
4. **Clean project structure** - minimal intrusion into the host project
5. **Update mechanism** - way to keep Ralph current in consumer projects
6. **CLI tool paradigm** - thinking of this as making Ralph a command-line tool

## Codebase Analysis

### Current Architecture

Ralph is currently structured as:
```
ralph-default-files/           # Root project
├── ralph/                     # Self-contained Ralph application
│   ├── src/                   # TypeScript source
│   ├── dist/                  # Compiled JavaScript
│   ├── prompts/               # Agent instruction templates (9 files)
│   ├── .claude/commands/      # Claude Code slash commands
│   ├── package.json           # Ralph's npm manifest
│   └── tsconfig.json
├── thoughts/                  # Work artifacts (at project root)
├── .ralph.env                 # Configuration (gitignored)
├── .mcp.json                  # Linear MCP config (gitignored)
└── package.json               # Root proxy manifest
```

### Key Design Characteristics

1. **Single Production Dependency**: Only `@linear/sdk` - extremely lightweight
2. **Configuration via Environment**: All behavior controlled via env vars (`.ralph.env`)
3. **Git Repo Root Detection**: `config.ts` uses `git rev-parse --show-toplevel` to find project root
4. **Artifact Storage**: `thoughts/` at project root, `.output/` and `.attachments/` inside `ralph/`
5. **Prompt Loading**: Uses `import.meta.url` to find prompts relative to compiled code
6. **Provider Abstraction**: Supports both Claude Code CLI and Codex CLI

### Files That Reference Project Root

| File | Reference | Purpose |
|------|-----------|---------|
| `config.ts` | `getRepoRoot()` | Base for `.ralph.env`, working directory |
| `output-logger.ts` | `ralph/.output/` | Runtime logs |
| `attachment-downloader.ts` | `ralph/.attachments/` | Downloaded files |
| `prompts/*.md` | `thoughts/` paths | Artifact storage |

### npm Script Proxy Pattern (Current)

Root `package.json`:
```json
{
  "scripts": {
    "build": "npm run build --prefix ralph",
    "start": "npm start --prefix ralph",
    "dev": "npm run dev --prefix ralph"
  }
}
```

This allows running `npm start` from project root while execution happens in `ralph/`.

## Implementation Considerations

### Option 1: npm Package (Recommended)

**Approach**: Publish Ralph to npm as `@leixusam/ralph` (or similar scoped package)

**Installation**:
```bash
npm install --save-dev @leixusam/ralph
# or
npm install -g @leixusam/ralph
```

**Execution**:
```bash
npx ralph                    # If installed locally
ralph                        # If installed globally
npm run ralph                # Via npm script
```

**package.json Changes Required**:
```json
{
  "name": "@leixusam/ralph",
  "version": "2.0.0",
  "bin": {
    "ralph": "./dist/index.js"
  },
  "files": [
    "dist/**/*",
    "prompts/**/*",
    ".claude/**/*"
  ]
}
```

**Pros**:
- Standard npm workflow, familiar to all Node.js developers
- Version pinning via package.json
- Easy updates via `npm update`
- Works with npx for one-off execution
- Supports both global and local installation

**Cons**:
- Requires npm publish setup
- Need to handle prompt/command file paths carefully
- `.claude/commands/` may need special handling for Claude Code discovery

### Option 2: Git Submodule / Subtree

**Approach**: Users add Ralph as a git submodule in their project

**Installation**:
```bash
git submodule add https://github.com/leixusam/ralph-default-files ralph
# or
git subtree add --prefix ralph https://github.com/leixusam/ralph-default-files main
```

**Execution**:
```bash
npm run --prefix ralph start
# or with root proxy scripts
npm start
```

**Pros**:
- Full source available for customization
- Updates via `git submodule update` or `git subtree pull`
- No npm publish needed
- Developers can fork and modify

**Cons**:
- Git submodules are notorious for complexity
- Subtrees bloat the host repo's git history
- More manual update process
- Requires git knowledge

### Option 3: Copy-Paste Installation (Simplest)

**Approach**: Users download and copy the `ralph/` folder into their project

**Installation**:
```bash
# Option A: Git clone and copy
git clone https://github.com/leixusam/ralph-default-files /tmp/ralph-source
cp -r /tmp/ralph-source/ralph ./

# Option B: Download release archive
curl -L https://github.com/.../releases/latest/download/ralph.tar.gz | tar xz
```

**Execution**:
```bash
cd ralph && npm install && npm start
# or with root proxy scripts
npm start
```

**Pros**:
- Zero dependencies on npm registry or git submodules
- Full local ownership of code
- Simple to understand

**Cons**:
- Manual updates (re-download and copy)
- No version tracking
- Users must manually merge updates

### Option 4: npx Scaffolding Tool (create-ralph)

**Approach**: Create an `npx create-ralph` command that sets up Ralph in a project

**Installation**:
```bash
npx create-ralph
# or
npm init ralph
```

This would:
1. Copy Ralph files into `./ralph/`
2. Add proxy scripts to root `package.json`
3. Set up `.gitignore` entries
4. Optionally run initialization wizard

**Pros**:
- Best initial setup experience
- Can customize based on project structure
- No ongoing dependency on external package

**Cons**:
- Still manual updates after initial setup
- Additional package to maintain

## Key Technical Challenges

### Challenge 1: Running from Project Root vs Ralph Folder

**Current State**: Root `package.json` uses `--prefix ralph` to proxy commands.

**Options**:
1. **Keep proxy pattern** (recommended for copy/submodule approaches)
2. **Use `bin` field** for npm package approach - allows `npx ralph` anywhere
3. **Detect execution context** in `index.ts` and adjust paths accordingly

**Recommendation**:
- For npm package: Use `bin` field with shebang (`#!/usr/bin/env node`)
- For copy/submodule: Include proxy `package.json` as template

### Challenge 2: Prompt and Command File Discovery

**Current**: `prompts.ts` uses `import.meta.url` to find prompts relative to compiled JS:
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(__dirname, '../../prompts');
```

**Problem**: When installed via npm, the file structure is:
```
node_modules/@leixusam/ralph/
├── dist/lib/prompts.js      # Compiled TS
└── prompts/                   # Markdown files
```

The relative path `../../prompts` would be `node_modules/@leixusam/prompts` - wrong!

**Solutions**:
1. **Use package.json `exports`** to define entry points
2. **Compute path from package root** using `require.resolve('@leixusam/ralph/package.json')`
3. **Bundle prompts as strings** during build (increases complexity)

**Recommendation**: Modify `prompts.ts` to detect npm installation and adjust paths:
```typescript
function getPromptsDir(): string {
  // If running from npm package, prompts are sibling to dist/
  const packageRoot = join(__dirname, '../../');
  const promptsInPackage = join(packageRoot, 'prompts');
  if (existsSync(promptsInPackage)) {
    return promptsInPackage;
  }
  // Fallback for development
  return join(__dirname, '../../prompts');
}
```

### Challenge 3: .claude/commands/ Discovery

**Problem**: Claude Code discovers slash commands from `.claude/commands/` in the project root, not from npm packages.

**Options**:
1. **Symlink during postinstall**: `ln -s node_modules/@leixusam/ralph/.claude/commands ralph/.claude/commands`
2. **Copy during postinstall**: Actually copy the files
3. **Document manual setup**: User must copy `.claude/commands/` or reference them
4. **Hybrid approach**: Core Ralph runs via npm, but commands are copied to project

**Recommendation**: For npm package, include a postinstall script that:
1. Creates `ralph/.claude/commands/` symlink if it doesn't exist
2. Warns user if `.claude/commands/` needs to be added to project root

### Challenge 4: Nested Usage (Ralph Developing Ralph)

**Scenario**: User wants to use Ralph to develop the Ralph project itself.

**Current Structure**:
```
ralph-default-files/
├── ralph/                    # Ralph code
└── thoughts/                 # Ralph's artifacts FOR this project
```

**When Ralph is installed in another project**:
```
my-app/
├── ralph/                    # Installed Ralph (or node_modules/@.../ralph)
├── thoughts/                 # Ralph's artifacts for my-app
└── package.json
```

**If Ralph is used to develop itself**:
```
ralph-default-files/         # Project root (git repo)
├── ralph/                    # Ralph's own code
├── thoughts/                 # Artifacts for developing Ralph
└── .ralph.env                # Config pointing to Linear team for Ralph development
```

This already works! Ralph uses `git rev-parse --show-toplevel` to find the project root, so:
- When developing Ralph, it operates on `ralph-default-files/`
- When developing `my-app`, it operates on `my-app/`

**No special handling needed** - the design is already correct.

### Challenge 5: Configuration and Secrets

**Current**: `.ralph.env` at project root with `LINEAR_API_KEY`, `LINEAR_TEAM_KEY`

**For multiple projects**: Each project needs its own `.ralph.env` with credentials for its Linear team.

**Recommendation**: Keep current approach - each project has its own `.ralph.env`. This is correct because:
- Different projects may have different Linear teams
- Secrets should be per-project, not global
- `.ralph.env` is gitignored, so no cross-contamination

### Challenge 6: Update Mechanism

**Options by Installation Method**:

| Method | Update Command |
|--------|----------------|
| npm package | `npm update @leixusam/ralph` |
| git submodule | `git submodule update --remote` |
| git subtree | `git subtree pull --prefix ralph origin main` |
| copy-paste | Re-download and copy |

**For npm package, add update notification**:
```typescript
// In index.ts startup
import updateNotifier from 'update-notifier';
const pkg = require('../package.json');
updateNotifier({ pkg }).notify();
```

This shows a non-intrusive message when updates are available.

## Approach Recommendation

### Primary Recommendation: npm Package

**Phase 1: Publish to npm**
1. Add `bin` field pointing to `dist/index.js`
2. Add shebang (`#!/usr/bin/env node`) to entry point
3. Configure `files` field to include `dist/`, `prompts/`, `.claude/`
4. Fix prompt path detection for npm installation
5. Publish as `@leixusam/ralph` (scoped) or `ralph-ai` (unscoped)

**Phase 2: Add Scaffolding (Optional)**
1. Create `create-ralph` package for `npx create-ralph`
2. Sets up `.claude/commands/` symlinks
3. Adds proxy scripts to host `package.json`
4. Creates `.ralph.env` template

**Phase 3: Add Update Notifications**
1. Integrate `update-notifier` package
2. Show update message on startup when new version available

### Alternative: Copy-Paste with Installation Script

If npm publishing is not desired:
1. Create `install-ralph.sh` script in releases
2. Downloads latest release and extracts to `./ralph/`
3. Adds proxy scripts to `package.json`
4. Creates update script at `ralph/update.sh`

## Risks

1. **Claude Code slash command discovery**: May require manual `.claude/commands/` setup
2. **Path resolution complexity**: npm vs local development paths differ
3. **Breaking changes**: Updates may break existing installations if prompts change significantly
4. **Linear MCP configuration**: Codex users need separate MCP setup instructions

## Testing Strategy

1. **Local npm link testing**: `npm link` in ralph/, then `npm link @leixusam/ralph` in test project
2. **npx testing**: Publish to npm and verify `npx @leixusam/ralph` works
3. **Path resolution testing**: Verify prompts load correctly in both dev and npm modes
4. **Nested development testing**: Use Ralph to work on Ralph tickets
5. **Update notification testing**: Verify `update-notifier` displays correctly

## Specification Assessment

**Does this feature need a UX specification?**

No, this is primarily a packaging/distribution change with no user-facing UI. The command-line interface remains the same (`npm start` or `ralph`). However, documentation should be updated to explain:
- Installation options
- Configuration for new projects
- Update procedures

**Needs Specification**: No

## Questions for Human Review

1. **npm scope**: Should the package be scoped (`@leixusam/ralph`) or unscoped (`ralph-ai`)?
2. **Primary installation method**: Should we prioritize npm package or copy-paste?
3. **Claude Code commands**: Should they be auto-installed via postinstall, or documented for manual setup?
4. **Breaking change policy**: How to handle prompt changes that affect existing installations?
5. **create-ralph scaffolding**: Is this worth the additional maintenance overhead?

## Appendix: File Changes Summary

### Files to Modify

| File | Changes |
|------|---------|
| `ralph/package.json` | Add `bin`, `files`, update `main` |
| `ralph/src/index.ts` | Add shebang, optional update-notifier |
| `ralph/src/lib/prompts.ts` | Fix path resolution for npm install |
| `.gitignore` | Ensure `dist/` is not ignored (it's needed for publishing) |

### New Files to Create

| File | Purpose |
|------|---------|
| `ralph/bin/ralph.js` | CLI entry point with shebang (optional - can use dist/index.js directly) |
| `ralph/postinstall.js` | Setup Claude Code commands symlinks (optional) |

### Documentation to Update

| File | Changes |
|------|---------|
| `ralph/README.md` | Add installation instructions, update usage examples |
| Root `README.md` | Link to Ralph installation docs |

## Next Steps

Ready for planning phase.

---

## Sources

- [npm bin Command - GeeksforGeeks](https://www.geeksforgeeks.org/node-js/npm-bin-command/)
- [Best practices for building CLI and publishing it to NPM](https://webbylab.com/blog/best-practices-for-building-cli-and-publishing-it-to-npm/)
- [Creating an NPX package - DEV Community](https://dev.to/nausaf/creating-an-npm-package-that-runs-on-command-line-with-npx-9a0)
- [Using npm Workspaces for Monorepo Management - Earthly Blog](https://earthly.dev/blog/npm-workspaces-monorepo/)
- [update-notifier - npm](https://www.npmjs.com/package/update-notifier)
- [npm-check-updates - npm](https://www.npmjs.com/package/npm-check-updates)
- [Yeoman - The web's scaffolding tool](https://yeoman.io/)
