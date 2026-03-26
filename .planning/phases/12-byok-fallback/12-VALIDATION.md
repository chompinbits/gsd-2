---
phase: 12
slug: byok-fallback
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (`node --test`) |
| **Config file** | none — tests run directly via `node --test` with `--import` hook |
| **Quick run command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` |
| **Full suite command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` |
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
| 12-01-01 | 01 | 1 | FLOW-03 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | FLOW-03 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ✅ | ✅ green |
| 12-02-01 | 02 | 2 | FLOW-03 | source-shape | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ✅ | ✅ green |
| 12-02-02 | 02 | 2 | FLOW-03 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` — 36 tests; all passing per 12-VERIFICATION.md
- [x] Test infrastructure already present — no framework install needed

*Existing Node.js test runner infrastructure covers all phase requirements.*

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
- Approval: ✅ Approved (post-execution audit — 4/4 SC verified per 12-VERIFICATION.md)
