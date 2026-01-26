# Research: Project Structure Reorganization (RSK-19)

**Issue**: RSK-19 - Reorganize and clean up project structure
**Date**: 2026-01-25
**Status**: Research complete, ready for planning

## Executive Summary

This research investigates patterns for reorganizing Ralph to be self-contained within a subfolder while maintaining easy command execution from the project root. The key finding is that both Claude Code and Codex CLI support **file referencing with @ syntax** and **cascading instruction hierarchies**, making it straightforward to have Ralph's instructions live in a subfolder while being properly loaded by the tools.

## Current Project Structure

```
ralph-default-files/         # Project root (user's project)
├── .claude/                  # Claude Code commands (slash commands)
│   ├── commands/
│   │   ├── commit.md
│   │   ├── create_plan.md
│   │   └── ... (11 more)
│   └── settings.local.json
├── .ralph/                   # Ralph output directory
│   └── output/               # Loop output logs
├── ralph/                    # Ralph core (TypeScript)
│   ├── dist/                 # Compiled JS
│   ├── src/                  # Source code
│   │   ├── index.ts          # Main entry point
│   │   ├── config.ts
│   │   ├── types.ts
│   │   └── lib/
│   │       ├── claude.ts     # Claude Code spawner
│   │       ├── codex.ts      # Codex CLI spawner
│   │       └── ...
│   ├── prompts/              # Agent prompts
│   │   ├── agent1-linear-reader.md
│   │   ├── agent2-worker-*.md
│   │   └── agent3-linear-writer.md
│   └── docs/
├── thoughts/                 # Session artifacts
│   ├── research/
│   ├── plans/
│   ├── validation/
│   └── shared/
├── CLAUDE.md                 # -> @AGENTS.md (file reference)
├── AGENTS.md                 # Build & run instructions
└── package.json
```

## Key Requirements

1. **Self-contained Ralph folder**: All Ralph-related files should be inside the `ralph/` subfolder
2. **Command accessibility**: Main command runnable from project root
3. **User installation model**: Users install Ralph and get everything (including logs) in the Ralph folder
4. **Instruction file handling**: CLAUDE.md/AGENTS.md should ideally live inside Ralph folder

## Research Findings: Claude Code

### 1. File Discovery Mechanism

Claude Code uses **recursive upward scanning** starting from the current working directory:

- Scans from cwd up to (but not including) root `/`
- Reads all `CLAUDE.md` and `CLAUDE.local.md` files encountered
- Files higher in hierarchy provide foundation; more specific (nested) files take precedence

**File precedence** (highest to lowest):
1. `CLAUDE.local.md` or `.claude/CLAUDE.md.local` (gitignored)
2. `CLAUDE.md` or `.claude/CLAUDE.md` (committed)
3. `~/.claude/CLAUDE.md` (user global)

### 2. @ Reference Syntax

**CLAUDE.md files support @ syntax for importing other files:**

```markdown
# Project Instructions
@ralph/CLAUDE.md
@ralph/AGENTS.md
```

Features:
- File paths can be relative or absolute
- Directory references provide directory listing
- Tab completion works with `@`
- Files are included in context

### 3. Command Line Flags for Instructions

| Flag | Behavior |
|------|----------|
| `--append-system-prompt` | Appends to default prompt |
| `--append-system-prompt-file` | Appends file contents |
| `--system-prompt` | Replaces entire prompt |
| `--system-prompt-file` | Replaces with file contents |

### 4. Programmatic Spawning (Current Ralph Implementation)

Ralph currently spawns Claude Code with:
```typescript
spawn('claude', [
  '-p',
  '--dangerously-skip-permissions',
  '--output-format=stream-json',
  '--model', options.model,
  '--verbose',
], { cwd: config.workingDirectory });
```

**Key insight**: Instructions are passed via stdin as part of the prompt, not via separate instruction files. Claude Code still reads CLAUDE.md from the working directory hierarchy.

### 5. Nested Project Support

Fully implemented as of August 2025:
- Claude scans upward from cwd
- Loads all discovered CLAUDE.md files
- More specific (lower) files take precedence

## Research Findings: Codex CLI

### 1. AGENTS.md Discovery

Codex uses **cascading three-tier system**:

1. **Global**: `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md`
2. **Project**: Walks from git root to cwd, checks each directory for:
   - `AGENTS.override.md`
   - `AGENTS.md`
   - Fallback filenames in config
3. **Merge**: Concatenates root→leaf (later files take precedence)

**Limit**: Stops at `project_doc_max_bytes` (32KB default)

### 2. Command Line Flags for Instructions

| Flag | Description |
|------|-------------|
| `PROMPT` | Initial instruction via argument |
| `--config developer_instructions` | Override config values |
| `--profile` | Use predefined config profile |

### 3. Current Ralph Codex Implementation

```typescript
spawn('codex', [
  'exec',
  '--dangerously-bypass-approvals-and-sandbox',
  '--json',
  '--model', model,
  '-c', `model_reasoning_effort="${reasoningEffort}"`,
], { cwd: config.workingDirectory });
```

Similar to Claude - instructions via stdin prompt.

## Proposed Solutions

