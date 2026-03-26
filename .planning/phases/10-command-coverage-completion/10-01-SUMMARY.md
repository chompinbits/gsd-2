---
phase: 10-command-coverage-completion
plan: "01"
subsystem: cli-dispatch
tags: [stage-routing, workflow-wrappers, management-commands, accounting]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [FLOW-01-core]
  affects: [src/cli.ts, stage-router.ts]
tech_stack:
  added: []
  patterns: [backend-agnostic-workflow-wrapper, settings-driven-dispatch]
key_files:
  created:
    - src/workflows/roadmap.ts
    - src/workflows/requirements.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts
    - src/cli.ts
decisions:
  - "roadmap and requirements commands route at low tier (0.33×) per D-04"
  - "CLI dispatch pattern follows existing discuss/plan/execute/verify pattern exactly"
  - "Workflow wrappers use same session creation shape as discuss-phase.ts (no tool override)"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-26"
  tasks: 2
  files: 4
requirements: [FLOW-01]
---

# Phase 10 Plan 01: Stage Router + Management Command Dispatch Summary

Management commands (new-project, new-milestone, add-phase, remove-phase, progress) now route through `resolvePlanningBackendFromSettings()` via backend-agnostic workflow wrappers, with roadmap and requirements mapped to low tier (0.33×) in stage accounting.

## What Was Built

### Task 1: Stage router entries + workflow wrappers

Added two new tier entries to `STAGE_TIER_MAP` in `stage-router.ts` and created two new workflow wrappers following the `discuss-phase.ts` pattern:

- `"roadmap": "low"` and `"requirements": "low"` added to STAGE_TIER_MAP Low section
- `src/workflows/roadmap.ts` — wrapper for roadmap management commands (new-project, new-milestone, add-phase, remove-phase) with `stage: 'roadmap'` and `ROADMAP_ACCOUNTING_TIER = 'low'`
- `src/workflows/requirements.ts` — wrapper for requirements commands (progress) with `stage: 'requirements'` and `REQUIREMENTS_ACCOUNTING_TIER = 'low'`

Both wrappers follow the `discuss-phase.ts` session creation pattern exactly: `SessionManager.inMemory()`, `AuthStorage`, `ModelRegistry`, `SettingsManager`, `DefaultResourceLoader`, `createAgentSession({ ..., stage })`.

### Task 2: CLI dispatch blocks

Added 5 management command dispatch blocks to `src/cli.ts` after the `verify-work` block:

| Command | Workflow | Stage telemetry |
|---------|---------|-----------------|
| `new-project` | `runRoadmapWorkflow` | `stage=roadmap` |
| `new-milestone` | `runRoadmapWorkflow` | `stage=roadmap` |
| `add-phase` | `runRoadmapWorkflow` | `stage=roadmap` |
| `remove-phase` | `runRoadmapWorkflow` | `stage=roadmap` |
| `progress` | `runRequirementsWorkflow` | `stage=requirements` |

Each block: calls `resolvePlanningBackendFromSettings()`, logs `[command] backend=<b> stage=<s>`, calls the workflow, logs completion, writes JSON to stdout, exits 0.

**Total `resolvePlanningBackendFromSettings()` call sites in cli.ts: 9** (4 pre-existing + 5 new).

## Verification Results

All plan acceptance criteria verified:

```
✓ "roadmap": "low" in stage-router.ts
✓ "requirements": "low" in stage-router.ts
✓ export async function runRoadmapWorkflow in src/workflows/roadmap.ts
✓ export async function runRequirementsWorkflow in src/workflows/requirements.ts
✓ stage: 'roadmap' in roadmap.ts
✓ stage: 'requirements' in requirements.ts
✓ ROADMAP_ACCOUNTING_TIER = 'low' in roadmap.ts
✓ REQUIREMENTS_ACCOUNTING_TIER = 'low' in requirements.ts
✓ 5 dispatch blocks with correct command strings in cli.ts
✓ 9 resolvePlanningBackendFromSettings() call sites in cli.ts
✓ 4 stage=roadmap log lines in cli.ts
✓ 1 stage=requirements log line in cli.ts
✓ TypeScript: 0 new errors (1 pre-existing error in verify-work.test.ts unrelated to these changes)
```

## Commits

| Commit | Message |
|--------|---------|
| `ae3d8bff` | feat(10-01): stage router entries + roadmap/requirements workflow wrappers |
| `625e2bc8` | feat(10-01): CLI dispatch blocks for management commands |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 5 commands are fully wired from CLI dispatch through workflow wrapper to `createAgentSession`. No placeholders.

## Self-Check: PASSED

- [x] `src/workflows/roadmap.ts` exists
- [x] `src/workflows/requirements.ts` exists
- [x] `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` modified
- [x] `src/cli.ts` modified
- [x] Commit `ae3d8bff` exists
- [x] Commit `625e2bc8` exists
