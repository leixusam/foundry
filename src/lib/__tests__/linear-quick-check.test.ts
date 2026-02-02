import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock Linear client
const mockIssues = vi.fn();

// Mock @linear/sdk before importing
vi.mock('@linear/sdk', () => {
  return {
    LinearClient: class MockLinearClient {
      issues = mockIssues;
    },
  };
});

import { checkForUncompletedTickets } from '../linear-quick-check.js';

describe('linear-quick-check module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkForUncompletedTickets()', () => {
    it('returns hasWork=true with ticket count when issues exist', async () => {
      // First query returns 1 issue (existence check)
      mockIssues.mockResolvedValueOnce({
        nodes: [{ id: 'issue-1', title: 'Test Issue' }],
      });
      // Second query returns 3 issues (count check)
      mockIssues.mockResolvedValueOnce({
        nodes: [
          { id: 'issue-1' },
          { id: 'issue-2' },
          { id: 'issue-3' },
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(true);
      expect(result.ticketCount).toBe(3);
      expect(result.error).toBeUndefined();
    });

    it('returns hasWork=false with count=0 when no issues', async () => {
      mockIssues.mockResolvedValue({ nodes: [] });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('filters by team key', async () => {
      mockIssues.mockResolvedValue({ nodes: [] });

      await checkForUncompletedTickets('api-key', 'MYTEAM');

      expect(mockIssues).toHaveBeenCalledWith({
        first: 1,
        filter: {
          team: { key: { eq: 'MYTEAM' } },
          state: { type: { in: ['backlog', 'unstarted'] } },
        },
      });
    });

    it('includes only backlog and unstarted states', async () => {
      mockIssues.mockResolvedValue({ nodes: [] });

      await checkForUncompletedTickets('api-key', 'F');

      expect(mockIssues).toHaveBeenCalledWith({
        first: 1,
        filter: expect.objectContaining({
          state: { type: { in: ['backlog', 'unstarted'] } },
        }),
      });
    });

    it('returns error object on API failure', async () => {
      mockIssues.mockRejectedValue(new Error('API key invalid'));

      const result = await checkForUncompletedTickets('bad-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.error).toBe('API key invalid');
    });

    it('handles network errors', async () => {
      mockIssues.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.error).toBe('ENOTFOUND');
    });

    it('second query gets count (up to 50)', async () => {
      // First query returns 1 issue
      mockIssues.mockResolvedValueOnce({
        nodes: [{ id: 'issue-1' }],
      });
      // Second query returns issues
      mockIssues.mockResolvedValueOnce({
        nodes: Array(50).fill({ id: 'issue' }),
      });

      await checkForUncompletedTickets('api-key', 'F');

      // Verify second call uses first: 50
      expect(mockIssues).toHaveBeenCalledTimes(2);
      expect(mockIssues).toHaveBeenNthCalledWith(2, {
        first: 50,
        filter: {
          team: { key: { eq: 'F' } },
          state: { type: { in: ['backlog', 'unstarted'] } },
        },
      });
    });
  });
});
