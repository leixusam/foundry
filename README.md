# Foundry - Autonomous Product Development Agent

Foundry is an AI-powered autonomous development system that works on Linear tickets without human intervention. It orchestrates multiple AI agents to research, plan, implement, and validate code changes, all while keeping Linear updated with progress.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @leixusam/foundry
```

Then initialize Foundry in your project:

```bash
cd your-project
foundry init
```

### Local Project Installation

```bash
npm install --save-dev @leixusam/foundry
npx foundry init
```

## Quick Start

1. **Install Foundry** (see above)

2. **Initialize** - Run `foundry init` to:
   - Configure Linear API credentials
   - Set up MCP for Claude Code
   - Install Claude Code slash commands
   - Create the `thoughts/` directory

3. **Create a ticket** in Linear in your team's backlog

4. **Start Foundry**:
   ```bash
   foundry              # Global install
   npx foundry          # Local install
   ```

Foundry will claim the ticket, work on it autonomously, and update Linear with progress.

## How It Works

Foundry runs a continuous loop, processing Linear tickets through a three-agent pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Foundry Loop                                   │
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

After `foundry init`, your project will have:

```
your-project/
├── .foundry/              # Runtime data (gitignored)
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

Set these in `.foundry/env` or export them:

| Variable | Description | Default |
|----------|-------------|---------|
| `LINEAR_API_KEY` | Your Linear API key | (required) |
| `LINEAR_TEAM_KEY` | Linear team identifier (e.g., "RSK") | (required) |
| `FOUNDRY_PROVIDER` | AI provider: "claude" or "codex" | "claude" |
| `FOUNDRY_CLAUDE_MODEL` | Claude model: "opus", "sonnet", "haiku" | "opus" |
| `FOUNDRY_MAX_ITERATIONS` | Stop after N iterations (0 = unlimited) | 0 |

### Using Codex CLI as Provider

When using Codex (`FOUNDRY_PROVIDER=codex`), configure Linear MCP in Codex:

```bash
codex mcp add linear --url https://mcp.linear.app/mcp
```

## CLI Commands

```bash
foundry              # Run the main development loop
foundry init         # Initialize Foundry in current project
foundry --help       # Show help
foundry --version    # Show version
```

## Linear Workflow Statuses

Foundry creates these statuses in Linear:

**Ready statuses** (waiting for Foundry):
- `∞ Needs Research`
- `∞ Needs Plan`
- `∞ Needs Implement`
- `∞ Needs Validate`

**In Progress statuses** (Foundry is working):
- `∞ Research In Progress`
- `∞ Plan In Progress`
- `∞ Implement In Progress`
- `∞ Validate In Progress`

**Terminal statuses**:
- `∞ Done`
- `∞ Canceled`

## Writing Good Tickets

Foundry works best with clear, specific tickets:

**Good ticket**:
> Add a dark mode toggle to the settings page. Should save preference to localStorage and apply a .dark-theme class to the body.

**Tips**:
- Include acceptance criteria when possible
- Reference existing code patterns to follow
- Specify any constraints or requirements
- Link related issues if dependencies exist

## Developing Foundry

If you want to contribute or modify Foundry:

```bash
# Clone the repo
git clone https://github.com/leixusam/foundry
cd foundry

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
