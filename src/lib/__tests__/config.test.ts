import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = process.env;

describe('getMergeMode', () => {
  beforeEach(() => {
    // Reset modules to get fresh imports
    vi.resetModules();
    // Create a fresh copy of env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns "merge" by default', async () => {
    delete process.env.FOUNDRY_MERGE_MODE;
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('merge');
  });

  it('returns "pr" when FOUNDRY_MERGE_MODE=pr', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'pr';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('pr');
  });

  it('returns "pr" when FOUNDRY_MERGE_MODE=PR (case insensitive)', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'PR';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('pr');
  });

  it('returns "merge" for invalid values', async () => {
    process.env.FOUNDRY_MERGE_MODE = 'invalid';
    const { getConfig } = await import('../../config.js');
    const config = getConfig(true);
    expect(config.mergeMode).toBe('merge');
  });
});
