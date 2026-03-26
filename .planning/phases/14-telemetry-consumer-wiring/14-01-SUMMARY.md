---
plan: 14-01
phase: 14-telemetry-consumer-wiring
status: complete
started: 2026-03-26
completed: 2026-03-26
commits:
  - 0ea94c99
  - 76229ef7
---

## Outcome

Wired `getDowngrades()` and `getByokActivations()` into `formatPremiumSummary` at session teardown in `sdk.ts`, closing the two orphaned accessor gaps from the v1.1 milestone audit.

## What Was Built

**Task 1 — sdk.ts telemetry consumer wiring:**
- Added `formatPremiumSummary` to the existing lazy import destructuring of `./backends/accounting/index.js`
- Expanded the `withCopilotSessionCleanup` cleanup callback from a one-liner into an async block that:
  1. Gets the tracker via `copilotBackend.getTracker()`
  2. Guards on tracker existing and `totalRequests > 0` (no emit for idle sessions)
  3. Calls `formatPremiumSummary(tracker.getSummary(), accountingConfig, copilotBackend.getDowngrades(), copilotBackend.getByokActivations().length > 0)`
  4. Emits via `process.stderr.write("[gsd:accounting] " + summary + "\n")`
  5. Calls `releaseSharedCopilotClientManager(clientManager)` as before

**Task 2 — Regression tests:**
- Added 4 source-shape tests to `backends.test.ts` `describe("copilot session routing")` block
- Tests assert presence of: `copilotBackend.getDowngrades()`, `copilotBackend.getByokActivations()`, `formatPremiumSummary(`, `[gsd:accounting]`
- All 18 tests pass (14 existing + 4 new)

## Key Files

key-files:
  created: []
  modified:
    - path: packages/pi-coding-agent/src/core/sdk.ts
      provides: Telemetry consumer wiring in cleanup callback — getDowngrades and getByokActivations routed through formatPremiumSummary to stderr
    - path: packages/pi-coding-agent/src/core/backends/backends.test.ts
      provides: 4 source-shape regression tests for telemetry consumer wiring

## Deviations

None. Implemented exactly as designed in plan.

## Self-Check

| Truth | Verified |
|-------|---------|
| getDowngrades() return value is passed to formatPremiumSummary at session teardown | ✓ grep confirms line 303 |
| getByokActivations() return value is passed to formatPremiumSummary at session teardown | ✓ grep confirms line 302 (`.length > 0` → byokActive bool) |
| Structured telemetry report is reachable in production path for both downgrade and BYOK events | ✓ process.stderr.write confirmed line 304 |
| 4 regression tests pass | ✓ 18/18 tests pass |

## Self-Check: PASSED
