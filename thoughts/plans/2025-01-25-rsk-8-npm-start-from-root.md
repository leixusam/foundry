# Implementation Plan: Run npm start from Project Root (RSK-8)

## Summary

Create a root-level `package.json` that proxies npm scripts to the `ralph/` package, allowing users to run `npm start` from the project root directory instead of requiring `cd ralph/` first.

## Background

Based on research findings (`thoughts/research/2025-01-25-rsk-8-npm-start-from-root.md`):
- The Node.js application code already correctly uses `git rev-parse --show-toplevel` for working directory
- Claude spawns with full project access regardless of where npm is run
- The issue is purely NPM convenience - `package.json` is in `ralph/`, requiring `cd ralph/` before running npm commands

## Approach

Use npm's `--prefix` flag to create proxy scripts in a root-level `package.json`. This is a standard pattern for monorepo-style setups and requires minimal changes.

## Implementation Phases

### Phase 1: Create Root package.json

**File**: `/package.json` (CREATE)

```json
{
  "name": "ralph-default-files",
  "version": "1.0.0",
  "private": true,
  "description": "Linear-orchestrated autonomous agent system - project root",
  "scripts": {
    "install:ralph": "npm install --prefix ralph",
    "build": "npm run build --prefix ralph",
    "start": "npm start --prefix ralph",
    "dev": "npm run dev --prefix ralph",
    "typecheck": "npm run typecheck --prefix ralph"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Notes**:
- `private: true` prevents accidental publishing
- `install:ralph` script for installing dependencies (since `npm install` at root won't install ralph's deps)
- All scripts proxy to ralph/ using `--prefix`

### Phase 2: Verify Implementation

Run the following commands from project root to verify:

1. `npm run install:ralph` - Should install ralph's dependencies
2. `npm run build` - Should compile TypeScript
3. `npm start` - Should start the application
4. `npm run typecheck` - Should run type checking
5. `cd ralph && npm start` - Should still work (backward compatibility)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `/package.json` | CREATE | Root package.json with proxy scripts |

## Success Criteria

1. `npm start` works from project root
2. `npm run build` works from project root
3. `npm run dev` works from project root
4. `npm run typecheck` works from project root
5. All commands still work from `ralph/` directory (backward compatibility)
6. No changes required to existing application code

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Script proxy adds latency | Low | Low | npm --prefix has negligible overhead |
| Confusion about which package.json | Medium | Low | Clear naming and private:true prevents issues |

## Rollback Plan

If issues arise, simply delete `/package.json`. The existing workflow (cd ralph && npm start) remains unchanged.

## Estimated Effort

Minimal - single file creation with 4 proxy scripts.
