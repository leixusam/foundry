import { getConfig } from './config.js';
import { spawnClaude } from './lib/claude.js';
import { sleep, handleRateLimit } from './lib/rate-limit.js';
import { parseDispatchResult, parseWorkResult, parseLinearUpdate } from './lib/parsers.js';
import { loadPrompt, buildWorkerPrompt, buildWriterPrompt } from './lib/prompts.js';
import { gitSafetyNetPush, getCurrentBranch } from './lib/git.js';

async function runLoop(iteration: number): Promise<void> {
  console.log(`\n${'='.repeat(24)} LOOP ${iteration} ${'='.repeat(24)}\n`);
  const loopStart = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 1: Linear Reader
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Agent 1: Linear Reader starting...');

  const agent1Prompt = await loadPrompt('agent1-linear-reader');
  const agent1Result = await spawnClaude({
    prompt: agent1Prompt,
    model: 'sonnet',
    allowedTools: ['mcp__linear__*'],
  });

  if (agent1Result.rateLimited) {
    await handleRateLimit(agent1Result.retryAfterMs || 5 * 60 * 1000);
    return; // Retry loop
  }

  const dispatch = parseDispatchResult(agent1Result.output);

  if (!dispatch) {
    console.log('Could not parse Agent 1 output. Sleeping 1 minute...');
    await sleep(60 * 1000);
    return;
  }

  if (dispatch.noWork) {
    const config = getConfig();
    console.log(`No work available: ${dispatch.reason || 'unknown'}`);
    console.log(`Sleeping ${config.noWorkSleepMinutes} minutes...`);
    await sleep(config.noWorkSleepMinutes * 60 * 1000);
    return;
  }

  console.log(`Selected: ${dispatch.issueIdentifier} - ${dispatch.issueTitle}`);
  console.log(`   Stage: ${dispatch.stage}`);
  console.log(`   Priority: ${dispatch.priority}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Worker
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\nAgent 2: ${dispatch.stage} Worker starting...`);

  const workerPrompt = await buildWorkerPrompt(dispatch);

  const agent2Result = await spawnClaude({
    prompt: workerPrompt,
    model: 'opus',
    // Worker gets all tools EXCEPT Linear
    allowedTools: undefined, // All tools, Linear is blocked by not providing MCP config
  });

  // Even if rate limited, we continue to Agent 3 to log the issue
  const workResult = parseWorkResult(agent2Result.output);

  if (workResult) {
    console.log(`   Success: ${workResult.success}`);
    console.log(`   Artifact: ${workResult.artifactPath || 'none'}`);
    if (workResult.commitHash) {
      console.log(`   Commit: ${workResult.commitHash}`);
    }
  } else {
    console.log('   Could not parse work result');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Linear Writer
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 3: Linear Writer starting...');

  const writerPrompt = await buildWriterPrompt(dispatch, workResult, agent2Result);

  const agent3Result = await spawnClaude({
    prompt: writerPrompt,
    model: 'haiku',
    allowedTools: ['mcp__linear__*'],
  });

  const linearUpdate = parseLinearUpdate(agent3Result.output);

  if (linearUpdate) {
    console.log(`   Comment posted: ${linearUpdate.commentPosted}`);
    console.log(`   Status updated: ${linearUpdate.statusUpdated}`);
    if (linearUpdate.newStatus) {
      console.log(`   New status: ${linearUpdate.newStatus}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE.JS: Safety Net
  // ═══════════════════════════════════════════════════════════════════════════
  const safetyNetResult = await gitSafetyNetPush(iteration);

  if (safetyNetResult.pushed) {
    console.log(`\nSAFETY NET: Pushed uncommitted changes`);
    console.log(`   Commit: ${safetyNetResult.commitHash}`);
    console.log(`   This should be rare - investigate if it happens frequently`);
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

  let iteration = 0;

  while (true) {
    try {
      await runLoop(iteration);
      iteration++;
    } catch (error) {
      console.error(`\nLoop ${iteration} error:`, error);
      console.log(`Sleeping ${config.errorSleepMinutes} minute(s) before retry...`);
      await sleep(config.errorSleepMinutes * 60 * 1000);
    }
  }
}

main().catch(console.error);
