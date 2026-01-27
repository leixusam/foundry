import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createLinearClient,
  validateApiKey,
  getTeamByKeyOrId,
  checkFoundryStatusesExist,
  ensureFoundryStatuses,
  getFoundryStatusNames,
  FOUNDRY_STATUS_PREFIX,
} from './lib/linear-api.js';
import { prompt, confirm } from './lib/readline.js';
import { InitResult } from './types.js';
import { getRepoRoot } from './config.js';
import { checkCodexLinearMcpConfigured } from './lib/codex.js';
import { detectAvailableClis, hasAnyCli, CliAvailability } from './lib/cli-detection.js';

// Get the package directory (where Foundry is installed)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');

// Check if Codex Linear MCP is configured
export function checkCodexLinearMcp(): boolean {
  return checkCodexLinearMcpConfigured();
}

// Check if initialization is needed (no Foundry statuses exist)
export async function checkInitialized(apiKey: string, teamKey: string): Promise<boolean> {
  try {
    const client = createLinearClient(apiKey);

    // Find the team
    const team = await getTeamByKeyOrId(client, teamKey);
    if (!team) {
      return false;
    }

    // Check if Foundry statuses exist
    return await checkFoundryStatusesExist(client, team.id);
  } catch {
    return false;
  }
}

// Prompt user for Linear API key (required - cannot skip)
async function promptForApiKey(): Promise<string | undefined> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Foundry Initialization Wizard');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Foundry needs a Linear API key to manage workflow statuses.');
  console.log('');
  console.log('To get your API key:');
  console.log('  1. Go to: https://linear.app/settings/account/security/api-keys/new');
  console.log('  2. Enter a label (e.g., "Foundry")');
  console.log('  3. Click "Create key"');
  console.log('  4. Copy the generated key');
  console.log('');

  // Loop until valid API key provided
  while (true) {
    const apiKey = await prompt('Enter your Linear API key: ');

    if (!apiKey) {
      console.log('\nLinear API key is required. Foundry cannot operate without it.');
      continue;
    }

    // Validate the API key
    console.log('\nValidating API key...');
    const client = createLinearClient(apiKey);
    const isValid = await validateApiKey(client);

    if (!isValid) {
      console.log('Invalid API key. Please check and try again.\n');
      continue;
    }

    console.log('API key is valid.');
    return apiKey;
  }
}

// Get team info for display
interface TeamInfo {
  id: string;
  key: string;
  name: string;
}

// Prompt user for team key with smart default selection
async function promptForTeamKey(apiKey: string): Promise<string | undefined> {
  const client = createLinearClient(apiKey);

  // List available teams
  console.log('\nFetching teams...');
  const teamsResult = await client.teams();
  const teams: TeamInfo[] = teamsResult.nodes.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
  }));

  if (teams.length === 0) {
    console.log('No teams found in your Linear workspace.');
    return undefined;
  }

  // If only one team, auto-select it
  if (teams.length === 1) {
    const team = teams[0];
    console.log(`\nFound team: ${team.name} (${team.key})`);
    console.log(`Auto-selecting as it's the only team.`);
    return team.key;
  }

  // Multiple teams - show list with first one as default
  const defaultTeam = teams[0];

  console.log('\nAvailable teams:');
  teams.forEach((team, index) => {
    const defaultMarker = index === 0 ? ' (default)' : '';
    console.log(`  - ${team.key}: ${team.name}${defaultMarker}`);
  });

  const teamKeyInput = await prompt(`\nEnter team key or press Enter for default [${defaultTeam.key}]: `);
  const teamKey = teamKeyInput.trim() || defaultTeam.key;

  // Verify team exists
  const team = await getTeamByKeyOrId(client, teamKey);
  if (!team) {
    console.log(`Team "${teamKey}" not found.`);
    return undefined;
  }

  console.log(`Selected team: ${team.name} (${team.key})`);
  return teamKey;
}

// MCP configuration interface
interface McpConfig {
  mcpServers: {
    [key: string]: {
      type: string;
      url: string;
      headers: {
        [key: string]: string;
      };
    };
  };
}

// Get the .foundry directory path, ensuring it exists
function getFoundryDir(): string {
  const foundryDir = join(getRepoRoot(), '.foundry');
  if (!existsSync(foundryDir)) {
    mkdirSync(foundryDir, { recursive: true });
  }
  return foundryDir;
}

