# Implementation Plan: Create a tool to download Linear attachments and screenshots

**Issue**: RSK-39
**Date**: 2026-01-26
**Research**: thoughts/research/2026-01-26-RSK-39-linear-attachment-downloader.md
**Specification**: N/A (pure infrastructure feature, no UX changes)
**Status**: Ready for Implementation

## Overview

This feature adds an attachment downloader module to Ralph that downloads images and files from Linear issues before Agent 2 starts work. This gives Agent 2 full visual context when working on issues that include screenshots or mockups.

The implementation:
1. Creates a new `attachment-downloader.ts` module
2. Integrates it into the main loop between Agent 1 and Agent 2
3. Passes downloaded file paths to Agent 2's prompt
4. Works with both Claude Code (Read tool) and Codex CLI (local file access)

## Success Criteria

- [ ] Attachments from Linear issues are downloaded to `ralph/.attachments/{issue-identifier}/`
- [ ] Embedded images from issue descriptions are extracted and downloaded
- [ ] File paths are passed to Agent 2's prompt so it can view images
- [ ] Both Claude Code and Codex CLI can access downloaded files
- [ ] Failed downloads don't crash Ralph (graceful error handling)
- [ ] Type check passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Manual test: Run Ralph on an issue with attachments and verify download

## Phases

### Phase 1: Create Attachment Downloader Module

**Goal**: Create the core download functionality as a standalone module

**Changes**:
- `ralph/src/lib/attachment-downloader.ts`: New module with:
  - `AttachmentInfo` interface (id, url, filename, source)
  - `DownloadResult` interface (success, attachments array, errors array)
  - `extractLinearUrls(markdown: string)`: Parse markdown for Linear upload URLs
  - `downloadIssueAttachments(apiKey, issueIdentifier, attachments)`: Download files
  - `ensureAttachmentDir(issueIdentifier)`: Create output directory
- `ralph/src/types.ts`: Add `AttachmentInfo` and `DownloadResult` types

**Implementation Details**:
```typescript
// URL pattern for Linear uploads
const LINEAR_UPLOAD_PATTERN = /https:\/\/uploads\.linear\.app\/[^\s\)\]"']+/g;

// Download with Authorization header
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 2: Update .gitignore

**Goal**: Ensure downloaded attachments are not committed

**Changes**:
- `.gitignore`: Add `ralph/.attachments/` to the ignore list

**Verification**:
```bash
# Verify the pattern matches
git check-ignore ralph/.attachments/test.png
```

### Phase 3: Integrate into Main Loop

**Goal**: Download attachments between Agent 1 and Agent 2

**Changes**:
- `ralph/src/index.ts`:
  - Import attachment downloader module
  - After Agent 1 output, parse for attachments metadata
  - Call `downloadIssueAttachments()`
  - Include downloaded file paths in Agent 2's prompt

**Integration Point** (after line ~78 in index.ts):
```typescript
// After agent1Output is extracted, before Agent 2 starts:
const attachmentPaths = await downloadAttachmentsFromAgent1Output(
  config.linearApiKey!,
  agent1Output
);

// Include in worker prompt (around line ~98):
const workerPrompt = `...
${attachmentPaths.length > 0 ? `
## Downloaded Attachments

The following files have been downloaded locally from the Linear issue. You can read/view these files:
${attachmentPaths.map(p => `- ${p}`).join('\n')}
` : ''}
...`;
```

**Verification**:
```bash
npm run typecheck
npm run build
```

### Phase 4: Add Helper to Parse Agent 1 Output

**Goal**: Extract attachment URLs from Agent 1's structured output

**Changes**:
- `ralph/src/lib/attachment-downloader.ts`: Add function to parse Agent 1's output for attachment metadata
  - Parse attachment URLs from the `### Attachments` section
  - Parse embedded image URLs from the issue description

**Format Agent 1 outputs** (from agent1-linear-reader.md):
```
### Attachments
- Branch: ralph/RSK-39 (https://github.com/...)
- Screenshot: https://uploads.linear.app/...
```

**Verification**:
```bash
npm run typecheck
npm run build
```

## Testing Strategy

### Manual Testing
1. Create a test issue in Linear with:
   - An attached screenshot
   - An embedded image in the description
2. Put the issue in `[RL] Needs Research` status
3. Run Ralph with `RALPH_MAX_ITERATIONS=1`
4. Verify:
   - Files appear in `ralph/.attachments/{issue-identifier}/`
   - Agent 2's log shows the attachment paths
   - Agent 2 can reference/read the files

### Edge Cases to Test
- Issue with no attachments (should work normally)
- Invalid/expired attachment URLs (should log error, continue)
- Large files (consider adding size limits in future iteration)
- Non-image attachments (PDFs, etc.)

## Rollback Plan

1. Remove the attachment download integration from `index.ts`
2. Delete `ralph/src/lib/attachment-downloader.ts`
3. Remove types from `ralph/src/types.ts`
4. The gitignore change can stay (harmless)

Since attachments are optional context and not required for core functionality, any issues can be resolved by simply removing the integration call in `index.ts`.

## Notes

### File Naming Strategy
Downloaded files will be named: `{original-id-or-hash}-{sanitized-title}.{ext}`
This preserves uniqueness while being human-readable.

### Size Limits (Future Enhancement)
The research suggested considering a 10MB limit. For this initial implementation, we'll download all files but log warnings for files over 10MB. A hard limit can be added later if needed.

### Cleanup Strategy (Future Enhancement)
Old attachments in `ralph/.attachments/` can accumulate. Consider adding:
- Automatic cleanup of attachments older than 7 days
- Cleanup before each loop iteration

This is out of scope for the initial implementation but noted for future work.

### Comment Attachments (Out of Scope)
The research mentioned potentially downloading images from comments. This is deferred to a future ticket if needed. For now, only description and explicit attachments are handled.
