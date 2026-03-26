---
phase: "09"
plan: "01"
subsystem: auto-mode orchestration
tags: [exec-02, stage-routing, tool-filtering, newSession, dispatch]
dependency_graph:
  requires: [08-01, 08-02, 08-03]
  provides: [unitConfig-threading, per-unit-tool-profiles, stage-propagation]
  affects: [auto-dispatch, run-unit, phases, session, agent-session]
tech_stack:
  added: []
  patterns:
    - UnitSessionConfig threaded as optional parameter (non-breaking)
    - Stage annotation in resolveDispatch (both registry and inline fallback paths)
    - Tool filter applied AFTER _buildRuntime to avoid extension rebuild override
key_files:
  created: []
  modified:
    - src/resources/extensions/gsd/auto/types.ts
    - src/resources/extensions/gsd/auto-dispatch.ts
    - src/resources/extensions/gsd/auto/run-unit.ts
    - src/resources/extensions/gsd/auto/phases.ts
    - src/resources/extensions/gsd/auto/session.ts
    - packages/pi-coding-agent/src/core/extensions/types.ts
    - packages/pi-coding-agent/src/core/extensions/runner.ts
    - packages/pi-coding-agent/src/core/agent-session.ts
decisions:
  - "activeToolNames applied after _buildRuntime to avoid extension rebuild override (D-07 enforcement)"
  - "resolveDispatch annotates stage in both registry and inline-loop paths for full coverage"
  - "defaultBackend defaults to 'pi' in AutoSession; per-unit config layers on top at newSession"
  - "pi-coding-agent dist rebuilt from source; dist gitignored per .gitignore convention"
metrics:
  duration: "~9 minutes"
  completed_date: "2026-03-26"
  tasks: 3
  files: 8
---

# Phase 09 Plan 01: Stage-Aware Config Threading Summary

**One-liner:** Per-unit stage/tool-profile config threaded from dispatch through runUnitPhase/runUnit into newSession.activeToolNames using UNIT_TYPE_TO_STAGE and UNIT_TYPE_TOOL_PROFILE maps.

## Objective

Wire per-unit stage-aware config from auto-mode dispatch through the session creation chain, enabling Copilot backend to receive correct stage, tool restrictions, and accounting metadata for each auto-mode unit type (EXEC-02, SC-1 through SC-3).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Define UnitSessionConfig type and stage/tool-profile maps | `6137e4c5` | types.ts, auto-dispatch.ts |
| 2 | Extend newSession() to accept activeToolNames option | `1058e67d` | extensions/types.ts, runner.ts, agent-session.ts |
| 3 | Wire config from dispatch through runUnitPhase and runUnit to newSession | `937e5692` | run-unit.ts, phases.ts, session.ts |

## Changes Made

### Task 1: UnitSessionConfig Type and Maps

**`src/resources/extensions/gsd/auto/types.ts`:**
- Added `UnitSessionConfig` interface with `stage?`, `availableToolNames?`, `modelHint?` fields
- Added `stage?: string` field to `IterationData` interface

**`src/resources/extensions/gsd/auto-dispatch.ts`:**
- Added `stage?: string` field to `DispatchAction` dispatch variant
- Added `UNIT_TYPE_TO_STAGE` map (13 unit types → STAGE_TIER_MAP keys)
- Added `ToolProfile` type (`"coding" | "readonly"`)
- Added `UNIT_TYPE_TOOL_PROFILE` map (13 unit types → tool profiles)
- Added `resolveToolProfile()` helper function
- Updated `resolveDispatch()` to annotate `result.stage` in both registry and inline fallback paths

### Task 2: newSession() activeToolNames Option

**`packages/pi-coding-agent/src/core/extensions/types.ts`:**
- Added `activeToolNames?: string[]` to `ExtensionCommandContext.newSession()`
- Added `activeToolNames?: string[]` to `ExtensionCommandContextActions.newSession`

**`packages/pi-coding-agent/src/core/extensions/runner.ts`:**
- Added `activeToolNames?: string[]` to `NewSessionHandler` type

**`packages/pi-coding-agent/src/core/agent-session.ts`:**
- Added `activeToolNames?: string[]` to `newSession()` method signature
- Added `setActiveToolsByName(options.activeToolNames)` call AFTER `_buildRuntime()` and `setup` callback, BEFORE `_reconnectToAgent()` (prevents extension rebuild from overriding filter)

### Task 3: Full Config Threading

**`src/resources/extensions/gsd/auto/run-unit.ts`:**
- Imported `UnitSessionConfig` type
- Added `unitConfig?: UnitSessionConfig` parameter to `runUnit()` signature
- Updated `newSession()` call to pass `{ activeToolNames: unitConfig?.availableToolNames }`

