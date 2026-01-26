# Implementation Plan: Project Structure Reorganization (RSK-19)

**Issue**: RSK-19 - Reorganize and clean up project structure
**Date**: 2026-01-25
**Research Document**: `thoughts/research/2026-01-25-RSK-19-project-reorganization.md`

## Executive Summary

Reorganize the project so that Ralph is self-contained within a subfolder while maintaining command accessibility from the project root. The key approach is the **Root Reference Pattern** where minimal root files reference comprehensive instructions inside the ralph folder.

## Goals

1. Make the `ralph/` folder self-contained with all Ralph-related files
2. Keep commands easily runnable from the project root
3. Move `.claude/commands/` into `ralph/.claude/commands/`
4. Move CLAUDE.md and AGENTS.md content into ralph folder
5. Use `@` reference syntax for Claude Code compatibility
6. Consider `thoughts/` directory placement

## Non-Goals

- Creating a `ralph init` command (can be added later if needed)
- Auto-injecting references into user's files
- Handling symlinks (platform issues)

## Implementation Phases

### Phase 1: Create Ralph-specific CLAUDE.md and AGENTS.md

**Files to create:**

1. `ralph/CLAUDE.md` - Full instructions for Ralph development
2. `ralph/AGENTS.md` - Build/run commands specific to Ralph

**Content for `ralph/CLAUDE.md`:**
```markdown
# Ralph - Autonomous Product Development System

This is the core Ralph autonomous development loop. Ralph orchestrates multiple AI agents
to work on Linear tickets autonomously.

## Build & Run

- Install: `cd ralph && npm install` (or `npm run install:ralph` from root)
- Build: `npm run build` (from root, proxies to ralph)
- Start: `npm run start` (from root, proxies to ralph)
- Dev: `npm run dev` (from root, watch mode)
- Typecheck: `npm run typecheck` (from root, proxies to ralph)

## Architecture

### Agent Pipeline
1. **Agent 1 (Linear Reader)**: Scans Linear for tickets, claims work
2. **Agent 2 (Worker)**: Executes the actual development work
3. **Agent 3 (Linear Writer)**: Updates Linear with results

### Directory Structure
- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript (gitignored at root)
- `prompts/` - Agent prompt templates
- `.claude/commands/` - Claude Code slash commands

### Key Files
- `src/index.ts` - Main loop entry point
- `src/config.ts` - Configuration management
- `src/lib/claude.ts` - Claude Code spawner
- `src/lib/codex.ts` - Codex CLI spawner
- `src/lib/prompts.ts` - Prompt loader

## Environment Variables

- `RALPH_PROVIDER` - "claude" (default) or "codex"
- `RALPH_CLAUDE_MODEL` - "opus" (default), "sonnet", or "haiku"
- `RALPH_MAX_ITERATIONS` - Limit iterations (0 = unlimited)
- `CODEX_MODEL` - Codex model name
- `CODEX_REASONING_EFFORT` - "low", "medium", "high" (default), "extra_high"

## Output

Runtime logs are written to `.ralph/output/` in the project root (gitignored).
```

**Content for `ralph/AGENTS.md`:**
```markdown
## Build & Run (Ralph)

- Install: `npm install` (from ralph/ directory)
- Build: `tsc`
- Start: `node dist/index.js`
- Dev: `tsc --watch`
- Typecheck: `tsc --noEmit`

## Code Conventions

- TypeScript strict mode
- ES modules (type: module)
- Node.js 18+
- Relative imports with .js extensions (ES module requirement)
```

### Phase 2: Move `.claude/commands/` to `ralph/.claude/commands/`

**Files to move:**
- `.claude/commands/*.md` → `ralph/.claude/commands/*.md`
- `.claude/settings.local.json` → `ralph/.claude/settings.local.json`

**Commands list (11 files):**
- commit.md
- create_handoff.md
- create_plan.md
- debug.md
- describe_pr.md
- implement_plan.md
- iterate_plan.md
- local_review.md
- research_codebase.md
- resume_handoff.md
- validate_plan.md

### Phase 3: Update Root Reference Files

**Update `CLAUDE.md` in project root:**
```markdown
@ralph/CLAUDE.md
@ralph/AGENTS.md
```

This uses the `@` file reference syntax that Claude Code supports. When Claude Code reads the root CLAUDE.md, it will pull in the contents of both referenced files.

**Update `AGENTS.md` in project root:**
```markdown
@ralph/AGENTS.md
```

Note: Codex CLI may not support `@` syntax the same way. We'll test this. If Codex doesn't support it, we may need to keep a copy or use a different approach for Codex.

### Phase 4: Update .gitignore for New Structure

**Add to `.gitignore`:**
```
# Keep ralph/dist committed for now (compiled package)
# If we npm-publish later, we'd gitignore this
```

No changes needed - the current `.gitignore` already excludes `.ralph/output/` at the project level.

### Phase 5: Move `thoughts/` Directory Decision

**Recommendation**: Keep `thoughts/` at project root level.

**Reasoning:**
- `thoughts/` contains project-specific artifacts (research, plans, validation)
- These are tied to the user's project, not to Ralph itself
- Users may want to review their project's thoughts without diving into ralph/
- Keeping it at root makes it more visible and accessible

However, we should document this clearly - `thoughts/` is where Ralph stores its work artifacts for the current project.

### Phase 6: Test the Setup

**Verification steps:**
1. Run `npm run build` from project root - should work
2. Run `npm run start` from project root - should work
3. Launch `claude` from project root - should pick up ralph/CLAUDE.md via reference
4. Verify slash commands work (`/commit`, `/create_plan`, etc.)
5. Check that `.ralph/output/` logs are still created correctly

## File Summary

### Files to Create
1. `ralph/CLAUDE.md` - Full Ralph instructions
2. `ralph/AGENTS.md` - Ralph build commands

### Files to Move
3. `.claude/commands/*.md` → `ralph/.claude/commands/*.md` (11 files)
4. `.claude/settings.local.json` → `ralph/.claude/settings.local.json`

### Files to Update
5. `CLAUDE.md` (root) - Replace content with `@ralph/CLAUDE.md` and `@ralph/AGENTS.md`
6. `AGENTS.md` (root) - Replace content with `@ralph/AGENTS.md`

### Files to Delete (after move)
7. `.claude/commands/` directory
8. `.claude/settings.local.json`

### Files Unchanged
- `ralph/src/*` - No code changes needed
- `ralph/prompts/*` - Already in right location
- `.ralph/output/` - Already gitignored, stays at root
- `thoughts/` - Stays at project root

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Codex CLI may not support `@` syntax | Medium | Test after implementation; may need separate approach for Codex |
| Slash commands may not work from ralph/.claude | High | Claude Code searches upward for .claude/, so may need root .claude/ symlink or special handling |
| Breaking existing workflows | Medium | All commands still work from root via npm scripts |

## Open Questions Resolved

1. **thoughts/ directory location?** → Keep at project root (project-specific artifacts)
2. **ralph init command?** → Not needed now (manual setup is fine)
3. **User's own CLAUDE.md content?** → Users can add their content above or below the `@` references

## Success Criteria

1. ✅ `ralph/` folder contains all Ralph-specific files (code, prompts, instructions, slash commands)
2. ✅ Root files are minimal references only
3. ✅ `npm run start` works from project root
4. ✅ Claude Code loads instructions via `@` references
5. ✅ Slash commands work (may need testing/adjustment)
6. ✅ Runtime logs still go to `.ralph/output/`

## Blocked By
None

## Unblocks
- RSK-21 (Integrate Linear CLI) - was waiting on this reorganization
