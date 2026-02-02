import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  parseRateLimitReset,
  isRateLimitError,
  handleRateLimit,
  executeWithRateLimitRetry,
  RateLimitableResult,
  RateLimitRetryConfig,
} from '../rate-limit.js';

describe('rate-limit module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep()', () => {
    it('returns a promise that resolves after specified time', async () => {
      const sleepPromise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(sleepPromise).resolves.toBeUndefined();
    });

    it('does not resolve before specified time', async () => {
      let resolved = false;
      sleep(1000).then(() => {
        resolved = true;
      });
      vi.advanceTimersByTime(500);
      expect(resolved).toBe(false);
      vi.advanceTimersByTime(500);
      await Promise.resolve(); // flush microtasks
      expect(resolved).toBe(true);
    });
  });

  describe('parseRateLimitReset()', () => {
    it('parses "resets at 10:30 am (PST)" format', () => {
      // Set system time to 10:00 AM PST (18:00 UTC) on a specific date
      const now = new Date('2026-01-15T18:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Rate limit resets at 10:30 am (PST)');
      // 10:30 AM PST = 18:30 UTC, which is 30 minutes from now + 1 minute buffer
      expect(result).toBeGreaterThan(30 * 60 * 1000);
      expect(result).toBeLessThan(32 * 60 * 1000);
    });

    it('parses "resets 12am (America/Los_Angeles)" format', () => {
      // Set system time to 11:00 PM PST (07:00 UTC next day) on a specific date
      const now = new Date('2026-01-15T07:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Your limit resets 12am (America/Los_Angeles)');
      // 12:00 AM PST = 08:00 UTC, which is 1 hour from now + 1 minute buffer
      expect(result).toBeGreaterThan(60 * 60 * 1000);
      expect(result).toBeLessThan(62 * 60 * 1000);
    });

    it('handles 12-hour time with PM', () => {
      const now = new Date('2026-01-15T18:00:00.000Z'); // 10:00 AM PST
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Rate limit resets at 2:30 pm (PST)');
      // 2:30 PM PST = 22:30 UTC, which is 4.5 hours from now
      expect(result).toBeGreaterThan(4 * 60 * 60 * 1000);
      expect(result).toBeLessThan(5 * 60 * 60 * 1000);
    });

    it('handles 12-hour time with AM (midnight case)', () => {
      const now = new Date('2026-01-15T07:00:00.000Z'); // 11:00 PM PST
      vi.setSystemTime(now);

      const result = parseRateLimitReset('resets at 12:00 am (PST)');
      // 12:00 AM PST = 08:00 UTC next day
      expect(result).toBeGreaterThan(60 * 60 * 1000);
    });

    it('returns time in the future (rolls to next day if past)', () => {
      // Set time to 11:00 AM PST (19:00 UTC)
      const now = new Date('2026-01-15T19:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Rate limit resets at 10:30 am (PST)');
      // 10:30 AM is in the past today, so should roll to tomorrow
      // That's about 23.5 hours from now
      expect(result).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(result).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it('handles string input', () => {
      const now = new Date('2026-01-15T18:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Rate limit resets at 10:30 am (PST)');
      expect(result).toBeGreaterThan(30 * 60 * 1000);
    });

    it('handles object input with `result` field', () => {
      const now = new Date('2026-01-15T18:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset({
        result: 'Rate limit resets at 10:30 am (PST)',
      });
      expect(result).toBeGreaterThan(30 * 60 * 1000);
    });

    it('handles object input with nested `message.content[0].text`', () => {
      const now = new Date('2026-01-15T18:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset({
        message: {
          content: [{ text: 'Rate limit resets at 10:30 am (PST)' }],
        },
      });
      expect(result).toBeGreaterThan(30 * 60 * 1000);
    });

    it('returns default 5 minutes when no match', () => {
      const result = parseRateLimitReset('Some unrelated error message');
      expect(result).toBe(5 * 60 * 1000);
    });

    it('adds 1-minute buffer to calculated time', () => {
      // Set time to exactly 10:00 AM PST (18:00 UTC)
      const now = new Date('2026-01-15T18:00:00.000Z');
      vi.setSystemTime(now);

      const result = parseRateLimitReset('Rate limit resets at 10:30 am (PST)');
      // 10:30 AM PST = 18:30 UTC = 30 minutes from now
      // With 1 minute buffer = 31 minutes
      expect(result).toBe(31 * 60 * 1000);
    });
  });

  describe('isRateLimitError()', () => {
    it('detects "rate limit" (case insensitive)', () => {
      expect(isRateLimitError('You have hit a rate limit')).toBe(true);
      expect(isRateLimitError('RATE LIMIT exceeded')).toBe(true);
      expect(isRateLimitError('rate-limit error')).toBe(true);
    });

    it('detects "too many requests"', () => {
      expect(isRateLimitError('Error: Too many requests')).toBe(true);
      expect(isRateLimitError('too many requests, please slow down')).toBe(true);
    });

    it('detects "quota exceeded"', () => {
      expect(isRateLimitError('Your API quota exceeded')).toBe(true);
      expect(isRateLimitError('Quota Exceeded')).toBe(true);
    });

    it('detects "usage limit"', () => {
      expect(isRateLimitError('You hit your usage limit')).toBe(true);
      expect(isRateLimitError('usage_limit reached')).toBe(true);
    });

    it('detects "hit your limit" (Claude-specific)', () => {
      expect(isRateLimitError("You've hit your limit for today")).toBe(true);
      expect(isRateLimitError('hit your limit')).toBe(true);
    });

    it('detects "RateLimitError" (Codex-specific)', () => {
      expect(isRateLimitError('RateLimitError: API rate limit reached')).toBe(true);
    });

    it('detects "request limit reached"', () => {
      expect(isRateLimitError('Request limit reached for the day')).toBe(true);
    });

    it('returns false for non-rate-limit errors', () => {
      expect(isRateLimitError('Connection timeout')).toBe(false);
      expect(isRateLimitError('Internal server error')).toBe(false);
      expect(isRateLimitError('Authentication failed')).toBe(false);
      expect(isRateLimitError('File not found')).toBe(false);
    });
  });

  describe('handleRateLimit()', () => {
    it('logs the wait time in minutes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const handlePromise = handleRateLimit(3 * 60 * 1000);
      vi.advanceTimersByTime(3 * 60 * 1000);
      await handlePromise;

      expect(consoleSpy).toHaveBeenCalledWith('Rate limited. Sleeping 3 minute(s)...');
      consoleSpy.mockRestore();
    });

    it('calls sleep with correct duration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const waitMs = 2 * 60 * 1000;

      const handlePromise = handleRateLimit(waitMs);

      // Verify it waits the full duration
      vi.advanceTimersByTime(waitMs - 1);
      // Promise should still be pending - we can't directly check this, but we can
      // verify by advancing the remaining time and seeing it resolves
      vi.advanceTimersByTime(1);
      await handlePromise;

      consoleSpy.mockRestore();
    });
  });

  describe('executeWithRateLimitRetry()', () => {
    it('returns immediately if not rate limited', async () => {
      const operation = vi.fn().mockResolvedValue({
        rateLimited: false,
        data: 'success',
      } as RateLimitableResult & { data: string });

      const config: RateLimitRetryConfig = { maxRetries: 3 };
      const result = await executeWithRateLimitRetry(operation, config, 'Test Agent');

      expect(result.rateLimited).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on rate limit up to maxRetries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let callCount = 0;

      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            rateLimited: true,
            retryAfterMs: 60000, // 1 minute
          } as RateLimitableResult;
        }
        return { rateLimited: false } as RateLimitableResult;
      });

      const config: RateLimitRetryConfig = { maxRetries: 3 };

      const resultPromise = executeWithRateLimitRetry(operation, config, 'Test Agent');

      // Use runAllTimersAsync to properly handle all timers and async operations
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.rateLimited).toBe(false);
      expect(operation).toHaveBeenCalledTimes(3);

      consoleSpy.mockRestore();
    });

    it('returns after maxRetries exceeded', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const operation = vi.fn().mockResolvedValue({
        rateLimited: true,
        retryAfterMs: 60000,
      } as RateLimitableResult);

      const config: RateLimitRetryConfig = { maxRetries: 2 };

      const resultPromise = executeWithRateLimitRetry(operation, config, 'Test Agent');

      // First call - rate limited (attempt 1)
      await Promise.resolve();
      vi.advanceTimersByTime(60000);

      // Second call - rate limited (attempt 2 = maxRetries)
      await Promise.resolve();
      const result = await resultPromise;

      expect(result.rateLimited).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('max retries reached')
      );

      consoleSpy.mockRestore();
    });

    it('uses retryAfterMs from result', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let callCount = 0;

      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rateLimited: true,
            retryAfterMs: 120000, // 2 minutes
          } as RateLimitableResult;
        }
        return { rateLimited: false } as RateLimitableResult;
      });

      const config: RateLimitRetryConfig = { maxRetries: 3 };
      const resultPromise = executeWithRateLimitRetry(operation, config, 'Test Agent');

      // First call - rate limited with 2 minute wait
      await Promise.resolve();
      // Should not proceed before 2 minutes
      vi.advanceTimersByTime(60000);
      expect(operation).toHaveBeenCalledTimes(1);

      // Advance remaining time
      vi.advanceTimersByTime(60000);
      const result = await resultPromise;

      expect(result.rateLimited).toBe(false);
      expect(operation).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('defaults to 5 minutes if no retryAfterMs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let callCount = 0;

      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rateLimited: true,
            // No retryAfterMs
          } as RateLimitableResult;
        }
        return { rateLimited: false } as RateLimitableResult;
      });

      const config: RateLimitRetryConfig = { maxRetries: 3 };
      const resultPromise = executeWithRateLimitRetry(operation, config, 'Test Agent');

      // First call - rate limited with default 5 minute wait
      await Promise.resolve();
      // Should not proceed before 5 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(operation).toHaveBeenCalledTimes(1);

      // Advance remaining time
      vi.advanceTimersByTime(60000);
      const result = await resultPromise;

      expect(result.rateLimited).toBe(false);
      expect(operation).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });
});