**`src/resources/extensions/gsd/auto/phases.ts`:**
- Imported `UnitSessionConfig` from types.ts
- Imported `UNIT_TYPE_TO_STAGE`, `UNIT_TYPE_TOOL_PROFILE`, `resolveToolProfile` from auto-dispatch.ts
- Added `stage: dispatchResult.stage` to `runDispatch()` return data
- Added `unitConfig` building in `runUnitPhase()` using `UNIT_TYPE_TOOL_PROFILE` lookup
- Passed `unitConfig` to `runUnit()` call

**`src/resources/extensions/gsd/auto/session.ts`:**
- Added `defaultBackend: "pi" | "copilot" = "pi"` property to `AutoSession`
- Added `this.defaultBackend = "pi"` to `reset()` method

## Verification

```
npx tsc --noEmit --project tsconfig.extensions.json  → 0 errors (clean)
npx tsc --noEmit --project tsconfig.json             → 1 pre-existing error in
                                                        verify-work.test.ts
                                                        (not introduced by this plan)
```

All acceptance criteria met:
- ✅ `UnitSessionConfig` interface defined in types.ts
- ✅ `UNIT_TYPE_TO_STAGE` map exported from auto-dispatch.ts
- ✅ `UNIT_TYPE_TOOL_PROFILE` map exported from auto-dispatch.ts
- ✅ `resolveToolProfile()` exported from auto-dispatch.ts
- ✅ `DispatchAction` dispatch variant has `stage?: string`
- ✅ `resolveDispatch()` annotates `result.stage` from `UNIT_TYPE_TO_STAGE`
- ✅ `ExtensionCommandContext.newSession()` includes `activeToolNames?: string[]`
- ✅ `NewSessionHandler` type includes `activeToolNames?: string[]`
- ✅ `AgentSession.newSession()` applies tool filter AFTER `_buildRuntime()`
- ✅ `runUnit()` signature includes `unitConfig?: UnitSessionConfig`
- ✅ `runUnit()` passes `unitConfig?.availableToolNames` to `newSession()`
- ✅ `runUnitPhase()` builds `UnitSessionConfig` from dispatch maps
- ✅ `runUnitPhase()` passes `unitConfig` to `runUnit()`
- ✅ `runDispatch()` propagates `dispatchResult.stage` into `iterData.stage`
- ✅ `AutoSession` has `defaultBackend: "pi" | "copilot"` property

## Stage Coverage

| Unit Type | Stage (accounting) | Tool Profile |
|-----------|-------------------|--------------|
| discuss-milestone | discuss-phase | readonly |
| research-milestone | research-phase | readonly |
| research-slice | research-phase | readonly |
| plan-milestone | plan-phase | readonly |
| plan-slice | plan-phase | readonly |
| execute-task | execute-task | coding |
| complete-slice | execute-task | coding |
| run-uat | run-uat | readonly |
| verify-phase | verify-phase | readonly |
| rewrite-docs | execute-task | coding |
| reassess-roadmap | plan-phase | readonly |
| replan-slice | plan-phase | readonly |
| validate-milestone | validate-phase | readonly |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pi-coding-agent dist rebuild needed**
- **Found during:** Task 2 verification
- **Issue:** `tsconfig.extensions.json` resolves `@gsd/pi-coding-agent` types from `dist/index.d.ts` (compiled). Source changes to `packages/pi-coding-agent/src/` require rebuilding dist for TypeScript to pick up `activeToolNames`.
- **Fix:** Ran `npm run build` in `packages/pi-coding-agent/` to rebuild dist. Dist is gitignored per convention.
- **Impact:** None — dist rebuild is normal dev workflow. Source changes are in git.

## Known Stubs

None — all implementation is fully wired. No placeholder values or hardcoded empties in data flow.

## Self-Check: PASSED

```
[ -f "src/resources/extensions/gsd/auto/types.ts" ] → FOUND
[ -f "src/resources/extensions/gsd/auto-dispatch.ts" ] → FOUND
[ -f "src/resources/extensions/gsd/auto/run-unit.ts" ] → FOUND
[ -f "src/resources/extensions/gsd/auto/phases.ts" ] → FOUND
[ -f "src/resources/extensions/gsd/auto/session.ts" ] → FOUND
[ -f "packages/pi-coding-agent/src/core/agent-session.ts" ] → FOUND
git log --oneline | grep 6137e4c5 → FOUND
git log --oneline | grep 1058e67d → FOUND
git log --oneline | grep 937e5692 → FOUND
```
