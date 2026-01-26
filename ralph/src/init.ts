import {
  createLinearClient,
  validateApiKey,
  getTeamByKeyOrId,
  checkRalphStatusesExist,
  ensureRalphStatuses,
  getRalphStatusNames,
  RALPH_STATUS_PREFIX,
} from './lib/linear-api.js';
import { prompt, confirm } from './lib/readline.js';
import { InitResult } from './types.js';

// Check if initialization is needed (no Ralph statuses exist)
export async function checkInitialized(apiKey: string, teamKey: string): Promise<boolean> {
  try {
    const client = createLinearClient(apiKey);

    // Find the team
    const team = await getTeamByKeyOrId(client, teamKey);
    if (!team) {
      return false;
    }

    // Check if Ralph statuses exist
    return await checkRalphStatusesExist(client, team.id);
  } catch {
    return false;
  }
}

// Prompt user for Linear API key
async function promptForApiKey(): Promise<string | undefined> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Ralph Initialization Wizard');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Ralph needs a Linear API key to manage workflow statuses.');
  console.log('');
  console.log('To get your API key:');
  console.log('  1. Go to Linear Settings → API');
  console.log('  2. Click "Create key"');
  console.log('  3. Copy the generated key');
  console.log('');

  const apiKey = await prompt('Enter your Linear API key (or press Enter to skip): ');

  if (!apiKey) {
    console.log('\nSkipping initialization. Set LINEAR_API_KEY environment variable to configure later.');
    return undefined;
  }

  // Validate the API key
  console.log('\nValidating API key...');
  const client = createLinearClient(apiKey);
  const isValid = await validateApiKey(client);

  if (!isValid) {
    console.log('Invalid API key. Please check and try again.');
    return undefined;
  }

  console.log('API key is valid.');
  return apiKey;
}

// Prompt user for team key
async function promptForTeamKey(apiKey: string): Promise<string | undefined> {
  const client = createLinearClient(apiKey);

  // List available teams
  const teams = await client.teams();
  if (teams.nodes.length === 0) {
    console.log('No teams found in your Linear workspace.');
    return undefined;
  }

  console.log('\nAvailable teams:');
  teams.nodes.forEach((team) => {
    console.log(`  - ${team.key}: ${team.name}`);
  });

  const teamKey = await prompt('\nEnter team key (e.g., RSK): ');

  if (!teamKey) {
    console.log('No team selected.');
    return undefined;
  }

  // Verify team exists
  const team = await getTeamByKeyOrId(client, teamKey);
  if (!team) {
    console.log(`Team "${teamKey}" not found.`);
    return undefined;
  }

  console.log(`Selected team: ${team.name} (${team.key})`);
  return teamKey;
}

// Show status preview
function showStatusPreview(): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`                    ${RALPH_STATUS_PREFIX} Status Setup`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Ralph will create the following workflow statuses:');
  console.log('');

  const statusNames = getRalphStatusNames();
  statusNames.forEach((name) => {
    console.log(`  • ${name}`);
  });

  console.log('');
  console.log(`These statuses use the ${RALPH_STATUS_PREFIX} prefix to avoid conflicts`);
  console.log('with your existing workflow statuses.');
  console.log('');
}

// Run the full initialization wizard
export async function runInitialization(): Promise<InitResult | undefined> {
  // Get API key from environment or prompt
  let apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    apiKey = await promptForApiKey();
    if (!apiKey) {
      return undefined;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    Environment Variable Setup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Add this to your shell profile (.bashrc, .zshrc, etc.):');
    console.log(`  export LINEAR_API_KEY="${apiKey}"`);
    console.log('');
  }

  // Get team key from environment or prompt
  let teamKey = process.env.LINEAR_TEAM_KEY;

  if (!teamKey) {
    teamKey = await promptForTeamKey(apiKey);
    if (!teamKey) {
      return undefined;
    }

    console.log('\nAdd this to your shell profile:');
    console.log(`  export LINEAR_TEAM_KEY="${teamKey}"`);
    console.log('');
  }

  // Find the team
  const client = createLinearClient(apiKey);
  const team = await getTeamByKeyOrId(client, teamKey);
  if (!team) {
    console.log(`Team "${teamKey}" not found.`);
    return undefined;
  }

  // Check if already initialized
  const isInitialized = await checkRalphStatusesExist(client, team.id);
  if (isInitialized) {
    console.log(`\n${RALPH_STATUS_PREFIX} statuses already exist in ${team.name}. No action needed.`);
    return {
      success: true,
      created: [],
      existing: getRalphStatusNames(),
      errors: [],
    };
  }

  // Show what will be created
  showStatusPreview();

  // Confirm with user
  const proceed = await confirm('Create these statuses?');
  if (!proceed) {
    console.log('\nInitialization canceled.');
    return undefined;
  }

  // Create the statuses
  console.log('\nCreating statuses...');
  const result = await ensureRalphStatuses(client, team.id);

  // Report results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Initialization Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result.created.length > 0) {
    console.log(`Created ${result.created.length} statuses.`);
  }

  if (result.existing.length > 0) {
    console.log(`Found ${result.existing.length} existing statuses.`);
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  if (result.success) {
    console.log('\nRalph is ready to use!');
  } else {
    console.log('\nSome errors occurred. Please check and try again.');
  }

  return result;
}
