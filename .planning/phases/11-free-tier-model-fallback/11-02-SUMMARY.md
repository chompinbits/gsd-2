---
phase: 11-free-tier-model-fallback
plan: 02
subsystem: accounting
tags: [free-tier, model-fallback, budget, telemetry, copilot-backend]

requires:
  - phase: 11-01
    provides: suggestDowngrade(), DowngradeSuggestion type, FreeTierFallbackConfig, FREE_TIER_CANDIDATES

provides:
  - CopilotSessionBackend routes sessions to 0× model when budget reaches warn threshold
  - Structured stderr notification on downgrade (D-06 — no silent fallback)
  - formatPremiumSummary extended with optional downgrades parameter for session telemetry
  - getDowngrades() accessor on CopilotSessionBackend for external consumers

affects: [11-03, telemetry, session-reporting, accounting]

tech-stack:
  added: []
  patterns:
    - "Pre-flight downgrade check at session creation (D-03) — not mid-send (D-07/D-08)"
    - "Optional backward-compatible parameter extension for telemetry API"

key-files:
  created: []
  modified:
    - packages/pi-coding-agent/src/core/backends/copilot-backend.ts
    - packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts

key-decisions:
  - "Downgrade check placed at createSession/resumeSession boundary only — never inside AccountingSessionHandle.send() (D-07/D-08)"
  - "Use stderr (process.stderr.write) for downgrade notification — avoids polluting stdout responses (D-06)"
  - "formatPremiumSummary downgrades param is optional — preserves backward compatibility for all existing callers"
  - "getDowngrades() accessor pattern — CopilotSessionBackend owns the list, external reporters consume it"

patterns-established:
  - "Pre-flight pattern: evaluate budget state before constructing session, override config before SDK call"
  - "Backward-compatible API extension via optional parameter with undefined guard"

requirements-completed: [FLOW-02]

duration: 2min
completed: 2026-03-26
---

# Phase 11 Plan 02: Free-Tier Model Fallback — Session Integration & Telemetry Summary

**Wired suggestDowngrade() into CopilotSessionBackend session creation; extended formatPremiumSummary to emit model downgrade events in telemetry output.**

## Performance

- **Duration:** ~2min
- **Started:** 2026-03-26T14:37:26Z
- **Completed:** 2026-03-26T14:39:30Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Task 1 (copilot-backend.ts): `_applyDowngradeIfNeeded()` pre-flight check wired into both `createSession()` and `resumeSession()`. When budget state exceeds warn threshold and `freeTierFallback.enabled` is true, the requested model is replaced with a 0× candidate. A structured `[gsd:accounting]` warning is emitted via stderr on downgrade (D-06). `_downgrades[]` array and `getDowngrades()` accessor added for telemetry consumers. (Committed as `63ddff7e` by prior executor agent.)
- Task 2 (telemetry.ts): `formatPremiumSummary` extended with optional `downgrades` parameter. If downgrade records are present, appends a "Model downgrades:" section showing `originalModel → downgradedTo (at X.X% budget)` per D-12. Backward-compatible — all existing callers unaffected.
- All 56 existing accounting tests and 20 downgrade unit tests pass with no regressions.

## Task Commits

1. **Task 1: Wire downgrade check into CopilotSessionBackend** — `63ddff7e` (feat) _(prior agent)_
2. **Task 2: Add downgrade event to telemetry output** — `d14e3b5c` (feat)

## Files Created/Modified

- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Added `_applyDowngradeIfNeeded()`, `_downgrades[]` field, `getDowngrades()`, wired into `createSession()` and `resumeSession()`
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — Extended `formatPremiumSummary` with optional `downgrades?` parameter; appends "Model downgrades:" block when records present

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written (Task 1 was already committed by the parallel Plan 01 completion agent as part of that wave; Task 2 implemented cleanly).

## Self-Check

- [x] `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — exists and contains all required symbols
- [x] `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — exists and contains `downgrades?` param, `Model downgrades:`, `originalModel`, `downgradedTo`
- [x] Commit `63ddff7e` — verified in git log
- [x] Commit `d14e3b5c` — verified in git log
- [x] TypeScript compiles without errors (`npx tsc --noEmit` — no output)
- [x] 20/20 downgrade tests pass
- [x] 56/56 accounting tests pass

## Self-Check: PASSED
