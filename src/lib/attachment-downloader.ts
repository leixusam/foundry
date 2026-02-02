import * as fs from 'node:fs';
import * as path from 'node:path';
import { AttachmentInfo, DownloadResult, DownloadedAttachment } from '../types.js';
import { getRepoRoot } from '../config.js';

// Pattern to match Linear upload URLs in markdown content
const LINEAR_UPLOAD_PATTERN = /https:\/\/uploads\.linear\.app\/[^\s\)\]"'<>]+/g;

// Pattern to match markdown image syntax with alt text: ![alt text](url)
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\((https:\/\/uploads\.linear\.app\/[^\s\)]+)\)/g;

// Size limit warning threshold (10MB)
const SIZE_WARNING_THRESHOLD = 10 * 1024 * 1024;

// Map Content-Type to file extension
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/json': '.json',
  'application/zip': '.zip',
};

/**
 * Extracts Linear upload URLs from markdown content (descriptions, comments, etc.)
 * Preserves original filenames from markdown alt text (e.g., ![image.png](url))
 */
export function extractLinearUrls(markdown: string): AttachmentInfo[] {
  const seen = new Set<string>();
  const attachments: AttachmentInfo[] = [];

  // First, extract images with alt text (which contains the original filename)
  // This gives us the best filename info: ![Screenshot 2026-01-27.png](url)
  const imageMatches = [...markdown.matchAll(MARKDOWN_IMAGE_PATTERN)];
  for (const match of imageMatches) {
    const [, altText, url] = match;
    if (seen.has(url)) continue;
    seen.add(url);

    // Use alt text as filename if it looks like a filename (has extension)
    const filename = hasFileExtension(altText) ? altText : getFilenameFromUrl(url);

    // Generate a unique ID from URL hash
    const id = Buffer.from(url).toString('base64').slice(0, 12);

    attachments.push({
      id,
      url,
      filename: decodeURIComponent(filename),
      source: 'embedded',
    });
  }

  // Then extract any standalone URLs that weren't in markdown image syntax
  const urls = markdown.match(LINEAR_UPLOAD_PATTERN) || [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    const filename = getFilenameFromUrl(url);
    const id = Buffer.from(url).toString('base64').slice(0, 12);

    attachments.push({
      id,
      url,
      filename: decodeURIComponent(filename),
      source: 'embedded',
    });
  }

  return attachments;
}

/**
 * Checks if a string looks like a filename (has a file extension)
 */
function hasFileExtension(text: string): boolean {
  return /\.\w{2,5}$/.test(text.trim());
}

/**
 * Extracts filename from URL path (fallback when no alt text available)
 */
function getFilenameFromUrl(url: string): string {
  const urlPath = new URL(url).pathname;
  const segments = urlPath.split('/');
  return segments[segments.length - 1] || 'attachment';
}

/**
 * Parses attachment metadata from Agent 1's output.
 * Looks for the Attachments section and extracts Linear upload URLs.
 */
export function parseAgent1Attachments(agent1Output: string): AttachmentInfo[] {
  // First extract any URLs from the entire output (embedded images in description)
  const allUrls = extractLinearUrls(agent1Output);

  // Also look for explicit attachment section
  // Agent 1 outputs attachments like:
  // ### Attachments
  // - Screenshot: https://uploads.linear.app/...
  const attachmentSection = agent1Output.match(/### Attachments\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (attachmentSection) {
    const sectionUrls = extractLinearUrls(attachmentSection[1]);
    // Mark these as explicit attachments
    for (const att of sectionUrls) {
      const existing = allUrls.find(a => a.url === att.url);
      if (existing) {
        existing.source = 'attachment';
      } else {
        att.source = 'attachment';
        allUrls.push(att);
      }
    }
  }

  return allUrls;
}

/**
 * Ensures the attachment directory exists for a given issue
 */
