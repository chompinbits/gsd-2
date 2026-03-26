---
phase: 11
slug: free-tier-model-fallback
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node native test runner (`node --test`) |
| **Config file** | none — tests use `--import resolve-ts.mjs` hook (project standard) |
| **Quick run command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` |
| **Full suite command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts src/resources/extensions/gsd/auto/stage-routing.test.ts` |
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
| 11-01-01 | 01 | 1 | FLOW-02 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | FLOW-02 | source-shape | grep-based assertions in downgrade.test.ts | ✅ | ✅ green |
| 11-02-01 | 02 | 2 | FLOW-02 | integration | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` — 263 lines, 20 tests; all passing per 11-VERIFICATION.md
- [x] Existing test infrastructure covers remaining requirements

*Existing infrastructure covers framework requirements — no new framework install needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- Approval: ✅ Approved (post-execution audit — 13/13 SC verified per 11-VERIFICATION.md)
