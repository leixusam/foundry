### Step 7: Get Repository URL

Before creating the PR, get the repository URL:

```bash
git remote get-url origin
```

Include this as `repo_url` in WORK_RESULT.

### Step 8: Create Pull Request

Instead of merging directly, create a pull request for human review.

```bash
# Ensure all changes are pushed to the feature branch
git push origin foundry/{identifier}

# Create the pull request
gh pr create \
  --title "{issue_identifier}: {issue_title}" \
  --body "$(cat <<'EOF'
## Summary

{Brief description of what was implemented}

## Changes

{List of key changes made}

## Testing

{How the changes were verified}

- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] Lint passes

## Linear Issue

{issue_identifier}

---
🤖 Created by [Foundry](https://github.com/leixusam/foundry) with {{PROVIDER_LINK}}
EOF
)" \
  --base main \
  --head foundry/{identifier}
```

Replace the placeholders:
- `{issue_identifier}`: The issue ID (e.g., RSK-123)
- `{issue_title}`: The issue title
- Other fields based on the work completed

**Handle the PR creation result:**

1. **PR created successfully**: Capture the PR URL from the output
   Set `merge_status: pr_created` and `pr_url: {URL}` in WORK_RESULT.

2. **PR creation failed**: Include the error
   Set `merge_status: pr_failed` and include error details in WORK_RESULT.

## Output Format

After completing your work and PR is created:

```
WORK_RESULT:
  success: true
  stage_completed: {{STAGE}}
  workflow: {{WORKFLOW}}
  branch_name: foundry/{identifier}
  repo_url: {git remote URL, e.g., https://github.com/owner/repo.git}
  artifact_path: foundry-docs/{{ARTIFACT_DIR}}/YYYY-MM-DD-{identifier}-{slug}.md
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
