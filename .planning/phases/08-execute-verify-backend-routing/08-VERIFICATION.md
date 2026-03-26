---
phase: 08-execute-verify-backend-routing
verified: 2026-03-25T12:00:00Z
status: gaps_found
score: 1/4 ROADMAP success criteria verified
re_verification:
  previous_status: human_needed
  previous_score: 8/8 plan must-haves (1/4 ROADMAP SCs)
  gaps_closed: []
  gaps_remaining:
    - SC1 — no gsd execute-phase CLI subcommand
    - SC2 — no gsd verify-work CLI subcommand
    - SC3 — resolvePlanningBackendFromSettings() not wired to execute/verify
  regressions: []
gaps:
  - truth: "User can run execute-phase with Copilot SDK as the backend and see plans executed successfully"
    status: failed
    reason: "No 'gsd execute-phase' CLI subcommand exists in src/cli.ts. The workflow wrapper (runExecuteWorkflow) exists but is never dispatched from the CLI layer."
    artifacts:
      - path: "src/cli.ts"
        issue: "Missing dispatch block: if (cliFlags.messages[0] === 'execute-phase') { ... }"
      - path: "src/workflows/execute-phase.ts"
        issue: "Implementation is complete but unreachable via CLI"
    missing:
      - "Add CLI dispatch block for 'execute-phase' in src/cli.ts, calling runExecuteWorkflow with backend from resolvePlanningBackendFromSettings()"

  - truth: "User can run verify-work with Copilot SDK backend and receive UAT verification results"
    status: failed
    reason: "No 'gsd verify-work' CLI subcommand exists in src/cli.ts. The workflow wrapper (runVerifyWorkflow) exists but is never dispatched from the CLI layer."
    artifacts:
      - path: "src/cli.ts"
        issue: "Missing dispatch block: if (cliFlags.messages[0] === 'verify-work') { ... }"
      - path: "src/workflows/verify-work.ts"
        issue: "Implementation is complete but unreachable via CLI"
    missing:
      - "Add CLI dispatch block for 'verify-work' in src/cli.ts, calling runVerifyWorkflow with backend from resolvePlanningBackendFromSettings()"

  - truth: "Backend routing config (defaultBackend: copilot) controls execute/verify workflow paths without code changes"
    status: failed
    reason: "resolvePlanningBackendFromSettings() is wired only for discuss-phase (cli.ts:281) and plan-phase (cli.ts:300). It is not called in any execute/verify code path. SC3 requires settings-driven routing to cover execute/verify without per-invocation flags."
    artifacts:
      - path: "src/cli.ts"
        issue: "resolvePlanningBackendFromSettings() used at lines 281 and 300 only; no execute/verify dispatch consumes it"
    missing:
      - "Wire resolvePlanningBackendFromSettings() into both execute-phase and verify-work dispatch blocks once those blocks are added"
---

# Phase 8: Execute & Verify Backend Routing — Verification Report (Re-verification)

**Phase Goal:** Users can run execute and verify workflows entirely on Copilot SDK backend
**Verified:** 2026-03-25T12:00:00Z
**Status:** GAPS_FOUND — 3 of 4 ROADMAP success criteria are code gaps, not human-approval items
**Re-verification:** Yes — previous verification (2026-03-25) incorrectly classified SC1–SC3 as `human_needed`; strict re-evaluation judges against ROADMAP SCs

---

## Verification Basis

Previous verification scored 8/8 against PLAN `must_haves`. This re-verification scores against the **ROADMAP success criteria** (SC1–SC4), which are the phase contract:

> SC is a code gap when the implementation does not exist. It becomes `human_needed` only when the implementation exists and only live/manual validation is missing.

---

## Goal Achievement

