import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerClaudeProvider,
  registerCodexProvider,
  createProvider,
  LLMProvider,
  ProviderName,
} from '../provider.js';

describe('provider module', () => {
  // Create mock providers for testing
  const createMockProvider = (name: ProviderName): LLMProvider => ({
    name,
    spawn: async () => ({
      output: '',
      finalOutput: 'test',
      rateLimited: false,
      cost: 0,
      costEstimated: false,
      duration: 0,
      exitCode: 0,
      tokenUsage: { input: 0, output: 0, cached: 0 },
    }),
  });

  describe('registerClaudeProvider()', () => {
    it('registers factory function', () => {
      const mockClaudeProvider = createMockProvider('claude');
      registerClaudeProvider(() => mockClaudeProvider);

      const provider = createProvider('claude');
      expect(provider.name).toBe('claude');
    });

    it('allows re-registration', () => {
      const mockProvider1 = createMockProvider('claude');
      const mockProvider2 = { ...createMockProvider('claude'), customField: 'test' };

      registerClaudeProvider(() => mockProvider1);
      registerClaudeProvider(() => mockProvider2 as unknown as LLMProvider);

      const provider = createProvider('claude');
      expect(provider.name).toBe('claude');
    });
  });

  describe('registerCodexProvider()', () => {
    it('registers factory function', () => {
      const mockCodexProvider = createMockProvider('codex');
      registerCodexProvider(() => mockCodexProvider);

      const provider = createProvider('codex');
      expect(provider.name).toBe('codex');
    });

    it('allows re-registration', () => {
      const mockProvider1 = createMockProvider('codex');
      const mockProvider2 = { ...createMockProvider('codex'), customField: 'test' };

      registerCodexProvider(() => mockProvider1);
      registerCodexProvider(() => mockProvider2 as unknown as LLMProvider);

      const provider = createProvider('codex');
      expect(provider.name).toBe('codex');
    });
  });

  describe('createProvider()', () => {
    beforeEach(() => {
      // Register both providers for these tests
      registerClaudeProvider(() => createMockProvider('claude'));
      registerCodexProvider(() => createMockProvider('codex'));
    });

    it('returns Claude provider when registered', () => {
      const provider = createProvider('claude');
      expect(provider.name).toBe('claude');
      expect(typeof provider.spawn).toBe('function');
    });

    it('returns Codex provider when registered', () => {
      const provider = createProvider('codex');
      expect(provider.name).toBe('codex');
      expect(typeof provider.spawn).toBe('function');
    });

    it('throws for unknown provider name', () => {
      expect(() => createProvider('unknown' as ProviderName)).toThrow(
        'Unknown provider: unknown'
      );
    });

    it('creates new provider instance on each call', () => {
      const provider1 = createProvider('claude');
      const provider2 = createProvider('claude');

      // Each call should create a new provider instance (factory pattern)
      expect(provider1).not.toBe(provider2);
    });

    it('provider spawn returns expected result structure', async () => {
      const provider = createProvider('claude');
      const result = await provider.spawn({ prompt: 'test' });

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('finalOutput');
      expect(result).toHaveProperty('rateLimited');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('tokenUsage');
      expect(result.tokenUsage).toHaveProperty('input');
      expect(result.tokenUsage).toHaveProperty('output');
      expect(result.tokenUsage).toHaveProperty('cached');
    });
  });
});
