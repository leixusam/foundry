# Research: Create a tool to download Linear attachments and screenshots

**Issue**: RSK-39
**Date**: 2026-01-26
**Status**: Complete

## Summary

This feature enables Ralph to download attachments and screenshots from Linear issues before Agent 2 starts work, providing full visual context for issues with embedded images. The tool must work with both Claude Code and ChatGPT Codex CLI, saving files to a gitignored folder and passing file paths to Agent 2.

## Requirements Analysis

From the issue description:
1. **Get attachments and screenshots** from Linear issues (from description AND explicit attachments)
2. **Support both Claude Code and Codex CLI** - must be provider-agnostic
3. **Save to gitignored folder locally** - files shouldn't be committed
4. **Pass file paths to Agent 2** - so the worker can access/view the images during development
5. **Leverage existing Linear CLI integration** - RSK-21 established the Linear SDK setup

### Key Insight: MCP Already Has Attachment Metadata

The Linear MCP (`mcp__linear__get_issue`) already returns attachment metadata including URLs. For example:
```json
{
  "attachments": [
    {
      "id": "30cf463b-532e-4a37-aa78-cbc6cb8a6ccd",
      "title": "Screenshot",
      "subtitle": "user@email.com",
      "url": "https://uploads.linear.app/org-id/file-id/attachment-id"
    }
  ]
}
```

The challenge is that `uploads.linear.app` URLs require authentication to access.

## Codebase Analysis

### Relevant Files

- `ralph/src/lib/linear-api.ts` - Linear SDK wrapper using `@linear/sdk`
- `ralph/src/config.ts` - Config management, already has `LINEAR_API_KEY`
- `ralph/src/index.ts` - Main orchestration loop (Agent 1 → Agent 2 → Agent 3)
- `ralph/prompts/agent1-linear-reader.md` - Agent 1 prompt, gathers issue context
- `ralph/prompts/agent2-worker-*.md` - Agent 2 stage prompts
- `.gitignore` - Already ignores `ralph/.output/`

### Existing Patterns

1. **Linear SDK Integration**: The project uses `@linear/sdk` for GraphQL API access
2. **Provider Abstraction**: `provider.ts` defines a clean interface for spawning LLM agents
3. **Output Directory**: `ralph/.output/` is already gitignored for runtime artifacts
4. **Config Management**: Environment variables loaded from `.ralph.env`

### Dependencies

- `@linear/sdk: ^31.0.0` - Already installed
- Node.js fetch API - Available for HTTP requests

## Implementation Considerations

### Approach: Pre-Processing in Agent 1's Flow

The most practical approach is to download attachments as a pre-processing step between Agent 1 identifying the issue and Agent 2 starting work. This can be implemented as:

1. **New module**: `ralph/src/lib/attachment-downloader.ts`
2. **Integration point**: After Agent 1 outputs issue details, before Agent 2 prompt is constructed
3. **Storage location**: `ralph/.attachments/{issue-identifier}/` (gitignored)

### Authentication Methods for Linear Files

Per Linear's documentation, there are two ways to access files in `uploads.linear.app`:

**Option A: Authorization Header (Recommended)**
```bash
curl https://uploads.linear.app/{org-id}/{file-id}/{attachment-id} \
  -H 'Authorization: Bearer {LINEAR_API_KEY}'
```

**Option B: Signed URLs (Alternative)**
Configure SDK to return signed URLs with expiration:
```typescript
const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
  headers: { "public-file-urls-expire-in": "60" }
});
```

**Recommendation**: Use Option A (Authorization header) since we already have the API key available and it's simpler than managing expiring signed URLs.

### File Sources to Handle

1. **Explicit Attachments** - Available in `issue.attachments[]` array
2. **Embedded Images in Description** - Need to parse markdown for `![](https://uploads.linear.app/...)` patterns
3. **Embedded Images in Comments** - If we want full context

### Implementation Outline

```typescript
// ralph/src/lib/attachment-downloader.ts

interface AttachmentInfo {
  id: string;
  url: string;
  filename: string;
  source: 'attachment' | 'description' | 'comment';
}

interface DownloadResult {
  success: boolean;
  attachments: Array<{
    originalUrl: string;
    localPath: string;
    filename: string;
  }>;
  errors: string[];
}

export async function downloadIssueAttachments(
  apiKey: string,
  issueIdentifier: string,
  attachments: AttachmentInfo[]
): Promise<DownloadResult>;

// Parse markdown for embedded Linear upload URLs
export function extractLinearUrls(markdown: string): string[];
```

### Calling from Main Loop

```typescript
// In index.ts, after Agent 1 completes

// Extract attachments from Agent 1's output (or re-fetch issue)
const attachments = parseAttachmentsFromOutput(agent1Output);

// Download to local folder
const downloadResult = await downloadIssueAttachments(
  config.linearApiKey,
  issueIdentifier,
  attachments
);

// Include local paths in Agent 2's prompt
const workerPrompt = `...
## Attachment Files (Downloaded Locally)
${downloadResult.attachments.map(a => `- ${a.localPath}`).join('\n')}
...`;
```

### Agent 2 Compatibility (Claude Code vs Codex)

Both Claude Code and Codex can access local files:
- **Claude Code**: Uses `Read` tool to view images natively
- **Codex**: Should be able to access local files in the working directory

The key is ensuring file paths are absolute or relative to the working directory.

### Storage Location Decision

Options:
1. `ralph/.attachments/{issue-identifier}/` - Organized by issue
2. `ralph/.output/{pod-name}/attachments/` - Organized with other output

**Recommendation**: Use `ralph/.attachments/{issue-identifier}/` because:
- Attachments might be reused across multiple loops/stages
- Cleaner separation from runtime logs
- Easy to clean up old attachments periodically

### Gitignore Update

Add to `.gitignore`:
```
ralph/.attachments/
```

## Risks

1. **Large Files**: Some attachments might be large (PDFs, videos). Consider size limits.
2. **Rate Limiting**: Bulk downloads might hit Linear's rate limits. Add delays if needed.
3. **URL Parsing**: Markdown parsing for embedded images needs to handle various formats.
4. **Stale Files**: Old downloaded files might accumulate. Consider cleanup strategy.

## Testing Strategy

1. **Unit Tests**: URL extraction from markdown, authentication header construction
2. **Integration Tests**: Download actual files from a test Linear workspace
3. **E2E Tests**: Full loop with an issue containing attachments

## Specification Assessment

This feature is primarily **backend/infrastructure** - it downloads files and passes paths to Agent 2. The user experience doesn't change for humans using Ralph. Agent 2 simply gets additional file paths in its context.

**Needs Specification**: No

The UX is straightforward:
- If issue has attachments → download them → tell Agent 2 where they are
- No new user flows, screens, or interaction patterns

## Questions for Human Review

1. **File Size Limits**: Should we skip attachments over a certain size (e.g., 10MB)?
2. **File Types**: Should we filter to only download images, or all attachment types?
3. **Cleanup Strategy**: How often should old downloaded attachments be cleaned up?
4. **Comment Attachments**: Should we also download images from issue comments, or just description/attachments?

## Next Steps

Ready for planning phase. The implementation is well-scoped:
1. Create `attachment-downloader.ts` module
2. Integrate into main loop between Agent 1 and Agent 2
3. Update Agent 2 prompts to handle attachment file paths
4. Update `.gitignore`
5. Test with real issues containing attachments