### ROADMAP Success Criteria (Primary Truth)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC1 | User can run execute-phase with Copilot SDK backend | ✗ FAILED | `grep "execute-phase" src/cli.ts` → no results. `runExecuteWorkflow` exists in `src/workflows/execute-phase.ts` but is never dispatched from CLI |
| SC2 | User can run verify-work with Copilot SDK backend | ✗ FAILED | `grep "verify-work" src/cli.ts` → no results. `runVerifyWorkflow` exists in `src/workflows/verify-work.ts` but is never dispatched from CLI |
| SC3 | defaultBackend config controls execute/verify paths without code changes | ✗ FAILED | `resolvePlanningBackendFromSettings()` wired only at cli.ts:281 (discuss-phase) and cli.ts:300 (plan-phase). Zero wiring to any execute/verify path |
| SC4 | Accounting telemetry captures per-plan usage during execute/verify sessions | ✓ VERIFIED | D-10 logs: `[execute-phase] backend=X tier=standard stage=execute-task` and `[verify-work] backend=X tier=free stage=verify-work` |

**Score:** 1/4 ROADMAP success criteria verified

---

### Plan Must-Haves (Secondary — Infrastructure Layer)

All 8/8 plan must-haves from `08-01-PLAN.md` and `08-02-PLAN.md` remain verified:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Execute workflow creates backend session with stage 'execute-task' and full coding tools | ✓ VERIFIED | `stage: 'execute-task'` at execute-phase.ts:121; `tools: codingTools` passed to sessionOptions |
| 2 | Verify workflow creates backend session with stage 'verify-work' and read-only tools | ✓ VERIFIED | `stage: 'verify-work'` at verify-work.ts:191; `tools: readOnlyTools` passed to sessionOptions |
| 3 | Both workflows route through createAgentSession with backend parameter from options | ✓ VERIFIED | Both use `const backend = options.backend ?? 'pi'` forwarded into `createAgentSession(sessionOptions)` |
| 4 | Stage aliases execute-phase, verify-phase, run-uat resolve to correct billing tiers | ✓ VERIFIED | stage-router.ts lines 22–24: execute-phase→standard, verify-phase→free, run-uat→free |
| 5 | Stage aliases have passing unit tests | ✓ VERIFIED | accounting.test.ts line 98: `getStageMultiplierTier("execute-phase") === "standard"`; 54/54 pass |
| 6 | Execute workflow routing tested with both pi and copilot backend params | ✓ VERIFIED | execute-phase.test.ts 12/12 pass |
| 7 | Verify workflow routing tested with both pi and copilot backend params | ✓ VERIFIED | verify-work.test.ts 14/14 pass |
| 8 | Tool profile enforcement tested: execute gets write tools, verify does not | ✓ VERIFIED | Source-shape tests assert `codingTools` present + `readOnlyTools` absent in execute-phase; vice versa for verify-work |

