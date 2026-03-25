---
phase: "03"
plan: "02"
subsystem: "planning-workflow-migration"
tags: ["backend-routing", "plan-phase", "copilot-sdk", "cli", "accounting"]
dependency_graph:
  requires: ["01-adapter-layer-sdk-foundation", "02-request-accounting-model-routing", "03-01"]
  provides: ["plan-phase-workflow", "validatePlanArtifact", "plan-backend-flag-cli"]
  affects: ["src/cli.ts", "src/workflows/plan-phase.ts"]
tech_stack:
  added: []
  patterns: ["backend-aware session routing", "D-09 safe default", "D-10 telemetry logging", "accounting tier constant"]
key_files:
  created:
    - src/workflows/plan-phase.ts
  modified:
    - src/cli.ts
decisions:
  - "D-09 safe default preserved: backend defaults to 'pi' on plan-phase path; no default switchover"
  - "D-07 session routing: createAgentSession({backend}) is the single routing point; no per-backend branching in plan generation"
  - "D-10 telemetry: stderr logs at session start (backend + tier) and after plan parsing (phase/slice/task counts)"
  - "D-01 parity: parsePlanArtifact() operates on normalized text output identical across backends"
  - "Accounting tier: plan-phase always maps to 'standard' (1x) per Phase 2 STAGE_TIER_MAP; inlined as constant to avoid cross-package internal import"
metrics:
  duration_min: 9
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_date: "2026-03-25"
---

# Phase 03 Plan 02: Copilot Plan Workflow Migration Summary

**One-liner:** Backend-aware `runPlanWorkflow()` routes plan-phase sessions to Pi or Copilot SDK via `createAgentSession({backend})`, with `--backend` CLI flag, `GSD_PLANNING_BACKEND` env var, accounting tier telemetry, and `validatePlanArtifact()` for parity scoring.

---

## What Was Built

### `src/workflows/plan-phase.ts` (NEW)

Programmatic plan-phase workflow module. Key exports:

- **`PhaseDefinition`**, **`SliceDefinition`**, **`TaskDefinition`**, **`PlanOutput`**, **`PlanConfig`**, **`PlanOptions`**, **`PlanValidationResult`** — type contracts matching the plan spec
- **`validatePlanArtifact(output)`** — validates a `PlanOutput` for structural completeness (phases, slices, tasks, descriptions); returns `{valid, score: 0–100, issues[]}` for parity comparison (D-05, D-06)
- **`parsePlanArtifact(text)`** (internal) — parses numbered Phase/Slice/Task headings with Risk, Dependencies, Estimated Hours, and Description fields; backend-agnostic by design (D-01, D-03)
- **`runPlanWorkflow(config, options)`** — calls `createAgentSession({backend})` with the chosen backend, sends a structured plan-phase prompt via `session.prompt({expandPromptTemplates: false})`, collects from `session.state.messages`, returns `PlanOutput`

Session creation is the single backend-specific seam (D-07). All plan parsing, validation, and output assembly is identical for both `'pi'` and `'copilot'` paths.

**Accounting integration:** `plan-phase` maps to `'standard'` tier (1×) per Phase 2 `STAGE_TIER_MAP`. The tier is stored as a local constant `PLAN_PHASE_ACCOUNTING_TIER = 'standard'` with a comment referencing the source. This avoids a cross-package internal import while maintaining full transparency for D-10 telemetry. The actual accounting (request tracking, budget guard) happens automatically inside `copilot-backend.ts` when the copilot backend is used.

### `src/cli.ts` (MODIFIED)

One addition:
1. **`gsd plan-phase [objective]` subcommand handler** — placed after the discuss-phase handler, before the main interactive mode;
   - priority: `--backend` flag > `GSD_PLANNING_BACKEND` env var > `'pi'` default (D-09);
   - D-10 telemetry: logs `[plan-phase] backend=<backend> tier=standard` at start;
   - outputs `PlanOutput` as JSON to stdout; completion count logged to stderr (D-10)

---

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript compile | `npx tsc --noEmit` | ✅ zero errors |
| Function signature Task 1 | `grep -A5 "async function runPlanWorkflow"` | ✅ accepts backend param, routes to createAgentSession |
| Exports Task 1 | `grep "export function validatePlanArtifact\|export interface PlanOutput\|export async function runPlanWorkflow"` | ✅ all 3 key exports present |
| Accounting tier Task 1 | `grep "PLAN_PHASE_ACCOUNTING_TIER\|tier=standard"` | ✅ standard tier constant + D-10 telemetry in both files |
| CLI Task 2 | `grep -A3 "plan-phase"` in cli.ts | ✅ handler with backend routing, tier logging, D-09/D-10 compliance |
| App smoke + headless tests | `--test src/tests/app-smoke.test.ts src/tests/headless-detection.test.ts` | ✅ 27/27 pass |
| Discuss prompt tests | `--test src/resources/extensions/gsd/tests/discuss-prompt.test.ts` | ✅ 1/1 pass |

