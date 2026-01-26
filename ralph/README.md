# Ralph - Autonomous Product Development System

Ralph is an AI-powered autonomous development system that works on Linear tickets without human intervention. It orchestrates multiple AI agents to research, plan, implement, and validate code changes, all while keeping Linear updated with progress.

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

1. **Agent 1 (Linear Reader)**: Queries Linear for available tickets, prioritizes work, claims the most important ticket, and gathers all context needed for the worker.

2. **Agent 2 (Worker)**: The actual developer. Reads code, writes code, runs tests, and commits changes. Works through multiple stages depending on ticket complexity.

3. **Agent 3 (Linear Writer)**: Updates Linear with results - posts detailed comments, updates ticket status, and links to commits and branches.

### Workflow Stages

Ralph supports two workflow types:

**Oneshot** (simple tasks):
- Single-stage completion
- For small bugs, chores, documentation
- Merges directly to main when done

**Staged** (complex features):
- Research → Specification → Plan → Implement → Validate
- Each stage produces artifacts in `thoughts/` directory
- Multiple Linear status transitions
- Thorough validation before merge

## Prerequisites

- Node.js 18+
- [Claude Code](https://claude.ai/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- A Linear account with API access
- Git repository initialized

## Quick Start

### 1. Copy Ralph to Your Project

Copy the entire `ralph/` folder into your project root:

```bash
cp -r /path/to/ralph-default-files/ralph /your/project/ralph
```

### 2. Install Dependencies

```bash
cd ralph
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Run the Initialization Wizard

Start Ralph - it will detect missing configuration and launch the setup wizard:

```bash
npm start
```

The wizard will:
1. Prompt for your Linear API key
2. Ask which Linear team to work with
3. Create the required `[RL]` workflow statuses in Linear
4. Save configuration to `.ralph.env`

### 5. Create Your First Ticket

In Linear, create a ticket in your team's backlog. Ralph will pick it up on the next loop iteration.

## Directory Structure

After setup, your project will have:

```
your-project/
├── ralph/                 # Ralph autonomous system
│   ├── src/               # TypeScript source code
│   ├── prompts/           # Agent prompt templates
│   ├── dist/              # Compiled JavaScript
│   ├── .output/           # Runtime logs (gitignored)
│   └── package.json
├── thoughts/              # Ralph's work artifacts
│   ├── research/          # Research documents
│   ├── plans/             # Implementation plans
│   ├── specifications/    # UX specifications
│   ├── validation/        # Validation reports
│   ├── oneshot/           # Oneshot task records
│   └── shared/            # Shared context
├── .ralph.env             # Linear configuration (gitignored)
└── CLAUDE.md              # Claude Code project instructions
```

## Configuration

### Environment Variables

Set these in `.ralph.env` or export them:

| Variable | Description | Default |
|----------|-------------|---------|
| `LINEAR_API_KEY` | Your Linear API key | (required) |
| `LINEAR_TEAM_KEY` | Linear team identifier (e.g., "ENG") | (required) |
| `RALPH_PROVIDER` | AI provider: "claude" or "codex" | "claude" |
| `RALPH_CLAUDE_MODEL` | Claude model: "opus", "sonnet", "haiku" | "opus" |
| `RALPH_MAX_ITERATIONS` | Stop after N iterations (0 = unlimited) | 0 |

### Using Codex CLI as Provider

When using Codex as the provider (`--provider codex` or `RALPH_PROVIDER=codex`), you must configure Linear MCP in Codex:

```bash
# Add Linear MCP to Codex configuration
codex mcp add linear --url https://mcp.linear.app/mcp

# Verify Linear MCP is configured
codex mcp list
```

Ralph will check for Linear MCP configuration at startup and show a helpful error if it's missing.

**Note**: Codex CLI uses global MCP configuration (`~/.codex/config.toml`) rather than per-session tool restriction like Claude Code. All three agents will have access to all configured MCP tools when using Codex, but they are prompted to only use Linear tools for Agents 1 and 3.

### Linear Workflow Statuses

Ralph creates these statuses in Linear:

**Ready statuses** (waiting for Ralph to pick up):
- `[RL] Needs Research`
- `[RL] Needs Specification`
- `[RL] Needs Plan`
- `[RL] Needs Implement`
- `[RL] Needs Validate`

**In Progress statuses** (Ralph is actively working):
- `[RL] Research In Progress`
- `[RL] Specification In Progress`
- `[RL] Plan In Progress`
- `[RL] Implement In Progress`
- `[RL] Validate In Progress`
- `[RL] Oneshot In Progress`

**Terminal statuses**:
- `[RL] Done`
- `[RL] Canceled`

## Usage

### Starting Ralph

```bash
cd ralph
npm start
```

Ralph will:
1. Start the main loop
2. Generate a unique pod name (e.g., `crystal-tiger`)
3. Begin scanning Linear for work
4. Process tickets autonomously

### Monitoring Progress

- **Terminal**: Ralph logs all activity to stdout
- **Linear**: Check ticket comments for detailed progress
- **Output folder**: See `ralph/.output/` for full logs
- **Thoughts folder**: See `thoughts/` for research and plans

### Stopping Ralph

Press `Ctrl+C` to stop gracefully. Ralph will complete the current loop before exiting.

## Writing Good Tickets

Ralph works best with clear, specific tickets:

**Good ticket**:
> Add a dark mode toggle to the settings page. Should save preference to localStorage and apply a .dark-theme class to the body.

**Okay ticket**:
> Add dark mode to settings

**Poor ticket**:
> Make the app look better

Tips:
- Include acceptance criteria when possible
- Reference existing code patterns to follow
- Specify any constraints or requirements
- Link related issues if dependencies exist

## Artifacts

Ralph creates artifacts in the `thoughts/` directory:

- **Research docs**: Understanding of the problem and codebase
- **Specifications**: UX and interaction design (for complex features)
- **Plans**: Step-by-step implementation plans
- **Validation reports**: Test results and verification

These artifacts are committed to git, providing a record of Ralph's reasoning.

## Branch and Commit Strategy

- Ralph creates branches named `ralph/{ticket-id}` (e.g., `ralph/RSK-123`)
- Each stage commits its artifacts
- Oneshot and validate stages merge to main automatically
- Complex conflicts are flagged for human resolution

## Parallel Execution

Multiple Ralph instances (pods) can run simultaneously:
- Each pod has a unique name
- Pods coordinate via Linear status updates
- Stale claims are automatically released after 4 hours

## Troubleshooting

### Ralph isn't picking up tickets

1. Check that tickets are in a backlog status
2. Verify Linear API key has write access
3. Ensure `[RL]` statuses exist in your team

### Rate limiting

Ralph handles Anthropic rate limits automatically by waiting and retrying.

### Merge conflicts

When Ralph can't merge automatically, it:
1. Sets ticket status to "Blocked"
2. Posts a comment with conflict details
3. Waits for human resolution

## License

MIT
