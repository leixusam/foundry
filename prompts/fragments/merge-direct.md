### Step 7: Get Repository URL

Before merging, get the repository URL for Agent 3:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

### Step 8: Merge to Main

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

## Output Format

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
