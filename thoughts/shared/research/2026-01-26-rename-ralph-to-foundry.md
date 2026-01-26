---
date: 2026-01-26T21:32:11Z
researcher: Claude
git_commit: 9a9c6884c899a7ec473659deebb260b33132601b
branch: main
repository: ralph-default-files
topic: "Rename project from Ralph to Foundry - scope analysis"
tags: [research, codebase, rename, foundry]
status: complete
last_updated: 2026-01-26
last_updated_by: Claude
---

# Research: Rename Project from Ralph to Foundry

**Date**: 2026-01-26T21:32:11Z
**Researcher**: Claude
**Git Commit**: 9a9c6884c899a7ec473659deebb260b33132601b
**Branch**: main
**Repository**: ralph-default-files

## Research Question

Document all locations where "ralph" appears in the codebase to understand the full scope of renaming the project to "foundry".

## Summary

The name "ralph" appears in **383 occurrences across 60+ files**. The renaming would affect:

1. **Package identity**: npm package name, CLI command, repository name
2. **Runtime directories**: `.ralph/` folder structure
3. **Environment variables**: `RALPH_*` prefix (5 variables)
4. **Linear workflow**: `[RL]` status prefix
5. **Source code**: Type names, config references
6. **Documentation**: README, CLAUDE.md, all 66 thought documents
7. **Prompts**: Agent instruction files

## Detailed Findings

### 1. Package & CLI Identity

| Location | Current Value | Would Change To |
|----------|---------------|-----------------|
| `package.json:2` | `"name": "@leixusam/ralph"` | `"@leixusam/foundry"` |
| `package.json:8` | `"bin": { "ralph": ... }` | `"foundry"` |
| `package-lock.json:2,8` | `@leixusam/ralph` | `@leixusam/foundry` |
| Repository URL | `ralph-default-files` | `foundry` (or similar) |

### 2. Source Code Files

#### Core Files (high impact)
| File | Occurrences | Key References |
|------|-------------|----------------|
| `src/config.ts` | 16 | `RalphConfig` type, `.ralph/env` path, env var parsing |
| `src/init.ts` | 22 | Wizard text, status prefix, directory creation |
| `src/index.ts` | 12 | Startup messages, error messages |
| `src/cli.ts` | 5 | Help text, usage instructions |
| `src/types.ts` | 3 | `RalphConfig`, `RalphStatusWithColor` types |

#### Library Files
| File | Occurrences | Key References |
|------|-------------|----------------|
| `src/lib/linear-api.ts` | 32 | `RALPH_STATUS_PREFIX = '[RL]'`, status definitions |
| `src/lib/init-project.ts` | 8 | `.ralph/` directory, setup wizard |
| `src/lib/output-logger.ts` | 1 | `.ralph/output/` path |
| `src/lib/stats-logger.ts` | 1 | `.ralph/output/` path |
| `src/lib/attachment-downloader.ts` | 1 | `.ralph/attachments/` path |
| `src/lib/claude.ts` | 1 | `.ralph/mcp.json` path |

### 3. Environment Variables

All would need `RALPH_` → `FOUNDRY_` prefix change:

| Current | New | File Locations |
|---------|-----|----------------|
| `RALPH_PROVIDER` | `FOUNDRY_PROVIDER` | config.ts:139, cli.ts:19 |
| `RALPH_CLAUDE_MODEL` | `FOUNDRY_CLAUDE_MODEL` | config.ts:146, cli.ts:20 |
| `RALPH_MAX_ITERATIONS` | `FOUNDRY_MAX_ITERATIONS` | config.ts:163, cli.ts:21 |
| `RALPH_RATE_LIMIT_MAX_RETRIES` | `FOUNDRY_RATE_LIMIT_MAX_RETRIES` | config.ts:175 |
| `RALPH_GCP_AUTO_STOP` | `FOUNDRY_GCP_AUTO_STOP` | config.ts:189 |

### 4. Runtime Directory Structure

Current `.ralph/` would become `.foundry/`:

```
.ralph/           →  .foundry/
├── env           →  ├── env
├── mcp.json      →  ├── mcp.json
├── output/       →  ├── output/
└── attachments/  →  └── attachments/
```

