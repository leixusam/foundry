import { getConfig } from './config.js';
import { spawnClaude, extractFinalOutput } from './lib/claude.js';
import { sleep, handleRateLimit } from './lib/rate-limit.js';
import { loadPrompt } from './lib/prompts.js';
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
    model: 'opus',
    allowedTools: ['mcp__linear__*'],
  });

  if (agent1Result.rateLimited) {
    await handleRateLimit(agent1Result.retryAfterMs || 5 * 60 * 1000);
    return;
  }

  // Extract the text output from agent 1
  const agent1Output = extractFinalOutput(agent1Result.output);

  // Check if there's no work (look for the signal in the output)
  if (agent1Output.includes('no_work: true') || agent1Output.includes('NO_WORK')) {
    const config = getConfig();
    console.log('No work available.');
    console.log(`Sleeping ${config.noWorkSleepMinutes} minutes...`);
    await sleep(config.noWorkSleepMinutes * 60 * 1000);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Worker
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 2: Worker starting...');

  // Build worker prompt by combining the base prompt with agent 1's output
  const workerBasePrompt = await loadPrompt('agent2-worker');
  const workerPrompt = `## Context from Linear (gathered by Agent 1)

${agent1Output}

---

${workerBasePrompt}`;

  const agent2Result = await spawnClaude({
    prompt: workerPrompt,
    model: 'opus',
  });

  if (agent2Result.rateLimited) {
    console.log('Agent 2 was rate limited. Will continue to Agent 3 to log status.');
  }

  const agent2Output = extractFinalOutput(agent2Result.output);

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Linear Writer
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\nAgent 3: Linear Writer starting...');

  const writerBasePrompt = await loadPrompt('agent3-linear-writer');
  const writerPrompt = `## Context from Agent 1 (Linear issue details)

${agent1Output}

---

## Results from Agent 2 (Work performed)

${agent2Output}

---

## Session Stats

- Agent 2 Cost: $${agent2Result.cost.toFixed(4)}
- Agent 2 Duration: ${Math.round(agent2Result.duration / 1000)}s
- Agent 2 Exit code: ${agent2Result.exitCode}
- Agent 2 Rate limited: ${agent2Result.rateLimited}

---

${writerBasePrompt}`;

  const agent3Result = await spawnClaude({
    prompt: writerPrompt,
    model: 'haiku',
    allowedTools: ['mcp__linear__*'],
  });

  if (agent3Result.rateLimited) {
    console.log('Agent 3 was rate limited.');
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
