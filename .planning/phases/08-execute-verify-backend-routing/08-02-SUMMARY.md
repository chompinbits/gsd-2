---
phase: 08-execute-verify-backend-routing
plan: 02
subsystem: tests
tags: [tests, execute, verify, backend-routing, accounting, stage-aliases, source-shape]
dependency_graph:
  requires: [08-01-execute-verify-workflow-wrappers]
  provides: [stage-alias-unit-tests, execute-workflow-tests, verify-workflow-tests]
  affects: [test-coverage, D-10-telemetry-verification, D-05-parity]
tech_stack:
  added: []
  patterns: [source-shape-tests, node-native-test-runner, dynamic-import-parser-tests]
key_files:
  created:
    - src/workflows/execute-phase.test.ts
    - src/workflows/verify-work.test.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts
decisions:
  - "Used source-shape tests (readFileSync pattern assertions) for routing/tool-profile contracts to avoid SDK auth dependencies"
  - "Dynamic import of verify-work.ts for parser tests — works because @gsd/pi-coding-agent resolves to symlinked dist and app-paths.js exists"
  - "telemetry tier test matches constant declaration (EXECUTE_PHASE_ACCOUNTING_TIER = 'standard') not literal string — source uses template interpolation"
  - "Tests run with --experimental-strip-types (no resolve-ts.mjs needed for source-shape tests; dynamic import path transparent)"
metrics:
  duration: ~8m
  completed: "2026-03-26"
  tasks_completed: 3
  files_changed: 3
---

# Phase 08 Plan 02: Test Coverage for Execute/Verify Workflow Wrappers Summary

Unit tests covering stage-alias tier attribution, execute-phase routing/tool-profile contracts, verify-work routing/tool-profile contracts, and extractVerifyChecks parser behavior.

## What Was Built

### Task 1: Stage Alias Tests in accounting.test.ts
Added three v1.1 alias tests to the `getStageMultiplierTier` describe block:
```typescript
it("returns 'standard' for execute-phase alias", () => { ... });
it("returns 'free' for verify-phase alias", () => { ... });
it("returns 'free' for run-uat alias", () => { ... });
```
54 total tests pass (previously 51).

### Task 2: Execute-Phase Workflow Source-Shape Tests
New file `src/workflows/execute-phase.test.ts` with 12 tests:
- Export shape: `runExecuteWorkflow`, `ExecuteConfig`, `ExecuteOptions`, `ExecuteOutput`
- Backend routing: `createAgentSession` present, `backend` param forwarded
- Tool profile (D-07): `codingTools` present, `readOnlyTools` absent
- Stage accounting (D-04): `execute-task` stage literal, `EXECUTE_PHASE_ACCOUNTING_TIER = 'standard'`
- Prompt contract (D-01): `{OBJECTIVE}` and `{CONTEXT_SECTION}` placeholders

### Task 3: Verify-Work Workflow Tests
New file `src/workflows/verify-work.test.ts` with 14 tests:
- Export shape: `runVerifyWorkflow`, `extractVerifyChecks`, `VerifyConfig`, `VerifyOptions`, `VerifyOutput`
- Backend routing: `createAgentSession` present
- Tool profile (D-08): `readOnlyTools` present, `codingTools` absent
- Stage accounting (D-04): `verify-work` stage literal, `VERIFY_WORK_ACCOUNTING_TIER = 'free'`
- Parser tests (runtime): single check, mixed pass/fail, no checks, check without details

## Verification Results

```
accounting.test.ts:   54 tests, 54 pass, 0 fail  ✓
execute-phase.test.ts: 12 tests, 12 pass, 0 fail  ✓
verify-work.test.ts:   14 tests, 14 pass, 0 fail  ✓
Total:                 80 tests, 80 pass, 0 fail  ✓
```

## Commits

| Hash | Message |
|------|---------|
| c96f8145 | test(08-02): add v1.1 stage alias unit tests to accounting |
| 8e07b90e | test(08-02): create execute-phase workflow source-shape tests |
| 91e879fa | test(08-02): create verify-work workflow source-shape and parser tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated telemetry tier test regex to match actual source**
- **Found during:** Task 2 initial test run
- **Issue:** Plan specified `/tier=standard/` but source uses `tier=${EXECUTE_PHASE_ACCOUNTING_TIER}` (template interpolation of constant), not a literal string
- **Fix:** Changed regex to `/EXECUTE_PHASE_ACCOUNTING_TIER\s*=\s*'standard'/` to match the constant declaration — semantically equivalent (D-10 requirement still satisfied)
- **Files modified:** `src/workflows/execute-phase.test.ts`
- **Note:** Applied same pattern to verify-work.test.ts tier test proactively

## Known Stubs

None — all tests exercise real behavior. Source-shape tests assert actual source file structure; parser tests exercise the real `extractVerifyChecks` function via dynamic import.

## Self-Check: PASSED

- [x] `packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` — modified, 3 new alias tests
- [x] `src/workflows/execute-phase.test.ts` — EXISTS, 12 tests pass
- [x] `src/workflows/verify-work.test.ts` — EXISTS, 14 tests pass
- [x] git log confirms all 3 task commits: c96f8145, 8e07b90e, 91e879fa
- [x] All 80 tests pass with exit code 0
