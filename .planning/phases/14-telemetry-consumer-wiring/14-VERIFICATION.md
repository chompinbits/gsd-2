---
phase: 14-telemetry-consumer-wiring
verified: 2026-03-26T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
requirements:
  - FLOW-02
  - FLOW-03
---

# Phase 14: Telemetry Consumer Wiring Verification Report

**Phase Goal:** Wire `getDowngrades()` and `getByokActivations()` into `formatPremiumSummary` callers at session teardown in `sdk.ts`, closing two orphaned accessor gaps identified in the v1.1 milestone audit.
**Verified:** 2026-03-26
**Status:** ✓ PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getDowngrades()` return value is passed to `formatPremiumSummary` at session teardown | ✓ VERIFIED | sdk.ts line 301: `const downgrades = copilotBackend.getDowngrades();` — passed as 3rd arg on line 303 |
| 2 | `getByokActivations()` return value is passed to `formatPremiumSummary` at session teardown | ✓ VERIFIED | sdk.ts line 302: `const byokActive = copilotBackend.getByokActivations().length > 0;` — passed as 4th arg on line 303 |
| 3 | Structured telemetry report is reachable in production path for both downgrade and BYOK events | ✓ VERIFIED | sdk.ts line 304: `process.stderr.write("[gsd:accounting] " + summary + "\n")` inside guarded async cleanup callback |
| 4 | 4 source-shape regression tests protect the wiring | ✓ VERIFIED | backends.test.ts lines 145–173: 4 tests present in `copilot session routing` describe block; all 18 tests pass |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pi-coding-agent/src/core/sdk.ts` | Telemetry consumer wiring in cleanup callback | ✓ VERIFIED | Contains `copilotBackend.getDowngrades()`, `copilotBackend.getByokActivations()`, `formatPremiumSummary(`, `[gsd:accounting]` |
| `packages/pi-coding-agent/src/core/backends/backends.test.ts` | Source-shape regression tests for telemetry consumer | ✓ VERIFIED | 4 new tests assert all 4 wiring patterns are present in sdk.ts source |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sdk.ts` | `copilot-backend.ts` | `copilotBackend.getDowngrades()` and `copilotBackend.getByokActivations()` in cleanup callback | ✓ WIRED | Both calls present at lines 301–302 inside `withCopilotSessionCleanup` async callback |
| `sdk.ts` | `accounting/telemetry.ts` | `formatPremiumSummary(tracker.getSummary(), accountingConfig, downgrades, byokActive)` | ✓ WIRED | All 4 args passed on line 303; `formatPremiumSummary` imported via lazy destructure on line 278 |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `getDowngrades()` called in cleanup | `grep "copilotBackend.getDowngrades()" sdk.ts` | line 301 | ✓ PASS |
| `getByokActivations()` called in cleanup | `grep "copilotBackend.getByokActivations()" sdk.ts` | line 302 | ✓ PASS |
| `formatPremiumSummary(` present with all 4 args | `grep "formatPremiumSummary(" sdk.ts` | line 303 | ✓ PASS |
| `[gsd:accounting]` stderr prefix present | `grep "\[gsd:accounting\]" sdk.ts` | line 304 | ✓ PASS |
| 4 regression tests pass | `node --no-warnings --test backends.test.js` | 18/18 pass, 0 fail | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FLOW-02 | 14-01-PLAN.md | `getDowngrades()` accessor wired into `formatPremiumSummary` at teardown | ✓ SATISFIED | sdk.ts line 301+303 |
| FLOW-03 | 14-01-PLAN.md | `getByokActivations()` accessor wired into `formatPremiumSummary` at teardown | ✓ SATISFIED | sdk.ts line 302+303 |

---

### Anti-Patterns Found

None. No TODOs, stubs, placeholder returns, or empty implementations detected in modified files.

---

### Human Verification Required

None. All behaviors are verifiable programmatically via source grep and test suite execution.

---

## Gaps Summary

No gaps. All 4 must-haves verified:

1. `getDowngrades()` return value correctly retrieved and passed as `downgrades` arg to `formatPremiumSummary`
2. `getByokActivations()` return value correctly reduced to `byokActive` bool and passed as 4th arg
3. Cleanup callback is async, guarded on `totalRequests > 0`, and emits via `process.stderr.write` with `[gsd:accounting]` prefix
4. 4 source-shape regression tests in `backends.test.ts` all pass (18/18 total)

Both FLOW-02 and FLOW-03 requirements satisfied. Phase goal achieved.

---

_Verified: 2026-03-26T00:00:00Z_
_Verifier: the agent (gsd-verifier)_
