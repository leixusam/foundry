import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sep } from 'path';

// `src/config.ts` loads `.foundry/env` at import-time. Make tests deterministic even if a developer
// has that file locally by pretending it doesn't exist.
const FOUNDRY_ENV_SUFFIX = `${sep}.foundry${sep}env`;

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();

  return {
    ...actual,
    existsSync: vi.fn((path: Parameters<typeof actual.existsSync>[0]) => {
      if (typeof path === 'string' && path.endsWith(FOUNDRY_ENV_SUFFIX)) {
        return false;
      }
      return actual.existsSync(path);
    }),
    readFileSync: vi.fn((path: Parameters<typeof actual.readFileSync>[0], ...rest: unknown[]) => {
      if (typeof path === 'string' && path.endsWith(FOUNDRY_ENV_SUFFIX)) {
        return '';
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return actual.readFileSync(path, ...(rest as [any]));
    }),
  };
});

// Store original env
const originalEnv = process.env;

describe('config module', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear all FOUNDRY and CODEX env vars to get defaults
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('FOUNDRY_') || key.startsWith('CODEX_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getRepoRoot()', () => {
    it('returns git repo root when in repo', async () => {
      const { getRepoRoot } = await import('../../config.js');
      const result = getRepoRoot();
      // Should return a valid path (we're running in a git repo)
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('returns a string path', async () => {
      const { getRepoRoot } = await import('../../config.js');
      const result = getRepoRoot();
      // Path should not be empty
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isGitRepository()', () => {
    it('returns true when in git repo', async () => {
      const { isGitRepository } = await import('../../config.js');
      const result = isGitRepository();
      // We're running in the foundry git repo
      expect(result).toBe(true);
    });
  });

  describe('getConfig() - provider configuration', () => {
    it('returns claude as default provider', async () => {
      delete process.env.FOUNDRY_PROVIDER;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.provider).toBe('claude');
    });

    it('returns codex when FOUNDRY_PROVIDER=codex', async () => {
      process.env.FOUNDRY_PROVIDER = 'codex';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.provider).toBe('codex');
    });

    it('returns opus as default claude model', async () => {
      delete process.env.FOUNDRY_CLAUDE_MODEL;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.claudeModel).toBe('opus');
    });

    it('returns sonnet when FOUNDRY_CLAUDE_MODEL=sonnet', async () => {
      process.env.FOUNDRY_CLAUDE_MODEL = 'sonnet';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.claudeModel).toBe('sonnet');
    });

    it('returns haiku when FOUNDRY_CLAUDE_MODEL=haiku', async () => {
      process.env.FOUNDRY_CLAUDE_MODEL = 'haiku';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.claudeModel).toBe('haiku');
    });
  });

  describe('getConfig() - max iterations', () => {
    it('returns 0 (unlimited) by default', async () => {
      delete process.env.FOUNDRY_MAX_ITERATIONS;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.maxIterations).toBe(0);
    });

    it('returns positive number when set', async () => {
      process.env.FOUNDRY_MAX_ITERATIONS = '5';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.maxIterations).toBe(5);
    });

    it('returns 0 for invalid value', async () => {
      process.env.FOUNDRY_MAX_ITERATIONS = 'invalid';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.maxIterations).toBe(0);
    });
  });

  describe('getConfig() - rate limit retries', () => {
    it('returns 3 by default', async () => {
      delete process.env.FOUNDRY_RATE_LIMIT_MAX_RETRIES;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.rateLimitMaxRetries).toBe(3);
    });

    it('returns custom value when set', async () => {
      process.env.FOUNDRY_RATE_LIMIT_MAX_RETRIES = '5';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.rateLimitMaxRetries).toBe(5);
    });
  });

  describe('getConfig() - GCP auto stop', () => {
    it('returns false by default', async () => {
      delete process.env.FOUNDRY_GCP_AUTO_STOP;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.gcpAutoStop).toBe(false);
    });

    it('returns true when FOUNDRY_GCP_AUTO_STOP=true', async () => {
      process.env.FOUNDRY_GCP_AUTO_STOP = 'true';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.gcpAutoStop).toBe(true);
    });

    it('returns true when FOUNDRY_GCP_AUTO_STOP=1', async () => {
      process.env.FOUNDRY_GCP_AUTO_STOP = '1';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.gcpAutoStop).toBe(true);
    });
  });

  describe('getConfig() - quick check interval', () => {
    it('returns 5 minutes by default', async () => {
      delete process.env.FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.quickCheckIntervalMinutes).toBe(5);
    });

    it('returns custom value when set', async () => {
      process.env.FOUNDRY_QUICK_CHECK_INTERVAL_MINUTES = '10';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.quickCheckIntervalMinutes).toBe(10);
    });
  });

  describe('getConfig() - full check interval', () => {
    it('returns 120 minutes by default', async () => {
      delete process.env.FOUNDRY_FULL_CHECK_INTERVAL_MINUTES;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.fullCheckIntervalMinutes).toBe(120);
    });

    it('returns custom value when set', async () => {
      process.env.FOUNDRY_FULL_CHECK_INTERVAL_MINUTES = '60';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.fullCheckIntervalMinutes).toBe(60);
    });
  });

  describe('getConfig() - codex reasoning effort', () => {
    it('returns high by default', async () => {
      delete process.env.CODEX_REASONING_EFFORT;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexReasoningEffort).toBe('high');
    });

    it('returns low when CODEX_REASONING_EFFORT=low', async () => {
      process.env.CODEX_REASONING_EFFORT = 'low';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexReasoningEffort).toBe('low');
    });

    it('returns medium when CODEX_REASONING_EFFORT=medium', async () => {
      process.env.CODEX_REASONING_EFFORT = 'medium';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexReasoningEffort).toBe('medium');
    });

    it('returns extra_high when CODEX_REASONING_EFFORT=extra_high', async () => {
      process.env.CODEX_REASONING_EFFORT = 'extra_high';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexReasoningEffort).toBe('extra_high');
    });
  });

  describe('getConfig() - per-agent codex reasoning', () => {
    it('uses global default for agent1', async () => {
      process.env.CODEX_REASONING_EFFORT = 'low';
      delete process.env.CODEX_AGENT1_REASONING;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexAgentReasoning.agent1).toBe('low');
    });

    it('uses CODEX_AGENT1_REASONING when set', async () => {
      process.env.CODEX_AGENT1_REASONING = 'extra_high';
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexAgentReasoning.agent1).toBe('extra_high');
    });

    it('agent3 defaults to medium', async () => {
      delete process.env.CODEX_AGENT3_REASONING;
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.codexAgentReasoning.agent3).toBe('medium');
    });
  });

  describe('getConfig() - merge mode', () => {
    it('returns "merge" when explicitly set', async () => {
      // Explicitly set to merge (overrides .foundry/env file)
      process.env.FOUNDRY_MERGE_MODE = 'merge';
      vi.resetModules();
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.mergeMode).toBe('merge');
    });

    it('returns "pr" when FOUNDRY_MERGE_MODE=pr', async () => {
      process.env.FOUNDRY_MERGE_MODE = 'pr';
      vi.resetModules();
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.mergeMode).toBe('pr');
    });

    it('returns "pr" when FOUNDRY_MERGE_MODE=PR (case insensitive)', async () => {
      process.env.FOUNDRY_MERGE_MODE = 'PR';
      vi.resetModules();
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.mergeMode).toBe('pr');
    });

    it('returns "merge" for invalid values', async () => {
      process.env.FOUNDRY_MERGE_MODE = 'invalid';
      vi.resetModules();
      const { getConfig } = await import('../../config.js');
      const config = getConfig(true);
      expect(config.mergeMode).toBe('merge');
    });
  });

  describe('getConfig() - caching behavior', () => {
    it('returns cached config by default', async () => {
      const { getConfig } = await import('../../config.js');
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it('rebuilds config when reload=true', async () => {
      // Use a different env var to avoid polluting merge mode tests
      const { getConfig } = await import('../../config.js');
      const config1 = getConfig();

      // Change env and reload
      process.env.FOUNDRY_MAX_ITERATIONS = '99';
      const config2 = getConfig(true);

      expect(config2.maxIterations).toBe(99);
    });
  });
});