Files that create/reference this:
- `src/config.ts:19` - env file path
- `src/init.ts:124-128` - directory creation
- `src/lib/init-project.ts:82-86` - directory creation
- `src/lib/output-logger.ts:16` - output path
- `src/lib/stats-logger.ts:86` - stats path
- `src/lib/attachment-downloader.ts:78` - attachments path
- `.gitignore:19-21` - ignore entry

### 5. Linear Workflow Status Prefix

The `[RL]` prefix (Ralph Linear) appears in:

| File | Usage |
|------|-------|
| `src/lib/linear-api.ts:5` | `RALPH_STATUS_PREFIX = '[RL]'` |
| `src/init.ts:180-196` | Status preview display |
| `prompts/agent1-linear-reader.md:36-56` | Status list documentation |
| `README.md:130-148` | Status documentation |

Status names that would change:
- `[RL] Backlog` → `[FY] Backlog` (or similar)
- `[RL] Needs Research` → `[FY] Needs Research`
- `[RL] In Progress` variants
- `[RL] Done`, `[RL] Canceled`

### 6. Documentation Files

| File | Occurrences | Content |
|------|-------------|---------|
| `README.md` | 19 | Installation, usage, configuration |
| `CLAUDE.md` | 6 | Project description, runtime docs |
| `AGENTS.md` | ~5 | Build commands |

### 7. Agent Prompts

All in `prompts/` directory:
- `agent1-linear-reader.md` (4 occurrences) - Status prefix, workflow
- `agent2-worker.md` (1 occurrence)
- `agent2-worker-*.md` (6 files, 1 each)
- `agent3-linear-writer.md` (1 occurrence)

### 8. Thoughts Directory

**66 files** reference "ralph" in `thoughts/`:
- `thoughts/plans/` - 13 files
- `thoughts/research/` - 12 files
- `thoughts/validation/` - 16 files
- `thoughts/research-implement/` - 6 files
- `thoughts/oneshot/` - 11 files
- `thoughts/shared/plans/` - 1 file (core architecture)
- `thoughts/shared/research/` - 2 files

Notable files:
- `thoughts/shared/plans/2025-01-25-ralph-v2-linear-orchestration.md` - Core architecture
- `thoughts/plans/2025-01-25-RSK-41-installable-package-plan.md` - Recent npm package work

### 9. Archived Files

- `archive/ralph.sh` - Legacy shell script

## Code References

### Type Definitions
- `src/types.ts:1` - `RalphConfig` interface
- `src/types.ts:20` - `RalphStatusWithColor` type
- `src/config.ts:217` - `RalphConfig` export

### User-Facing Strings
- `src/cli.ts:9` - "Ralph - Autonomous Product Development Agent"
- `src/index.ts:371` - "Ralph v2 starting..."
- `src/lib/init-project.ts:60` - "Ralph - Setup Wizard"
- `src/lib/init-project.ts:235` - "✓ Ralph initialized!"

### Path Constants
- `src/config.ts:19` - `join(getRepoRoot(), '.ralph', 'env')`
- `src/lib/output-logger.ts:16` - `join(config.workingDirectory, '.ralph', 'output')`

## Rename Scope Summary

| Category | Count | Complexity |
|----------|-------|------------|
| Package name | 2 files | Low - npm republish |
| CLI command | 1 location | Low - package.json bin |
| Type names | 3 types | Medium - find/replace |
| Env variables | 5 variables | Medium - backwards compat? |
| Directory name | 7 locations | Medium - code changes |
| Status prefix | 1 constant + docs | Low - but affects Linear |
| Documentation | 25+ files | High - manual review |
| Thoughts files | 66 files | High - historical docs |
| Prompts | 9 files | Medium - review needed |

## Considerations

1. **npm package**: Would need to publish as new package (`@leixusam/foundry`) - can't rename existing
2. **Existing users**: Anyone using `@leixusam/ralph` would need to switch
3. **Linear statuses**: Users with `[RL]` statuses would need migration
4. **Git history**: Repository rename doesn't affect history but changes URLs
5. **Thoughts directory**: Historical documents could keep "ralph" references or be updated

## Open Questions

1. Should `[RL]` become `[FY]` or something else?
2. Keep backwards compatibility for `RALPH_*` env vars?
3. Rename repository or create new one?
4. Update historical thought documents or leave as-is?
