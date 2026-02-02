import { LinearClient } from '@linear/sdk';
import { QuickCheckResult } from '../types.js';

/**
 * Performs a lightweight check for uncompleted tickets in a Linear team.
 *
 * This queries the Linear API for issues that are NOT in 'completed' or 'canceled'
 * status types, scoped to the specified team.
 *
 * @param apiKey - Linear API key
 * @param teamKey - Team key (e.g., "F")
 * @returns QuickCheckResult with hasWork boolean and ticket count
 */
export async function checkForUncompletedTickets(
  apiKey: string,
  teamKey: string
): Promise<QuickCheckResult> {
  try {
    const client = new LinearClient({ apiKey });

    // Query for issues not in completed or canceled states
    // Using first: 1 for efficiency - we only need to know if ANY exist
    const issues = await client.issues({
      first: 1,
      filter: {
        team: { key: { eq: teamKey } },
        state: { type: { nin: ['completed', 'canceled'] } }
      }
    });

    const hasWork = issues.nodes.length > 0;

    // If we found at least one, get the actual count (capped at 50 for efficiency)
    let ticketCount = 0;
    if (hasWork) {
      const countResult = await client.issues({
        first: 50,
        filter: {
          team: { key: { eq: teamKey } },
          state: { type: { nin: ['completed', 'canceled'] } }
        }
      });
      ticketCount = countResult.nodes.length;
    }

    return { hasWork, ticketCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hasWork: false,
      ticketCount: 0,
      error: errorMessage
    };
  }
}
