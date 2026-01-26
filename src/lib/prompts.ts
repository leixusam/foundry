import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptsDir = join(__dirname, '../../prompts');

export async function loadPrompt(name: string): Promise<string> {
  const path = join(promptsDir, `${name}.md`);
  return readFile(path, 'utf-8');
}
