---
phase: 11
slug: free-tier-model-fallback
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `node --experimental-strip-types --import ./resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` |
| **Full suite command** | `node --experimental-strip-types --import ./resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts src/resources/extensions/gsd/auto/stage-routing.test.ts` |
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
| 11-01-01 | 01 | 1 | FLOW-02 | unit | `node --experimental-strip-types --import ./resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | FLOW-02 | source-shape | grep-based assertions in downgrade.test.ts | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | FLOW-02 | integration | `node --experimental-strip-types --import ./resolve-ts.mjs --test packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` — stubs for FLOW-02 downgrade logic
- [ ] Existing test infrastructure covers remaining requirements

*Existing infrastructure covers framework requirements — no new framework install needed.*

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
