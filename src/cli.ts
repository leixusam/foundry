#!/usr/bin/env node

// Parse CLI arguments BEFORE any imports
// (config.ts parses args at module load, so we must check help/version first)
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Foundry - Autonomous Product Development Agent

Usage:
  foundry              Run the main development loop
  foundry init         Initialize Foundry in current project
  foundry --help       Show this help message
  foundry --version    Show version

Environment Variables:
  LINEAR_API_KEY          Linear API key (required)
  LINEAR_TEAM_KEY         Linear team identifier (required)
  FOUNDRY_PROVIDER          "claude" (default) or "codex"
  FOUNDRY_CLAUDE_MODEL      "opus" (default), "sonnet", or "haiku"
  FOUNDRY_MAX_ITERATIONS    Limit iterations (0 = unlimited)

For more information, see https://github.com/leixusam/foundry
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('0.1.0');
  process.exit(0);
}

// Dynamic imports to avoid config.ts being loaded before we check help/version
if (args[0] === 'init') {
  import('./lib/init-project.js').then((m) => m.initProject().catch(console.error));
} else {
  import('./index.js').then((m) => m.main().catch(console.error));
}