Infrastructure-layer score: 8/8 — workflows are correctly implemented and tested. The gap is exclusively in the CLI dispatch layer.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/workflows/execute-phase.ts` | Execute workflow backend-agnostic wrapper | ✓ VERIFIED | 130+ lines; exports ExecuteConfig, ExecuteOptions, ExecuteOutput, runExecuteWorkflow |
| `src/workflows/verify-work.ts` | Verify workflow backend-agnostic wrapper | ✓ VERIFIED | 200+ lines; exports VerifyConfig, VerifyOptions, VerifyOutput, VerifyCheck, runVerifyWorkflow, extractVerifyChecks |
| `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` | Stage-to-tier map with v1.1 aliases | ✓ VERIFIED | Lines 22–24 contain execute-phase, verify-phase, run-uat with correct tiers |
| `packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` | Stage alias tier tests | ✓ VERIFIED | Line 98: execute-phase alias test; 54/54 pass |
| `src/workflows/execute-phase.test.ts` | Execute workflow unit tests | ✓ VERIFIED | 12 source-shape tests; 12/12 pass |
| `src/workflows/verify-work.test.ts` | Verify workflow unit tests | ✓ VERIFIED | 14 tests; 14/14 pass |
| `src/cli.ts` — execute-phase dispatch | CLI subcommand block | ✗ MISSING | No `if (cliFlags.messages[0] === 'execute-phase')` block exists |
| `src/cli.ts` — verify-work dispatch | CLI subcommand block | ✗ MISSING | No `if (cliFlags.messages[0] === 'verify-work')` block exists |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/workflows/execute-phase.ts` | `packages/pi-coding-agent/src/core/sdk.ts` | `createAgentSession({backend, stage:'execute-task', tools:codingTools})` | ✓ WIRED | backend at line 96, stage at line 121, tools in sessionOptions |
| `src/workflows/verify-work.ts` | `packages/pi-coding-agent/src/core/sdk.ts` | `createAgentSession({backend, stage:'verify-work', tools:readOnlyTools})` | ✓ WIRED | backend at line 166, stage at line 191, tools in sessionOptions |
| `stage-router.ts` | `copilot-backend.ts` | `getStageMultiplierTier()` called in copilot-backend | ✓ WIRED | copilot-backend.ts lines 8 (import) and 43 (call) |
| `src/cli.ts` | `src/workflows/execute-phase.ts` | `if (cliFlags.messages[0] === 'execute-phase')` | ✗ NOT WIRED | No dispatch block exists |
| `src/cli.ts` | `src/workflows/verify-work.ts` | `if (cliFlags.messages[0] === 'verify-work')` | ✗ NOT WIRED | No dispatch block exists |
| `src/cli.ts` execute/verify | `resolvePlanningBackendFromSettings()` | settings-driven backend selection | ✗ NOT WIRED | `resolvePlanningBackendFromSettings()` called only for discuss-phase (line 281) and plan-phase (line 300) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| execute-phase exports exist | `grep "export async function runExecuteWorkflow" execute-phase.ts` | Found at line 88 | ✓ PASS |
| verify-work exports exist | `grep "export async function runVerifyWorkflow" verify-work.ts` | Found | ✓ PASS |
| Stage aliases in tier map | `grep -c "execute-phase\|verify-phase\|run-uat" stage-router.ts` | 3 | ✓ PASS |
| getStageMultiplierTier wired in copilot-backend | `grep "getStageMultiplierTier" copilot-backend.ts` | Lines 8, 43 | ✓ PASS |
| CLI execute-phase command | `grep "execute-phase" src/cli.ts` | Not found | ✗ FAIL — SC1 code gap |
| CLI verify-work command | `grep "verify-work" src/cli.ts` | Not found | ✗ FAIL — SC2 code gap |
| resolvePlanningBackendFromSettings wired for execute/verify | `grep -n "resolvePlanningBackend" src/cli.ts` | Lines 281, 300 only (discuss/plan) | ✗ FAIL — SC3 code gap |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXEC-01 | 08-01, 08-02 | User can run execute and verify workflows entirely on Copilot SDK backend | ✗ PARTIAL | Workflow infrastructure complete; CLI dispatch layer absent. REQUIREMENTS.md marks [x] Complete but SC1–SC3 are unsatisfied in code. |

---

### Anti-Patterns Found

None in implementation files. `src/workflows/execute-phase.ts`, `src/workflows/verify-work.ts`, `src/workflows/execute-phase.test.ts`, `src/workflows/verify-work.test.ts`, `stage-router.ts`, `accounting.test.ts` are all clean.

---

### Gaps Summary

The phase 08 implementation is **infrastructure-complete but CLI-incomplete**. The workflow wrappers (`runExecuteWorkflow`, `runVerifyWorkflow`) are real, substantive, and tested. The accounting/stage-routing layer is wired correctly. However, none of the ROADMAP success criteria that require user-invocable commands are satisfied:

- **SC1 & SC2** — No `gsd execute-phase` or `gsd verify-work` CLI subcommands exist in `src/cli.ts`. Without these dispatch blocks, users cannot invoke either workflow from the command line regardless of backend setting.
- **SC3** — `resolvePlanningBackendFromSettings()` was established in Phase 7 and extended to `discuss-phase` and `plan-phase`, but was never wired to any execute/verify dispatch path (which also do not exist yet).
- **SC4** — Accounting telemetry is verified; this criterion passes.

The previous verification classified SC1–SC3 as `human_needed` because it anticipated Phase 9 scope. **That classification was incorrect** under the strict rule: absent code is a gap, not a human-approval item. Phase completion remains blocked until SC1–SC3 are implemented.

**Minimum fix:** Add two CLI dispatch blocks to `src/cli.ts` following the `discuss-phase`/`plan-phase` pattern, calling `runExecuteWorkflow` and `runVerifyWorkflow` with backend resolved from `resolvePlanningBackendFromSettings()`.

---

_Verified: 2026-03-25T12:00:00Z_
_Verifier: the agent (gsd-verifier) — re-verification pass with strict ROADMAP SC judgment_