// Copy prompts from the installed package to .foundry/prompts/
// Always overwrites to ensure prompts are up-to-date with installed version
export function copyPromptsToProject(): void {
  const sourceDir = join(PACKAGE_ROOT, 'prompts');
  const destDir = join(getFoundryDir(), 'prompts');

  // Ensure destination directory exists
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Check if source prompts exist
  if (!existsSync(sourceDir)) {
    console.log('Warning: Prompts directory not found in package.');
    return;
  }

  // Copy all .md files from source to destination
  const files = readdirSync(sourceDir).filter(f => f.endsWith('.md'));
  let copied = 0;

  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const destPath = join(destDir, file);
    copyFileSync(sourcePath, destPath);
    copied++;
  }

  console.log(`Prompts synced to .foundry/prompts/ (${copied} files)`);
}

// Add .foundry/ to .gitignore if not already present
function ensureGitignore(): void {
  const gitignorePath = join(getRepoRoot(), '.gitignore');
  const entry = '.foundry/';

  // Read existing .gitignore or start with empty
  let content = '';
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf-8');
  }

  // Check if .foundry/ is already ignored
  const lines = content.split('\n');
  const alreadyIgnored = lines.some(
    (line) => line.trim() === entry || line.trim() === '.foundry'
  );

  if (alreadyIgnored) {
    return;
  }

  // Append .foundry/ to .gitignore
  const newContent = content.endsWith('\n') || content === ''
    ? content + entry + '\n'
    : content + '\n' + entry + '\n';

  writeFileSync(gitignorePath, newContent, 'utf-8');
  console.log('Added .foundry/ to .gitignore');
}

// Save or update MCP configuration with Linear API key
function saveMcpConfig(apiKey: string): void {
  const mcpPath = join(getFoundryDir(), 'mcp.json');

  let config: McpConfig = { mcpServers: {} };

  // Read existing config if it exists
  if (existsSync(mcpPath)) {
    try {
      const existing = readFileSync(mcpPath, 'utf-8');
      config = JSON.parse(existing);
      // Ensure mcpServers object exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
    } catch {
      // If parsing fails, start fresh
      config = { mcpServers: {} };
    }
  }

  // Add or update Linear MCP server configuration
  config.mcpServers.linear = {
    type: 'http',
    url: 'https://mcp.linear.app/mcp',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log('Linear MCP server configured in .foundry/mcp.json');
}

// Provider type for selection
type ProviderChoice = 'claude' | 'codex';

/**
 * Checks which coding CLIs are available and displays the results.
 * Returns the availability status, or undefined if neither CLI is installed.
 */
export function checkAndDisplayCliAvailability(): CliAvailability | undefined {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Detecting Coding CLIs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Checking for installed coding CLIs...\n');

  const availability = detectAvailableClis();

  // Display detection results
  const claudeStatus = availability.claude ? '✓ installed' : '✗ not found';
  const codexStatus = availability.codex ? '✓ installed' : '✗ not found';

  console.log(`  Claude Code CLI: ${claudeStatus}`);
  console.log(`  Codex CLI:       ${codexStatus}`);
  console.log('');

  // Check if at least one CLI is available
  if (!hasAnyCli(availability)) {
    console.log('❌ Error: No coding CLI found');
    console.log('');
    console.log('   Foundry requires at least one of the following to be installed:');
    console.log('');
    console.log('   Claude Code CLI:');
    console.log('     npm install -g @anthropic-ai/claude-code');
    console.log('     https://github.com/anthropics/claude-code');
    console.log('');
    console.log('   Codex CLI:');
    console.log('     npm install -g @openai/codex');
    console.log('     https://github.com/openai/codex');
    console.log('');
    console.log('   Please install at least one CLI and try again.');
    return undefined;
  }

  return availability;
}

// Prompt user for provider selection (Claude or Codex)
// Only shows available options based on CLI detection
async function promptForProvider(availability: CliAvailability): Promise<ProviderChoice> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    Provider Selection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // If only one CLI is installed, auto-select it
  if (availability.claude && !availability.codex) {
    console.log('Only Claude Code CLI is installed.');
    console.log('Auto-selecting Claude as the provider.\n');
    return 'claude';
  }

  if (availability.codex && !availability.claude) {
    console.log('Only Codex CLI is installed.');
    console.log('Auto-selecting Codex as the provider.\n');
    return 'codex';
  }

  // Both CLIs are installed, let user choose
  console.log('Foundry supports two AI providers:');
  console.log('  1. Claude (default) - Anthropic\'s Claude via Claude Code CLI');
  console.log('  2. Codex - OpenAI\'s Codex via Codex CLI');
  console.log('');

  const input = await prompt('Select provider [1=Claude (default), 2=Codex]: ');
  const choice = input.trim();

  if (choice === '2' || choice.toLowerCase() === 'codex') {
    console.log('Selected provider: Codex');
    return 'codex';
  }

  console.log('Selected provider: Claude');
  return 'claude';
}

