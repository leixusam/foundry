import { getConfig, isGitRepository, getRepoRoot } from './config.js';
import { sleep, executeWithRateLimitRetry, RateLimitRetryConfig } from './lib/rate-limit.js';
import { loadPrompt } from './lib/prompts.js';
import { getCurrentBranch } from './lib/git.js';
import { generatePodName } from './lib/loop-instance-name.js';
import { initLoopLogger, getCurrentOutputDir } from './lib/output-logger.js';
import { initLoopStats, logAgentStats, finalizeLoopStats } from './lib/stats-logger.js';
import { createProvider, ProviderResult } from './lib/provider.js';
import { extractLinearUrls, downloadIssueAttachments } from './lib/attachment-downloader.js';
import { createLinearClientWithSignedUrls, getIssueDescription } from './lib/linear-api.js';
import { isRunningOnGcp, stopGcpInstance } from './lib/gcp.js';
import { checkForUncompletedTickets } from './lib/linear-quick-check.js';
import { getVersion } from './lib/version.js';
import { checkForUpdates, displayUpdateNotification } from './lib/update-checker.js';
import {
  ensureFoundryDir,
  ensureFoundryDocsDir,
  ensureGitignore,
  loadExistingConfig,
  saveEnvConfig,
  saveMcpConfig,
  copyPromptsToProject,
  copyClaudeCommands,
  checkAndDisplayCliAvailability,
  autoSelectProvider,
  validateLinearKey,
  fetchLinearTeams,
  checkLinearStatuses,
  createLinearStatuses,
  checkCodexLinearMcp,
  createPromptInterface,
  promptSecret,
  promptWithDefault,
  maskApiKey,
  LoadedConfig,
  TeamInfo,
  CliAvailability,
} from './lib/setup.js';

// Import providers to register them
import './lib/claude.js';
import './lib/codex.js';

/**
 * Extracts the issue identifier (e.g., RSK-39) from Agent 1's output.
 * Agent 1 outputs this in the format "**Identifier**: RSK-39" or similar.
 */
