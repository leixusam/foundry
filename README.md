# Foundry - Autonomous Product Development Agent

Foundry is an AI-powered autonomous development system that works on Linear tickets without human intervention. It orchestrates multiple AI agents to research, plan, implement, and validate code changes, all while keeping Linear updated with progress.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @leixusam/foundry
```

### Local Project Installation

```bash
npm install --save-dev @leixusam/foundry
```

## Quick Start

1. **Install Foundry** (see above)

2. **Run Foundry**:
   ```bash
   cd your-project
   foundry              # Global install
   npx foundry          # Local install
   ```

3. **First-run setup** - On first run, Foundry will:
   - Prompt for your Linear API key
   - Auto-detect your Linear team
   - Create necessary directories and configuration
   - Start the development loop

4. **Create tickets** in Linear and Foundry will work on them autonomously

For advanced configuration, run `foundry config` to change settings like provider, model, and iteration limits.

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

After running Foundry, your project will have:

```
your-project/
├── .foundry/              # Runtime data (gitignored)
│   ├── env                # Configuration and credentials
│   ├── mcp.json           # MCP configuration for Claude Code
│   ├── output/            # Runtime logs
│   └── attachments/       # Downloaded issue attachments
├── foundry-docs/          # Work artifacts (committed)
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
| `FOUNDRY_MERGE_MODE` | Merge mode: "merge" or "pr" | "merge" |

### Merge Modes

Foundry supports two modes for completing work:

**Direct Merge (default)**
```bash
export FOUNDRY_MERGE_MODE=merge
```
Foundry merges completed work directly to main. Best for trusted autonomous operation.

**Pull Request Mode**
```bash
export FOUNDRY_MERGE_MODE=pr
```
Foundry creates a pull request instead of merging. The ticket moves to `∞ Awaiting Merge` status until a human reviews and merges the PR. Best for teams that want human oversight.

### Using Codex CLI as Provider

When using Codex (`FOUNDRY_PROVIDER=codex`), configure Linear MCP in Codex:

```bash
codex mcp add linear --url https://mcp.linear.app/mcp
```

## CLI Commands

```bash
foundry              # Run the main development loop
foundry config       # Configure Foundry settings
foundry uninstall    # Remove Foundry from current project
foundry --help       # Show help
foundry --version    # Show version
```

## Updates

Foundry automatically checks for updates once per day. When a new version is available, you'll see a notification on startup:

```
   Update available: 0.1.3 → 0.1.4
   Run: npm install -g @leixusam/foundry@latest
```

Update with:

```bash
npm install -g @leixusam/foundry@latest
```

## Releasing (Maintainers)

Releases are performed via GitHub Actions.

### Preflight

1. Confirm GitHub repo secrets:
   - `NPM_TOKEN` (required): npm publish token with access to publish `@leixusam/foundry`.
   - `RELEASE_TOKEN` (optional): GitHub token/PAT with `contents: write` in case `github.token` can’t push to `main` due to branch protections (also used to create the GitHub Release).
2. Confirm no other release run is in progress (the workflow uses `concurrency: release`).

### Optional: dry run (CI gates only)

1. GitHub → Actions → `Release` → Run workflow (branch: `main`)
2. Inputs:
   - `release_type`: `patch`
   - `npm_tag`: `latest`
   - `dry_run`: `true`
3. Expectation: build/typecheck/tests run and pass; **no** version bump commit, tag, GitHub Release, or npm publish is created.

### Patch release

1. GitHub → Actions → `Release` → Run workflow (branch: `main`)
2. Inputs:
   - `release_type`: `patch` (or `minor` / `major`)
   - `npm_tag`: `latest` (or another intended dist-tag)
   - `dry_run`: `false`
3. Expected outputs:
   - A commit on `main` with message like `chore(release): vX.Y.Z`
   - A git tag `vX.Y.Z` pushed to the repo
   - A GitHub Release created for `vX.Y.Z` (auto-generated notes)
   - `@leixusam/foundry@X.Y.Z` published to npm under the chosen dist-tag

### Recovery (partial failures)

- **Tag exists but npm publish failed**: GitHub → Actions → `Publish existing ref to npm`
  - `ref`: the tag (e.g. `vX.Y.Z`)
  - `npm_tag`: the intended dist-tag (default `latest`)
- **npm publish succeeded but GitHub Release creation failed**: create a GitHub Release from the existing tag (UI or `gh release create vX.Y.Z --generate-notes`).

### Rollback (only if necessary)

If a tag was created but should not exist (and npm publish did not occur):

```bash
git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z
```

Delete the GitHub Release for that tag in the UI if one was created.

### Local parity checks (optional)

```bash
npm ci
npm run build
npm run typecheck
npm test
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
- `∞ Awaiting Merge` - Work complete, PR awaiting human review/merge (PR mode only)

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

## Acknowledgments

Foundry builds on ideas and techniques from the AI engineering community:

- **[Dex Horthy](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)** - For the research/plan/implement pattern that structures how Foundry approaches work
- **[Geoff Huntley](https://ghuntley.com/ralph/)** - For the Ralph Wiggum technique that inspires Foundry's autonomous agent approach
- **[Vaibhav @ BoundaryML](https://boundaryml.com/podcast)** - For BAML and the "AI That Works" podcast series on building reliable AI systems

## License

MIT
