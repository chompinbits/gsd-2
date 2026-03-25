---
phase: "05"
plan: "01"
subsystem: "planning-parity-evidence-revalidation"
tags: ["requirement-evidence", "parity-regression-gate", "traceability", "npm-test"]
dependency_graph:
  requires:
    - phase: "03"
      provides: "parity test suites in src/tests/parity/, integration tests in src/tests/integration/"
    - phase: "04"
      provides: "e2e-planning-parity.test.ts E2E roundtrip parity harness"
  provides:
    - "Parity suites in default npm test regression gate"
    - "Explicit requirement-ID verification evidence for TOOL-02, PLAN-01, PLAN-02"
    - "Restored milestone traceability for three orphaned requirements"
  affects:
    - package.json
    - .planning/phases/05-planning-parity-evidence-revalidation/05-VERIFICATION.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/03-planning-workflow-migration/03-SUMMARY.md
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/phases/05-planning-parity-evidence-revalidation/05-VERIFICATION.md
  modified:
    - package.json
    - .planning/REQUIREMENTS.md
    - .planning/phases/03-planning-workflow-migration/03-SUMMARY.md
key-decisions:
  - "Parity tests added to test:unit glob (not test:integration) since they are mock-based unit-level parity checks, not integration tests requiring external resources"
  - "Phase 3 summary retroactively updated with requirements-completed to close the frontmatter evidence gap identified by milestone audit"

requirements-completed:
  - TOOL-02
  - PLAN-01
  - PLAN-02

completed: "2026-03-25"
---

# Phase 05 Plan 01: Parity Regression Gate + Requirement Evidence Summary

**Wired 46 parity tests into default npm test path and created explicit requirement-ID verification evidence for the three orphaned requirements (TOOL-02, PLAN-01, PLAN-02) identified by the v1.0 milestone audit.**

---

## Accomplishments

- Added `src/tests/parity/*.test.ts` glob to `test:unit` script in package.json — all 46 parity tests (12 + 11 + 23) now run as part of default `npm test`
- Created 05-VERIFICATION.md with per-requirement evidence tables mapping TOOL-02, PLAN-01, PLAN-02 to specific test files and Phase 3 verification cross-references
- Updated REQUIREMENTS.md traceability: all three requirements now show Phase 5/Complete
- Updated REQUIREMENTS.md checkboxes: TOOL-02, PLAN-01, PLAN-02 marked as `[x]`
- Added `requirements-completed: [TOOL-02, PLAN-01, PLAN-02]` to Phase 3 summary frontmatter

---

## What Was Built

### Task 1: package.json (MODIFIED)

Added `src/tests/parity/*.test.ts` to end of `test:unit` script glob. This ensures all parity suites execute in the default regression gate (`npm test` → `npm run test:unit`).

Files now covered: `planning-parity.test.ts` (12 tests), `plan-check-equivalence.test.ts` (11 tests), `e2e-planning-parity.test.ts` (23 tests).

### Task 2: Verification Evidence + Traceability (NEW + MODIFIED)

- **05-VERIFICATION.md** (NEW): Per-requirement evidence tables with specific test files, test counts, and cross-references to Phase 3 verification tables. Frontmatter includes `requirements_verified: [TOOL-02, PLAN-01, PLAN-02]` and `status: passed`.
- **REQUIREMENTS.md** (MODIFIED): Three traceability rows updated from Pending to Complete; three requirement checkboxes marked `[x]`.
- **03-SUMMARY.md** (MODIFIED): Added `requirements-completed` field to frontmatter listing the three requirements Phase 3 delivered.
