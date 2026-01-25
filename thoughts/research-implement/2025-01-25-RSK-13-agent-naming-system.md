# RSK-13: Agent Loop Naming System

## Overview

This document describes the implementation of a naming system for agent loops, allowing multiple parallel agents to be distinguished in Linear comments.

## Problem

When multiple Ralph agents run in parallel on the same repository, there was no way to identify which agent instance made which comment in Linear. This made it difficult to debug issues and understand the attribution of work.

## Solution

### Naming Format

Each loop instance gets a unique name in the format:
```
{adjective}-{animal}-{timestamp}
```

Example: `red-giraffe-1737848125`

The timestamp is Unix seconds, ensuring uniqueness. The adjective + animal combination provides a human-friendly, memorable identifier.

### Word Lists

**Adjectives (24 words):**
- Colors: red, blue, green, purple, orange, yellow, silver, golden
- Traits: swift, calm, bold, wise, keen, bright, quick, steady
- Themes: cosmic, lunar, solar, stellar, crystal, mystic, arctic, tropic

**Animals (24 words):**
- Real: giraffe, zebra, falcon, otter, panda, koala, eagle, dolphin, tiger, wolf, bear, hawk, owl, fox, lynx, raven
- Mythical: phoenix, dragon, griffin, unicorn, pegasus, sphinx, hydra, kraken

With 24 × 24 = 576 combinations plus timestamps, collisions are virtually impossible.

## Implementation

### Files Changed

1. **ralph/src/lib/agent-name.ts** (NEW)
   - `generateAgentName()`: Generates unique names using word lists + timestamp
   - `getAgentNameDisplay()`: Extracts human-readable part without timestamp

2. **ralph/src/index.ts**
   - Generates agent name at the start of each loop
   - Passes agent name to all three agents via their prompts
   - Logs agent name to console

3. **ralph/prompts/agent1-linear-reader.md**
   - Updated claim comment format to include agent name

4. **ralph/prompts/agent3-linear-writer.md**
   - Updated success/failure comment formats to include agent name

### How Names Flow Through the System

```
                    ┌────────────────────────────────────┐
                    │    Loop starts                     │
                    │    agentName = generateAgentName() │
                    │    e.g., "red-giraffe-1737848125"  │
                    └────────────────────────────────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │    Agent 1      │   │    Agent 2      │   │    Agent 3      │
    │ (Linear Reader) │   │    (Worker)     │   │ (Linear Writer) │
    │                 │   │                 │   │                 │
    │ Posts comment:  │   │ Knows its name  │   │ Posts comment:  │
    │ "Agent Claimed  │   │ for logging     │   │ "Stage Complete │
    │  | red-giraffe  │   │ purposes        │   │  | red-giraffe  │
    │  -1737848125"   │   │                 │   │  -1737848125"   │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
```

### Linear Comment Format Changes

**Before:**
```
Agent Claimed | 2025-01-25T15:30:00Z

**Stage**: research
**Timeout**: 4 hours
```

**After:**
```
Agent Claimed | red-giraffe-1737848125 | 2025-01-25T15:30:00Z

**Agent**: red-giraffe-1737848125
**Stage**: research
**Timeout**: 4 hours
```

## Verification

- [x] TypeScript compiles without errors (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] Agent name generation is deterministic (same timestamp = same name)
- [x] Names are human-readable and memorable
- [x] Format includes timestamp for guaranteed uniqueness

## Future Considerations

1. **Name persistence across restarts**: Currently each loop gets a new name. If desired, could persist a single name per `npm start` invocation.

2. **Shorter display names**: Could add a utility to show just adjective-animal without timestamp for casual use.

3. **Custom prefixes**: Could allow configuring a prefix (e.g., `prod-red-giraffe` vs `dev-red-giraffe`).
