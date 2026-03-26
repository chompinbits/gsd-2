---
phase: 08
slug: execute-verify-backend-routing
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (`node --test`) |
| **Config file** | `package.json` scripts |
| **Quick run command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/execute-phase.test.ts src/workflows/verify-work.test.ts` |
| **Full suite command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/execute-phase.test.ts src/workflows/verify-work.test.ts packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts src/cli-dispatch.test.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | EXEC-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/execute-phase.test.ts` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | EXEC-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/verify-work.test.ts` | ✅ | ✅ green |
| 08-02-01 | 02 | 1 | EXEC-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` | ✅ | ✅ green |
| 08-03-01 | 03 | 2 | EXEC-01 | integration | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/execute-phase.test.ts src/workflows/verify-work.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/workflows/execute-phase.test.ts` — 12 tests for execute workflow routing, tool profile; all passing
- [x] `src/workflows/verify-work.test.ts` — 14 tests for verify workflow routing, tool profile; all passing

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- Approval: ✅ Approved (post-execution audit — 4/4 SC verified per 08-VERIFICATION.md)

---
*Phase 08 — Execute & Verify Backend Routing*
*Created: 2026-03-25*
