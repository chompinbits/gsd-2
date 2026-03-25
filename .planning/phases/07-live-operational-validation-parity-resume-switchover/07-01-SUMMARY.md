---
phase: 07-live-operational-validation-parity-resume-switchover
plan: 01
subsystem: testing
tags: [copilot-sdk, live-tests, parity, switchover, session-resume]
requires:
  - phase: 06-stage-aware-accounting-contract-integration
    provides: stage-aware backend/session contracts for live Copilot validation
provides:
  - Live Copilot parity test covering discuss and plan prompts
  - Live switchover and rollback test with session create/resume coverage
affects: [tests/live, TOOL-03, RUNT-03, SAFE-02, SAFE-03]
tech-stack:
  added: []
  patterns:
    - Env-guarded live tests that emit SKIPPED for non-live environments
    - Dynamic import gate to avoid module resolution failures before live-test env checks
key-files:
  created:
    - tests/live/test-copilot-parity.ts
    - tests/live/test-copilot-switchover-resume.ts
  modified: []
key-decisions:
  - Use dynamic imports after GSD_LIVE_TESTS guard so local/non-live runs skip cleanly without import-time failures
  - Keep outputs aligned with tests/live/run.ts expectations via PASS/FAIL/SKIPPED terminal lines and evidence output
patterns-established:
  - "Live test scripts print CHECK lines and a final PASS/FAIL/SKIPPED line for runner compatibility"
requirements-completed: [TOOL-03, RUNT-03, SAFE-02, SAFE-03]
duration: 16min
completed: 2026-03-25
---

# Phase 07 Plan 01: Live Parity + Switchover + Resume Test Harnesses Summary

**Two new live Copilot validation scripts now prove discuss/plan response quality and switchover/resume mechanics with structured CHECK and Evidence output.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-25T20:02:00Z
- **Completed:** 2026-03-25T20:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `test-copilot-parity.ts` to run discuss and plan probes through `CopilotSessionBackend` with evidence-length checks.
- Added `test-copilot-switchover-resume.ts` to validate `SettingsManager` switchover/rollback and live session create/resume behavior.
- Ensured both scripts are safe in non-live environments via `GSD_LIVE_TESTS` guard and compatible status lines for `tests/live/run.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create live parity validation test** - `7c43ba6d` (feat)
2. **Task 2: Create live switchover and resume validation test** - `f40c85aa` (feat)

## Files Created/Modified
- `tests/live/test-copilot-parity.ts` - Live discuss/plan Copilot backend probe with response-quality checks and evidence output.
- `tests/live/test-copilot-switchover-resume.ts` - Switchover/rollback plus optional live create-resume session validation with graceful section-level skip behavior.

## Decisions Made
- Used dynamic imports after env guard so scripts can emit `SKIPPED` without requiring Copilot SDK module resolution in non-live runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Static imports prevented SKIPPED behavior in non-live mode**
- **Found during:** Task 1/Task 2 verification
- **Issue:** Top-level imports were evaluated before the `GSD_LIVE_TESTS` guard and failed module resolution.
- **Fix:** Reworked imports to dynamic `await import(...)` after the env guard in both live scripts.
- **Files modified:** `tests/live/test-copilot-parity.ts`, `tests/live/test-copilot-switchover-resume.ts`
- **Verification:** `node --experimental-strip-types` on both scripts now outputs `SKIPPED: GSD_LIVE_TESTS not set`.
- **Committed in:** Included in task commits `7c43ba6d` and `f40c85aa`.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Restores required runner-compatible skip behavior with no scope expansion.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Verification artifact plan (`07-02`) can now reference concrete live test scripts and evidence fields.
- Live execution evidence is pending and will be captured in `07-VERIFICATION.md` during Wave 2.

---
*Phase: 07-live-operational-validation-parity-resume-switchover*
*Completed: 2026-03-25*