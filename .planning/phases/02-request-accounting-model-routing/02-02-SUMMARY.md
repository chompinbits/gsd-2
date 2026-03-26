---
phase: 02-request-accounting-model-routing
plan: 02
subsystem: accounting
tags: [accounting, request-tracker, budget-guard, config, tdd, typescript]
dependency_graph:
  requires: [accounting/types, accounting/multipliers, accounting/stage-router]
  provides: [accounting/request-tracker, accounting/budget-guard, accounting/config]
  affects: [pi-coding-agent backend layer]
tech_stack:
  added: []
  patterns: [TDD-red-green, node-test-runner, ESM-hooks, Node16-ESM]
key_files:
  created:
    - packages/pi-coding-agent/src/core/backends/accounting/request-tracker.ts
    - packages/pi-coding-agent/src/core/backends/accounting/budget-guard.ts
    - packages/pi-coding-agent/src/core/backends/accounting/config.ts
    - packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts
    - packages/pi-coding-agent/src/core/backends/accounting/ts-resolver.mjs
  modified:
    - packages/pi-coding-agent/src/core/backends/accounting/index.ts
key_decisions:
  - "budgetLimit=0 means unlimited/disabled — guard always returns ok, tracker records 0% used"
  - "BudgetExceededError message includes gsd settings and /gsd-set-profile budget for actionable guidance per D-10"
  - "ts-resolver.mjs ESM hook required because node --experimental-strip-types does not auto-remap .js imports to .ts"
  - "fromJSON restores totalPremiumRequests from stored value — avoids re-summing floating point records"
metrics:
  duration: ~7min
  completed: "2026-03-24"
  tasks: 2
  files: 6
---

# Phase 02 Plan 02: Request Tracker, Budget Guard, Config — Summary

**One-liner:** Runtime accounting engine with per-session premium request accumulator, graduated 80%/100% budget enforcement, config.json loading with CLI override support, and 51-test suite covering all 5 accounting modules.

## What Was Built

Four implementation files and a comprehensive test suite under `packages/pi-coding-agent/src/core/backends/accounting/`:

| File | Purpose |
|------|---------|
| `request-tracker.ts` | `RequestTracker` class: per-session premium request accumulator with per-stage breakdown, toJSON/fromJSON persistence |
| `budget-guard.ts` | `BudgetGuard`, `BudgetExceededError`, `BudgetWarning`: pre-send enforcement with warn/stop modes |
| `config.ts` | `loadAccountingConfig`, `mergeWithCliOverrides`, `resetConfig`: config loading with defaults/file/CLI merge |
| `accounting.test.ts` | 51 tests covering all 5 accounting modules via node:test runner |
| `ts-resolver.mjs` | ESM hook that remaps `.js` imports to `.ts` for `node --experimental-strip-types` |
| `index.ts` (updated) | Barrel re-exports extended with new module exports |

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for request-tracker and budget-guard | `8b3455fe` | accounting.test.ts, ts-resolver.mjs |
| 1 (GREEN) | Implement request-tracker and budget-guard | `37b79b15` | request-tracker.ts, budget-guard.ts |
| 2 (RED) | Failing tests for config loader | `c98e5efd` | accounting.test.ts |
| 2 (GREEN) | Implement config loader and complete unit tests | `c738cf74` | config.ts, index.ts |

## Verification Results

All 51 tests pass across 10 test suites:
- `getModelMultiplier` — free/low/standard tiers, unknown → standard, provider prefix stripping ✓
- `getMultiplierValue` — correct numeric values for all tiers ✓
- `getStageMultiplierTier` — all 7 stages + unknown default ✓
- `resolveEffectiveTier` — hint semantics (no hint, high, low, medium) ✓
- `RequestTracker` — record accumulation, free-tier (count not cost), getSummary stage grouping, reset, toJSON/fromJSON ✓
- `BudgetGuard` — ok/warning/throw at thresholds, budgetLimit=0 unlimited, soft limit mode ✓
- `BudgetExceededError` — Error subclass, actionable message, properties ✓
- `loadAccountingConfig` — no-file defaults, missing section, valid merge, invalid values fallback ✓
- `mergeWithCliOverrides` — override application, undefined ignored, immutable ✓
- `resetConfig` — returns defaults, new object each call ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MULTIPLIER_VALUES import location**
- **Found during:** Task 1 GREEN (first test run)
- **Issue:** Test imported `MULTIPLIER_VALUES` from `./multipliers.js` but it is exported from `./types.js`
- **Fix:** Changed test import to `{ MULTIPLIER_VALUES, DEFAULT_ACCOUNTING_CONFIG } from "./types.js"`
- **Files modified:** `accounting.test.ts`
- **Commit:** `37b79b15` (included in Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Added ts-resolver.mjs ESM hook**
- **Found during:** Task 1 RED verification
- **Issue:** `node --experimental-strip-types` does not auto-remap `.js` imports to `.ts` files in Node.js v24. The plan's verification command `node --experimental-strip-types --test` would fail because all imports use `.js` extension (TypeScript convention for Node16 module resolution) but the actual files are `.ts`.
- **Fix:** Created `ts-resolver.mjs` — a minimal `register()`-based ESM hook that remaps `.js` specifiers to `.ts` when the `.ts` file exists. Used as `--import ./ts-resolver.mjs`.
- **Files modified:** `ts-resolver.mjs` (new file)
- **Commit:** `8b3455fe` (included in Task 1 RED commit)

## Known Stubs

None — all exported functions and classes are fully implemented with runtime logic.

## Self-Check: PASSED

Files exist:
- `packages/pi-coding-agent/src/core/backends/accounting/request-tracker.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/budget-guard.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/config.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` ✓
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` (updated) ✓

Commits exist:
- `8b3455fe` test(02-02): add failing tests for request-tracker and budget-guard ✓
- `37b79b15` feat(02-02): implement request-tracker and budget-guard ✓
- `c98e5efd` test(02-02): add failing tests for config loader ✓
- `c738cf74` feat(02-02): implement config loader and complete unit tests ✓
