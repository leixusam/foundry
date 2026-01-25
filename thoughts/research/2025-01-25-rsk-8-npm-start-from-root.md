# Research: Run npm start from Project Root (RSK-8)

## Issue Summary

The request is to support running `npm start` from the project root directory instead of requiring it to be run from within the `ralph/` subfolder. The motivation is that when Claude Code runs from the project root, it needs access to the full project folder, but the current setup only gives it access to files within `ralph/`.

## Current Project Structure

```
ralph-default-files/           # Project root (git repo root)
├── .claude/                   # Claude configuration
├── .git/                      # Git repository
├── .gitignore
├── .mcp.json
├── AGENTS.md
├── CLAUDE.md
├── IMPLEMENTATION_PLAN.md
├── PROMPT_build.md
├── PROMPT_plan.md
├── ralph.sh                   # Bash wrapper script (runs from root)
├── thoughts/                  # Documentation directory
│   ├── plans/
│   ├── research/
│   ├── shared/
│   └── validation/
└── ralph/                     # Node.js application subfolder
    ├── package.json           # npm entry point (currently here)
    ├── tsconfig.json
    ├── node_modules/
    ├── dist/                  # Compiled output
    ├── prompts/               # Agent prompts
    └── src/                   # Source code
        ├── index.ts
        ├── config.ts
        ├── types.ts
        └── lib/
            ├── claude.ts
            ├── git.ts
            ├── prompts.ts
            └── ...
```

## Current Behavior Analysis

### 1. Configuration (`config.ts`)

The config already correctly determines the working directory using git:

```typescript
function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

export const config: RalphConfig = {
  workingDirectory: getRepoRoot(),  // Returns project root!
  // ...
};
```

**Finding**: The `workingDirectory` is already correctly set to the git repo root, not `ralph/`.

### 2. Claude Spawning (`claude.ts`)

Claude is spawned with the correct working directory:

```typescript
const proc = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: config.workingDirectory,  // Uses git repo root
});
```

**Finding**: Claude already runs with `cwd` set to the project root.

### 3. Prompt Loading (`prompts.ts`)

Prompts are loaded relative to the compiled file location:

```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptsDir = join(__dirname, '../../prompts');
```

This resolves to `ralph/dist/lib/` → `../../prompts` → `ralph/prompts/`.

**Finding**: This works correctly regardless of where npm is run from because it's relative to the compiled JS file, not `process.cwd()`.

### 4. Git Operations (`git.ts`)

All git operations use `config.workingDirectory`:

```typescript
execSync('git status --porcelain', execOpts).trim();
// where execOpts = { encoding: 'utf-8' as const, cwd: config.workingDirectory }
```

**Finding**: Git operations are already using the correct directory.

### 5. The Bash Script (`ralph.sh`)

The bash script uses `SCRIPT_DIR` and assumes it's run from the project root:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

**Finding**: The bash script works from any directory because it determines its location from the script path.

## The Actual Problem

The problem is NOT in the code logic - the Node.js application already uses `git rev-parse --show-toplevel` to find the project root.

The problem is **NPM execution context**:

1. `package.json` is located in `ralph/`
2. To run `npm start`, you must `cd ralph/` first
3. This is inconvenient and confusing

## Proposed Solutions

### Solution A: Root-Level package.json (Recommended)

Create a `package.json` at the project root that proxies to the ralph package:

```json
{
  "name": "ralph-default-files",
  "scripts": {
    "start": "npm start --prefix ralph",
    "build": "npm run build --prefix ralph",
    "dev": "npm run dev --prefix ralph",
    "typecheck": "npm run typecheck --prefix ralph"
  }
}
```

**Pros**:
- Simple to implement
- Works with standard npm conventions
- No code changes required
- Clear separation between root project and ralph package

**Cons**:
- Two package.json files to maintain

### Solution B: Move package.json to Root (Not Recommended)

Move all source code to root level and eliminate the `ralph/` subfolder.

**Cons**:
- Major restructuring
- Breaks existing workflows
- Mixes application code with project documentation

### Solution C: npm Workspace Configuration

Use npm workspaces to manage ralph as a subpackage.

**Pros**:
- Modern approach for monorepos
- Good for future expansion

**Cons**:
- More complex setup
- Overkill for single-package project

## Recommended Approach

**Solution A** is recommended because:

1. It requires minimal changes (one new file)
2. It maintains the clean separation between project root (docs, configs) and application code (ralph/)
3. It allows running `npm start` from project root as requested
4. It's a standard pattern for proxy package.json files

## Implementation Steps

1. Create `/package.json` at project root with proxy scripts
2. Update `.gitignore` if needed to ignore root-level `node_modules/` (shouldn't be needed since we use `--prefix`)
3. Test that `npm start` works from project root
4. Update any documentation that references running from `ralph/`

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `/package.json` | CREATE | Root package.json with proxy scripts |
| `/AGENTS.md` | UPDATE | Update build instructions if needed |

## Verification

After implementation:
1. `cd /project-root && npm start` should work
2. `cd /project-root/ralph && npm start` should still work
3. Claude spawned by the application should have access to the full project

## Notes

The core application logic is already correct. The issue is purely about NPM convenience - being able to type `npm start` from the project root instead of having to `cd ralph` first.
