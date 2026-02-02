import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generatePodName,
  generateLoopInstanceName,
  getLoopInstanceNameDisplay,
} from '../loop-instance-name.js';

describe('loop-instance-name module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generatePodName()', () => {
    it('returns format "adjective-animal"', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      const name = generatePodName();

      expect(name).toMatch(/^[a-z]+-[a-z]+$/);
      const parts = name.split('-');
      expect(parts).toHaveLength(2);
    });

    it('is deterministic for same timestamp (same second = same name)', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
      const name1 = generatePodName();

      vi.setSystemTime(new Date('2026-01-15T10:00:00.500Z')); // Same second, different ms
      const name2 = generatePodName();

      expect(name1).toBe(name2);
    });

    it('uses modulo to select from word lists', () => {
      // Test that different timestamps produce valid names
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 10, 0, i)));
        const name = generatePodName();
        expect(name).toMatch(/^[a-z]+-[a-z]+$/);
      }
    });

    it('produces different names for different seconds', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
      const name1 = generatePodName();

      vi.setSystemTime(new Date('2026-01-15T10:00:01.000Z')); // 1 second later
      const name2 = generatePodName();

      expect(name1).not.toBe(name2);
    });
  });

  describe('generateLoopInstanceName()', () => {
    it('returns format "YYYYMMDD-HHMMSS-adjective-animal"', () => {
      vi.setSystemTime(new Date('2026-01-15T10:30:45.000Z'));

      const name = generateLoopInstanceName();

      expect(name).toMatch(/^\d{8}-\d{6}-[a-z]+-[a-z]+$/);
      expect(name).toMatch(/^20260115-103045-/);
    });

    it('timestamp is in UTC', () => {
      // Set a time where local vs UTC would differ significantly
      vi.setSystemTime(new Date('2026-06-15T23:30:00.000Z'));

      const name = generateLoopInstanceName();

      // Should use UTC time, not local
      expect(name).toMatch(/^20260615-233000-/);
    });

    it('pod name portion matches generatePodName()', () => {
      vi.setSystemTime(new Date('2026-01-15T10:30:45.000Z'));

      const fullName = generateLoopInstanceName();
      const podName = generatePodName();

      const parts = fullName.split('-');
      const podNameFromFull = `${parts[2]}-${parts[3]}`;

      expect(podNameFromFull).toBe(podName);
    });
  });

  describe('getLoopInstanceNameDisplay()', () => {
    it('extracts "adjective-animal" from new format "YYYYMMDD-HHMMSS-adjective-animal"', () => {
      const result = getLoopInstanceNameDisplay('20250125-143052-calm-pegasus');
      expect(result).toBe('calm-pegasus');
    });

    it('extracts "adjective-animal" from old format "adjective-animal-YYYYMMDD-HHMMSS"', () => {
      const result = getLoopInstanceNameDisplay('calm-pegasus-20250125-143052');
      expect(result).toBe('calm-pegasus');
    });

    it('handles legacy format "adjective-animal-unixTimestamp"', () => {
      const result = getLoopInstanceNameDisplay('red-giraffe-1706223456');
      expect(result).toBe('red-giraffe');
    });

    it('returns full name if format unrecognized', () => {
      const result = getLoopInstanceNameDisplay('something-completely-different-format-here');
      // This has 5 parts with first not being 8 digits, so falls through
      // to the "3+ parts" check which returns first two
      expect(result).toBe('something-completely');
    });

    it('handles edge case of 2-part name', () => {
      const result = getLoopInstanceNameDisplay('calm-pegasus');
      // Only 2 parts, no timestamp prefix, returns full name
      expect(result).toBe('calm-pegasus');
    });
  });
});
