import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptsDir = join(__dirname, '../../prompts');
export async function loadPrompt(name) {
    const path = join(promptsDir, `${name}.md`);
    return readFile(path, 'utf-8');
}
// Build the worker prompt based on stage
export async function buildWorkerPrompt(dispatch) {
    const basePrompt = await loadPrompt(`agent2-worker-${dispatch.stage}`);
    // Build the context section with all dispatch info
    const context = `
## Issue Context

The following information was gathered by Agent 1 from Linear:

\`\`\`
DISPATCH_RESULT:
  issue_id: ${dispatch.issueId}
  issue_identifier: ${dispatch.issueIdentifier}
  issue_title: ${dispatch.issueTitle}
  issue_description: |
    ${dispatch.issueDescription.split('\n').join('\n    ')}
  stage: ${dispatch.stage}
  project_name: ${dispatch.projectName}
  claim_timestamp: ${dispatch.claimTimestamp}
  labels: [${dispatch.labels.join(', ')}]
  priority: ${dispatch.priority}
  existing_artifacts:
    research: ${dispatch.existingArtifacts.research || ''}
    plan: ${dispatch.existingArtifacts.plan || ''}
  comments_summary: |
    ${(dispatch.commentsSummary || 'No previous comments').split('\n').join('\n    ')}
\`\`\`

---

`;
    return context + basePrompt;
}
// Build the Linear writer prompt with results from Agent 1 and Agent 2
export async function buildWriterPrompt(dispatch, workResult, claudeResult) {
    const basePrompt = await loadPrompt('agent3-linear-writer');
    // Include both dispatch and work results
    const context = `
## Agent 1 Output (Issue Context)

\`\`\`
DISPATCH_RESULT:
  issue_id: ${dispatch.issueId}
  issue_identifier: ${dispatch.issueIdentifier}
  issue_title: ${dispatch.issueTitle}
  stage: ${dispatch.stage}
  claim_timestamp: ${dispatch.claimTimestamp}
\`\`\`

## Agent 2 Output (Work Result)

${workResult ? `
\`\`\`
WORK_RESULT:
  success: ${workResult.success}
  stage_completed: ${workResult.stageCompleted || 'unknown'}
  artifact_path: ${workResult.artifactPath || 'none'}
  commit_hash: ${workResult.commitHash || 'none'}
  next_status: ${workResult.nextStatus || 'unknown'}
  summary: |
    ${(workResult.summary || 'No summary provided').split('\n').join('\n    ')}
  error: |
    ${(workResult.error || '').split('\n').join('\n    ')}
\`\`\`
` : `
Agent 2 did not produce a parseable WORK_RESULT.
This may indicate a crash, timeout, or other error.

Raw output excerpt (last 500 chars):
\`\`\`
${claudeResult.output.slice(-500)}
\`\`\`
`}

## Session Stats

- Cost: $${claudeResult.cost.toFixed(4)}
- Duration: ${Math.round(claudeResult.duration / 1000)}s
- Exit code: ${claudeResult.exitCode}
- Rate limited: ${claudeResult.rateLimited}

---

`;
    return context + basePrompt;
}
//# sourceMappingURL=prompts.js.map