---
phase: 09-autonomous-orchestration-migration
plan: 02
subsystem: gsd-auto
tags: [tests, tool-profiles, stage-routing, config-threading]
dependency_graph:
  requires: [09-01]
  provides: [unit-config-tests, stage-routing-tests]
  affects: [auto-dispatch.ts]
tech_stack:
  added: []
  patterns: [node:test, source-shape-assertions, readFileSync-regex-extraction]
key_files:
  created:
    - src/resources/extensions/gsd/auto/unit-config.test.ts
    - src/resources/extensions/gsd/auto/stage-routing.test.ts
  modified:
    - src/resources/extensions/gsd/auto-dispatch.ts
decisions:
  - "Use --import resolve-ts.mjs hook for live TypeScript imports (plan stated bare --experimental-strip-types, this is the project-standard approach)"
  - "Add reactive-execute and complete-milestone to both maps as Rule 2 fix — coverages test validates this"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 3
---

# Phase 09 Plan 02: Automated Tests for Phase 9 Orchestration Summary

Created two test files proving per-unit tool profile enforcement, stage derivation map completeness, and config threading correctness for the Phase 9 EXEC-02 wiring.

## What Was Built

### Task 1: Tool Profile and UnitSessionConfig Tests (15 tests)
**File:** `src/resources/extensions/gsd/auto/unit-config.test.ts`

Tests verify:
- `UNIT_TYPE_TOOL_PROFILE` covers 100% of unit types extracted from `DISPATCH_RULES` source
- `resolveToolProfile("coding")` returns `["read", "bash", "edit", "write", "lsp"]`
- `resolveToolProfile("readonly")` returns `["read", "bash", "lsp"]` (no write/edit)
- Specific mappings: `execute-task` → `coding`, `discuss-milestone` → `readonly`, `verify-phase` → `readonly`
- Source-shape: `UnitSessionConfig` defined in `types.ts`, `runUnit` accepts `unitConfig?: UnitSessionConfig`, passes `activeToolNames`, `ExtensionCommandContext.newSession` has `activeToolNames?:` option, `AgentSession.newSession` calls `setActiveToolsByName`

### Task 2: Stage Derivation and Dispatch-to-Config Flow Tests (12 tests)
**File:** `src/resources/extensions/gsd/auto/stage-routing.test.ts`

Tests verify:
- `UNIT_TYPE_TO_STAGE` covers 100% of unit types in `DISPATCH_RULES`
- Every mapped stage value is a valid key in `STAGE_TIER_MAP` (extracted from source)
- Specific mappings: `execute-task` → `execute-task`, `discuss-milestone` → `discuss-phase`, `verify-phase` → `verify-phase`, `research-slice` → `research-phase`, `plan-milestone` → `plan-phase`
- Source-shape: `DispatchAction` has `stage?: string`, `resolveDispatch` assigns `result.stage`, `IterationData` has `stage?:`, phases.ts propagates `stage: dispatchResult.stage` to iterData, phases.ts uses `UNIT_TYPE_TO_STAGE` when building unitConfig

## Verification

```bash
# Unit config tests (15 passing)
node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs \
  --experimental-strip-types \
  src/resources/extensions/gsd/auto/unit-config.test.ts

# Stage routing tests (12 passing)
node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs \
  --experimental-strip-types \
  src/resources/extensions/gsd/auto/stage-routing.test.ts
```

Both run to 0 failures, 0 cancellations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] `reactive-execute` and `complete-milestone` absent from both maps**
- **Found during:** Task 1 (map completeness test design)
- **Issue:** Two unit types dispatched by `DISPATCH_RULES` (`reactive-execute` in the parallel execution path, `complete-milestone` in the milestone completion path) had no entries in `UNIT_TYPE_TOOL_PROFILE` or `UNIT_TYPE_TO_STAGE`. The map completeness tests would have caught this at runtime.
- **Fix:** Added both to `UNIT_TYPE_TOOL_PROFILE` (`"coding"`) and `UNIT_TYPE_TO_STAGE` (`"execute-task"`) — accurate since both involve file writes.
- **Files modified:** `src/resources/extensions/gsd/auto-dispatch.ts`
- **Commits:** b561905a (profile map), 60e5bd74 (stage map)

**2. [Rule 3 - Blocking] Test run command required resolve-ts.mjs hook**
- **Found during:** Task 1 execution
- **Issue:** Plan specified bare `node --experimental-strip-types` as the run command, but `auto-dispatch.ts` has transitive `.js` imports that require the `resolve-ts.mjs` hook to redirect to `.ts`. This is standard project test infrastructure.
- **Fix:** Tests use `node --import ./src/resources/extensions/gsd/tests/resolve-ts.mjs --experimental-strip-types` (project-standard pattern for all GSD tests with live imports).
- **Import style:** Changed from `../auto-dispatch.js` to `../auto-dispatch.ts` (direct `.ts` import per project convention).

## Known Stubs

None — all tests exercise live runtime behavior or verified source patterns.

## Self-Check

- [x] `src/resources/extensions/gsd/auto/unit-config.test.ts` exists
- [x] `src/resources/extensions/gsd/auto/stage-routing.test.ts` exists
- [x] `src/resources/extensions/gsd/auto-dispatch.ts` contains `"reactive-execute": "coding"` and `"complete-milestone": "coding"` in UNIT_TYPE_TOOL_PROFILE
- [x] `src/resources/extensions/gsd/auto-dispatch.ts` contains `"reactive-execute": "execute-task"` and `"complete-milestone": "execute-task"` in UNIT_TYPE_TO_STAGE
- [x] 27 total tests, 27 passing, 0 failures

## Self-Check: PASSED
