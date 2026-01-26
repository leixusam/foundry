# Ralph - Autonomous Product Development System

This is the core Ralph autonomous development loop. Ralph orchestrates multiple AI agents
to work on Linear tickets autonomously.

## Build & Run

- Install: `npm install`
- Build: `npm run build`
- Start: `npm run start`
- Dev: `npm run dev` (watch mode)
- Typecheck: `npm run typecheck`

## Architecture

### Agent Pipeline
1. **Agent 1 (Linear Reader)**: Scans Linear for tickets, claims work
2. **Agent 2 (Worker)**: Executes the actual development work
3. **Agent 3 (Linear Writer)**: Updates Linear with results

### Directory Structure
- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript (gitignored)
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

Runtime logs are written to `.ralph/output/` (gitignored). Output folder names are prefixed with
timestamps for easy sorting (e.g., `20250126-051600-swift-wyvern/`).

## Project Artifacts

The `thoughts/` directory at project root stores Ralph's work artifacts:
- `thoughts/research/` - Research documents for tickets
- `thoughts/plans/` - Implementation plans
- `thoughts/validation/` - Validation reports
- `thoughts/shared/` - Shared context between sessions
