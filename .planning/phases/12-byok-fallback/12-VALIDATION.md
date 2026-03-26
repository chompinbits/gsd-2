---
phase: 12
slug: byok-fallback
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` |
| **Full suite command** | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` |
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
| 12-01-01 | 01 | 1 | FLOW-03 | unit | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | FLOW-03 | unit | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | FLOW-03 | source-shape | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | FLOW-03 | unit | `node --test --import ./resolve-ts.mjs packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pi-coding-agent/src/core/backends/accounting/byok.test.ts` — stubs for FLOW-03 BYOK logic
- [ ] Test infrastructure already present — no framework install needed

*Existing Node.js test runner infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
