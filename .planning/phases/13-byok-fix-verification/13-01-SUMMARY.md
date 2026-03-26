---
plan: 13-01
phase: 13-byok-fix-verification
status: complete
completed: 2026-03-26
commit: d551c0cd
---

## Summary

Fixed the missing `setSettingsManager` wiring in `sdk.ts` (GAP-2). One line added immediately after `copilotBackend.setAccountingConfig(accountingConfig)` in the copilot backend branch of `createAgentSession()`. Added two source-shape regression tests to prevent re-introduction.

## What Was Built

- **Fix:** `packages/pi-coding-agent/src/core/sdk.ts` — added `copilotBackend.setSettingsManager(settingsManager)` on the line after `setAccountingConfig`
- **Tests:** `packages/pi-coding-agent/src/core/backends/backends.test.ts` — two new tests in `describe("copilot session routing")`:
  - `sdk.ts copilot branch calls copilotBackend.setSettingsManager` — asserts the call exists
  - `sdk.ts setSettingsManager is called after setAccountingConfig` — asserts correct ordering

## Verification

- TDD Red→Green cycle confirmed: 2 new tests failed before fix, all 14 pass after
- byok.test.ts: 36/36 pass — no regressions
- TypeScript compiles without errors

## Key Files

### Modified
- `packages/pi-coding-agent/src/core/sdk.ts` — setSettingsManager wiring added
- `packages/pi-coding-agent/src/core/backends/backends.test.ts` — 2 source-shape tests added

## Deviations

None. Executed exactly as planned.
