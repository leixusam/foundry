## Merge Mode: `auto` (choose the safest path)

You must choose **exactly one** of the following options:

- **Option A: Merge directly to `main`**
- **Option B: Create a PR for review**

### Decision Rubric (read first)

Prefer **Option B (PR)** when:
- The changes include **significant business logic updates**
- You are **unsure** about correctness, scope, or product intent
- You had to make assumptions, or you want review for safety
- There are potential edge cases, migrations, or higher-risk changes

Prefer **Option A (direct merge)** only when:
- The changes are **small, clearly safe**, and well-understood
- All checks pass and there are no open questions

---

# Option A: Merge directly to `main`

## A1: Get Repository URL

Before merging, get the repository URL for Agent 3:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

## A2: Merge to Main

After all checks pass, merge the feature branch to main:

```bash
# Switch to main and update
git checkout main
git pull origin main

# Attempt merge with no-ff to preserve branch history
git merge foundry/{identifier} --no-ff -m "Merge foundry/{identifier}: {issue_title}"
```

**Handle the merge result:**

1. **Clean merge (no conflicts)**: Push to main, delete feature branch
   ```bash
   git push origin main
   git branch -d foundry/{identifier}
   git push origin --delete foundry/{identifier}
   ```
   Set `merge_status: success` in WORK_RESULT.

2. **Simple conflicts** (imports, whitespace, non-overlapping): Resolve them if obvious
   - Conflicts are purely mechanical (imports, formatting)
   - Changes don't overlap in business logic
   - Resolution is obvious and doesn't require product decisions

   After resolving:
   ```bash
   git add .
   git commit -m "Merge foundry/{identifier}: {issue_title}"
   git push origin main
   git branch -d foundry/{identifier}
   git push origin --delete foundry/{identifier}
   ```
   Set `merge_status: success` in WORK_RESULT.

3. **Complex conflicts** (business logic, requires judgment): Abort and mark blocked
   - Conflicts touch core business logic
   - Multiple approaches are possible
   - Resolution requires broader context

   ```bash
   git merge --abort
   git checkout foundry/{identifier}
   ```
   Set `merge_status: blocked` and `merge_conflict_files: [list of files]` in WORK_RESULT.

### WORK_RESULT (Option A)

Use this output format when you chose **Option A (direct merge)**.

After completing your work and merge succeeds:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {merge commit hash on main}
  merge_status: success
  next_status: "∞ Done"
  summary: |
    {Brief description of what was done}
    Files changed: {list}
    All checks pass. Merged to main.
```

If work completes but merge is blocked:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash on feature branch}
  merge_status: blocked
  merge_conflict_files: [file1.ts, file2.ts]
  next_status: "∞ Blocked"
  summary: |
    {Brief description of what was done}
    Merge conflicts require human resolution.
    Conflicts in: {list of files}
```

If you encounter an error:

```
WORK_RESULT:
  success: false
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  error: |
    {What went wrong and why it couldn't be fixed}
```

---

# Option B: Create PR for review

## B1: Get Repository URL

Before creating the PR, get the repository URL:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

## B2: Create PR Description Document

Before creating the PR, write a comprehensive PR description document to `foundry-docs/prs/{identifier}.md`:

```markdown
# PR: {issue_identifier} - {issue_title}

**Branch**: `foundry/{identifier}`
**Linear Issue**: {issue_identifier}
**Date**: {YYYY-MM-DD}

## Summary

{2-3 sentence description of what this PR accomplishes and why}

## Problem

{What problem does this solve? What was the user pain point or technical need?}

## Solution

{How does this PR solve the problem? Describe the approach taken.}

## Changes

{List the key changes made, organized by category if helpful}

### Files Changed
- `path/to/file.ts` - {brief description of change}
- `path/to/other.ts` - {brief description of change}

## Testing

{How were the changes verified?}

### Automated
- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)

### Manual Verification
{Any manual testing performed or recommended}

## Breaking Changes

{List any breaking changes, or "None" if backward compatible}

## Migration Notes

{Any steps needed for users upgrading, or "None" if not applicable}

## Screenshots

{If UI changes, include before/after screenshots, or "N/A" for non-UI changes}

---
🤖 Created by [Foundry](https://github.com/leixusam/foundry) with {{PROVIDER_LINK}}
```

Commit and push this document:
```bash
git add foundry-docs/prs/
git commit -m "docs({identifier}): add PR description"
git push origin foundry/{identifier}
```

## B3: Create Pull Request

Create the pull request using the description document:

```bash
# Create the pull request with the description file
gh pr create \
  --title "{issue_identifier}: {issue_title}" \
  --body-file foundry-docs/prs/{identifier}.md \
  --base main \
  --head foundry/{identifier}
```

Replace the placeholders:
- `{issue_identifier}`: The issue ID (e.g., RSK-123)
- `{issue_title}`: The issue title
- `{identifier}`: The issue identifier for branch naming

**Handle the PR creation result:**

1. **PR created successfully**: Capture the PR URL from the output
   Set `merge_status: pr_created` and `pr_url: {URL}` in WORK_RESULT.

2. **PR creation failed**: Include the error
   Set `merge_status: pr_failed` and include error details in WORK_RESULT.

### WORK_RESULT (Option B)

Use this output format when you chose **Option B (PR)**.

After completing your work and PR is created:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  pr_description_path: foundry-docs/prs/{identifier}.md
  commit_hash: {short hash on feature branch}
  merge_status: pr_created
  pr_url: {GitHub PR URL}
  next_status: "∞ Awaiting Merge"
  summary: |
    {Brief description of what was done}
    Files changed: {list}
    All checks pass. PR created for review.
    PR: {pr_url}
```

If PR creation fails:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
  commit_hash: {short hash on feature branch}
  merge_status: pr_failed
  next_status: "∞ Blocked"
  summary: |
    {Brief description of what was done}
    PR creation failed: {error message}
```

If you encounter an error during implementation:

```
WORK_RESULT:
  success: false
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  error: |
    {What went wrong and why it couldn't be fixed}
```
