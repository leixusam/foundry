/**
 * Foundry configuration wizard (`foundry config`).
 * Shows all current values and allows user to change them with "Enter to keep" UX.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import { getRepoRoot } from '../config.js';
import {
  createLinearClient,
  validateApiKey,
  getTeamByKeyOrId,
  deleteFoundryStatuses,
  FOUNDRY_STATUS_PREFIX,
  getFoundryStatusNames,
} from './linear-api.js';
import {
  ensureFoundryDir,
  ensureFoundryDocsDir,
  ensureGitignore,
  loadExistingConfig,
  saveEnvConfig,
  saveMcpConfig,
  saveCodexMcpConfig,
  checkAndDisplayCliAvailability,
  autoSelectProvider,
  validateLinearKey,
  fetchLinearTeams,
  checkLinearStatuses,
  createLinearStatuses,
  createPromptInterface,
  promptSecret,
  promptWithDefault,
  promptConfirm,
  promptSelect,
  maskApiKey,
  LoadedConfig,
  TeamInfo,
  SelectOption,
} from './setup.js';
import { ProviderName, ClaudeModel, CodexReasoningEffort, MergeMode, WorkflowMode } from '../types.js';

/**
 * Main configuration wizard for `foundry config`.
 */
export async function configProject(): Promise<void> {
  const projectRoot = getRepoRoot();

  console.log('');
  console.log('╭─ Foundry Configuration ─╮');
  console.log('');
  console.log(`Project: ${projectRoot}`);
  console.log('');

  // Ensure directories exist
  ensureFoundryDir();
  ensureFoundryDocsDir();
  ensureGitignore();

  // Check CLI availability
  const cliAvailability = checkAndDisplayCliAvailability();
  if (!cliAvailability) {
    process.exit(1);
  }

  // Load existing configuration
  const existingConfig = loadExistingConfig();
  const rl = createPromptInterface();

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // Linear Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Linear Configuration ───\n');

    // API Key
    let apiKey: string;
    if (existingConfig.linearApiKey) {
      console.log(`Linear API Key: ${maskApiKey(existingConfig.linearApiKey)} (configured)`);
      const newKey = await promptWithDefault(rl, '  [Enter to keep, or paste new key]', '');
      apiKey = newKey || existingConfig.linearApiKey;

      // Validate if changed
      if (newKey && newKey !== existingConfig.linearApiKey) {
        console.log('Validating...');
        const isValid = await validateLinearKey(newKey);
        if (!isValid) {
          console.log('Invalid API key. Keeping existing key.');
          apiKey = existingConfig.linearApiKey;
        } else {
          console.log('✓ Valid');
        }
      }
    } else {
      console.log('To get your API key:');
      console.log('  1. Go to: https://linear.app/settings/account/security/api-keys/new');
      console.log('  2. Enter a label (e.g., "Foundry")');
      console.log('  3. Click "Create key"');
      console.log('');

      apiKey = await promptSecret(rl, 'Linear API Key');
      if (!apiKey) {
        console.log('\nLinear API key is required.');
        process.exit(1);
      }

      console.log('Validating...');
      const isValid = await validateLinearKey(apiKey);
      if (!isValid) {
        console.log('Invalid API key.');
        process.exit(1);
      }
      console.log('✓ Valid');
    }

    console.log('');

    // Fetch teams for selection
    console.log('Fetching teams...');
    let teams: TeamInfo[] = [];
    try {
      teams = await fetchLinearTeams(apiKey);
    } catch (error) {
      console.log('Failed to fetch teams. Please check your API key.');
      process.exit(1);
    }

    if (teams.length === 0) {
      console.log('No teams found in your Linear workspace.');
      process.exit(1);
    }

    // Team selection
    const currentTeamIndex = existingConfig.linearTeamKey
      ? teams.findIndex((t) => t.key === existingConfig.linearTeamKey)
      : 0;
    const defaultTeamIndex = currentTeamIndex >= 0 ? currentTeamIndex : 0;

    console.log('Select team:');
    const teamOptions: SelectOption<string>[] = teams.map((team) => ({
      value: team.key,
      label: `${team.name} (${team.key})`,
    }));

    const teamKey = await promptSelect(rl, teamOptions, defaultTeamIndex);
    const selectedTeam = teams.find((t) => t.key === teamKey)!;
    console.log(`Selected: ${selectedTeam.name} (${selectedTeam.key})`);

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // Provider Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Provider ───\n');

    let provider: ProviderName;

    // Determine available options based on CLI detection
    const providerOptions: SelectOption<ProviderName>[] = [];
    if (cliAvailability.claude) {
      providerOptions.push({ value: 'claude', label: 'claude', description: 'Claude Code CLI' });
    }
    if (cliAvailability.codex) {
      providerOptions.push({ value: 'codex', label: 'codex', description: 'OpenAI Codex CLI' });
    }

    if (providerOptions.length === 1) {
      provider = providerOptions[0].value;
      console.log(`Provider: ${provider} (only available option)\n`);
    } else {
      const currentProvider = existingConfig.provider || 'claude';
      const defaultProviderIndex = providerOptions.findIndex((p) => p.value === currentProvider);

      console.log('Select provider:');
      provider = await promptSelect(rl, providerOptions, defaultProviderIndex >= 0 ? defaultProviderIndex : 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Advanced Options
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Model ───\n');

    let claudeModel: ClaudeModel = existingConfig.claudeModel || 'opus';
    let codexModel: string = existingConfig.codexModel || 'gpt-5.3-codex';
    let codexEffort: CodexReasoningEffort = existingConfig.codexReasoningEffort || 'high';
    let maxIterations: number = existingConfig.maxIterations ?? 0;

    if (provider === 'claude') {
      const modelOptions: SelectOption<ClaudeModel>[] = [
        { value: 'opus', label: 'opus', description: 'Most capable' },
        { value: 'sonnet', label: 'sonnet', description: 'Balanced' },
        { value: 'haiku', label: 'haiku', description: 'Fastest' },
      ];
      const defaultModelIndex = modelOptions.findIndex((m) => m.value === claudeModel);

      console.log('Select model:');
      claudeModel = await promptSelect(rl, modelOptions, defaultModelIndex >= 0 ? defaultModelIndex : 0);
    } else {
      const modelInput = await promptWithDefault(
        rl,
        `Codex Model (${codexModel})`,
        codexModel
      );
      codexModel = modelInput || codexModel;

      const effortOptions: SelectOption<CodexReasoningEffort>[] = [
        { value: 'low', label: 'low' },
        { value: 'medium', label: 'medium' },
        { value: 'high', label: 'high' },
        { value: 'extra_high', label: 'extra_high' },
      ];
      const defaultEffortIndex = effortOptions.findIndex((e) => e.value === codexEffort);

      console.log('\nSelect reasoning effort:');
      codexEffort = await promptSelect(rl, effortOptions, defaultEffortIndex >= 0 ? defaultEffortIndex : 2);
    }

    console.log('');
    console.log('─── Advanced ───\n');

    const maxIterInput = await promptWithDefault(
      rl,
      `Max Iterations (0=unlimited) (${maxIterations})`,
      String(maxIterations)
    );
    const parsedMax = parseInt(maxIterInput, 10);
    if (!isNaN(parsedMax) && parsedMax >= 0) {
      maxIterations = parsedMax;
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // Workflow Mode Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Workflow Mode ───\n');

    const currentWorkflowMode: WorkflowMode = existingConfig.workflowMode || 'staged';
    const workflowModeOptions: SelectOption<WorkflowMode>[] = [
      {
        value: 'staged',
        label: 'staged',
        description: 'Default flow: research/spec/plan/implement/validate (oneshot when small)',
      },
      {
        value: 'oneshot',
        label: 'oneshot',
        description: 'Always run every ticket as oneshot',
      },
    ];
    const defaultWorkflowModeIndex = workflowModeOptions.findIndex((m) => m.value === currentWorkflowMode);

    console.log('How should tickets be processed?');
    const workflowMode = await promptSelect(
      rl,
      workflowModeOptions,
      defaultWorkflowModeIndex >= 0 ? defaultWorkflowModeIndex : 0
    );

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // Merge Mode Configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Merge Mode ───\n');

    const currentMergeMode: MergeMode = existingConfig.mergeMode || 'auto';

    const mergeModeOptions: SelectOption<MergeMode>[] = [
      { value: 'auto', label: 'auto', description: 'Agent decides: merge directly or create PR (recommended)' },
      { value: 'merge', label: 'merge', description: 'Merge directly to main' },
      { value: 'pr', label: 'pr', description: 'Create PR for review' },
    ];
    const defaultMergeIndex = mergeModeOptions.findIndex((m) => m.value === currentMergeMode);

    console.log('When work completes:');
    const mergeMode = await promptSelect(rl, mergeModeOptions, defaultMergeIndex >= 0 ? defaultMergeIndex : 0);

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Summary ───\n');
    console.log(`  Team: ${selectedTeam.name} (${selectedTeam.key})`);
    console.log(`  Provider: ${provider}${provider === 'claude' ? ` (${claudeModel})` : ` (${codexModel})`}`);
    console.log(`  Workflow: ${workflowMode}`);
    console.log(`  Merge: ${mergeMode}`);
    console.log(`  Max iterations: ${maxIterations === 0 ? 'unlimited' : maxIterations}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // Save Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    const newConfig: LoadedConfig = {
      linearApiKey: apiKey,
      linearTeamKey: teamKey,
      provider,
      claudeModel,
      codexModel,
      codexReasoningEffort: codexEffort,
      maxIterations,
      mergeMode,
      workflowMode,
    };

    saveEnvConfig(newConfig);
    saveMcpConfig(apiKey);

    // Configure Codex MCP if using Codex provider
    if (provider === 'codex') {
      saveCodexMcpConfig();
    }

    console.log('Saved to .foundry/env');

    // ═══════════════════════════════════════════════════════════════════════════
    // Linear Workflow Statuses
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('─── Linear Workflow Statuses ───\n');

    const statusesExist = await checkLinearStatuses(apiKey, teamKey);

    if (statusesExist) {
      console.log(`${FOUNDRY_STATUS_PREFIX} statuses already exist. No action needed.\n`);
    } else {
      console.log('Foundry will create the following workflow statuses:\n');

      const statusNames = getFoundryStatusNames();
      statusNames.forEach((name) => {
        console.log(`  • ${name}`);
      });

      console.log('');
      console.log(`These statuses use the ${FOUNDRY_STATUS_PREFIX} prefix to avoid conflicts`);
      console.log('with your existing workflow statuses.\n');

      const createStatuses = await promptConfirm(rl, 'Create these statuses?', true);

      if (createStatuses) {
        console.log('\nCreating statuses...');
        const result = await createLinearStatuses(apiKey, teamKey);

        if (result.created.length > 0) {
          console.log(`Created ${result.created.length} status(es).`);
        }
        if (result.existing.length > 0) {
          console.log(`Found ${result.existing.length} existing status(es).`);
        }
        if (result.errors.length > 0) {
          console.log(`Errors (${result.errors.length}):`);
          result.errors.forEach((err) => console.log(`  - ${err}`));
        }
      } else {
        console.log('\nSkipped status creation. You can create them later by running `foundry config` again.');
      }
    }

    // Show Codex MCP status if using Codex
    if (provider === 'codex') {
      console.log('');
      console.log('─── Codex MCP ───\n');
      console.log('Linear MCP configured in ~/.codex/config.toml');
      console.log('(Uses LINEAR_API_KEY from .foundry/env)');
    }

    // Done
    console.log('');
    console.log('✓ Configuration complete');
    console.log('  Run `foundry` to start');
    console.log('');

  } finally {
    rl.close();
  }
}

/**
 * Removes Foundry from the current project (`foundry uninstall`).
 */
export async function uninstallProject(): Promise<void> {
  const projectRoot = getRepoRoot();
  const foundryDir = join(projectRoot, '.foundry');

  console.log('');
  console.log('╭─ Foundry Uninstall ─╮');
  console.log('');
  console.log(`Project: ${projectRoot}`);
  console.log('');

  // Check if Foundry is even installed
  if (!existsSync(foundryDir)) {
    console.log('Foundry is not installed in this project.');
    console.log('(No .foundry/ directory found)');
    process.exit(0);
  }

  // Show what will be removed
  console.log('This will remove:');
  console.log('');
  console.log('  1. .foundry/ directory containing:');
  console.log('     - env (Linear API key and configuration)');
  console.log('     - mcp.json (MCP configuration)');
  console.log('     - prompts/ (agent prompts)');
  console.log('     - output/ (run logs and session data)');
  console.log('');
  console.log('  2. .foundry/ entry from .gitignore');
  console.log('');

  // Load existing config to check for Linear credentials
  const existingConfig = loadExistingConfig();
  const hasLinearConfig = existingConfig.linearApiKey && existingConfig.linearTeamKey;

  if (hasLinearConfig) {
    console.log(`  3. Optionally: ${FOUNDRY_STATUS_PREFIX} workflow statuses from Linear`);
    console.log('     (Only empty statuses can be deleted)');
    console.log('');
  }

  console.log('─────────────────────────────────────────');
  console.log('');

  const rl = createPromptInterface();

  try {
    // Confirm uninstall
    const confirmUninstall = await promptConfirm(rl, 'Proceed with uninstall?', false);

    if (!confirmUninstall) {
      console.log('');
      console.log('Uninstall cancelled.');
      process.exit(0);
    }

    console.log('');

    // Ask about Linear statuses if configured
    let deleteStatuses = false;
    if (hasLinearConfig) {
      deleteStatuses = await promptConfirm(
        rl,
        `Delete ${FOUNDRY_STATUS_PREFIX} workflow statuses from Linear?`,
        false
      );
    }

    console.log('');

    // Step 1: Delete Linear statuses (before we lose the API key!)
    if (deleteStatuses && existingConfig.linearApiKey && existingConfig.linearTeamKey) {
      console.log('Removing Linear workflow statuses...');

      try {
        const client = createLinearClient(existingConfig.linearApiKey);

        // Validate API key still works
        const isValid = await validateApiKey(client);
        if (!isValid) {
          console.log('  Warning: Linear API key is invalid. Skipping status deletion.');
        } else {
          // Get team
          const team = await getTeamByKeyOrId(client, existingConfig.linearTeamKey);
          if (!team) {
            console.log(`  Warning: Team "${existingConfig.linearTeamKey}" not found. Skipping status deletion.`);
          } else {
            const result = await deleteFoundryStatuses(client, team.id);

            // Report results
            if (result.deleted.length > 0) {
              console.log(`  Deleted ${result.deleted.length} status(es):`);
              for (const name of result.deleted) {
                console.log(`    ✓ ${name}`);
              }
            }

            if (result.skipped.length > 0) {
              console.log('');
              console.log(`  Skipped ${result.skipped.length} status(es) with active issues:`);
              for (const { name, issueCount } of result.skipped) {
                console.log(`    ⚠ ${name} (${issueCount} issue${issueCount > 1 ? 's' : ''})`);
              }
              console.log('');
              console.log('  To delete these statuses manually:');
              console.log('    1. Move issues to other statuses in Linear');
              console.log('    2. Go to Settings → Teams → Workflow');
              console.log(`    3. Delete the ${FOUNDRY_STATUS_PREFIX} statuses`);
            }

            if (result.errors.length > 0) {
              console.log('');
              console.log(`  Errors (${result.errors.length}):`);
              for (const error of result.errors) {
                console.log(`    ✗ ${error}`);
              }
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  Error connecting to Linear: ${msg}`);
      }

      console.log('');
    }

    // Step 2: Remove .foundry/ directory
    console.log('Removing .foundry/ directory...');
    try {
      rmSync(foundryDir, { recursive: true, force: true });
      console.log('  ✓ Removed .foundry/');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ Error removing .foundry/: ${msg}`);
    }

    // Step 3: Clean up .gitignore
    console.log('Cleaning up .gitignore...');
    const removedFromGitignore = removeFromGitignore(projectRoot);
    if (removedFromGitignore) {
      console.log('  ✓ Removed .foundry/ from .gitignore');
    } else {
      console.log('  (No changes needed)');
    }

    console.log('');
    console.log('✓ Foundry uninstalled');

  } finally {
    rl.close();
  }
}

/**
 * Removes .foundry/ entry from .gitignore.
 */
function removeFromGitignore(projectRoot: string): boolean {
  const gitignorePath = join(projectRoot, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return false;
  }

  const content = readFileSync(gitignorePath, 'utf-8');
  const lines = content.split('\n');

  // Filter out .foundry/ related lines
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed !== '.foundry/' && trimmed !== '.foundry' && trimmed !== '# Foundry runtime data';
  });

  // Only write if we actually removed something
  if (filteredLines.length < lines.length) {
    // Clean up any double newlines that might result
    const newContent = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
    writeFileSync(gitignorePath, newContent);
    return true;
  }

  return false;
}
