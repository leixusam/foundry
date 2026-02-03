import { LinearClient } from '@linear/sdk';
import { PulseCheckResult, StatusCategoryCounts, LinearStateType } from '../types.js';

/**
 * Performs a pulse check that returns ticket counts by status category.
 *
 * This queries the Linear API for all issues in the team and groups them by
 * status type (backlog, unstarted, started, completed, canceled).
 *
 * @param apiKey - Linear API key
 * @param teamKey - Team key (e.g., "F")
 * @returns PulseCheckResult with hasWork boolean, ticket count, and status breakdown
 */
export async function checkForUncompletedTickets(
  apiKey: string,
  teamKey: string
): Promise<PulseCheckResult> {
  const emptyStatusCounts: StatusCategoryCounts = {
    backlog: 0,
    unstarted: 0,
    started: 0,
    completed: 0,
    canceled: 0,
  };

  try {
    const client = new LinearClient({ apiKey });

    // Get all issues for the team to count by status category
    // Using a reasonable limit to get accurate counts
    const issues = await client.issues({
      first: 250,
      filter: {
        team: { key: { eq: teamKey } },
      },
      includeArchived: false,
    });

    // Count issues by status type
    const statusCounts: StatusCategoryCounts = { ...emptyStatusCounts };

    for (const issue of issues.nodes) {
      const state = await issue.state;
      if (state) {
        const stateType = state.type as LinearStateType;
        if (stateType in statusCounts) {
          statusCounts[stateType]++;
        }
      }
    }

    // Ready-to-work tickets are those in backlog or unstarted
    const readyToWorkCount = statusCounts.backlog + statusCounts.unstarted;
    const hasWork = readyToWorkCount > 0;

    return {
      hasWork,
      ticketCount: readyToWorkCount,
      statusCounts,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hasWork: false,
      ticketCount: 0,
      statusCounts: emptyStatusCounts,
      error: errorMessage,
    };
  }
}
