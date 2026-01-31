# Foundry - Autonomous Product Development System

This is the core Foundry autonomous development loop. Foundry orchestrates multiple AI agents
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

- `FOUNDRY_PROVIDER` - "claude" (default) or "codex"
- `FOUNDRY_CLAUDE_MODEL` - "opus" (default), "sonnet", or "haiku"
- `FOUNDRY_MAX_ITERATIONS` - Limit iterations (0 = unlimited)
- `CODEX_MODEL` - Codex model name
- `CODEX_REASONING_EFFORT` - "low", "medium", "high" (default), "extra_high"

## Output

Runtime logs are written to `.foundry/output/` (gitignored). Output folder names are prefixed with
timestamps for easy sorting (e.g., `20250126-051600-swift-wyvern/`).

## Project Artifacts

The `foundry-docs/` directory at project root stores Foundry's work artifacts:
- `foundry-docs/research/` - Research documents for tickets
- `foundry-docs/plans/` - Implementation plans
- `foundry-docs/validation/` - Validation reports
- `foundry-docs/shared/` - Shared context between sessions

## Releasing

To release a new version (auto-publishes to npm via GitHub Actions):

```bash
npm version patch    # or minor/major - bumps package.json + creates git tag
git push && git push --tags
gh release create v0.x.x --generate-notes --title "v0.x.x"
```

The `publish.yml` workflow automatically runs `npm publish` when a GitHub release is created.
