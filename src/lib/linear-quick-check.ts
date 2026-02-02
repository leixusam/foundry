import { LinearClient } from '@linear/sdk';
import { QuickCheckResult } from '../types.js';
import { FOUNDRY_STATUS_PREFIX } from './linear-api.js';

// Status name for blocked tickets that require human intervention
const BLOCKED_STATUS_NAME = `${FOUNDRY_STATUS_PREFIX} Blocked`;

/**
 * Performs a lightweight check for uncompleted tickets in a Linear team.
 *
 * This queries the Linear API for issues that are NOT in 'completed' or 'canceled'
 * status types, and NOT in the '∞ Blocked' status, scoped to the specified team.
 *
 * The '∞ Blocked' status is excluded because it requires human intervention and
 * should not trigger automated agent loops.
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

    // Filter for actionable tickets:
    // - NOT completed or canceled (by type)
    // - NOT blocked (by name, since blocked has type 'started')
    const stateFilter = {
      and: [
        { type: { nin: ['completed', 'canceled'] } },
        { name: { neq: BLOCKED_STATUS_NAME } }
      ]
    };

    // Query for issues not in completed, canceled, or blocked states
    // Using first: 1 for efficiency - we only need to know if ANY exist
    const issues = await client.issues({
      first: 1,
      filter: {
        team: { key: { eq: teamKey } },
        state: stateFilter
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
          state: stateFilter
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
