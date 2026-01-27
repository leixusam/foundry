import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Gets the current version from package.json.
 * Reads from the installed package location, not cwd.
 */
export function getVersion(): string {
  try {
    // Get the directory of this module (installed package location)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Navigate up from dist/lib/ to package root
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

/**
 * Gets the package name from package.json.
 */
export function getPackageName(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name;
  } catch {
    return '@leixusam/foundry';
  }
}