**Task 3 (live plan-check parity baseline):** Deferred — same status as 03-01 Task 3. Live LLM side-by-side execution requires a running Pi and Copilot credential environment. The code paths are correctly wired and TypeScript-verified. `validatePlanArtifact()` is ready to score both backend outputs. Parity evaluation against actual plan content is naturally scoped to plan 03-03 (Parity Testing + Integration Validation).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/workflows/plan-phase.ts` did not exist**
- **Found during:** Task 1 — plan says "open src/workflows/plan-phase.ts and modify the existing `runPlanWorkflow()` function"
- **Issue:** Same situation as 03-01: the file was a planned deliverable, not an existing file. Only `discuss-phase.ts` existed in `src/workflows/`.
- **Fix:** Created the file from scratch implementing the full interface specified in the plan's `<interfaces>` block, including all exported types, `validatePlanArtifact()`, `parsePlanArtifact()`, and `runPlanWorkflow()`.
- **Files modified:** `src/workflows/plan-phase.ts` (created)
- **Commit:** 339eb9d9

**2. [Rule 3 - Blocking] Plan's `createAgentSession()` call includes `accountingStage` and `stageTier` params that don't exist in the real API**
- **Found during:** Task 1 implementation
- **Issue:** The plan's action block shows `createAgentSession({ ...config, backend, accountingStage: 'plan-phase', stageTier })`. The actual `CreateAgentSessionOptions` interface has no `accountingStage` or `stageTier` fields. The accounting for copilot backend is wired internally in `copilot-backend.ts` via `setAccountingConfig()`.
- **Fix:** Used the same pattern as `discuss-phase.ts` — pass only `backend` to `createAgentSession()`. The accounting tier is tracked locally as `PLAN_PHASE_ACCOUNTING_TIER = 'standard'` (deterministic from `STAGE_TIER_MAP`) and logged via D-10 telemetry. Real accounting happens automatically inside the copilot backend.
- **Commit:** 339eb9d9

**3. [Rule 3 deviation] `getStageMultiplierTier` import path `@core/backends/accounting` does not exist**
- **Found during:** Task 1 — plan says `import { getStageMultiplierTier } from '@core/backends/accounting'`
- **Issue:** `@core` is not a TypeScript path alias in this project. The function is in `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` but not exported from the public `@gsd/pi-coding-agent` package. Cross-package internal imports from `src/` would bypass the package boundary and break the build.
- **Fix:** Inlined the tier as `const PLAN_PHASE_ACCOUNTING_TIER = 'standard' as const` with a comment referencing the source. Since `STAGE_TIER_MAP['plan-phase']` is `'standard'` and this mapping doesn't change within Phase 3, the constant is semantically equivalent and avoids an architectural import issue.
- **Commit:** 339eb9d9

**4. [Rule 3 deviation] Task 3 not fully executable — deferred to plan 03-03**
- **Found during:** Task 3 evaluation
- **Issue:** Task 3 requires generating PLAN.md files from both backends via live LLM calls and running `plan-check` on both. This requires configured credentials.
- **Fix:** `runPlanWorkflow` and `validatePlanArtifact` are correctly wired and TypeScript-verified. Parity baseline evaluation is naturally scoped to plan 03-03. Documented here for completeness.

---

## Known Stubs

None — implementation is complete with real behavior. `parsePlanArtifact()` and `validatePlanArtifact()` operate on actual LLM output text; no hardcoded empty returns.

---

## Self-Check

```bash
[ -f "src/workflows/plan-phase.ts" ] && echo "FOUND: plan-phase.ts" || echo "MISSING"
git log --oneline --all | grep -q "339eb9d9" && echo "COMMIT FOUND: 339eb9d9" || echo "MISSING"
```

- [x] `src/workflows/plan-phase.ts` — file exists
- [x] `src/cli.ts` — modified with plan-phase handler, --backend flag (from 03-01), and tier telemetry
- [x] commit `339eb9d9` — verified in git log

## Self-Check: PASSED
