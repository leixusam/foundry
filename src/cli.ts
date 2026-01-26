#!/usr/bin/env node

// Parse CLI arguments BEFORE any imports
// (config.ts parses args at module load, so we must check help/version first)
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Ralph - Autonomous Product Development Agent

Usage:
  ralph              Run the main development loop
  ralph init         Initialize Ralph in current project
  ralph --help       Show this help message
  ralph --version    Show version

Environment Variables:
  LINEAR_API_KEY          Linear API key (required)
  LINEAR_TEAM_KEY         Linear team identifier (required)
  RALPH_PROVIDER          "claude" (default) or "codex"
  RALPH_CLAUDE_MODEL      "opus" (default), "sonnet", or "haiku"
  RALPH_MAX_ITERATIONS    Limit iterations (0 = unlimited)

For more information, see https://github.com/leixusam/ralph-default-files
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('2.0.0');
  process.exit(0);
}

// Dynamic imports to avoid config.ts being loaded before we check help/version
if (args[0] === 'init') {
  import('./lib/init-project.js').then((m) => m.initProject().catch(console.error));
} else {
  import('./index.js').then((m) => m.main().catch(console.error));
}
