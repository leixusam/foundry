import { getConfig } from './config.js';
import { sleep, executeWithRateLimitRetry, RateLimitRetryConfig } from './lib/rate-limit.js';
import { loadPrompt } from './lib/prompts.js';
import { getCurrentBranch } from './lib/git.js';
import { generatePodName } from './lib/loop-instance-name.js';
import { initLoopLogger, getCurrentOutputDir } from './lib/output-logger.js';
import { initLoopStats, logAgentStats, finalizeLoopStats } from './lib/stats-logger.js';
import { createProvider, ProviderResult } from './lib/provider.js';
import { checkInitialized, runInitialization, checkCodexLinearMcp } from './init.js';
import { downloadAttachmentsFromAgent1Output } from './lib/attachment-downloader.js';
import { isRunningOnGcp, stopGcpInstance } from './lib/gcp.js';

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
    /Branch:\s*ralph\/([A-Z]+-\d+)/i,
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
  // Pod name persists across all loops in this Ralph session
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
- **Pod Name**: ${podName} - persists for this entire Ralph session
- **Loop Number**: ${iteration} - increments each time Ralph processes a new ticket
- **Agent**: Agent 1 (Linear Reader) - your role in this loop

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
          console.log('Failed to stop GCP instance. Falling back to sleep.');
        }
      } else {
        console.log('Not running on GCP VM. Falling back to sleep.');
      }
    }

    console.log(`Sleeping ${config.noWorkSleepMinutes} minutes...`);
    await sleep(config.noWorkSleepMinutes * 60 * 1000);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTACHMENT DOWNLOAD: Download any attached images/files from the Linear issue
  // ═══════════════════════════════════════════════════════════════════════════
  let attachmentPaths: string[] = [];
  const issueIdentifier = extractIssueIdentifier(agent1Output);

  if (issueIdentifier && config.linearApiKey) {
    console.log('\nDownloading attachments from Linear...');
    try {
      attachmentPaths = await downloadAttachmentsFromAgent1Output(
        config.linearApiKey,
        agent1Output,
        issueIdentifier
      );
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
- **Pod Name**: ${podName} - persists for this entire Ralph session
- **Loop Number**: ${iteration} - increments each time Ralph processes a new ticket
- **Agent**: Agent 2 (Worker) - your role in this loop

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
- **Pod Name**: ${podName} - persists for this entire Ralph session
- **Loop Number**: ${iteration} - increments each time Ralph processes a new ticket
- **Agent**: Agent 3 (Linear Writer) - your role in this loop

**IMPORTANT**: Include the pod name (${podName}) in all comments you post to Linear so that when multiple pods work in parallel, we can identify which one made which comment.

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

export async function main(): Promise<void> {
  const config = getConfig();

  console.log('Ralph v2 starting...');
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

  // Check if Linear is configured and initialized
  if (!config.linearApiKey || !config.linearTeamId) {
    console.log('\n⚠️  Linear configuration missing.');
    console.log('   Set LINEAR_API_KEY and LINEAR_TEAM_KEY environment variables,');
    console.log('   or run initialization wizard.\n');

    const result = await runInitialization();
    if (!result || !result.success) {
      console.log('\nCannot start Ralph without Linear configuration.');
      process.exit(1);
    }

    console.log('\nRestart Ralph to continue.\n');
    process.exit(0);
  }

  // Check if Ralph statuses exist in Linear
  const isInitialized = await checkInitialized(config.linearApiKey, config.linearTeamId);
  if (!isInitialized) {
    console.log('\n⚠️  [RL] statuses not found in Linear.');
    console.log('   Running initialization wizard...\n');

    const result = await runInitialization();
    if (!result || !result.success) {
      console.log('\nFailed to create [RL] statuses. Please check Linear permissions.');
      process.exit(1);
    }
  }

  console.log('   Linear Team: ' + config.linearTeamId);
  console.log('   [RL] Statuses: ✓ configured');

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

  // Generate pod name once at startup - persists for entire Ralph session
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
