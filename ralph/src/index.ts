import { getConfig } from './config.js';
import { sleep, handleRateLimit } from './lib/rate-limit.js';
import { loadPrompt } from './lib/prompts.js';
import { getCurrentBranch } from './lib/git.js';
import { generatePodName } from './lib/loop-instance-name.js';
import { initLoopLogger, getCurrentOutputDir } from './lib/output-logger.js';
import { createProvider, ProviderResult } from './lib/provider.js';
import { checkInitialized, runInitialization } from './init.js';

// Import providers to register them
import './lib/claude.js';
import './lib/codex.js';

async function runLoop(podName: string, iteration: number): Promise<void> {
  const config = getConfig();

  // Initialize output logger for this loop iteration
  // Pod name persists across all loops in this Ralph session
  initLoopLogger(podName, iteration);

  console.log(`\n${'='.repeat(24)} LOOP ${iteration} ${'='.repeat(24)}`);
  console.log(`Pod: ${podName}`);
  console.log(`Provider: ${config.provider} (Agent 2 only)`);
  if (config.provider === 'codex') {
    console.log(`Codex Model: ${config.codexModel}`);
    console.log(`Reasoning Effort: ${config.codexReasoningEffort}`);
  } else {
    console.log(`Claude Model: ${config.claudeModel}`);
  }
  console.log(`Output Dir: ${getCurrentOutputDir()}\n`);
  const loopStart = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 1: Linear Reader (always Claude for cost efficiency)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Agent 1: Linear Reader starting...');

  const agent1Provider = createProvider('claude');
  const agent1BasePrompt = await loadPrompt('agent1-linear-reader');
  const agent1Prompt = `## Agent Instance

You are part of pod: **${podName}** / Loop ${iteration} / Agent 1 (Linear Reader)

This identifier format is: Pod Name / Loop Number / Agent Number (Role).
- **Pod Name**: ${podName} - persists for this entire Ralph session
- **Loop Number**: ${iteration} - increments each time Ralph processes a new ticket
- **Agent**: Agent 1 (Linear Reader) - your role in this loop

---

${agent1BasePrompt}`;
  const agent1Result = await agent1Provider.spawn({
    prompt: agent1Prompt,
    model: 'opus', // Use opus for best reasoning on issue selection and prioritization
    allowedTools: ['mcp__linear__*'],
  }, 1);

  if (agent1Result.rateLimited) {
    await handleRateLimit(agent1Result.retryAfterMs || 5 * 60 * 1000);
    return;
  }

  // Extract the text output from agent 1
  const agent1Output = agent1Result.finalOutput;

  // Check if there's no work (look for the signal in the output)
  if (agent1Output.includes('no_work: true') || agent1Output.includes('NO_WORK')) {
    console.log('No work available.');
    console.log(`Sleeping ${config.noWorkSleepMinutes} minutes...`);
    await sleep(config.noWorkSleepMinutes * 60 * 1000);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Worker (uses configured provider - Claude or Codex)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 2: Worker starting...');

  // Use configured provider for Agent 2
  const agent2Provider = createProvider(config.provider);

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

---

${workerBasePrompt}`;

  let agent2Result: ProviderResult;
  if (config.provider === 'codex') {
    agent2Result = await agent2Provider.spawn({
      prompt: workerPrompt,
      model: config.codexModel,
      reasoningEffort: config.codexReasoningEffort,
    }, 2);
  } else {
    agent2Result = await agent2Provider.spawn({
      prompt: workerPrompt,
      model: config.claudeModel,
    }, 2);
  }

  if (agent2Result.rateLimited) {
    console.log('Agent 2 was rate limited. Will continue to Agent 3 to log status.');
  }

  const agent2Output = agent2Result.finalOutput;

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Linear Writer (always Claude for cost efficiency)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 3: Linear Writer starting...');

  const agent3Provider = createProvider('claude');
  const writerBasePrompt = await loadPrompt('agent3-linear-writer');

  // Format cost string with estimated marker for Codex
  const costStr = agent2Result.costEstimated
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
- Model: opus
- Cost: $${agent1Result.cost.toFixed(4)}
- Duration: ${Math.round(agent1Result.duration / 1000)}s
- Tokens: in=${agent1Result.tokenUsage.input.toLocaleString()} out=${agent1Result.tokenUsage.output.toLocaleString()} cached=${agent1Result.tokenUsage.cached.toLocaleString()}

### Agent 2 (Worker)
- Provider: ${config.provider}
- Model: ${config.provider === 'codex' ? config.codexModel : config.claudeModel}
- Cost: ${costStr}
- Duration: ${Math.round(agent2Result.duration / 1000)}s
- Tokens: in=${agent2Result.tokenUsage.input.toLocaleString()} out=${agent2Result.tokenUsage.output.toLocaleString()} cached=${agent2Result.tokenUsage.cached.toLocaleString()}
- Exit code: ${agent2Result.exitCode}
- Rate limited: ${agent2Result.rateLimited}

### Loop Totals (Agent 1 + Agent 2)
- Total Cost: $${(agent1Result.cost + agent2Result.cost).toFixed(4)}${agent2Result.costEstimated ? ' (includes estimate)' : ''}
- Total Duration: ${Math.round((agent1Result.duration + agent2Result.duration) / 1000)}s
- Total Tokens: in=${(agent1Result.tokenUsage.input + agent2Result.tokenUsage.input).toLocaleString()} out=${(agent1Result.tokenUsage.output + agent2Result.tokenUsage.output).toLocaleString()} cached=${(agent1Result.tokenUsage.cached + agent2Result.tokenUsage.cached).toLocaleString()}

---

${writerBasePrompt}`;

  const agent3Result = await agent3Provider.spawn({
    prompt: writerPrompt,
    model: 'sonnet', // Use sonnet for better quality Linear updates
    allowedTools: ['mcp__linear__*'],
  }, 3);

  if (agent3Result.rateLimited) {
    console.log('Agent 3 was rate limited.');
  }

  // Loop stats
  const duration = Math.round((Date.now() - loopStart) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  console.log(`\nLoop ${iteration} complete in ${minutes}m ${seconds}s`);
}

async function main(): Promise<void> {
  const config = getConfig();

  console.log('Ralph v2 starting...');
  console.log(`   Working directory: ${config.workingDirectory}`);
  console.log(`   Branch: ${getCurrentBranch()}`);
  console.log(`   Provider: ${config.provider}`);
  if (config.provider === 'codex') {
    console.log(`   Codex Model: ${config.codexModel}`);
    console.log(`   Reasoning Effort: ${config.codexReasoningEffort}`);
  } else {
    console.log(`   Claude Model: ${config.claudeModel}`);
  }
  if (config.maxIterations > 0) {
    console.log(`   Max Iterations: ${config.maxIterations}`);
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

main().catch(console.error);
