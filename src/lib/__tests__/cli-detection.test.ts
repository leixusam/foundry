import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import {
  isClaudeCliInstalled,
  isCodexCliInstalled,
  detectAvailableClis,
  hasAnyCli,
  CliAvailability,
} from '../cli-detection.js';

describe('cli-detection module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isClaudeCliInstalled()', () => {
    it('returns true when `claude --version` succeeds', () => {
      vi.mocked(execSync).mockReturnValue('claude version 1.0.0');

      const result = isClaudeCliInstalled();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('claude --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('returns false when command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = isClaudeCliInstalled();

      expect(result).toBe(false);
    });

    it('handles timeout gracefully', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('ETIMEDOUT');
        (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw error;
      });

      const result = isClaudeCliInstalled();

      expect(result).toBe(false);
    });
  });

  describe('isCodexCliInstalled()', () => {
    it('returns true when `codex --version` succeeds', () => {
      vi.mocked(execSync).mockReturnValue('codex version 2.0.0');

      const result = isCodexCliInstalled();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('codex --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('returns false when command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = isCodexCliInstalled();

      expect(result).toBe(false);
    });

    it('handles timeout gracefully', () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('ETIMEDOUT');
        (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw error;
      });

      const result = isCodexCliInstalled();

      expect(result).toBe(false);
    });
  });

  describe('detectAvailableClis()', () => {
    it('returns correct availability object', () => {
      vi.mocked(execSync)
        .mockReturnValueOnce('claude version 1.0.0') // claude
        .mockImplementationOnce(() => {
          throw new Error('not found'); // codex
        });

      const result = detectAvailableClis();

      expect(result).toEqual({
        claude: true,
        codex: false,
      });
    });

    it('both false when neither installed', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = detectAvailableClis();

      expect(result).toEqual({
        claude: false,
        codex: false,
      });
    });

    it('both true when both installed', () => {
      vi.mocked(execSync).mockReturnValue('version 1.0.0');

      const result = detectAvailableClis();

      expect(result).toEqual({
        claude: true,
        codex: true,
      });
    });
  });

  describe('hasAnyCli()', () => {
    it('returns true if claude available', () => {
      const availability: CliAvailability = { claude: true, codex: false };
      expect(hasAnyCli(availability)).toBe(true);
    });

    it('returns true if codex available', () => {
      const availability: CliAvailability = { claude: false, codex: true };
      expect(hasAnyCli(availability)).toBe(true);
    });

    it('returns true if both available', () => {
      const availability: CliAvailability = { claude: true, codex: true };
      expect(hasAnyCli(availability)).toBe(true);
    });

    it('returns false if neither available', () => {
      const availability: CliAvailability = { claude: false, codex: false };
      expect(hasAnyCli(availability)).toBe(false);
    });
  });
});
