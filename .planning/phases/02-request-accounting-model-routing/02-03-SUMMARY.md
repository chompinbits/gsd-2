---
phase: 02-request-accounting-model-routing
plan: 03
subsystem: accounting
tags: [accounting, copilot-backend, budget-guard, request-tracker, telemetry, sdk-integration]
dependency_graph:
  requires: [accounting/types, accounting/multipliers, accounting/stage-router, accounting/request-tracker, accounting/budget-guard, accounting/config]
  provides: [accounting/telemetry, copilot-backend/accounting-integration, sdk/accounting-init]
  affects: [pi-coding-agent backend layer, copilot SDK path]
tech_stack:
  added: []
  patterns: [accounting-middleware-wrapper, lazy-dynamic-import, ESM-barrel-exports]
key_files:
  created:
    - packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/copilot-backend.ts
    - packages/pi-coding-agent/src/core/backends/accounting/index.ts
    - packages/pi-coding-agent/src/core/sdk.ts
key_decisions:
  - "AccountingSessionHandle wraps CopilotSessionHandle as a transparent proxy — existing behavior unchanged when accounting not configured"
  - "Stage defaults to 'unknown' in send() because BackendSessionHandle.send() has no stage metadata — conservative standard-tier default"
  - "getTracker() on CopilotSessionBackend returns the most recently created session's tracker — correct for single-session use"
  - "loadAccountingConfig() called with join(agentDir, 'config.json') — respects existing config directory convention"
  - "loadPersistedAccounting() uses dynamic import of RequestTracker to avoid circular dependency in telemetry module"
metrics:
  duration: ~4min
  completed: "2026-03-24"
  tasks: 2
  files: 4
---

# Phase 02 Plan 03: Accounting Integration and Telemetry Formatter – Summary

**One-liner:** Accounting middleware wired into CopilotSessionBackend with pre-send budget guard and post-send tracker, plus telemetry formatter producing stage breakdown tables with budget bar visualization.

## What Was Built

Two integration points and one new module closing the accounting loop in the Copilot execution path:

| File | Purpose |
|------|---------|
| `copilot-backend.ts` | `AccountingSessionHandle` wrapper (pre-send guard, post-send record), `setAccountingConfig()` / `getTracker()` on `CopilotSessionBackend` |
| `sdk.ts` | `loadAccountingConfig()` initialization and `setAccountingConfig()` call in `createAgentSession()` when `backend === "copilot"` |
| `telemetry.ts` | `formatStageLine`, `formatPremiumSummary`, `persistSessionAccounting`, `loadPersistedAccounting` |
| `index.ts` | Barrel re-exports extended with telemetry functions |

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire accounting into CopilotSessionBackend and sdk | `6d1a994d` | copilot-backend.ts, sdk.ts |
| 2 | Implement telemetry formatter and update barrel exports | `53f3fbc3` | telemetry.ts, index.ts |

## Verification Results

- TypeScript `npx tsc --noEmit` passes with zero errors on all modified files ✓
- All 51 accounting tests pass unchanged ✓
- `formatStageLine("plan", { count: 3, premiumCost: 0.99 })` → correctly padded line ✓
- `formatPremiumSummary(summary, config)` → full table with header, separator, stage rows, totals, budget line, and `[░░░░░░░░░░░░░░░░░░░░] 2.0%` bar ✓
- `AccountingSessionHandle.send()` calls `guard.check()` before forwarding, calls `tracker.record()` after — budget enforcement and tracking active ✓
- `BudgetExceededError` propagates naturally from `guard.check()` — blocked requests do not reach inner `send()` ✓
- `withCopilotSessionCleanup` in sdk.ts wraps the outer accounting handle — cleanup chain works correctly ✓
- Accounting inactive (no-op) when `setAccountingConfig()` not called — existing Pi backend path unaffected ✓

## Deviations from Plan

None — plan executed exactly as written.

The plan noted "Extract current `stage` from message context (or default to 'unknown')". Since `BackendSessionHandle.send()` accepts only `prompt: string` with no stage metadata, defaulted to `"unknown"` per the plan's explicit fallback. This maps to `"standard"` tier (conservative default per 02-01 design decision).

## Known Stubs

None — all exported functions are fully implemented. The `"unknown"` stage default is by design (the interface has no stage field), not a stub.

## Self-Check: PASSED

Files exist:
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` ✓
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` (modified) ✓
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` (modified) ✓
- `packages/pi-coding-agent/src/core/sdk.ts` (modified) ✓

Commits exist:
- `6d1a994d` feat(02-03): wire accounting into CopilotSessionBackend and sdk ✓
- `53f3fbc3` feat(02-03): implement telemetry formatter and update accounting barrel exports ✓
