---
phase: 10
slug: command-coverage-completion
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (`node --test`) |
| **Config file** | `package.json` scripts |
| **Quick run command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/roadmap.test.ts src/workflows/requirements.test.ts` |
| **Full suite command** | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/cli-dispatch.test.ts src/workflows/roadmap.test.ts src/workflows/requirements.test.ts packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` |
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
| 10-01-01 | 01 | 1 | FLOW-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/roadmap.test.ts` | ✅ | ✅ green |
| 10-01-02 | 01 | 1 | FLOW-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/workflows/requirements.test.ts` | ✅ | ✅ green |
| 10-02-01 | 02 | 1 | FLOW-01 | source-shape | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test src/cli-dispatch.test.ts` | ✅ | ✅ green |
| 10-02-02 | 02 | 1 | FLOW-01 | unit | `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types --test packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files pre-existing — no Wave 0 scaffold required.

- [x] `src/workflows/roadmap.test.ts` — 7 tests covering export shape, session stage, accounting tier, telemetry; all pre-existing
- [x] `src/workflows/requirements.test.ts` — 7 tests covering export shape, session stage, accounting tier, telemetry; all pre-existing
- [x] `src/cli-dispatch.test.ts` — source-shape tests for all 5 management command dispatch blocks; pre-existing
- [x] `packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` — stage-tier tests for roadmap/requirements; pre-existing

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- Approval: ✅ Approved (post-execution audit — 125/125 tests pass per 10-VERIFICATION.md)

---

*Phase: 10-command-coverage-completion*
*Created: 2026-03-26*
