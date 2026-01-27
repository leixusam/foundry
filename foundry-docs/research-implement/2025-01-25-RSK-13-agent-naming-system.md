# RSK-13: Loop Instance Naming System

## Overview

This document describes the implementation of a naming system for loop instances, allowing multiple parallel loops to be distinguished in Linear comments.

## Problem

When multiple Ralph instances run in parallel on the same repository, there was no way to identify which loop instance made which comment in Linear. This made it difficult to debug issues and understand the attribution of work.

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

1. **ralph/src/lib/loop-instance-name.ts** (renamed from agent-name.ts)
   - `generateLoopInstanceName()`: Generates unique names using word lists + timestamp
   - `getLoopInstanceNameDisplay()`: Extracts human-readable part without timestamp

2. **ralph/src/index.ts**
   - Generates loop instance name at the start of each loop
   - Passes loop instance name to all three agents via their prompts
   - Logs loop instance name to console

3. **ralph/prompts/agent1-linear-reader.md**
   - Updated claim comment format to include loop instance name

4. **ralph/prompts/agent3-linear-writer.md**
   - Updated success/failure comment formats to include loop instance name

### How Names Flow Through the System

```
                    ┌──────────────────────────────────────────────────┐
                    │    Loop starts                                    │
                    │    loopInstanceName = generateLoopInstanceName() │
                    │    e.g., "red-giraffe-1737848125"                 │
                    └──────────────────────────────────────────────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │    Agent 1      │   │    Agent 2      │   │    Agent 3      │
    │ (Linear Reader) │   │    (Worker)     │   │ (Linear Writer) │
    │                 │   │                 │   │                 │
    │ Posts comment:  │   │ Knows its loop  │   │ Posts comment:  │
    │ "Agent Claimed  │   │ instance name   │   │ "Stage Complete │
    │  | red-giraffe  │   │ for logging     │   │  | red-giraffe  │
    │  -1737848125"   │   │ purposes        │   │  -1737848125"   │
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

**Loop Instance**: red-giraffe-1737848125
**Stage**: research
**Timeout**: 4 hours
```

## Verification

- [x] TypeScript compiles without errors (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] Loop instance name generation is deterministic (same timestamp = same name)
- [x] Names are human-readable and memorable
- [x] Format includes timestamp for guaranteed uniqueness

## Terminology Note

The name "loop instance name" was chosen to clearly distinguish this identifier from individual agents:

- **Loop Instance Name**: Identifies a single loop iteration (e.g., `red-giraffe-1737848125`)
- **Agent**: An individual Claude Code instance within a loop (Agent 1, Agent 2, Agent 3)

All three agents within the same loop share the same loop instance name. This makes it clear in Linear comments which loop iteration performed the work.

## Future Considerations

1. **Pod naming (RSK-18)**: Add a higher-level identifier for `npm start` invocations. Loop instance names could then become `{pod-name}-loop-{n}` or remain separate.

2. **Shorter display names**: The `getLoopInstanceNameDisplay()` function already provides just adjective-animal without timestamp for casual use.

3. **Custom prefixes**: Could allow configuring a prefix (e.g., `prod-red-giraffe` vs `dev-red-giraffe`).
