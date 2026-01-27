# Oneshot: Preserve attachment filenames and extensions

**Issue**: F-59
**Date**: 2026-01-27
**Status**: Complete

## What Was Done

Fixed the attachment downloader to preserve original filenames and file extensions when downloading attachments from Linear.

**Problem**: When Foundry downloaded attachments from Linear, files were saved with cryptic names (base64 ID + UUID) without file extensions, making them difficult to use.

**Solution**:
1. Extract original filename from markdown alt text syntax (`![Screenshot 2026-01-27.png](url)`)
2. Add Content-Type based extension inference as a fallback for URLs without alt text
3. Ensure files are saved with their proper extensions (`.png`, `.jpg`, `.pdf`, etc.)

## Files Changed

- `src/lib/attachment-downloader.ts` - Core changes:
  - Added `MARKDOWN_IMAGE_PATTERN` regex to extract alt text from markdown images
  - Added `CONTENT_TYPE_TO_EXT` mapping for common file types
  - Modified `extractLinearUrls()` to use markdown alt text as filename when available
  - Added `hasFileExtension()` helper to check for file extensions
  - Added `getFilenameFromUrl()` helper for URL-based fallback
  - Added `getExtensionFromContentType()` and `ensureFileExtension()` for Content-Type fallback
  - Modified `downloadAttachment()` to apply extension from Content-Type when filename lacks one

## Verification

- TypeScript: PASS
- Build: PASS
- Manual test: PASS (verified with test script)

### Test Results

| Test Case | Expected | Actual | Result |
|-----------|----------|--------|--------|
| `![Screenshot 2026-01-27 at 10.52.13.png](url)` | `Screenshot 2026-01-27 at 10.52.13.png` | `Screenshot 2026-01-27 at 10.52.13.png` | PASS |
| `![image.png](url)` | `image.png` | `image.png` | PASS |
| Plain URL without markdown | URL segment | URL segment | PASS |
| Alt text without extension | URL segment | URL segment | PASS |

## Notes

- The fix uses a two-tier fallback system:
  1. **Primary**: Markdown alt text (best source for original filename)
  2. **Secondary**: URL path segment + Content-Type header for extension

- Common content types mapped: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `application/pdf`, `text/plain`, `application/json`, `application/zip`

- Files are still prefixed with a base64 ID for uniqueness (e.g., `aHR0cHM6Ly91-Screenshot-2026-01-27-at-10.52.13.png`)
