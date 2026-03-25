---
phase: 02-request-accounting-model-routing
plan: 01
subsystem: accounting
tags: [accounting, model-routing, multiplier-tiers, typescript]
dependency_graph:
  requires: []
  provides: [accounting/types, accounting/multipliers, accounting/stage-router]
  affects: [pi-coding-agent backend layer]
tech_stack:
  added: []
  patterns: [barrel-exports, stateless-lookup-modules, Node16-ESM]
key_files:
  created:
    - packages/pi-coding-agent/src/core/backends/accounting/types.ts
    - packages/pi-coding-agent/src/core/backends/accounting/multipliers.ts
    - packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts
    - packages/pi-coding-agent/src/core/backends/accounting/index.ts
  modified: []
key_decisions:
  - "GPT models are free (0×) — no GitHub Copilot premium cost — while Claude Haiku/Gemini Flash are low (0.33×) and Claude Sonnet/Gemini Pro are standard (1×)"
  - "Unknown models and stages both default to standard (1×) — conservative safe default"
  - "Medium complexity hint caps tier at low — implemented as min(stageTier, low) not decrement-by-one"
metrics:
  duration: ~5min
  completed: "2026-03-24"
  tasks: 2
  files: 4
---

# Phase 02 Plan 01: Accounting Type Contracts and Multiplier Table – Summary

**One-liner:** Foundational accounting module with MultiplierTier types, model-to-billing-tier map, and deterministic stage-to-tier routing for GitHub Copilot premium request tracking.

## What Was Built

Four stateless TypeScript modules forming the core accounting data model under `packages/pi-coding-agent/src/core/backends/accounting/`:

| File | Purpose |
|------|---------|
| `types.ts` | MultiplierTier union, MULTIPLIER_VALUES, AccountingConfig, RequestRecord, BudgetState, PremiumRequestSummary, DEFAULT_ACCOUNTING_CONFIG |
| `multipliers.ts` | MODEL_MULTIPLIER_MAP (40+ model IDs), getModelMultiplier(), getMultiplierValue() |
| `stage-router.ts` | STAGE_TIER_MAP (7 GSD stages), getStageMultiplierTier(), ComplexityHint, resolveEffectiveTier() |
| `index.ts` | Barrel re-exports for all public types and functions |

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Define accounting type contracts and multiplier table | `8b6f002d` | types.ts, multipliers.ts |
| 2 | Implement stage router and barrel exports | `c07ce37c` | stage-router.ts, index.ts |

## Verification Results

All 18 runtime checks passed:
- `getModelMultiplier("gpt-4o")` → `"free"` ✓
- `getModelMultiplier("claude-sonnet-4-6")` → `"standard"` ✓
- `getModelMultiplier("unknown-model")` → `"standard"` (conservative default) ✓
- `getModelMultiplier("openai/gpt-4o")` → `"free"` (provider prefix stripped) ✓
- `getStageMultiplierTier("discuss-phase")` → `"free"` ✓
- `getStageMultiplierTier("unknown-stage")` → `"standard"` (conservative default) ✓
- `resolveEffectiveTier("standard", "low")` → `"free"` ✓
- `resolveEffectiveTier("standard", "medium")` → `"low"` ✓
- `resolveEffectiveTier("low", "medium")` → `"low"` (stays, not over-downgraded) ✓
- No SDK imports in any accounting file — pure TypeScript types and logic ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed resolveEffectiveTier medium-hint logic**
- **Found during:** Task 2 verification
- **Issue:** Initial implementation decremented tier by one step for "medium" hint, causing `resolveEffectiveTier("low", "medium")` to return `"free"` instead of `"low"`. The plan spec says "return the lower of stageTier and 'low'" — i.e., cap at "low", not a one-step decrement.
- **Fix:** Changed to `min(stageTier, "low")` using index-based comparison on TIER_ORDER array. Standard → low, low stays low, free stays free.
- **Files modified:** `stage-router.ts`
- **Commit:** `c07ce37c` (included in Task 2 commit)

## Known Stubs

None — all exported functions are fully implemented with deterministic logic.

## Self-Check: PASSED

Files exist:
- `packages/pi-coding-agent/src/core/backends/accounting/types.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/multipliers.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` ✓

Commits exist:
- `8b6f002d` feat(02-01): define accounting type contracts and multiplier table ✓
- `c07ce37c` feat(02-01): implement stage router and barrel exports ✓
