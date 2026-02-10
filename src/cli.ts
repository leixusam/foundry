#!/usr/bin/env node

import { getVersion } from './lib/version.js';

// Parse CLI arguments BEFORE any other imports
// (config.ts parses args at module load, so we must check help/version first)
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  const version = getVersion();
  console.log(`
Foundry v${version} - Autonomous Product Development Agent

Usage:
  foundry              Run the main development loop
  foundry config       Configure Foundry settings
  foundry uninstall    Remove Foundry from current project
  foundry --help       Show this help message
  foundry --version    Show version

Environment Variables:
  LINEAR_API_KEY          Linear API key (required)
  LINEAR_TEAM_KEY         Linear team identifier (required)
  FOUNDRY_PROVIDER          "claude" (default) or "codex"
  FOUNDRY_CLAUDE_MODEL      "opus" (default), "sonnet", or "haiku"
  FOUNDRY_MAX_ITERATIONS    Limit iterations (0 = unlimited)
  FOUNDRY_MERGE_MODE        "auto" (default), "merge", or "pr"
  FOUNDRY_WORKFLOW_MODE     "staged" (default) or "oneshot"

For more information, see https://github.com/leixusam/foundry
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(getVersion());
  process.exit(0);
}

// Dynamic imports to avoid config.ts being loaded before we check help/version
if (args[0] === 'config') {
  import('./lib/init-project.js').then((m) => m.configProject().catch(console.error));
} else if (args[0] === 'uninstall') {
  import('./lib/init-project.js').then((m) => m.uninstallProject().catch(console.error));
} else {
  import('./index.js').then((m) => m.main().catch(console.error));
}
