# RSK-18: Update Pod Name Format

## Summary

Updated the loop instance (pod) naming system to use human-readable timestamps and expanded word lists for more unique combinations.

## Changes Made

### 1. Timestamp Format Change
- **Before**: Unix timestamp (seconds since epoch) - e.g., `1706223456`
- **After**: Human-readable format `YYYYMMDD-HHMMSS` - e.g., `20250125-143052`
- **Example**: `calm-pegasus-1706223456` → `calm-pegasus-20250125-143052`

### 2. Expanded Adjectives List
- **Before**: 24 adjectives
- **After**: 64 adjectives (8 per category)
- **Categories**:
  - Colors: red, blue, green, purple, orange, yellow, silver, golden, crimson, azure, emerald, violet, amber, ivory, bronze, copper
  - Qualities: swift, calm, bold, wise, keen, bright, quick, steady, noble, brave, gentle, fierce, proud, silent, clever, nimble
  - Cosmic/Nature: cosmic, lunar, solar, stellar, crystal, mystic, arctic, tropic, misty, frozen, blazing, radiant, shadow, thunder, starlit, ancient
  - Additional: vivid, serene, mighty, agile, lofty, daring, loyal, gallant, gleaming, glowing, shining, dusk, dawn, twilight, velvet, marble

### 3. Expanded Animals List
- **Before**: 24 animals
- **After**: 64 animals (8 per category)
- **Categories**:
  - Safari/Wild: giraffe, zebra, falcon, otter, panda, koala, eagle, dolphin, tiger, wolf, bear, hawk, owl, fox, lynx, raven, leopard, cheetah, jaguar, panther, gazelle, antelope, bison, mustang
  - Mythical: phoenix, dragon, griffin, unicorn, pegasus, sphinx, hydra, kraken, chimera, basilisk, wyvern, manticore, cerberus, hippogriff, thunderbird, leviathan
  - Ocean/Sky: shark, whale, seal, penguin, pelican, heron, condor, albatross, stingray, orca, narwhal, walrus, osprey, harrier, kestrel, merlin
  - Additional: badger, mongoose, wolverine, marten, viper, cobra, python, iguana

### 4. Unique Combinations
- **Before**: 24 × 24 = 576 combinations
- **After**: 64 × 64 = 4,096 combinations
- **Improvement**: ~7x more unique names

## Technical Implementation

### File Modified
- `ralph/src/lib/loop-instance-name.ts`

### Functions Updated
1. `generateLoopInstanceName()` - Now uses `YYYYMMDD-HHMMSS` format timestamp
2. `getLoopInstanceNameDisplay()` - Updated to handle both old (3-part) and new (4-part) format for backwards compatibility
3. Added new helper function `formatTimestamp()` for UTC timestamp formatting

### Backwards Compatibility
- The `getLoopInstanceNameDisplay()` function works with both old and new formats
- Old format: `red-giraffe-1706223456` → displays as `red-giraffe`
- New format: `calm-pegasus-20250125-143052` → displays as `calm-pegasus`

## Verification

```bash
# Build passes
npm run build

# Typecheck passes
npm run typecheck

# Example output
Generated name: cosmic-otter-20260126-022640
Display name: cosmic-otter
```

## Impact

- All new loop instances will have human-readable timestamps
- Easier to identify when a loop ran by looking at the name
- More unique combinations reduce chance of name collisions
- No breaking changes to existing functionality
