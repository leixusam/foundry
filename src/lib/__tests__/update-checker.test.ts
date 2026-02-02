import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';

const TEST_HOME = '/tmp/foundry-test-home';
const CACHE_DIR = join(TEST_HOME, '.foundry');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');

const fsExistsSync = vi.fn();
const fsReadFileSync = vi.fn();
const fsWriteFileSync = vi.fn();
const fsMkdirSync = vi.fn();

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: () => TEST_HOME,
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: fsExistsSync,
    readFileSync: fsReadFileSync,
    writeFileSync: fsWriteFileSync,
    mkdirSync: fsMkdirSync,
  };
});

vi.mock('../version.js', () => ({
  getVersion: () => '0.1.0',
  getPackageName: () => '@leixusam/foundry',
}));

describe('update-checker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses a fresh cached result without fetching', async () => {
    fsExistsSync.mockImplementation((path: unknown) => path === CACHE_FILE);
    fsReadFileSync.mockImplementation(() =>
      JSON.stringify({ lastCheck: Date.now(), latestVersion: '0.2.0' })
    );

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const { checkForUpdates } = await import('../update-checker.js');
    const result = await checkForUpdates();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      updateAvailable: true,
    });
  });

  it('fetches and writes cache when the cache is missing', async () => {
    fsExistsSync.mockImplementation((path: unknown) => path === CACHE_DIR);

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: '0.2.0' }),
    }));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const { checkForUpdates } = await import('../update-checker.js');
    const result = await checkForUpdates();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fsMkdirSync).not.toHaveBeenCalled();
    expect(fsWriteFileSync).toHaveBeenCalledTimes(1);

    const writtenCache = JSON.parse(String(fsWriteFileSync.mock.calls[0]?.[1] ?? '{}')) as {
      lastCheck: number;
      latestVersion: string | null;
    };
    expect(writtenCache).toEqual({ lastCheck: Date.now(), latestVersion: '0.2.0' });

    expect(result.updateAvailable).toBe(true);
  });

  it('fetches again when the cache is stale (older than 24h)', async () => {
    fsExistsSync.mockImplementation((path: unknown) => path === CACHE_FILE || path === CACHE_DIR);
    fsReadFileSync.mockImplementation(() =>
      JSON.stringify({
        lastCheck: Date.now() - 25 * 60 * 60 * 1000,
        latestVersion: '0.1.1',
      })
    );

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: '0.3.0' }),
    }));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const { checkForUpdates } = await import('../update-checker.js');
    const result = await checkForUpdates();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.latestVersion).toBe('0.3.0');
    expect(result.updateAvailable).toBe(true);
  });

  it('writes a null latestVersion when registry response is not ok', async () => {
    fsExistsSync.mockImplementation((path: unknown) => path === CACHE_DIR);

    const fetchSpy = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const { checkForUpdates } = await import('../update-checker.js');
    const result = await checkForUpdates();

    expect(result).toEqual({
      currentVersion: '0.1.0',
      latestVersion: null,
      updateAvailable: false,
    });

    const writtenCache = JSON.parse(String(fsWriteFileSync.mock.calls[0]?.[1] ?? '{}')) as {
      lastCheck: number;
      latestVersion: string | null;
    };
    expect(writtenCache).toEqual({ lastCheck: Date.now(), latestVersion: null });
  });

  it('handles fetch errors by returning null latestVersion and writing cache', async () => {
    fsExistsSync.mockImplementation((path: unknown) => path === CACHE_DIR);

    const fetchSpy = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const { checkForUpdates } = await import('../update-checker.js');
    const result = await checkForUpdates();

    expect(result.latestVersion).toBeNull();
    expect(result.updateAvailable).toBe(false);
    expect(fsWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it('prints a notification only when an update is available with a latest version', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { displayUpdateNotification } = await import('../update-checker.js');

    displayUpdateNotification({
      currentVersion: '0.1.0',
      latestVersion: null,
      updateAvailable: true,
    });
    expect(logSpy).not.toHaveBeenCalled();

    displayUpdateNotification({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      updateAvailable: false,
    });
    expect(logSpy).not.toHaveBeenCalled();

    displayUpdateNotification({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      updateAvailable: true,
    });

    expect(logSpy).toHaveBeenCalled();
    const combined = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(combined).toContain('Update available:');
    expect(combined).toContain('npm install -g @leixusam/foundry@latest');
  });
});

