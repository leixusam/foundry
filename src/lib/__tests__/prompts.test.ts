import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock config to avoid side effects
vi.mock('../../config.js', () => ({
  getRepoRoot: () => '/mock/repo',
}));

describe('loadPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('substitutes template variables', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('Hello {{NAME}}, mode is {{MODE}}.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test', { NAME: 'World', MODE: 'pr' });

    expect(result).toBe('Hello World, mode is pr.');
  });

  it('returns content unchanged when no variables provided', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('No variables here.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test');

    expect(result).toBe('No variables here.');
  });

  it('replaces multiple occurrences of same variable', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{{X}} and {{X}} again.');

    const { loadPrompt } = await import('../prompts.js');
    const result = loadPrompt('test', { X: 'value' });

    expect(result).toBe('value and value again.');
  });

  it('throws error when prompt not found', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    mockExistsSync.mockReturnValue(false);

    const { loadPrompt } = await import('../prompts.js');
    expect(() => loadPrompt('nonexistent')).toThrow('Prompt not found: nonexistent');
  });
});

describe('loadPromptFragment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads fragment content from fragments directory', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('Fragment content here.');

    const { loadPromptFragment } = await import('../prompts.js');
    const result = loadPromptFragment('merge-direct');

    expect(result).toBe('Fragment content here.');
  });

  it('throws error when fragment not found', async () => {
    const mockExistsSync = vi.mocked(existsSync);
    mockExistsSync.mockReturnValue(false);

    const { loadPromptFragment } = await import('../prompts.js');
    expect(() => loadPromptFragment('nonexistent')).toThrow('Prompt fragment not found: nonexistent');
  });
});
