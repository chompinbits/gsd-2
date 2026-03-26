---
phase: 09
slug: autonomous-orchestration-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — uses `node --experimental-strip-types` |
| **Quick run command** | `node --experimental-strip-types src/resources/extensions/gsd/auto/unit-config.test.ts` |
| **Full suite command** | `node --experimental-strip-types src/resources/extensions/gsd/auto/unit-config.test.ts && node --experimental-strip-types src/resources/extensions/gsd/auto/stage-routing.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| T1 | 01 | 1 | EXEC-02 SC-2 | source-shape | `node --experimental-strip-types src/resources/extensions/gsd/auto/unit-config.test.ts` | No | pending |
| T2 | 01 | 1 | EXEC-02 SC-3 | source-shape | `node --experimental-strip-types src/resources/extensions/gsd/auto/unit-config.test.ts` | No | pending |
| T3 | 02 | 2 | EXEC-02 SC-1,4 | source-shape | `node --experimental-strip-types src/resources/extensions/gsd/auto/stage-routing.test.ts` | No | pending |

---

## Wave 0 — Test Scaffold

Wave 0 creates test files that tasks fill with real assertions.

| File | Creates Tests For | Pre-Existing |
|------|------------------|-------------|
| `src/resources/extensions/gsd/auto/unit-config.test.ts` | Tool profile per unit type, stage derivation map, UnitSessionConfig threading | No |
| `src/resources/extensions/gsd/auto/stage-routing.test.ts` | Stage name normalization, end-to-end dispatch → config flow | No |

---

*Phase: 09-autonomous-orchestration-migration*
*Created: 2026-03-25*
