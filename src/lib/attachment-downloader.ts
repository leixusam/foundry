import * as fs from 'node:fs';
import * as path from 'node:path';
import { AttachmentInfo, DownloadResult, DownloadedAttachment } from '../types.js';
import { getRepoRoot } from '../config.js';

// Pattern to match Linear upload URLs in markdown content
const LINEAR_UPLOAD_PATTERN = /https:\/\/uploads\.linear\.app\/[^\s\)\]"'<>]+/g;

// Size limit warning threshold (10MB)
const SIZE_WARNING_THRESHOLD = 10 * 1024 * 1024;

/**
 * Extracts Linear upload URLs from markdown content (descriptions, comments, etc.)
 */
export function extractLinearUrls(markdown: string): AttachmentInfo[] {
  const urls = markdown.match(LINEAR_UPLOAD_PATTERN) || [];
  const seen = new Set<string>();
  const attachments: AttachmentInfo[] = [];

  for (const url of urls) {
    // Skip duplicates
    if (seen.has(url)) continue;
    seen.add(url);

    // Extract filename from URL
    const urlPath = new URL(url).pathname;
    const segments = urlPath.split('/');
    const filename = segments[segments.length - 1] || 'attachment';

    // Generate a unique ID from URL hash
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
  const attachmentsDir = path.join(getRepoRoot(), '.ralph', 'attachments', issueIdentifier);

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
 * Downloads a single attachment from Linear
 */
async function downloadAttachment(
  apiKey: string,
  attachment: AttachmentInfo,
  outputDir: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const response = await fetch(attachment.url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

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
    const sanitizedFilename = sanitizeFilename(attachment.filename);
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
