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

// Helper to create mock issues with state
const createMockIssue = (id: string, stateType: string) => ({
  id,
  state: Promise.resolve({ type: stateType }),
});

describe('linear-quick-check module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkForUncompletedTickets()', () => {
    it('returns hasWork=true when backlog issues exist', async () => {
      mockIssues.mockResolvedValue({
        nodes: [
          createMockIssue('issue-1', 'backlog'),
          createMockIssue('issue-2', 'completed'),
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(true);
      expect(result.ticketCount).toBe(1);
      expect(result.statusCounts.backlog).toBe(1);
      expect(result.statusCounts.completed).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('returns hasWork=true when unstarted issues exist', async () => {
      mockIssues.mockResolvedValue({
        nodes: [
          createMockIssue('issue-1', 'unstarted'),
          createMockIssue('issue-2', 'unstarted'),
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(true);
      expect(result.ticketCount).toBe(2);
      expect(result.statusCounts.unstarted).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('returns hasWork=false when only started/completed/canceled issues exist', async () => {
      mockIssues.mockResolvedValue({
        nodes: [
          createMockIssue('issue-1', 'started'),
          createMockIssue('issue-2', 'completed'),
          createMockIssue('issue-3', 'canceled'),
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.statusCounts.started).toBe(1);
      expect(result.statusCounts.completed).toBe(1);
      expect(result.statusCounts.canceled).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('returns hasWork=false with count=0 when no issues', async () => {
      mockIssues.mockResolvedValue({ nodes: [] });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.statusCounts).toEqual({
        backlog: 0,
        unstarted: 0,
        started: 0,
        completed: 0,
        canceled: 0,
      });
      expect(result.error).toBeUndefined();
    });

    it('filters by team key', async () => {
      mockIssues.mockResolvedValue({ nodes: [] });

      await checkForUncompletedTickets('api-key', 'MYTEAM');

      expect(mockIssues).toHaveBeenCalledWith({
        first: 250,
        filter: {
          team: { key: { eq: 'MYTEAM' } },
        },
        includeArchived: false,
      });
    });

    it('counts all status categories correctly', async () => {
      mockIssues.mockResolvedValue({
        nodes: [
          createMockIssue('issue-1', 'backlog'),
          createMockIssue('issue-2', 'backlog'),
          createMockIssue('issue-3', 'unstarted'),
          createMockIssue('issue-4', 'started'),
          createMockIssue('issue-5', 'started'),
          createMockIssue('issue-6', 'started'),
          createMockIssue('issue-7', 'completed'),
          createMockIssue('issue-8', 'completed'),
          createMockIssue('issue-9', 'completed'),
          createMockIssue('issue-10', 'completed'),
          createMockIssue('issue-11', 'canceled'),
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.statusCounts).toEqual({
        backlog: 2,
        unstarted: 1,
        started: 3,
        completed: 4,
        canceled: 1,
      });
      expect(result.hasWork).toBe(true);
      expect(result.ticketCount).toBe(3); // backlog + unstarted
    });

    it('returns error object on API failure', async () => {
      mockIssues.mockRejectedValue(new Error('API key invalid'));

      const result = await checkForUncompletedTickets('bad-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.statusCounts).toEqual({
        backlog: 0,
        unstarted: 0,
        started: 0,
        completed: 0,
        canceled: 0,
      });
      expect(result.error).toBe('API key invalid');
    });

    it('handles network errors', async () => {
      mockIssues.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.hasWork).toBe(false);
      expect(result.ticketCount).toBe(0);
      expect(result.error).toBe('ENOTFOUND');
    });

    it('handles issues with missing state gracefully', async () => {
      mockIssues.mockResolvedValue({
        nodes: [
          { id: 'issue-1', state: Promise.resolve(null) },
          createMockIssue('issue-2', 'completed'),
        ],
      });

      const result = await checkForUncompletedTickets('api-key', 'F');

      expect(result.statusCounts.completed).toBe(1);
      expect(result.hasWork).toBe(false);
    });
  });
});
