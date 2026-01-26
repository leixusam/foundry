import { mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../config.js';
import { getLoopInstanceNameDisplay } from './loop-instance-name.js';

// Track current logging context
let currentLoopName: string | null = null;
let currentLoopNumber: number | null = null;

/**
 * Gets the base output directory path (ralph/.output/ in the working directory)
 * Output lives inside the ralph folder since Ralph is designed as a plugin
 * that gets added to project folders - keeps parent project root clean.
 */
function getOutputDir(): string {
  const config = getConfig();
  return join(config.workingDirectory, 'ralph', '.output');
}

/**
 * Gets the log file path for a specific agent (raw LLM JSON output)
 * Structure: ralph/.output/{loop-name}/{loop-number}/agent-{n}.log
 */
function getAgentLogPath(agentNumber: number): string | null {
  if (!currentLoopName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();
  // Use the human-readable part of the agent name (e.g., "arctic-lynx" from "arctic-lynx-1234567")
  const loopNameDisplay = getLoopInstanceNameDisplay(currentLoopName);

  return join(
    outputDir,
    loopNameDisplay,
    `loop-${currentLoopNumber}`,
    `agent-${agentNumber}.log`
  );
}

/**
 * Gets the terminal log file path for a specific agent (formatted shell output)
 * Structure: ralph/.output/{loop-name}/{loop-number}/agent-{n}-terminal.log
 */
function getAgentTerminalLogPath(agentNumber: number): string | null {
  if (!currentLoopName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();
  const loopNameDisplay = getLoopInstanceNameDisplay(currentLoopName);

  return join(
    outputDir,
    loopNameDisplay,
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
 * @param loopInstanceName - The full loop instance name (e.g., "arctic-lynx-1234567")
 * @param loopNumber - The loop iteration number (0, 1, 2, ...)
 */
export function initLoopLogger(loopInstanceName: string, loopNumber: number): void {
  currentLoopName = loopInstanceName;
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
  if (!currentLoopName || currentLoopNumber === null) {
    return null;
  }

  const outputDir = getOutputDir();
  const loopNameDisplay = getLoopInstanceNameDisplay(currentLoopName);

  return join(outputDir, loopNameDisplay, `loop-${currentLoopNumber}`);
}
