---
plan: 12-02
phase: 12-byok-fallback
status: complete
commit: 27fbbef9
duration_mins: 20
tasks_completed: 2
files_created: 0
files_modified: 3
---

# Plan 12-02 Summary: Wire BYOK Into CopilotSessionBackend + Telemetry

## What Was Built

Completed the BYOK fallback integration: quota-exhausted sessions now seamlessly route to the user's configured BYOK provider. This implements FLOW-03 success criteria.

### Files Modified

- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Added `_applyByokIfExhausted()` private method, wired into both `createSession()` and `resumeSession()` after the downgrade check, added `setSettingsManager()`, `getByokActivations()`, `_settingsManager`, and `_byokActivations` fields
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — Extended `formatPremiumSummary()` with optional `byokActive?: boolean` parameter, adds BYOK indicator line to session summary output
- `packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` — Added 12 integration tests for copilot-backend wiring and telemetry byokActive indicator

## Key Decisions

- BYOK check runs AFTER the downgrade check (downgrade at warn threshold, BYOK at hard_stop — they are sequential thresholds)
- When BYOK activates, provider config is spread into the SDK sessionConfig spread object (does not carry across sessions — D-09)
- `SettingsManager` is injected via `setSettingsManager()` to keep the class loosely coupled for testability
- When quota is exhausted but BYOK is NOT configured, `BudgetExceededError` propagates naturally (no silent suppression)
- Stderr notification format: `[gsd:accounting] ⚡ BYOK provider active: {type}@{baseUrl} (premium quota exhausted)`
- `byokActive` is an additive optional parameter on `formatPremiumSummary` — fully backward-compatible

## Integration Notes

- Callers of `CopilotSessionBackend` that want BYOK support must call `setSettingsManager(sm)` before sessions
- `getByokActivations()` returns per-session BYOK activation events for telemetry/reporting

## Test Results

36/36 tests passing (24 from Plan 01 + 12 new integration tests).

## Self-Check: PASSED