### Option A: Root Reference Pattern (Recommended)

Keep minimal instruction files in project root that reference Ralph's internal files:

**Project root `CLAUDE.md`:**
```markdown
@ralph/CLAUDE.md
```

**Project root `AGENTS.md`:**
```markdown
@ralph/AGENTS.md
```

**ralph/CLAUDE.md:**
```markdown
# Ralph - Autonomous Product Development

## Build & Run
- Install: `cd ralph && npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
...full instructions...
```

**Pros:**
- Minimal footprint in user's project root
- All Ralph code and instructions self-contained
- Users can add their own instructions that reference Ralph's

**Cons:**
- Requires two files in project root

### Option B: Auto-inject Reference Pattern

Ralph automatically manages the root CLAUDE.md/AGENTS.md:
1. On first run, check if root CLAUDE.md exists
2. If not, create with reference to `@ralph/CLAUDE.md`
3. If exists but lacks reference, append reference

**Implementation:**
```typescript
// In ralph/src/lib/setup.ts
function ensureInstructionReferences() {
  const rootClaudeMd = path.join(cwd, 'CLAUDE.md');
  const reference = '@ralph/CLAUDE.md';

  if (!fs.existsSync(rootClaudeMd)) {
    fs.writeFileSync(rootClaudeMd, reference);
  } else {
    const content = fs.readFileSync(rootClaudeMd, 'utf8');
    if (!content.includes(reference)) {
      fs.appendFileSync(rootClaudeMd, `\n${reference}`);
    }
  }
}
```

**Pros:**
- Zero manual setup for users
- Self-healing if references removed

**Cons:**
- Modifies user's files automatically (may be unexpected)
- More complex setup process

### Option C: Prompt-based Instruction Injection

Pass all instructions via prompt/stdin only, don't rely on CLAUDE.md discovery:

```typescript
const instructions = fs.readFileSync('ralph/CLAUDE.md', 'utf8');
const fullPrompt = `${instructions}\n\n---\n\n${userPrompt}`;
```

**Pros:**
- No dependency on file discovery mechanisms
- Works regardless of cwd

**Cons:**
- Loses benefit of Claude Code's built-in instruction loading
- May miss user's project-specific instructions

### Option D: Symlink Pattern

Create symlinks from root to ralph folder:

```bash
ln -s ralph/CLAUDE.md CLAUDE.md
ln -s ralph/AGENTS.md AGENTS.md
```

**Pros:**
- Single source of truth
- Works transparently

**Cons:**
- Symlinks can be problematic on Windows
- Some tools don't follow symlinks properly

## Recommendation

**Use Option A (Root Reference Pattern) with optional Option B enhancement:**

1. **Structure**:
   - Move all instruction content to `ralph/CLAUDE.md` and `ralph/AGENTS.md`
   - Keep minimal root `CLAUDE.md` with just `@ralph/CLAUDE.md`
   - Keep minimal root `AGENTS.md` with just `@ralph/AGENTS.md`

2. **Enhancement** (optional):
   - Add a `ralph init` command that sets up the references
   - Or auto-detect and warn if references are missing

3. **Directory restructure**:
   ```
   ralph/                       # Self-contained Ralph package
   ├── src/                     # TypeScript source
   ├── dist/                    # Compiled JS
   ├── prompts/                 # Agent prompts
   ├── .claude/                 # Move slash commands here
   │   └── commands/
   ├── thoughts/                # Move here (or keep in .ralph/output)
   ├── CLAUDE.md                # Full instructions
   ├── AGENTS.md                # Full instructions
   ├── package.json
   └── README.md

   .ralph/                      # Runtime data (gitignored)
   └── output/                  # Loop output logs
   ```

4. **Command execution**:
   - Entry point: `npx ralph` or `node ralph/dist/index.js`
   - Working directory: project root (as currently)

## Files Requiring Changes

1. **Move**: `.claude/commands/*` → `ralph/.claude/commands/*`
2. **Create**: `ralph/CLAUDE.md` (new, comprehensive)
3. **Create**: `ralph/AGENTS.md` (new, comprehensive)
4. **Update**: Root `CLAUDE.md` → simple `@ralph/CLAUDE.md`
5. **Update**: Root `AGENTS.md` → simple `@ralph/AGENTS.md`
6. **Update**: `ralph/src/lib/prompts.ts` if prompt loading paths change
7. **Consider**: Move `thoughts/` into `ralph/` or `.ralph/`

## Open Questions for Planning

1. Should `thoughts/` directory live inside `ralph/` or remain at project root?
2. Should `.ralph/output/` be renamed to `ralph/output/` for consistency?
3. Should there be a `ralph init` command for setup?
4. How to handle users who have their own CLAUDE.md content to preserve?

## Blocks

This research unblocks **RSK-21 (Integrate Linear CLI)** which was waiting on this reorganization.

## Sources

- Claude Code documentation on CLAUDE.md files
- Claude Code CLI reference (--append-system-prompt flags)
- Codex CLI documentation on AGENTS.md
- Codex CLI command reference
- GitHub issues #705 (nested CLAUDE.md) and #771 (Node.js spawning)
