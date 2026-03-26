---
phase: 09
slug: autonomous-orchestration-migration
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| **Quick run command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gsd/auto/unit-config.test.ts` |
| **Full suite command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gsd/auto/unit-config.test.ts src/resources/extensions/gsd/auto/stage-routing.test.ts` |
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
| T1 | 01 | 1 | EXEC-02 SC-2 | source-shape | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gsd/auto/unit-config.test.ts` | ✅ | ✅ green |
| T2 | 01 | 1 | EXEC-02 SC-3 | source-shape | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gsd/auto/unit-config.test.ts` | ✅ | ✅ green |
| T3 | 02 | 2 | EXEC-02 SC-1,4 | source-shape | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/resources/extensions/gsd/auto/stage-routing.test.ts` | ✅ | ✅ green |

---

## Wave 0 — Test Scaffold

Wave 0 creates test files that tasks fill with real assertions.

| File | Creates Tests For | Pre-Existing |
|------|------------------|-------------|
| `src/resources/extensions/gsd/auto/unit-config.test.ts` | Tool profile per unit type, stage derivation map, UnitSessionConfig threading | ✅ Yes |
| `src/resources/extensions/gsd/auto/stage-routing.test.ts` | Stage name normalization, end-to-end dispatch → config flow | ✅ Yes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- Approval: ✅ Approved (post-execution audit — 4/4 SC verified, 27/27 tests pass per 09-VERIFICATION.md)

---
*Phase: 09-autonomous-orchestration-migration*
*Created: 2026-03-25*
