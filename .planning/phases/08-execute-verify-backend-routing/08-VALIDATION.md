---
phase: 08
slug: execute-verify-backend-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `node --test src/workflows/execute-phase.test.ts src/workflows/verify-work.test.ts` |
| **Full suite command** | `npm test` |
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
| 08-01-01 | 01 | 1 | EXEC-01 | unit | `node --test src/workflows/execute-phase.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | EXEC-01 | unit | `node --test src/workflows/verify-work.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | EXEC-01 | unit | `node --test packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 2 | EXEC-01 | integration | `node --test src/workflows/execute-phase.test.ts src/workflows/verify-work.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/workflows/execute-phase.test.ts` — stubs for execute workflow routing, tool profile
- [ ] `src/workflows/verify-work.test.ts` — stubs for verify workflow routing, tool profile

---
*Phase 08 — Execute & Verify Backend Routing*
*Created: 2026-03-25*
