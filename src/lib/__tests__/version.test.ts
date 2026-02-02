import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'fs';
import { getVersion, getPackageName } from '../version.js';

describe('version module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVersion()', () => {
    it('returns version from package.json', () => {
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ name: '@leixusam/foundry', version: '1.2.3' })
      );

      const result = getVersion();

      expect(result).toBe('1.2.3');
    });

    it('returns "unknown" if file not found', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = getVersion();

      expect(result).toBe('unknown');
    });

    it('returns "unknown" if JSON parse fails', () => {
      vi.mocked(readFileSync).mockReturnValue('not valid json');

      const result = getVersion();

      expect(result).toBe('unknown');
    });
  });

  describe('getPackageName()', () => {
    it('returns name from package.json', () => {
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ name: 'my-custom-package', version: '1.0.0' })
      );

      const result = getPackageName();

      expect(result).toBe('my-custom-package');
    });

    it('returns "@leixusam/foundry" if file not found', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = getPackageName();

      expect(result).toBe('@leixusam/foundry');
    });

    it('handles parse errors gracefully', () => {
      vi.mocked(readFileSync).mockReturnValue('invalid json here');

      const result = getPackageName();

      expect(result).toBe('@leixusam/foundry');
    });
  });
});
