import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const execSyncMock = vi.fn();

vi.mock('child_process', () => ({
  execSync: execSyncMock,
}));

describe('gcp', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isRunningOnGcp()', () => {
    it('returns true when metadata server responds with Metadata-Flavor=Google', async () => {
      const fetchSpy = vi.fn(async () => ({
        headers: {
          get: (name: string) => (name === 'Metadata-Flavor' ? 'Google' : null),
        },
      }));
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { isRunningOnGcp } = await import('../gcp.js');
      await expect(isRunningOnGcp()).resolves.toBe(true);
    });

    it('returns false when header is missing or not Google', async () => {
      const fetchSpy = vi.fn(async () => ({
        headers: {
          get: () => null,
        },
      }));
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { isRunningOnGcp } = await import('../gcp.js');
      await expect(isRunningOnGcp()).resolves.toBe(false);
    });

    it('returns false when fetch throws (timeout/network error)', async () => {
      const fetchSpy = vi.fn(async () => {
        throw new Error('timeout');
      });
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { isRunningOnGcp } = await import('../gcp.js');
      await expect(isRunningOnGcp()).resolves.toBe(false);
    });
  });

  describe('stopGcpInstance()', () => {
    it('returns false and logs an error when instance name is missing', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchSpy = vi.fn(async (url: string) => {
        if (url.endsWith('/instance/name')) {
          return { ok: false };
        }
        if (url.endsWith('/instance/zone')) {
          return { ok: true, text: async () => 'projects/1/zones/us-central1-a' };
        }
        return { ok: false };
      });
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { stopGcpInstance } = await import('../gcp.js');
      await expect(stopGcpInstance()).resolves.toBe(false);

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('returns false and logs an error when zone is missing', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchSpy = vi.fn(async (url: string) => {
        if (url.endsWith('/instance/name')) {
          return { ok: true, text: async () => 'test-instance' };
        }
        if (url.endsWith('/instance/zone')) {
          return { ok: false };
        }
        return { ok: false };
      });
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { stopGcpInstance } = await import('../gcp.js');
      await expect(stopGcpInstance()).resolves.toBe(false);

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('returns true and issues gcloud stop command when name and zone are available', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchSpy = vi.fn(async (url: string) => {
        if (url.endsWith('/instance/name')) {
          return { ok: true, text: async () => 'test-instance' };
        }
        if (url.endsWith('/instance/zone')) {
          return { ok: true, text: async () => 'projects/123/zones/us-central1-a' };
        }
        return { ok: false };
      });
      vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

      const { stopGcpInstance } = await import('../gcp.js');
      await expect(stopGcpInstance()).resolves.toBe(true);

      expect(execSyncMock).toHaveBeenCalledTimes(1);
      const [command, options] = execSyncMock.mock.calls[0] ?? [];
      expect(String(command)).toContain('gcloud compute instances stop "test-instance"');
      expect(String(command)).toContain('--zone="us-central1-a"');
      expect(String(command)).toContain('--quiet');
      expect(String(command)).toContain('&');
      expect(options).toMatchObject({ shell: '/bin/bash' });
      expect(logSpy).toHaveBeenCalled();
    });
  });
});

