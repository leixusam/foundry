import { LinearClient, WorkflowState as LinearWorkflowState } from '@linear/sdk';
import { WorkflowState, FoundryStatusDefinition, InitResult, LinearStateType } from '../types.js';

// Foundry status prefix to avoid conflicts with user's existing statuses
export const FOUNDRY_STATUS_PREFIX = '∞';

// Color scheme for Foundry statuses (Linear requires hex colors)
const STATE_COLORS: Record<LinearStateType, string> = {
  backlog: '#95a2b3',    // Gray - backlog
  unstarted: '#e2e2e2',  // Light gray - ready/unstarted
  started: '#f2c94c',    // Yellow - in progress
  completed: '#5e6ad2',  // Purple - done
  canceled: '#95a2b3',   // Gray - canceled
};

// Extended status definition with color for creation
interface FoundryStatusWithColor extends FoundryStatusDefinition {
  color: string;
}

// All Foundry statuses that need to exist in Linear
export const FOUNDRY_STATUS_DEFINITIONS: FoundryStatusWithColor[] = [
  { name: `${FOUNDRY_STATUS_PREFIX} Backlog`, type: 'backlog', color: STATE_COLORS.backlog },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Research`, type: 'unstarted', color: STATE_COLORS.unstarted },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Specification`, type: 'unstarted', color: STATE_COLORS.unstarted },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Plan`, type: 'unstarted', color: STATE_COLORS.unstarted },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Implement`, type: 'unstarted', color: STATE_COLORS.unstarted },
  { name: `${FOUNDRY_STATUS_PREFIX} Needs Validate`, type: 'unstarted', color: STATE_COLORS.unstarted },
  { name: `${FOUNDRY_STATUS_PREFIX} Research In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Specification In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Plan In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Implement In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Validate In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Oneshot In Progress`, type: 'started', color: STATE_COLORS.started },
  { name: `${FOUNDRY_STATUS_PREFIX} Blocked`, type: 'started', color: '#eb5757' },  // Red - requires human intervention
  { name: `${FOUNDRY_STATUS_PREFIX} Done`, type: 'completed', color: STATE_COLORS.completed },
  { name: `${FOUNDRY_STATUS_PREFIX} Canceled`, type: 'canceled', color: STATE_COLORS.canceled },
];

// Create Linear client with API key
export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}

// Get all workflow states for a team
export async function listWorkflowStates(client: LinearClient, teamId: string): Promise<WorkflowState[]> {
  const team = await client.team(teamId);
  const statesConnection = await team.states();
  const states = statesConnection.nodes;

  return states.map((state: LinearWorkflowState) => ({
    id: state.id,
    name: state.name,
    type: state.type as WorkflowState['type'],
    position: state.position,
  }));
}

// Create a new workflow state in a team
export async function createWorkflowState(
  client: LinearClient,
  teamId: string,
  state: FoundryStatusWithColor
): Promise<WorkflowState> {
  // Use workflowStateCreate mutation via the client
  const payload = await client.createWorkflowState({
    teamId,
    name: state.name,
    type: state.type,
    color: state.color,
  });

  const createdState = await payload.workflowState;
  if (!createdState) {
    throw new Error(`Failed to create workflow state: ${state.name}`);
  }

  return {
    id: createdState.id,
    name: createdState.name,
    type: createdState.type as WorkflowState['type'],
    position: createdState.position,
  };
}

// Get all Foundry status names
export function getFoundryStatusNames(): string[] {
  return FOUNDRY_STATUS_DEFINITIONS.map((s) => s.name);
}

// Check if all Foundry statuses exist in the team
export async function checkFoundryStatusesExist(client: LinearClient, teamId: string): Promise<boolean> {
  const existingStates = await listWorkflowStates(client, teamId);
  const existingNames = new Set(existingStates.map((s) => s.name));
  const foundryNames = getFoundryStatusNames();

  return foundryNames.every((name) => existingNames.has(name));
}

// Ensure all Foundry statuses exist, creating any that are missing
export async function ensureFoundryStatuses(client: LinearClient, teamId: string): Promise<InitResult> {
  const result: InitResult = {
    success: true,
    created: [],
    existing: [],
    errors: [],
  };

  // Get existing states
  const existingStates = await listWorkflowStates(client, teamId);
  const existingNames = new Set(existingStates.map((s) => s.name));

  // Check each Foundry status
  for (const statusDef of FOUNDRY_STATUS_DEFINITIONS) {
    if (existingNames.has(statusDef.name)) {
      result.existing.push(statusDef.name);
    } else {
      try {
        await createWorkflowState(client, teamId, statusDef);
        result.created.push(statusDef.name);
        console.log(`  Created: ${statusDef.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`${statusDef.name}: ${errorMessage}`);
        result.success = false;
        console.error(`  Error creating ${statusDef.name}: ${errorMessage}`);
      }
    }
  }

  return result;
}

// Get team by key (e.g., "RSK") or ID
export async function getTeamByKeyOrId(client: LinearClient, keyOrId: string): Promise<{ id: string; name: string; key: string } | undefined> {
  // First try to get by key
  const teams = await client.teams();
  const team = teams.nodes.find((t) => t.key === keyOrId || t.id === keyOrId);

  if (team) {
    return {
      id: team.id,
      name: team.name,
      key: team.key,
    };
  }

  return undefined;
}

// Validate API key by trying to fetch current user
export async function validateApiKey(client: LinearClient): Promise<boolean> {
  try {
    await client.viewer;
    return true;
  } catch {
    return false;
  }
}

// Result of attempting to delete Foundry statuses
export interface DeleteStatusesResult {
  deleted: string[];
  skipped: { name: string; issueCount: number }[];
  errors: string[];
}

// Get issue count for a workflow state
async function getIssueCountForState(client: LinearClient, stateId: string): Promise<number> {
  const state = await client.workflowState(stateId);
  const issues = await state.issues();
  return issues.nodes.length;
}

// Delete Foundry workflow statuses that have no issues
export async function deleteFoundryStatuses(
  client: LinearClient,
  teamId: string
): Promise<DeleteStatusesResult> {
  const result: DeleteStatusesResult = {
    deleted: [],
    skipped: [],
    errors: [],
  };

  // Get existing states
  const existingStates = await listWorkflowStates(client, teamId);
  const foundryStatusNames = getFoundryStatusNames();

  // Find Foundry statuses in the team
  const foundryStates = existingStates.filter((s) =>
    foundryStatusNames.includes(s.name)
  );

  for (const state of foundryStates) {
    try {
      // Check if any issues are using this status
      const issueCount = await getIssueCountForState(client, state.id);

      if (issueCount > 0) {
        result.skipped.push({ name: state.name, issueCount });
        continue;
      }

      // No issues - safe to archive (Linear archives rather than deletes)
      await client.archiveWorkflowState(state.id);
      result.deleted.push(state.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`${state.name}: ${errorMessage}`);
    }
  }

  return result;
}