export function ensureAttachmentDir(issueIdentifier: string): string {
  const attachmentsDir = path.join(getRepoRoot(), '.foundry', 'attachments', issueIdentifier);

  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  return attachmentsDir;
}

/**
 * Sanitizes a filename for safe filesystem use
 */
function sanitizeFilename(filename: string): string {
  // Remove or replace problematic characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200); // Limit length
}

/**
 * Gets file extension from Content-Type header
 */
function getExtensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  // Content-Type can include charset, e.g., "image/png; charset=utf-8"
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[mimeType] || null;
}

/**
 * Ensures a filename has an extension, inferring from Content-Type if needed
 */
function ensureFileExtension(filename: string, contentType: string | null): string {
  if (hasFileExtension(filename)) {
    return filename;
  }
  const ext = getExtensionFromContentType(contentType);
  return ext ? `${filename}${ext}` : filename;
}

/**
 * Downloads a single attachment from Linear
 */
async function downloadAttachment(
  _apiKey: string,
  attachment: AttachmentInfo,
  outputDir: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    // Linear attachment URLs are pre-signed with ?signature= query parameters
    // No Authorization header needed - the signature provides access
    const response = await fetch(attachment.url);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check content length for warning
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > SIZE_WARNING_THRESHOLD) {
      console.log(`  Warning: Large file (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB): ${attachment.filename}`);
    }

    const buffer = await response.arrayBuffer();

    // Ensure filename has extension (use Content-Type as fallback)
    const contentType = response.headers.get('content-type');
    const filenameWithExt = ensureFileExtension(attachment.filename, contentType);
    const sanitizedFilename = sanitizeFilename(filenameWithExt);
    const localPath = path.join(outputDir, `${attachment.id}-${sanitizedFilename}`);

    fs.writeFileSync(localPath, Buffer.from(buffer));

    return { success: true, localPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Downloads all attachments for an issue.
 * Returns the local file paths for successfully downloaded files.
 */
export async function downloadIssueAttachments(
  apiKey: string,
  issueIdentifier: string,
  attachments: AttachmentInfo[]
): Promise<DownloadResult> {
  if (attachments.length === 0) {
    return { success: true, attachments: [], errors: [] };
  }

  console.log(`Downloading ${attachments.length} attachment(s) for ${issueIdentifier}...`);

  const outputDir = ensureAttachmentDir(issueIdentifier);
  const downloaded: DownloadedAttachment[] = [];
  const errors: string[] = [];

  for (const attachment of attachments) {
    console.log(`  Downloading: ${attachment.filename}`);
    const result = await downloadAttachment(apiKey, attachment, outputDir);

    if (result.success && result.localPath) {
      downloaded.push({
        originalUrl: attachment.url,
        localPath: result.localPath,
        filename: attachment.filename,
      });
      console.log(`    ✓ Saved to ${result.localPath}`);
    } else {
      const errorMsg = `Failed to download ${attachment.filename}: ${result.error}`;
      errors.push(errorMsg);
      console.log(`    ✗ ${result.error}`);
    }
  }

  console.log(`  Downloaded ${downloaded.length}/${attachments.length} files`);

  return {
    success: errors.length === 0,
    attachments: downloaded,
    errors,
  };
}

/**
 * Main entry point: Downloads attachments from Agent 1's output.
 * Returns an array of local file paths that Agent 2 can read.
 */
export async function downloadAttachmentsFromAgent1Output(
  apiKey: string,
  agent1Output: string,
  issueIdentifier: string
): Promise<string[]> {
  // Parse attachments from Agent 1's output
  const attachments = parseAgent1Attachments(agent1Output);

  if (attachments.length === 0) {
    return [];
  }

  // Download all attachments
  const result = await downloadIssueAttachments(apiKey, issueIdentifier, attachments);

  // Log any errors but don't crash
  if (result.errors.length > 0) {
    console.log('  Some attachments failed to download:');
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }

  // Return the local file paths
  return result.attachments.map(a => a.localPath);
}
