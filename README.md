# Ralph - Autonomous Product Development Agent

Ralph is an AI-powered autonomous development system that works on Linear tickets without human intervention. It orchestrates multiple AI agents to research, plan, implement, and validate code changes, all while keeping Linear updated with progress.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @leixusam/ralph
```

Then initialize Ralph in your project:

```bash
cd your-project
ralph init
```

### Local Project Installation

```bash
npm install --save-dev @leixusam/ralph
npx ralph init
```

## Quick Start

1. **Install Ralph** (see above)

2. **Initialize** - Run `ralph init` to:
   - Configure Linear API credentials
   - Set up MCP for Claude Code
   - Install Claude Code slash commands
   - Create the `thoughts/` directory

3. **Create a ticket** in Linear in your team's backlog

4. **Start Ralph**:
   ```bash
   ralph              # Global install
   npx ralph          # Local install
   ```

Ralph will claim the ticket, work on it autonomously, and update Linear with progress.

## How It Works

Ralph runs a continuous loop, processing Linear tickets through a three-agent pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Ralph Loop                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   │   Agent 1    │     │   Agent 2    │     │   Agent 3    │            │
│   │    Linear    │────▶│    Worker    │────▶│    Linear    │            │
│   │    Reader    │     │              │     │    Writer    │            │
│   └──────────────┘     └──────────────┘     └──────────────┘            │
│         │                    │                    │                      │
│         ▼                    ▼                    ▼                      │
│   Scans Linear,        Executes work:       Updates Linear:             │
│   claims tickets,      - Research           - Posts comments            │
│   gathers context      - Plan               - Updates status            │
│                        - Implement          - Links artifacts           │
│                        - Validate                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Agent Pipeline

1. **Agent 1 (Linear Reader)**: Queries Linear for available tickets, prioritizes work, claims the most important ticket, and gathers context.

2. **Agent 2 (Worker)**: The actual developer. Reads code, writes code, runs tests, and commits changes.

3. **Agent 3 (Linear Writer)**: Updates Linear with results - posts detailed comments, updates ticket status, and links to commits.

## Directory Structure

After `ralph init`, your project will have:

```
your-project/
├── .ralph/                # Runtime data (gitignored)
│   ├── env                # Configuration and credentials
│   ├── mcp.json           # MCP configuration for Claude Code
│   ├── output/            # Runtime logs
│   └── attachments/       # Downloaded issue attachments
├── .claude/commands/      # Claude Code slash commands
├── thoughts/              # Work artifacts (committed)
│   ├── research/          # Research documents
│   ├── plans/             # Implementation plans
│   └── validation/        # Validation reports
└── CLAUDE.md              # Your project's Claude instructions
```

## Configuration

### Environment Variables

Set these in `.ralph/env` or export them:

| Variable | Description | Default |
|----------|-------------|---------|
| `LINEAR_API_KEY` | Your Linear API key | (required) |
| `LINEAR_TEAM_KEY` | Linear team identifier (e.g., "RSK") | (required) |
| `RALPH_PROVIDER` | AI provider: "claude" or "codex" | "claude" |
| `RALPH_CLAUDE_MODEL` | Claude model: "opus", "sonnet", "haiku" | "opus" |
| `RALPH_MAX_ITERATIONS` | Stop after N iterations (0 = unlimited) | 0 |

### Using Codex CLI as Provider

When using Codex (`RALPH_PROVIDER=codex`), configure Linear MCP in Codex:

```bash
codex mcp add linear --url https://mcp.linear.app/mcp
```

## CLI Commands

```bash
ralph              # Run the main development loop
ralph init         # Initialize Ralph in current project
ralph --help       # Show help
ralph --version    # Show version
```

## Linear Workflow Statuses

Ralph creates these statuses in Linear:

**Ready statuses** (waiting for Ralph):
- `[RL] Needs Research`
- `[RL] Needs Plan`
- `[RL] Needs Implement`
- `[RL] Needs Validate`

**In Progress statuses** (Ralph is working):
- `[RL] Research In Progress`
- `[RL] Plan In Progress`
- `[RL] Implement In Progress`
- `[RL] Validate In Progress`

**Terminal statuses**:
- `[RL] Done`
- `[RL] Canceled`

## Writing Good Tickets

Ralph works best with clear, specific tickets:

**Good ticket**:
> Add a dark mode toggle to the settings page. Should save preference to localStorage and apply a .dark-theme class to the body.

**Tips**:
- Include acceptance criteria when possible
- Reference existing code patterns to follow
- Specify any constraints or requirements
- Link related issues if dependencies exist

## Developing Ralph

If you want to contribute or modify Ralph:

```bash
# Clone the repo
git clone https://github.com/leixusam/ralph-default-files
cd ralph-default-files

# Install dependencies
npm install

# Build
npm run build

# Run from source
npm start

# Type check
npm run typecheck
```

## Prerequisites

- Node.js 18+
- [Claude Code](https://claude.ai/claude-code) or Codex CLI installed
- A Linear account with API access
- Git repository initialized

## License

MIT
