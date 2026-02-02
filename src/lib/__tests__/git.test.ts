import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process and config before importing
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  getConfig: vi.fn(() => ({
    workingDirectory: '/mock/repo',
  })),
}));

import { execSync } from 'child_process';
import { gitPull, getCurrentBranch } from '../git.js';

describe('git module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gitPull()', () => {
    it('returns true on success', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('Already up to date.'));

      const result = gitPull();

      expect(result).toBe(true);
    });

    it('returns false on failure', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Could not resolve host');
      });

      const result = gitPull();

      expect(result).toBe(false);
    });

    it('uses correct working directory', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      gitPull();

      expect(execSync).toHaveBeenCalledWith('git pull origin main', {
        stdio: 'pipe',
        cwd: '/mock/repo',
      });
    });
  });

  describe('getCurrentBranch()', () => {
    it('returns branch name on success', () => {
      vi.mocked(execSync).mockReturnValue('feature/my-branch\n');

      const result = getCurrentBranch();

      expect(result).toBe('feature/my-branch');
    });

    it('returns "unknown" on failure', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = getCurrentBranch();

      expect(result).toBe('unknown');
    });

    it('uses correct working directory', () => {
      vi.mocked(execSync).mockReturnValue('main\n');

      getCurrentBranch();

      expect(execSync).toHaveBeenCalledWith('git branch --show-current', {
        encoding: 'utf-8',
        cwd: '/mock/repo',
      });
    });
  });
});
