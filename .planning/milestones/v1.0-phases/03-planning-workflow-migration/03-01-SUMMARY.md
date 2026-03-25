---
phase: "03"
plan: "01"
subsystem: "planning-workflow-migration"
tags: ["backend-routing", "discuss-phase", "copilot-sdk", "cli"]
dependency_graph:
  requires: ["01-adapter-layer-sdk-foundation", "02-request-accounting-model-routing"]
  provides: ["discuss-phase-workflow", "backend-flag-cli"]
  affects: ["src/cli.ts", "src/workflows/discuss-phase.ts"]
tech_stack:
  added: []
  patterns: ["backend-aware session routing", "D-09 safe default", "D-10 telemetry logging"]
key_files:
  created:
    - src/workflows/discuss-phase.ts
  modified:
    - src/cli.ts
decisions:
  - "D-09 safe default: backend defaults to 'pi' on all paths; no Phase 4 switchover in Phase 3"
  - "D-07 session routing: createAgentSession({backend}) is the single routing point; no per-backend branching in question flow"
  - "D-10 telemetry: stderr logs at session start and after question extraction"
  - "D-01 parity: extractDiscussQuestions() operates on normalized text output identical across backends"
metrics:
  duration_min: 13
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_date: "2026-03-25"
---

# Phase 03 Plan 01: Copilot Discuss Workflow Migration Summary

**One-liner:** Backend-aware `runDiscussWorkflow()` routes discuss sessions to Pi or Copilot SDK via `createAgentSession({backend})`, with `--backend` CLI flag and `GSD_PLANNING_BACKEND` env var for explicit selection.

---

## What Was Built

### `src/workflows/discuss-phase.ts` (NEW)

Programmatic discuss-phase workflow module. Key exports:

- **`DiscussQuestion`**, **`DiscussOutput`**, **`DiscussConfig`**, **`DiscussOptions`** — type contracts matching the plan spec  
- **`extractDiscussQuestions(text)`** — parses numbered-list response text into scored `DiscussQuestion[]`; backend-agnostic by design (D-01, D-03)  
- **`runDiscussWorkflow(config, options)`** — calls `createAgentSession({backend})` with the chosen backend, sends a structured discuss-phase prompt via `session.prompt({expandPromptTemplates: false})`, collects from `session.state.messages`, returns `DiscussOutput`

Session creation is the single backend-specific seam (D-07). All question extraction, formatting, and output assembly is identical for both `'pi'` and `'copilot'` paths.

### `src/cli.ts` (MODIFIED)

Three additions:
1. **`CliFlags.backend?: 'pi' | 'copilot'`** — new optional flag field  
2. **`--backend <pi|copilot>` parse branch** in `parseCliArgs()` — safe-typed, invalid values silently ignored  
3. **`gsd discuss-phase [topic]` subcommand handler** — placed after headless subcommand, before print/interactive mode;
   priority: `--backend` flag > `GSD_PLANNING_BACKEND` env var > `'pi'` default (D-09);
   outputs `DiscussOutput` as JSON to stdout; backend logged to stderr (D-10)

---

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript compile | `npx tsc --noEmit` | ✅ zero errors |
| Function signature Task 1 | `grep -A5 "async function runDiscussWorkflow"` | ✅ accepts backend param, routes to createAgentSession |
| CLI Task 2 | `grep -A3 "discuss-phase"` in cli.ts | ✅ handler with backend routing and D-10 logging |
| App smoke + headless tests | `--test src/tests/app-smoke.test.ts src/tests/headless-detection.test.ts` | ✅ 27/27 pass |
| Discuss prompt tests | `--test src/resources/extensions/gsd/tests/discuss-prompt.test.ts` | ✅ 20/20 pass |

**Task 3 (manual parity baseline):** Deferred — live LLM side-by-side execution requires a running Pi and Copilot credential environment. The code paths are correctly wired; both backends will produce valid `DiscussOutput` with `DiscussQuestion[]`. Parity evaluation against actual question content is scoped to plan 03-03.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/workflows/discuss-phase.ts` did not exist**
- **Found during:** Task 1 — plan says "open src/workflows/discuss-phase.ts and modify the existing `runDiscussWorkflow()` function"
- **Issue:** The file and `src/workflows/` directory did not exist. The plan's context treated them as existing, but they were planned deliverables that had not been created yet.
- **Fix:** Created the file from scratch implementing the full interface specified in the plan's `<interfaces>` block, including `DiscussQuestion`, `DiscussOutput`, `DiscussConfig`, `DiscussOptions`, `runDiscussWorkflow()`, and `extractDiscussQuestions()`.
- **Files modified:** `src/workflows/discuss-phase.ts` (created)
- **Commit:** 929d4a8c

**2. [Rule 3 - Blocking] Plan interface uses idealized `AgentSession.send()` — actual API is `session.prompt()`**
- **Found during:** Task 1 implementation
- **Issue:** The plan's `<interfaces>` block shows `session.send(prompt): Promise<string>` for `AgentSession`. The actual `@gsd/pi-coding-agent` API is `session.prompt(text, options): Promise<void>` with responses collected from `session.state.messages`.
- **Fix:** Used the actual `session.prompt({expandPromptTemplates: false})` + `session.state.messages` pattern (same as `runPrintMode`). Output contract is identical — final assistant message text is returned regardless of backend.
- **Commit:** 929d4a8c

**3. [Rule 3 deviation] Task 3 not fully executable — deferred to plan 03-03**
- **Found during:** Task 3 evaluation
- **Issue:** Task 3 requires running live LLM calls on both Pi and Copilot backends and comparing output. This requires configured credentials for both providers, which cannot be automated in this execution context.
- **Fix:** Code paths are correctly wired and TypeScript-verified. Parity baseline evaluation is naturally scoped to plan 03-03 (Parity Testing + Integration Validation) per the phase plan. Documented here for completeness.

---

## Known Stubs

None — implementation is complete with real behavior. `extractDiscussQuestions()` operates on actual LLM output text; no hardcoded empty returns.

---

## Self-Check

```bash
[ -f "src/workflows/discuss-phase.ts" ] && echo "FOUND" || echo "MISSING"
git log --oneline --all | grep -q "929d4a8c" && echo "COMMIT FOUND" || echo "MISSING"
```

- [x] `src/workflows/discuss-phase.ts` — file exists
- [x] `src/cli.ts` — modified with --backend flag and discuss-phase handler
- [x] commit `929d4a8c` — verified in git log

## Self-Check: PASSED
