import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../config.js';
import { getLoopInstanceNameDisplay } from './loop-instance-name.js';

/**
 * Stats for a single agent run
 */
export interface AgentStats {
  agentNumber: number;
  agentName: string;
  provider: string;
  model: string;
  tokens: {
    input: number;
    output: number;
    cached: number;
  };
  cost: number;
  costEstimated: boolean;
  maxContextWindowPercent: number;
  compactionCount: number;
  durationSeconds: number;
  exitCode: number;
  rateLimited: boolean;
  completedAt: string;
}

/**
 * Stats for a single loop iteration
 */
export interface LoopStats {
  loopNumber: number;
  loopInstanceName: string;
  startedAt: string;
  completedAt?: string;
  agents: AgentStats[];
  totals: {
    tokens: {
      input: number;
      output: number;
      cached: number;
    };
    cost: number;
    costEstimated: boolean;
    durationSeconds: number;
  };
}

/**
 * Overall stats file structure
 */
export interface PodStats {
  podName: string;
  startedAt: string;
  updatedAt: string;
  loops: LoopStats[];
  grandTotals: {
    loopCount: number;
    tokens: {
      input: number;
      output: number;
      cached: number;
    };
    cost: number;
    costEstimated: boolean;
    durationSeconds: number;
  };
}

// Track current context
let currentLoopName: string | null = null;
let currentLoopNumber: number | null = null;
let currentLoopStartTime: Date | null = null;

/**
 * Gets the stats file path for the current pod
 * Structure: ralph/.output/{loop-name}/stats.json
 */
function getStatsFilePath(): string | null {
  if (!currentLoopName) {
    return null;
  }

  const config = getConfig();
  const outputDir = join(config.workingDirectory, 'ralph', '.output');
  const loopNameDisplay = getLoopInstanceNameDisplay(currentLoopName);

  return join(outputDir, loopNameDisplay, 'stats.json');
}

/**
 * Ensures the directory structure exists for a given file path
 */
