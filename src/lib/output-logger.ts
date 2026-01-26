import { mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../config.js';

// Track current logging context
let currentPodName: string | null = null;
let currentLoopNumber: number | null = null;

/**
 * Gets the base output directory path (.foundry/output/ in the working directory)
 * Output lives inside the .foundry folder which contains all Foundry runtime data.
 */
function getOutputDir(): string {
  const config = getConfig();
  return join(config.workingDirectory, '.foundry', 'output');
}

/**
 * Gets the log file path for a specific agent (raw LLM JSON output)
 * Structure: .foundry/output/{pod-name}/loop-{n}/agent-{n}.log
 */
function getAgentLogPath(agentNumber: number): string | null {
  if (!currentPodName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();

  return join(
    outputDir,
    currentPodName,
    `loop-${currentLoopNumber}`,
    `agent-${agentNumber}.log`
  );
}

/**
 * Gets the terminal log file path for a specific agent (formatted shell output)
 * Structure: .foundry/output/{pod-name}/loop-{n}/agent-{n}-terminal.log
 */
function getAgentTerminalLogPath(agentNumber: number): string | null {
  if (!currentPodName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();

  return join(
    outputDir,
    currentPodName,
    `loop-${currentLoopNumber}`,
    `agent-${agentNumber}-terminal.log`
  );
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
 * Initializes the output logger for a new loop iteration
 * @param podName - The pod name (e.g., "arctic-lynx") - persists for entire session
 * @param loopNumber - The loop iteration number (0, 1, 2, ...)
 */
export function initLoopLogger(podName: string, loopNumber: number): void {
  currentPodName = podName;
  currentLoopNumber = loopNumber;
}

/**
 * Logs a line of output for a specific agent (raw LLM JSON)
 * @param agentNumber - The agent number (1, 2, or 3)
 * @param line - The raw line of output to log (typically JSON from Claude)
 */
export async function logAgentOutput(agentNumber: number, line: string): Promise<void> {
  const logPath = getAgentLogPath(agentNumber);
  if (!logPath) {
    // Logger not initialized, skip logging
    return;
  }

  try {
    await ensureDir(logPath);
    await appendFile(logPath, line + '\n', 'utf-8');
  } catch (error) {
    // Silently fail - logging should not interrupt the main process
  }
}

/**
 * Logs terminal output for a specific agent (formatted shell output)
 * @param agentNumber - The agent number (1, 2, or 3)
 * @param text - The formatted text that was printed to the terminal
 */
export async function logTerminalOutput(agentNumber: number, text: string): Promise<void> {
  const logPath = getAgentTerminalLogPath(agentNumber);
  if (!logPath) {
    // Logger not initialized, skip logging
    return;
  }

  try {
    await ensureDir(logPath);
    await appendFile(logPath, text + '\n', 'utf-8');
  } catch (error) {
    // Silently fail - logging should not interrupt the main process
  }
}

/**
 * Gets the current output directory for diagnostics
 */
export function getCurrentOutputDir(): string | null {
  if (!currentPodName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();

  return join(outputDir, currentPodName, `loop-${currentLoopNumber}`);
}
