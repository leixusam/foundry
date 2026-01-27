# Implementation Plan: Add specification statuses to README documentation

**Issue**: RSK-49
**Date**: 2026-01-27
**Research**: `thoughts/research/2026-01-26-RSK-49-specification-statuses.md`
**Specification**: N/A
**Status**: Ready for Implementation

## Overview

Update the README.md to document the specification statuses (`∞ Needs Specification` and `∞ Specification In Progress`) that already exist and are fully functional in the codebase. This is a documentation-only change to ensure users understand the complete workflow.

## Success Criteria

- [ ] README.md status table includes `∞ Needs Specification` in "Ready statuses"
- [ ] README.md status table includes `∞ Specification In Progress` in "In Progress statuses"
- [ ] Workflow diagram shows specification as an optional stage between research and plan
- [ ] Documentation accurately reflects the actual system behavior
- [ ] Type check passes: `npm run typecheck`

## Phases

### Phase 1: Update Status Table

**Goal**: Add specification statuses to the "Linear Workflow Statuses" section

**Changes**:
- `README.md` (lines 186-196): Add the two specification statuses to the appropriate lists

**Current content** (lines 186-196):
```markdown
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
```

**Updated content**:
```markdown
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
```

**Verification**:
```bash
# Verify the statuses are present in README
grep -n "Needs Specification" README.md
grep -n "Specification In Progress" README.md
```

### Phase 2: Update Workflow Diagram

**Goal**: Update the ASCII workflow diagram to show specification as an optional path

**Changes**:
- `README.md` (lines 104-119): Modify the workflow diagram to include specification stage

**Current diagram** (lines 104-119):
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ∞ Needs    │────▶│  ∞ Needs    │────▶│  ∞ Needs    │────▶│  ∞ Needs    │
│  Research   │     │    Plan     │     │  Implement  │     │  Validate   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │                   │
       ▼                  ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ ∞ Research  │     │  ∞ Plan In  │     │∞ Implement  │     │ ∞ Validate  │
│ In Progress │     │  Progress   │     │ In Progress │     │ In Progress │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                  │
                                                                  ▼
                                                            ┌─────────────┐
                                                            │   ∞ Done    │
                                                            └─────────────┘
```

**Updated diagram**:
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

Note: The diagram uses "Spec" as an abbreviation to fit the boxes, with a footnote explaining it's optional.

**Verification**:
```bash
# Verify the diagram includes specification
grep -n "Spec" README.md
# Ensure the diagram renders correctly (visual inspection)
```

## Testing Strategy

This is a documentation-only change. Testing consists of:

1. **Content verification**: Grep commands to verify the new statuses are present
2. **Build verification**: Run `npm run typecheck` to ensure no TypeScript issues
3. **Visual verification**: Review the rendered README to ensure the diagram displays correctly

No functional testing is needed since the code already handles these statuses correctly.

## Rollback Plan

If the documentation update causes confusion or is incorrect:

```bash
git revert HEAD
git push origin foundry/RSK-49
```

## Notes

- The specification stage is **optional** - research agent decides if it's needed
- Specification is needed for: new UX flows, user-facing features, multi-screen interactions
- Specification is NOT needed for: bug fixes, backend changes, refactoring, documentation
- This distinction should be clear in the documentation to avoid confusion
