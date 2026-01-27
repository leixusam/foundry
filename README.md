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

Foundry uses three core concepts: **Pods**, **Loops**, and **Agents**.

### Pods, Loops, and Agents

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Pod (swift-wyvern)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Loop 1: Ticket RSK-42                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   Agent 1    │     │   Agent 2    │     │   Agent 3    │            │
│  │    Linear    │────▶│    Worker    │────▶│    Linear    │            │
│  │    Reader    │     │              │     │    Writer    │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                                         │
│  Loop 2: Ticket RSK-43                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   Agent 1    │────▶│   Agent 2    │────▶│   Agent 3    │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                                         │
│  Loop 3: ...                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Pod**: A running instance of Foundry. Each pod gets a unique name (e.g., "swift-wyvern") and continuously processes tickets until stopped. You can run multiple pods in parallel.

- **Loop**: One complete cycle of work. Each loop claims a ticket, works on it, and updates Linear. A pod runs loops continuously until there's no more work.

- **Agent**: An AI worker that handles one part of the loop. Three agents work in sequence to complete each loop.

### The Agent Pipeline

1. **Agent 1 (Linear Reader)**: Scans Linear for available tickets, prioritizes by urgency, **claims** the highest-priority ticket, and gathers context.

2. **Agent 2 (Worker)**: The developer. Reads code, writes code, runs tests, and commits changes.

3. **Agent 3 (Linear Writer)**: Updates Linear with results - posts comments, updates status, and links commits.

### Parallel Execution

Multiple pods can work on the same codebase simultaneously. Foundry prevents conflicts through **ticket claiming**:

1. When Agent 1 finds a ticket to work on, it immediately changes the status to "In Progress"
2. Other pods see this status and skip the ticket
3. Each pod works on different tickets, avoiding collisions

This lets you scale development by running multiple Foundry pods in parallel - on different machines, in CI, or as background processes.

### Linear as State Machine

Foundry uses Linear as its state machine. You don't need to configure Foundry or tell it what to work on - just add tickets to Linear and Foundry handles the rest.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ∞ Needs    │────▶│  ∞ Needs    │────▶│  ∞ Needs    │────▶│  ∞ Needs    │────▶│  ∞ Needs    │
│  Research   │     │    Spec*    │     │    Plan     │     │  Implement  │     │  Validate   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │                   │                   │
       ▼                  ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ ∞ Research  │     │  ∞ Spec In  │     │  ∞ Plan In  │     │∞ Implement  │     │ ∞ Validate  │
│ In Progress │     │  Progress*  │     │  Progress   │     │ In Progress │     │ In Progress │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                                      │
                          * Specification is optional - only when                     ▼
                            research determines UX decisions are needed         ┌─────────────┐
                                                                                │   ∞ Done    │
                                                                                └─────────────┘
```

**How it works:**

1. **You create a ticket** in Linear and set its status to `∞ Needs Research` (or any "Needs" status)
2. **Foundry picks it up** - Agent 1 scans for tickets in "Needs" statuses
3. **Foundry claims it** - Changes status to "In Progress" so other pods skip it
4. **Foundry works on it** - Agent 2 does the actual development work
5. **Foundry advances it** - Agent 3 moves the ticket to the next status
6. **Repeat** until the ticket reaches `∞ Done`

This means you can queue up work by creating tickets, and Foundry will process them in priority order. You can also intervene at any point - move a ticket back to a "Needs" status and Foundry will re-do that step.

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
- `∞ Needs Specification` (optional - when UX decisions are needed)
- `∞ Needs Plan`
- `∞ Needs Implement`
- `∞ Needs Validate`

**In Progress statuses** (Foundry is working):
- `∞ Research In Progress`
- `∞ Specification In Progress`
- `∞ Plan In Progress`
- `∞ Implement In Progress`
- `∞ Validate In Progress`

**Intervention statuses** (requires human action):
- `∞ Blocked` - Agent needs clarification or decision before proceeding

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
