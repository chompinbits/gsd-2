---
phase: 11-free-tier-model-fallback
plan: 01
subsystem: accounting
tags: [free-tier, budget, downgrade, model-fallback, accounting]

requires:
  - phase: none
    provides: "accounting infrastructure (types, config, budget-guard) already in place"
provides:
  - "suggestDowngrade() pure function — determines when/which model to downgrade to under budget pressure"
  - "FREE_TIER_CANDIDATES ordered list of 0× models derived from MODEL_MULTIPLIER_MAP"
  - "DowngradeSuggestion type with modelId, reason, percentUsed"
  - "FreeTierFallbackConfig interface with enabled and thresholdPolicy fields"
  - "DEFAULT_FREE_TIER_FALLBACK constant"
  - "Extended AccountingConfig with freeTierFallback field"
  - "config.ts parses free_tier_fallback section from config.json"
affects: [11-02-PLAN, budget-guard, cli-integration, session-routing]

tech-stack:
  added: []
  patterns:
    - "Pure function pattern for downgrade logic (D-02) — no side effects, fully testable"
    - "Threshold policy enum (warn vs hard_stop) for flexible budget trigger points"
    - "Deterministic candidate list derived from MODEL_MULTIPLIER_MAP via filter+sort"

key-files:
  created:
    - packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts
    - packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/accounting/types.ts
    - packages/pi-coding-agent/src/core/backends/accounting/config.ts
    - packages/pi-coding-agent/src/core/backends/accounting/index.ts

key-decisions:
  - "suggestDowngrade is pure (no side effects) — safe to call from any context including integration layer"
  - "FREE_TIER_CANDIDATES derived at module load time via filter+sort on MODEL_MULTIPLIER_MAP — stays in sync automatically"
  - "threshold_policy 'hard_stop' triggers at exactly 100%, 'warn' triggers at warnThreshold fraction"
  - "budgetLimit === 0 treated as unlimited — no downgrade pressure applied"
  - "DEFAULT_FREE_TIER_FALLBACK uses enabled:true, thresholdPolicy:'warn' — opt-out rather than opt-in"

patterns-established:
  - "Threshold policy enum: 'warn' and 'hard_stop' distinguish warnThreshold vs 100% trigger"
  - "Pure suggestion function: returns DowngradeSuggestion|null, callers decide how to act"

requirements-completed: [FLOW-02]

duration: 18min
completed: 2026-03-26
---

# Phase 11 Plan 01: Free-Tier Downgrade Engine Summary

**Pure `suggestDowngrade()` function with FreeTierFallbackConfig extension — deterministic budget-pressure downgrade decision engine for FLOW-02.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-26T04:01:00Z
- **Completed:** 2026-03-26T04:19:06Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Created `downgrade.ts` with pure `suggestDowngrade()` function, `FREE_TIER_CANDIDATES` constant, and `DowngradeSuggestion` type
- Extended `AccountingConfig` with `FreeTierFallbackConfig` (enabled, thresholdPolicy fields) and updated `DEFAULT_ACCOUNTING_CONFIG`
- Updated `config.ts` to parse `free_tier_fallback` section from config.json with safe defaults
- Wrote 20 comprehensive unit tests covering all D-02/D-04/D-05 behaviors — all pass
- Verified no regressions: all 56 existing accounting tests continue to pass

## Task Commits

TDD tasks committed atomically:

1. **Task 2 (RED): Failing tests for downgrade logic** - `5a51c4a2` (test)
2. **Task 1 (GREEN): Implement suggestDowngrade and extend accounting config** - `85c4b6d3` (feat)

## Files Created/Modified

- `packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts` — New: suggestDowngrade(), FREE_TIER_CANDIDATES, DowngradeSuggestion type (59 lines)
- `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` — New: 20 unit tests in 5 describe groups (263 lines)
- `packages/pi-coding-agent/src/core/backends/accounting/types.ts` — Extended: FreeTierFallbackConfig, DEFAULT_FREE_TIER_FALLBACK, freeTierFallback field on AccountingConfig
- `packages/pi-coding-agent/src/core/backends/accounting/config.ts` — Extended: parses free_tier_fallback section, mergeWithCliOverrides handles freeTierFallback
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` — Extended: exports FreeTierFallbackConfig, DEFAULT_FREE_TIER_FALLBACK, suggestDowngrade, FREE_TIER_CANDIDATES, DowngradeSuggestion

## Decisions Made

- `suggestDowngrade` is pure (no side effects) — safe to call from integration layer, session routing, or CLI
- `FREE_TIER_CANDIDATES` is derived at module load time by filtering `MODEL_MULTIPLIER_MAP` for `"free"` tier and sorting — stays in sync automatically when new models are added
- `thresholdPolicy: "hard_stop"` triggers at exactly 100%; `"warn"` triggers at `warnThreshold * 100`
- `budgetLimit === 0` means unlimited — downgrade pressure never applies
- `DEFAULT_FREE_TIER_FALLBACK` uses `enabled: true` (opt-out model rather than opt-in)

## Deviations from Plan

None — plan executed exactly as written. Implementation matched the `<action>` specification in the plan.

## Known Stubs

None.

---

## Self-Check

Checking files exist:

- FOUND: `packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts`
- FOUND: `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts`
- FOUND: `.planning/phases/11-free-tier-model-fallback/11-01-SUMMARY.md`
- FOUND commit: `5a51c4a2`
- FOUND commit: `85c4b6d3`

## Self-Check: PASSED
