import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractLinearUrls, parseAgent1Attachments, ensureAttachmentDir } from '../attachment-downloader.js';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  getRepoRoot: vi.fn(() => '/mock/repo'),
}));

import * as fs from 'fs';
import { getRepoRoot } from '../../config.js';

describe('attachment-downloader module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractLinearUrls()', () => {
    it('extracts URL from markdown image syntax `![alt](url)`', () => {
      const markdown = '![screenshot.png](https://uploads.linear.app/abc/def/screenshot.png)';
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://uploads.linear.app/abc/def/screenshot.png');
    });

    it('uses alt text as filename when it has extension', () => {
      const markdown = '![my-image.png](https://uploads.linear.app/abc/def/random-id)';
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('my-image.png');
    });

    it('falls back to URL path for filename', () => {
      const markdown = '![Description](https://uploads.linear.app/abc/def/image.png)';
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('image.png');
    });

    it('handles multiple URLs in one string', () => {
      const markdown = `
        ![first.png](https://uploads.linear.app/a/b/first.png)
        Some text here
        ![second.jpg](https://uploads.linear.app/c/d/second.jpg)
      `;
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('first.png');
      expect(result[1].filename).toBe('second.jpg');
    });

    it('deduplicates URLs (returns unique set)', () => {
      const markdown = `
        ![first.png](https://uploads.linear.app/a/b/image.png)
        ![second.png](https://uploads.linear.app/a/b/image.png)
      `;
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(1);
    });

    it('generates unique ID from URL hash', () => {
      const markdown = '![test.png](https://uploads.linear.app/a/b/test.png)';
      const result = extractLinearUrls(markdown);

      expect(result[0].id).toBeTruthy();
      expect(typeof result[0].id).toBe('string');
      expect(result[0].id.length).toBe(12);
    });

    it('handles standalone URLs (not in markdown syntax)', () => {
      const markdown = 'Check this: https://uploads.linear.app/abc/def/file.pdf';
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://uploads.linear.app/abc/def/file.pdf');
    });

    it('handles mixed markdown images and standalone URLs', () => {
      const markdown = `
        ![first.png](https://uploads.linear.app/a/b/first.png)
        Also see: https://uploads.linear.app/c/d/second.pdf
      `;
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(2);
    });

    it('returns empty array for no matches', () => {
      const markdown = 'No Linear URLs here, just regular text and https://example.com';
      const result = extractLinearUrls(markdown);

      expect(result).toHaveLength(0);
    });

    it('decodes URL-encoded filenames', () => {
      const markdown = '![test file.png](https://uploads.linear.app/a/b/test%20file.png)';
      const result = extractLinearUrls(markdown);

      expect(result[0].filename).toBe('test file.png');
    });
  });

  describe('parseAgent1Attachments()', () => {
    it('extracts URLs from entire output', () => {
      const output = `
Some text here
![image.png](https://uploads.linear.app/a/b/image.png)
More text
      `;
      const result = parseAgent1Attachments(output);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('image.png');
    });

    it('marks section URLs as "attachment" source', () => {
      const output = `
## Description
Some text

### Attachments
- Screenshot: https://uploads.linear.app/a/b/screenshot.png

## Other Section
      `;
      const result = parseAgent1Attachments(output);

      const attachmentUrls = result.filter(a => a.source === 'attachment');
      expect(attachmentUrls).toHaveLength(1);
    });

    it('marks embedded URLs as "embedded" source', () => {
      const output = `
## Description
Check this ![image.png](https://uploads.linear.app/a/b/image.png)
      `;
      const result = parseAgent1Attachments(output);

      expect(result[0].source).toBe('embedded');
    });

    it('deduplicates across sections', () => {
      const output = `
## Description
![image.png](https://uploads.linear.app/a/b/image.png)

### Attachments
- image: https://uploads.linear.app/a/b/image.png
      `;
      const result = parseAgent1Attachments(output);

      expect(result).toHaveLength(1);
      // The attachment section version should mark it as 'attachment'
      expect(result[0].source).toBe('attachment');
    });

    it('handles output with no attachments section', () => {
      const output = `
## Description
Just some text, no attachments
## Summary
More text
      `;
      const result = parseAgent1Attachments(output);

      expect(result).toHaveLength(0);
    });
  });

  describe('ensureAttachmentDir()', () => {
    it('creates directory if not exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      ensureAttachmentDir('F-123');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/mock/repo/.foundry/attachments/F-123',
        { recursive: true }
      );
    });

    it('returns correct path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = ensureAttachmentDir('F-456');

      expect(result).toBe('/mock/repo/.foundry/attachments/F-456');
    });

    it('works when directory already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = ensureAttachmentDir('F-789');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe('/mock/repo/.foundry/attachments/F-789');
    });
  });
});