// Save credentials to .foundry/env file and configure MCP
function saveCredentials(apiKey: string, teamKey: string, provider: ProviderChoice): void {
  const envPath = join(getFoundryDir(), 'env');
  const content = `# Foundry configuration (auto-generated by wizard)
LINEAR_API_KEY=${apiKey}
LINEAR_TEAM_KEY=${teamKey}
FOUNDRY_PROVIDER=${provider}
`;
  writeFileSync(envPath, content, 'utf-8');
  console.log(`\nCredentials saved to .foundry/env`);

  // Also configure MCP with the same API key
  saveMcpConfig(apiKey);

  // Ensure .foundry/ is in .gitignore (contains secrets)
  ensureGitignore();
}

// Show status preview
function showStatusPreview(): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`                    ${FOUNDRY_STATUS_PREFIX} Status Setup`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Foundry will create the following workflow statuses:');
  console.log('');

  const statusNames = getFoundryStatusNames();
  statusNames.forEach((name) => {
    console.log(`  • ${name}`);
  });

  console.log('');
  console.log(`These statuses use the ${FOUNDRY_STATUS_PREFIX} prefix to avoid conflicts`);
  console.log('with your existing workflow statuses.');
  console.log('');
}

// Run the full initialization wizard
// If cliAvailability is provided, it will be used for provider selection
// If not provided, CLI detection will be run automatically
export async function runInitialization(cliAvailability?: CliAvailability): Promise<InitResult | undefined> {
  // Get API key from environment or prompt
  let apiKey = process.env.LINEAR_API_KEY;

  // Track if we collected new credentials that need saving
  let needsSave = false;

  if (!apiKey) {
    apiKey = await promptForApiKey();
    if (!apiKey) {
      return undefined;
    }
    needsSave = true;
  }

  // Get team key from environment or prompt
  let teamKey = process.env.LINEAR_TEAM_KEY;

  if (!teamKey) {
    teamKey = await promptForTeamKey(apiKey);
    if (!teamKey) {
      return undefined;
    }
    needsSave = true;
  }

  // Get provider from environment or prompt (only if we're collecting new credentials)
  let provider: ProviderChoice = (process.env.FOUNDRY_PROVIDER as ProviderChoice) || 'claude';
  if (needsSave) {
    // Use provided CLI availability or detect it now
    const availability = cliAvailability ?? checkAndDisplayCliAvailability();
    if (!availability) {
      return undefined; // No CLI available
    }
    provider = await promptForProvider(availability);
  }

  // Save credentials to .foundry/env if we collected new ones
  if (needsSave) {
    saveCredentials(apiKey, teamKey, provider);

    // Update process.env so the config picks up the new values
    process.env.LINEAR_API_KEY = apiKey;
    process.env.LINEAR_TEAM_KEY = teamKey;
    process.env.FOUNDRY_PROVIDER = provider;
  }

  // Always copy/update prompts to .foundry/prompts/
  copyPromptsToProject();

  // Find the team
  const client = createLinearClient(apiKey);
  const team = await getTeamByKeyOrId(client, teamKey);
  if (!team) {
    console.log(`Team "${teamKey}" not found.`);
    return undefined;
  }

  // Check if already initialized
  const isInitialized = await checkFoundryStatusesExist(client, team.id);
  if (isInitialized) {
    console.log(`\n${FOUNDRY_STATUS_PREFIX} statuses already exist in ${team.name}. No action needed.`);
    return {
      success: true,
      created: [],
      existing: getFoundryStatusNames(),
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
  const result = await ensureFoundryStatuses(client, team.id);

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
    console.log('\nFoundry is ready to use!');
  } else {
    console.log('\nSome errors occurred. Please check and try again.');
  }

  return result;
}