async function ensureDir(filePath: string): Promise<void> {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Reads existing stats or creates initial structure
 */
async function readOrCreateStats(): Promise<PodStats | null> {
  const statsPath = getStatsFilePath();
  if (!statsPath || !currentLoopName) {
    return null;
  }

  const loopNameDisplay = getLoopInstanceNameDisplay(currentLoopName);

  try {
    if (existsSync(statsPath)) {
      const content = await readFile(statsPath, 'utf-8');
      return JSON.parse(content) as PodStats;
    }
  } catch {
    // File doesn't exist or is corrupted, create new
  }

  // Create initial stats structure
  return {
    podName: loopNameDisplay,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    loops: [],
    grandTotals: {
      loopCount: 0,
      tokens: { input: 0, output: 0, cached: 0 },
      cost: 0,
      costEstimated: false,
      durationSeconds: 0,
    },
  };
}

/**
 * Writes stats to file
 */
async function writeStats(stats: PodStats): Promise<void> {
  const statsPath = getStatsFilePath();
  if (!statsPath) {
    return;
  }

  try {
    await ensureDir(statsPath);
    stats.updatedAt = new Date().toISOString();
    await writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - stats logging should not interrupt main process
    console.error('Failed to write stats:', error);
  }
}

/**
 * Initializes stats tracking for a new loop iteration
 * Should be called at the start of each loop
 */
export function initLoopStats(loopInstanceName: string, loopNumber: number): void {
  currentLoopName = loopInstanceName;
  currentLoopNumber = loopNumber;
  currentLoopStartTime = new Date();
}

/**
 * Gets the current loop from stats, creating it if needed
 */
function getOrCreateCurrentLoop(stats: PodStats): LoopStats {
  if (currentLoopNumber === null || !currentLoopName || !currentLoopStartTime) {
    throw new Error('Loop stats not initialized');
  }

  let loop = stats.loops.find(l => l.loopNumber === currentLoopNumber);
  if (!loop) {
    loop = {
      loopNumber: currentLoopNumber,
      loopInstanceName: currentLoopName,
      startedAt: currentLoopStartTime.toISOString(),
      agents: [],
      totals: {
        tokens: { input: 0, output: 0, cached: 0 },
        cost: 0,
        costEstimated: false,
        durationSeconds: 0,
      },
    };
    stats.loops.push(loop);
    stats.grandTotals.loopCount = stats.loops.length;
  }

  return loop;
}

/**
 * Recalculates loop totals from agent stats
 */
function recalculateLoopTotals(loop: LoopStats): void {
  loop.totals = {
    tokens: { input: 0, output: 0, cached: 0 },
    cost: 0,
    costEstimated: false,
    durationSeconds: 0,
  };

  for (const agent of loop.agents) {
    loop.totals.tokens.input += agent.tokens.input;
    loop.totals.tokens.output += agent.tokens.output;
    loop.totals.tokens.cached += agent.tokens.cached;
    loop.totals.cost += agent.cost;
    loop.totals.durationSeconds += agent.durationSeconds;
    if (agent.costEstimated) {
      loop.totals.costEstimated = true;
    }
  }
}

/**
 * Recalculates grand totals from all loops
 */
function recalculateGrandTotals(stats: PodStats): void {
  stats.grandTotals = {
    loopCount: stats.loops.length,
    tokens: { input: 0, output: 0, cached: 0 },
    cost: 0,
    costEstimated: false,
    durationSeconds: 0,
  };

  for (const loop of stats.loops) {
    stats.grandTotals.tokens.input += loop.totals.tokens.input;
    stats.grandTotals.tokens.output += loop.totals.tokens.output;
    stats.grandTotals.tokens.cached += loop.totals.tokens.cached;
    stats.grandTotals.cost += loop.totals.cost;
    stats.grandTotals.durationSeconds += loop.totals.durationSeconds;
    if (loop.totals.costEstimated) {
      stats.grandTotals.costEstimated = true;
    }
  }
}

/**
 * Agent name mapping
 */
const AGENT_NAMES: Record<number, string> = {
  1: 'Linear Reader',
  2: 'Worker',
  3: 'Linear Writer',
};

/**
 * Logs stats for a completed agent run
 * Should be called after each agent finishes
 */
export async function logAgentStats(
  agentNumber: number,
  provider: string,
  model: string,
  result: {
    tokenUsage: { input: number; output: number; cached: number };
    cost: number;
    costEstimated: boolean;
    duration: number; // ms
    exitCode: number;
    rateLimited: boolean;
    output: string; // Raw streaming output for extracting context info
  }
): Promise<void> {
  const stats = await readOrCreateStats();
  if (!stats) {
    return;
  }

  const loop = getOrCreateCurrentLoop(stats);

  // Extract max context % and compaction count from raw output
  const { maxContextPercent, compactionCount } = parseContextMetrics(result.output);

  const agentStats: AgentStats = {
    agentNumber,
    agentName: AGENT_NAMES[agentNumber] || `Agent ${agentNumber}`,
    provider,
    model,
    tokens: {
      input: result.tokenUsage.input,
      output: result.tokenUsage.output,
      cached: result.tokenUsage.cached,
    },
    cost: result.cost,
    costEstimated: result.costEstimated,
    maxContextWindowPercent: maxContextPercent,
    compactionCount,
    durationSeconds: Math.round(result.duration / 1000),
    exitCode: result.exitCode,
    rateLimited: result.rateLimited,
    completedAt: new Date().toISOString(),
  };

  // Remove existing stats for this agent number (in case of retry)
  loop.agents = loop.agents.filter(a => a.agentNumber !== agentNumber);
  loop.agents.push(agentStats);

  // Sort by agent number
  loop.agents.sort((a, b) => a.agentNumber - b.agentNumber);

  // Recalculate totals
  recalculateLoopTotals(loop);
  recalculateGrandTotals(stats);

  await writeStats(stats);
}

/**
 * Marks the current loop as completed
 * Should be called at the end of each loop
 */
export async function finalizeLoopStats(): Promise<void> {
  const stats = await readOrCreateStats();
  if (!stats || currentLoopNumber === null) {
    return;
  }

  const loop = stats.loops.find(l => l.loopNumber === currentLoopNumber);
  if (loop) {
    loop.completedAt = new Date().toISOString();
    await writeStats(stats);
  }
}

/**
 * Parses raw streaming output to extract context metrics
 * - maxContextPercent: highest context window usage seen
 * - compactionCount: number of compact_boundary events
 */
function parseContextMetrics(rawOutput: string): {
  maxContextPercent: number;
  compactionCount: number;
} {
  let maxContextPercent = 0;
  let compactionCount = 0;

  const lines = rawOutput.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const json = JSON.parse(line);

      // Count compaction events
      if (json.type === 'system' && json.subtype === 'compact_boundary') {
        compactionCount++;
      }

      // Track max context usage from assistant messages
      if (json.type === 'assistant' && json.message?.usage) {
        const usage = json.message.usage as {
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
        const total = (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
        const pct = Math.floor((total * 100) / 168000); // 168K effective limit
        if (pct > maxContextPercent) {
          maxContextPercent = pct;
        }
      }
    } catch {
      // Not JSON, skip
    }
  }

  return { maxContextPercent, compactionCount };
}
