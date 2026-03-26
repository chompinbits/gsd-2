---
phase: 08-execute-verify-backend-routing
plan: 01
subsystem: workflows
tags: [execute, verify, backend-routing, accounting, stage-aliases]
dependency_graph:
  requires: [phase-07-foundation, createAgentSession, codingTools, readOnlyTools]
  provides: [execute-phase-workflow, verify-work-workflow, stage-tier-aliases-v1.1]
  affects: [accounting-tier-map, workflow-routing, parity-tests]
tech_stack:
  added: []
  patterns: [backend-agnostic-session-wrapper, discuss-plan-pattern, stateless-ephemeral-sessions]
key_files:
  created:
    - src/workflows/execute-phase.ts
    - src/workflows/verify-work.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts
decisions:
  - "Used codingTools for execute (full read/bash/edit/write) per D-07 tool profile contract"
  - "Used readOnlyTools for verify (read/bash only, no write/edit) per D-08 no-write contract"
  - "stage: 'execute-task' (not 'execute-phase') used in createAgentSession to match existing STAGE_TIER_MAP key"
  - "extractVerifyChecks exported as standalone function to allow unit testing independently of session"
metrics:
  duration: ~10m
  completed: "2026-03-26"
  tasks_completed: 3
  files_changed: 3
---

# Phase 08 Plan 01: Stage Aliases + Execute/Verify Workflow Wrappers Summary

Execute-phase and verify-work backend-agnostic session wrappers using codingTools/readOnlyTools, plus v1.1 stage aliases in STAGE_TIER_MAP.

## What Was Built

### Task 1: Stage Aliases in STAGE_TIER_MAP
Added three v1.1 aliases to `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`:

```typescript
// v1.1 stage aliases — auto-dispatch and workflow entry-point names (per D-05)
"execute-phase": "standard",  // 1× — synonym for execute-task used by auto-dispatch
"verify-phase": "free",       // 0× — synonym for verify-work used by auto-dispatch
"run-uat": "free",            // 0× — user acceptance testing
```

### Task 2: Execute-Phase Workflow Wrapper (`src/workflows/execute-phase.ts`)
New file following established discuss-phase/plan-phase pattern:
- Exports: `ExecuteConfig`, `ExecuteOptions`, `ExecuteOutput`, `runExecuteWorkflow`
- `createAgentSession` called with `backend` from options, `stage: 'execute-task'`, `tools: codingTools`
- Full coding tool set (read, bash, edit, write) per D-07
- D-10 telemetry: `[execute-phase] backend=<b> tier=standard stage=execute-task`
- Prompt template with `{OBJECTIVE}` and `{CONTEXT_SECTION}` placeholders
- Tool call counting via `messages.filter(m => m.role === 'tool').length`

### Task 3: Verify-Work Workflow Wrapper (`src/workflows/verify-work.ts`)
New file following same pattern but with verify-specific configuration:
- Exports: `VerifyConfig`, `VerifyOptions`, `VerifyOutput`, `VerifyCheck`, `runVerifyWorkflow`, `extractVerifyChecks`
- `createAgentSession` called with `backend` from options, `stage: 'verify-work'`, `tools: readOnlyTools`
- Read-only tool set (read, bash — no write/edit) per D-08
- D-10 telemetry: `[verify-work] backend=<b> tier=free stage=verify-work`
- Prompt template with `{SCOPE}`, `{CRITERIA_SECTION}`, `{CONTEXT_SECTION}` placeholders
- `extractVerifyChecks()` parses structured CHECK/STATUS/DETAILS blocks from response
- `passed` field derived from all checks passing (conservative: empty checks → false)

## Verification Results

```
grep -c '"execute-phase"\|"verify-phase"\|"run-uat"' stage-router.ts  → 3
grep -c "createAgentSession" src/workflows/execute-phase.ts            → 3
grep -c "codingTools" src/workflows/execute-phase.ts                   → 5
grep -c "execute-task" src/workflows/execute-phase.ts                  → 5
grep -c "createAgentSession" src/workflows/verify-work.ts              → 3
grep -c "readOnlyTools" src/workflows/verify-work.ts                   → 5
grep -c "verify-work" src/workflows/verify-work.ts                     → 11
npx tsc --noEmit --project tsconfig.json                               → (clean, no errors)
```

## Commits

| Hash | Message |
|------|---------|
| b23c40ca | feat(08-01): add execute-phase, verify-phase, run-uat to STAGE_TIER_MAP |
| e0e5b99f | feat(08-01): create execute-phase workflow wrapper |
| 8a94ddc4 | feat(08-01): create verify-work workflow wrapper |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — both workflow wrappers are fully wired. `extractVerifyChecks` is a real parser, not a placeholder.

## Self-Check: PASSED

- [x] `src/workflows/execute-phase.ts` — EXISTS
- [x] `src/workflows/verify-work.ts` — EXISTS
- [x] `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` — contains all 3 aliases
- [x] git log confirms all 3 task commits: b23c40ca, e0e5b99f, 8a94ddc4
- [x] TypeScript compilation: clean