function extractIssueIdentifier(agent1Output: string): string | null {
  // Try various patterns Agent 1 might use
  const patterns = [
    /\*\*Identifier\*\*:\s*([A-Z]+-\d+)/i,
    /\*\*Issue Identifier\*\*:\s*([A-Z]+-\d+)/i,
    /Issue ID[^:]*:\s*[^\n]*\n[^*]*\*\*Identifier\*\*:\s*([A-Z]+-\d+)/i,
    /Identifier:\s*([A-Z]+-\d+)/i,
    /Branch:\s*foundry\/([A-Z]+-\d+)/i,
    /\b([A-Z]+-\d+)\b/,  // Fallback: any ticket-like pattern
  ];

  for (const pattern of patterns) {
    const match = agent1Output.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function runLoop(podName: string, iteration: number): Promise<void> {
  const config = getConfig();

  // Initialize output logger for this loop iteration
  // Pod name persists across all loops in this Foundry session
  initLoopLogger(podName, iteration);

  // Initialize stats tracking for this loop iteration
  initLoopStats(podName, iteration);

  console.log(`\n${'='.repeat(24)} LOOP ${iteration} ${'='.repeat(24)}`);
  console.log(`Pod: ${podName}`);
  console.log(`Provider: ${config.provider}`);
  if (config.provider === 'codex') {
    console.log(`Codex Model: ${config.codexModel}`);
    console.log(`Agent Reasoning: A1=${config.codexAgentReasoning.agent1}, A2=${config.codexAgentReasoning.agent2}, A3=${config.codexAgentReasoning.agent3}`);
  } else {
    console.log(`Claude Model: ${config.claudeModel}`);
  }
  console.log(`Output Dir: ${getCurrentOutputDir()}\n`);
  const loopStart = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 1: Linear Reader (uses configured provider)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Agent 1: Linear Reader starting...');

  const agent1Provider = createProvider(config.provider);
  const agent1BasePrompt = await loadPrompt('agent1-linear-reader');
  const agent1Prompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 1 (Linear Reader)

This identifier format is: Pod Name / Loop Number / Agent Number (Role).
- **Pod Name**: ${podName} - persists for this entire Foundry session
- **Loop Number**: ${iteration} - increments each time Foundry processes a new ticket
- **Agent**: Agent 1 (Linear Reader) - your role in this loop

## Linear Team Configuration

**Team Key**: ${config.linearTeamId}

Use this team key for all Linear MCP tool calls (list_issues, list_issue_statuses, update_issue, create_comment, etc.). Do NOT use any other team key.

---

${agent1BasePrompt}`;

  // Select model based on provider
  const agent1Model = config.provider === 'codex' ? config.codexModel : 'opus';

  // Rate limit retry config - uses configured max retries
  const retryConfig: RateLimitRetryConfig = { maxRetries: config.rateLimitMaxRetries };

  // Agent 1 with rate limit retry
  const agent1Result = await executeWithRateLimitRetry(
    () => agent1Provider.spawn({
      prompt: agent1Prompt,
      model: agent1Model,
      allowedTools: ['mcp__linear__*'],
      reasoningEffort: config.provider === 'codex' ? config.codexAgentReasoning.agent1 : undefined,
    }, 1),
    retryConfig,
    'Agent 1 (Linear Reader)'
  );

  // If still rate limited after max retries, skip this iteration
  if (agent1Result.rateLimited) {
    console.log('Agent 1 still rate limited after max retries. Skipping iteration.');
    return;
  }

  // Log Agent 1 stats
  await logAgentStats(1, config.provider, agent1Model, {
    tokenUsage: agent1Result.tokenUsage,
    cost: agent1Result.cost,
    costEstimated: agent1Result.costEstimated,
    duration: agent1Result.duration,
    exitCode: agent1Result.exitCode,
    rateLimited: agent1Result.rateLimited,
    output: agent1Result.output,
  });

  // Extract the text output from agent 1
  const agent1Output = agent1Result.finalOutput;

  // Check if there's no work (look for the signal in the output)
  if (agent1Output.includes('no_work: true') || agent1Output.includes('NO_WORK')) {
    console.log('No work available.');

    // If GCP auto-stop is enabled, check if we're on GCP and stop the instance
    if (config.gcpAutoStop) {
      console.log('GCP auto-stop is enabled. Checking if running on GCP...');
      const onGcp = await isRunningOnGcp();
      if (onGcp) {
        console.log('Running on GCP VM. Initiating instance stop...');
        const stopped = await stopGcpInstance();
        if (stopped) {
          console.log('Instance stop command issued. VM will shut down shortly.');
          // Give the stop command time to take effect
          await sleep(10000);
          process.exit(0);
        } else {
          console.log('Failed to stop GCP instance. Falling back to quick check.');
        }
      } else {
        console.log('Not running on GCP VM. Falling back to quick check.');
      }
    }

    // Two-tier polling: quick check loop with fallback
    const fullCheckIntervalMs = config.fullCheckIntervalMinutes * 60 * 1000;
    const quickCheckIntervalMs = config.quickCheckIntervalMinutes * 60 * 1000;
    let lastFullCheck = Date.now(); // Agent 1 just ran

    while (true) {
      console.log(`\n[Quick Check] Sleeping ${config.quickCheckIntervalMinutes} minutes...`);
      await sleep(quickCheckIntervalMs);

      // Check if fallback is due
      const timeSinceFullCheck = Date.now() - lastFullCheck;
      const fallbackDue = timeSinceFullCheck >= fullCheckIntervalMs;

      if (fallbackDue) {
        console.log('[Quick Check] Fallback interval reached. Running full Agent 1 check.');
        return; // Exit to let main loop run Agent 1
      }

      // Perform quick check
      if (!config.linearApiKey || !config.linearTeamId) {
        console.log('[Quick Check] Missing Linear credentials. Falling back to Agent 1.');
        return;
      }

      console.log('[Quick Check] Checking for uncompleted tickets...');
      const result = await checkForUncompletedTickets(config.linearApiKey, config.linearTeamId);

      if (result.error) {
        console.log(`[Quick Check] Error: ${result.error}. Falling back to Agent 1.`);
        return; // Error - let Agent 1 handle it
      }

      if (result.hasWork) {
        console.log(`[Quick Check] Found ${result.ticketCount} uncompleted ticket(s). Triggering Agent 1.`);
        return; // Work found - run Agent 1
      }

      // No work found - continue quick check loop
      const minutesUntilFallback = Math.round((fullCheckIntervalMs - timeSinceFullCheck) / 60000);
      console.log(`[Quick Check] No uncompleted tickets. Fallback in ${minutesUntilFallback} minutes.`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTACHMENT DOWNLOAD: Download any attached images/files from the Linear issue
  // ═══════════════════════════════════════════════════════════════════════════
  let attachmentPaths: string[] = [];
  const issueIdentifier = extractIssueIdentifier(agent1Output);

  if (issueIdentifier && config.linearApiKey) {
    console.log('\nDownloading attachments from Linear...');
    try {
      // Fetch fresh description from Linear API with signed URLs
      // The public-file-urls-expire-in header makes Linear return pre-signed URLs (1 hour expiry)
      const linearClient = createLinearClientWithSignedUrls(config.linearApiKey, 3600);
      const freshDescription = await getIssueDescription(linearClient, issueIdentifier);

      if (freshDescription) {
        // Extract URLs from the fresh description (has valid signatures)
        const attachments = extractLinearUrls(freshDescription);
        if (attachments.length > 0) {
          const result = await downloadIssueAttachments(config.linearApiKey, issueIdentifier, attachments);
          attachmentPaths = result.attachments.map(a => a.localPath);
        }
      }

      if (attachmentPaths.length > 0) {
        console.log(`Downloaded ${attachmentPaths.length} attachment(s)`);
      } else {
        console.log('No attachments found in issue');
      }
    } catch (error) {
      console.log('Failed to download attachments (continuing without them):', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Worker (uses configured provider - Claude or Codex)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 2: Worker starting...');

  // Use configured provider for Agent 2
  const agent2Provider = createProvider(config.provider);

  // Build attachment context section if we have downloaded files
  const attachmentSection = attachmentPaths.length > 0
    ? `

## Downloaded Attachments

The following files have been downloaded locally from the Linear issue. You can read/view these files using the Read tool:

${attachmentPaths.map(p => `- ${p}`).join('\n')}

`
    : '';

  // Build worker prompt by combining the base prompt with agent 1's output
  const workerBasePrompt = await loadPrompt('agent2-worker');
  const workerPrompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 2 (Worker)

This identifier format is: Pod Name / Loop Number / Agent Number (Role).
- **Pod Name**: ${podName} - persists for this entire Foundry session
- **Loop Number**: ${iteration} - increments each time Foundry processes a new ticket
- **Agent**: Agent 2 (Worker) - your role in this loop

## Linear Team Configuration

**Team Key**: ${config.linearTeamId}

This team key is used for all Linear MCP tool calls. While you don't make Linear calls directly, this context may be passed to other agents.

---

## Context from Linear (gathered by Agent 1)

${agent1Output}
${attachmentSection}
---

${workerBasePrompt}`;

  // Agent 2 with rate limit retry
  let agent2Result: ProviderResult;
  if (config.provider === 'codex') {
    agent2Result = await executeWithRateLimitRetry(
      () => agent2Provider.spawn({
        prompt: workerPrompt,
        model: config.codexModel,
        reasoningEffort: config.codexReasoningEffort,
      }, 2),
      retryConfig,
      'Agent 2 (Worker)'
    );
  } else {
    agent2Result = await executeWithRateLimitRetry(
      () => agent2Provider.spawn({
        prompt: workerPrompt,
        model: config.claudeModel,
      }, 2),
      retryConfig,
      'Agent 2 (Worker)'
    );
  }

  // Note: Agent 2 rate limits are logged but we continue to Agent 3 regardless
  if (agent2Result.rateLimited) {
    console.log('Agent 2 still rate limited after max retries. Continuing to Agent 3 to log status.');
  }

  // Log Agent 2 stats
  const agent2Model = config.provider === 'codex' ? config.codexModel : config.claudeModel;
  await logAgentStats(2, config.provider, agent2Model, {
    tokenUsage: agent2Result.tokenUsage,
    cost: agent2Result.cost,
    costEstimated: agent2Result.costEstimated,
    duration: agent2Result.duration,
    exitCode: agent2Result.exitCode,
    rateLimited: agent2Result.rateLimited,
    output: agent2Result.output,
  });

  const agent2Output = agent2Result.finalOutput;

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Linear Writer (uses configured provider)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 3: Linear Writer starting...');

  const agent3Provider = createProvider(config.provider);
  const writerBasePrompt = await loadPrompt('agent3-linear-writer');

  // Format cost strings with estimated marker for Codex
  const agent1CostStr = agent1Result.costEstimated
    ? `~$${agent1Result.cost.toFixed(4)} (estimated)`
    : `$${agent1Result.cost.toFixed(4)}`;
  const agent2CostStr = agent2Result.costEstimated
    ? `~$${agent2Result.cost.toFixed(4)} (estimated)`
    : `$${agent2Result.cost.toFixed(4)}`;

  const writerPrompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 3 (Linear Writer)

This identifier format is: Pod Name / Loop Number / Agent Number (Role).
- **Pod Name**: ${podName} - persists for this entire Foundry session
- **Loop Number**: ${iteration} - increments each time Foundry processes a new ticket
- **Agent**: Agent 3 (Linear Writer) - your role in this loop

**IMPORTANT**: Include the pod name (${podName}) in all comments you post to Linear so that when multiple pods work in parallel, we can identify which one made which comment.

## Linear Team Configuration

**Team Key**: ${config.linearTeamId}

Use this team key for all Linear MCP tool calls (update_issue, create_comment, create_issue for sub-issues, etc.). Do NOT use any other team key.

---

## Context from Agent 1 (Linear issue details)

${agent1Output}

---

## Results from Agent 2 (Work performed)

${agent2Output}

---

## Session Stats

- Pod: ${podName}
- Loop: ${iteration}

### Agent 1 (Linear Reader)
- Provider: ${config.provider}
- Model: ${agent1Model}
- Cost: ${agent1CostStr}
- Duration: ${Math.round(agent1Result.duration / 1000)}s
- Tokens: in=${agent1Result.tokenUsage.input.toLocaleString()} out=${agent1Result.tokenUsage.output.toLocaleString()} cached=${agent1Result.tokenUsage.cached.toLocaleString()}

### Agent 2 (Worker)
- Provider: ${config.provider}
- Model: ${agent2Model}
- Cost: ${agent2CostStr}
- Duration: ${Math.round(agent2Result.duration / 1000)}s
- Tokens: in=${agent2Result.tokenUsage.input.toLocaleString()} out=${agent2Result.tokenUsage.output.toLocaleString()} cached=${agent2Result.tokenUsage.cached.toLocaleString()}
- Exit code: ${agent2Result.exitCode}
- Rate limited: ${agent2Result.rateLimited}

### Loop Totals (Agent 1 + Agent 2)
- Total Cost: $${(agent1Result.cost + agent2Result.cost).toFixed(4)}${(agent1Result.costEstimated || agent2Result.costEstimated) ? ' (includes estimate)' : ''}
- Total Duration: ${Math.round((agent1Result.duration + agent2Result.duration) / 1000)}s
- Total Tokens: in=${(agent1Result.tokenUsage.input + agent2Result.tokenUsage.input).toLocaleString()} out=${(agent1Result.tokenUsage.output + agent2Result.tokenUsage.output).toLocaleString()} cached=${(agent1Result.tokenUsage.cached + agent2Result.tokenUsage.cached).toLocaleString()}

---

${writerBasePrompt}`;

  // Agent 3 with rate limit retry
  const agent3Model = config.provider === 'codex' ? config.codexModel : 'sonnet';
  const agent3Result = await executeWithRateLimitRetry(
    () => agent3Provider.spawn({
      prompt: writerPrompt,
      model: agent3Model,
      allowedTools: ['mcp__linear__*'],
      reasoningEffort: config.provider === 'codex' ? config.codexAgentReasoning.agent3 : undefined,
    }, 3),
    retryConfig,
    'Agent 3 (Linear Writer)'
  );

  if (agent3Result.rateLimited) {
    console.log('Agent 3 still rate limited after max retries.');
  }

  // Log Agent 3 stats
  await logAgentStats(3, config.provider, agent3Model, {
    tokenUsage: agent3Result.tokenUsage,
    cost: agent3Result.cost,
    costEstimated: agent3Result.costEstimated,
    duration: agent3Result.duration,
    exitCode: agent3Result.exitCode,
    rateLimited: agent3Result.rateLimited,
    output: agent3Result.output,
  });

  // Finalize loop stats
  await finalizeLoopStats();

  // Loop stats
  const duration = Math.round((Date.now() - loopStart) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  console.log(`\nLoop ${iteration} complete in ${minutes}m ${seconds}s`);
}

/**
 * Displays the Foundry startup banner with ASCII art.
 * Futuristic/sci-fi themed, ~10 lines.
 */
function displayBanner(): void {
  const version = getVersion();
  const banner = `
    ███████╗ ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██████╗ ██╗   ██╗
    ██╔════╝██╔═══██╗██║   ██║████╗  ██║██╔══██╗██╔══██╗╚██╗ ██╔╝
    █████╗  ██║   ██║██║   ██║██╔██╗ ██║██║  ██║██████╔╝ ╚████╔╝
    ██╔══╝  ██║   ██║██║   ██║██║╚██╗██║██║  ██║██╔══██╗  ╚██╔╝
    ██║     ╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝██║  ██║   ██║
    ╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝   ╚═╝

    ⚡ Autonomous Product Development System ⚡  v${version}
════════════════════════════════════════════════════════════════`;
  console.log(banner);
}

/**
 * Displays a safety warning about AI coding agents.
 */
function displaySafetyWarning(): void {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  SAFETY WARNING                                              │
├─────────────────────────────────────────────────────────────────┤
│  Foundry uses AI coding agents (Claude Code, Codex) that are    │
│  granted permissions to read, write, and execute code.          │
│                                                                 │
│  • Coding agents may make mistakes                              │
│  • They may take actions that could be harmful to your system   │
│  • Always review changes before merging to production           │
│                                                                 │
│  We recommend running Foundry in a sandboxed environment or     │
│  virtual machine for added safety.                              │
└─────────────────────────────────────────────────────────────────┘
`);
}

/**
 * Runs minimal first-run setup if credentials are missing.
 * Prompts only for essentials (API key, team), uses defaults for everything else.
 * Returns true if setup completed successfully, false if user cancelled.
 */
async function runMinimalSetup(cliAvailability: CliAvailability): Promise<boolean> {
  console.log('\n⚠️  Linear credentials not configured.\n');

  const rl = createPromptInterface();

  try {
    // Load any existing config
    const existingConfig = loadExistingConfig();

    // Prompt for API key
    console.log('To get your API key:');
    console.log('  1. Go to: https://linear.app/settings/account/security/api-keys/new');
    console.log('  2. Enter a label (e.g., "Foundry")');
    console.log('  3. Click "Create key"');
    console.log('');

    let apiKey = await promptSecret(rl, 'Enter your Linear API key');
    if (!apiKey) {
      console.log('\nLinear API key is required.');
      return false;
    }

    // Validate API key
    console.log('Validating...');
    const isValid = await validateLinearKey(apiKey);
    if (!isValid) {
      console.log('Invalid API key. Please check and try again.');
      return false;
    }
    console.log('✓ Valid\n');

    // Fetch teams and select
    console.log('Fetching teams...');
    const teams = await fetchLinearTeams(apiKey);

    if (teams.length === 0) {
      console.log('No teams found in your Linear workspace.');
      return false;
    }

    let teamKey: string;
    if (teams.length === 1) {
      teamKey = teams[0].key;
      console.log(`Found team: ${teams[0].name} (${teams[0].key})`);
      console.log('Auto-selecting as it\'s the only team.\n');
    } else {
      console.log('Available teams:');
      teams.forEach((team) => {
        console.log(`  - ${team.key}: ${team.name}`);
      });
      teamKey = await promptWithDefault(rl, `\nSelect team`, teams[0].key);

      // Verify team exists
      const selectedTeam = teams.find((t) => t.key === teamKey);
      if (!selectedTeam) {
        console.log(`Team "${teamKey}" not found.`);
        return false;
      }
      console.log(`Selected: ${selectedTeam.name} (${selectedTeam.key})\n`);
    }

    // Auto-select provider based on CLI availability
    const provider = autoSelectProvider(cliAvailability);
    console.log(`Using provider: ${provider}\n`);

    // Prompt for merge mode
    console.log('Merge Mode Options:');
    console.log('  merge - Merge directly to main after validation (default)');
    console.log('  pr    - Create a pull request for human review');
    console.log('');
    const mergeModeInput = await promptWithDefault(rl, 'Merge mode [merge/pr]', 'merge');
    const mergeMode = mergeModeInput === 'pr' ? 'pr' : 'merge';

    // Save configuration
    const newConfig: LoadedConfig = {
      linearApiKey: apiKey,
      linearTeamKey: teamKey,
      provider,
      claudeModel: existingConfig.claudeModel || 'opus',
      codexModel: existingConfig.codexModel || 'gpt-5.2',
      codexReasoningEffort: existingConfig.codexReasoningEffort || 'high',
      maxIterations: existingConfig.maxIterations ?? 0,
      mergeMode,
    };

    saveEnvConfig(newConfig);
    saveMcpConfig(apiKey);
    ensureGitignore();

    // Update process.env so config picks up new values
    process.env.LINEAR_API_KEY = apiKey;
    process.env.LINEAR_TEAM_KEY = teamKey;
    process.env.FOUNDRY_PROVIDER = provider;
    process.env.FOUNDRY_MERGE_MODE = mergeMode;

    console.log('\n✓ Configuration saved!\n');
    return true;
  } finally {
    rl.close();
  }
}

export async function main(): Promise<void> {
  displayBanner();
  displaySafetyWarning();

  // Check for updates (non-blocking, cached for 24 hours)
  const updateResult = await checkForUpdates();
  displayUpdateNotification(updateResult);

  // Check for git repository first - Foundry requires git
  if (!isGitRepository()) {
    console.log('\n❌ Error: Not a git repository');
    console.log('');
    console.log('   Foundry requires a git repository to operate. It uses git for:');
    console.log('   - Creating feature branches');
    console.log('   - Committing changes');
    console.log('   - Creating pull requests');
    console.log('');
    console.log('   To initialize a git repository, run:');
    console.log('     git init');
    console.log('');
    process.exit(1);
  }

  // Ensure directories exist (silent)
  ensureFoundryDir();
  ensureFoundryDocsDir();
  ensureGitignore();

  // Check for coding CLI availability - at least one must be installed
  const cliAvailability = checkAndDisplayCliAvailability();
  if (!cliAvailability) {
    // Error message already displayed by checkAndDisplayCliAvailability
    process.exit(1);
  }

  // Sync prompts from package to .foundry/prompts/ (ensures they're always up-to-date)
  copyPromptsToProject();

  // Copy Claude commands if using Claude provider
  const existingConfig = loadExistingConfig();
  if (!existingConfig.provider || existingConfig.provider === 'claude') {
    copyClaudeCommands();
  }

  let config = getConfig();

  // Check if Linear credentials are configured
  if (!config.linearApiKey || !config.linearTeamId) {
    const setupSuccess = await runMinimalSetup(cliAvailability);
    if (!setupSuccess) {
      console.log('\nCannot start Foundry without Linear configuration.');
      console.log('Run `foundry config` for full configuration options.\n');
      process.exit(1);
    }

    // Reload config after setup (rebuild from updated process.env)
    config = getConfig(true);
  }

  // Display config summary
  console.log(`   Working directory: ${config.workingDirectory}`);
  console.log(`   Branch: ${getCurrentBranch()}`);
  console.log(`   Provider: ${config.provider}`);
  if (config.provider === 'codex') {
    console.log(`   Codex Model: ${config.codexModel}`);
    console.log(`   Reasoning Effort (default): ${config.codexReasoningEffort}`);
    console.log(`   Agent Reasoning: A1=${config.codexAgentReasoning.agent1}, A2=${config.codexAgentReasoning.agent2}, A3=${config.codexAgentReasoning.agent3}`);
  } else {
    console.log(`   Claude Model: ${config.claudeModel}`);
  }
  if (config.maxIterations > 0) {
    console.log(`   Max Iterations: ${config.maxIterations}`);
  }
  if (config.gcpAutoStop) {
    console.log(`   GCP Auto-Stop: enabled`);
  }
  console.log(`   Merge Mode: ${config.mergeMode}`);

  // Check if Foundry ∞ statuses exist in Linear, create if needed
  const statusesExist = await checkLinearStatuses(config.linearApiKey!, config.linearTeamId!);
  if (!statusesExist) {
    console.log('\n   Creating ∞ workflow statuses in Linear...');
    const result = await createLinearStatuses(config.linearApiKey!, config.linearTeamId!);

    if (!result.success) {
      console.log('\n❌ Failed to create ∞ statuses. Please check Linear permissions.');
      if (result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`   - ${err}`));
      }
      process.exit(1);
    }

    // Show status creation summary
    if (result.created.length > 0) {
      console.log(`   Created ${result.created.length} status(es)`);
    }
    if (result.existing.length > 0) {
      console.log(`   Found ${result.existing.length} existing status(es)`);
    }
  }

  console.log('   Linear Team: ' + config.linearTeamId);
  console.log('   ∞ Statuses: ✓ configured');

  // Check Codex Linear MCP if using Codex provider
  if (config.provider === 'codex') {
    const hasLinearMcp = checkCodexLinearMcp();
    if (!hasLinearMcp) {
      console.log('\n⚠️  Linear MCP not configured for Codex.');
      console.log('   Run: codex mcp add linear --url https://mcp.linear.app/mcp');
      process.exit(1);
    }
    console.log('   Codex Linear MCP: ✓ configured');
  }

  // Generate pod name once at startup - persists for entire Foundry session
  const podName = generatePodName();
  console.log(`   Pod: ${podName}`);

  let iteration = 0;

  while (config.maxIterations === 0 || iteration < config.maxIterations) {
    try {
      await runLoop(podName, iteration);
      iteration++;
    } catch (error) {
      console.error(`\nLoop ${iteration} error:`, error);
      console.log(`Sleeping ${config.errorSleepMinutes} minute(s) before retry...`);
      await sleep(config.errorSleepMinutes * 60 * 1000);
    }
  }

  if (config.maxIterations > 0) {
    console.log(`\nReached max iterations: ${config.maxIterations}`);
  }
}

// Run main when executed directly
// When used as CLI via cli.ts, main() is imported and called there
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
