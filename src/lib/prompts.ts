import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRepoRoot } from '../config.js';

// Get the package directory for fallback prompts
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '../..');

/**
 * Loads a prompt from .foundry/prompts/ (preferred) or package prompts/ (fallback).
 * Supports template variables in the format {{VARIABLE_NAME}}.
 *
 * @param name - Prompt name without .md extension
 * @param variables - Optional object of variable names to values for template substitution
 * @returns The prompt content with variables substituted
 */
export function loadPrompt(name: string, variables?: Record<string, string>): string {
  // Try .foundry/prompts/ first (project-local)
  const projectPromptPath = join(getRepoRoot(), '.foundry', 'prompts', `${name}.md`);

  // Fallback to package prompts/
  const packagePromptPath = join(PACKAGE_ROOT, 'prompts', `${name}.md`);

  let promptPath: string;
  if (existsSync(projectPromptPath)) {
    promptPath = projectPromptPath;
  } else if (existsSync(packagePromptPath)) {
    promptPath = packagePromptPath;
  } else {
    throw new Error(`Prompt not found: ${name}`);
  }

  let content = readFileSync(promptPath, 'utf-8');

  // Substitute template variables
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
  }

  return content;
}

/**
 * Loads a prompt fragment from the fragments/ subdirectory.
 *
 * @param name - Fragment name without .md extension (e.g., 'merge-direct')
 * @returns The fragment content
 */
export function loadPromptFragment(name: string): string {
  // Try .foundry/prompts/fragments/ first
  const projectFragmentPath = join(getRepoRoot(), '.foundry', 'prompts', 'fragments', `${name}.md`);

  // Fallback to package prompts/fragments/
  const packageFragmentPath = join(PACKAGE_ROOT, 'prompts', 'fragments', `${name}.md`);

  let fragmentPath: string;
  if (existsSync(projectFragmentPath)) {
    fragmentPath = projectFragmentPath;
  } else if (existsSync(packageFragmentPath)) {
    fragmentPath = packageFragmentPath;
  } else {
    throw new Error(`Prompt fragment not found: ${name}`);
  }

  return readFileSync(fragmentPath, 'utf-8');
}
