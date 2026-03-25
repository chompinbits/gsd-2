---
phase: 03-planning-workflow-migration
overview: true
status: ready_for_execution
wave: 1
depends_on: [02-request-accounting-model-routing]
---

# Phase 3: Planning Workflow Migration - Execution Plan

## Overview

Migrate planning command workflows (`/gsd-discuss-phase` and `/gsd-plan-phase`) to run through the Copilot SDK backend while preserving user-visible behavior, streaming parity across TUI/RPC/web surfaces, and equivalent plan-check outcomes. This phase keeps the migration behind explicit backend/config selection — default backend remains Pi SDK until Phase 4.

**Phase Goal (from ROADMAP.md):** Users can run discuss and plan workflows through the Copilot SDK backend with behavior identical to the current experience.

**Phase Depends On:** Phase 1 (adapter layer + SDK foundation), Phase 2 (request accounting + model routing)

**Phase Success Criteria:**
1. User can run `/gsd-discuss-phase` through the Copilot SDK backend and receive the same question flow
2. User can run `/gsd-plan-phase` through the Copilot SDK backend and get a valid PLAN.md output
3. User receives streaming output during planning commands with the same display behavior across TUI, headless, and web surfaces
4. User sees plan-check validation produce equivalent pass/fail results on the migrated path

---

## Phase Scope

### In Scope (This Phase)
- Migration of planning command runtime transport to Copilot SDK backend
- Streaming and event parity validation across TUI/RPC/web surfaces
- Plan-check equivalence testing (Pi path vs Copilot path)
- Session continuity and recovery for planning workflows
- Feature-flag safe migration (explicit backend selection)
- Observability for migrated planning runs (telemetry, debug output)

### Out of Scope (Phase 4)
- Switching default backend to Copilot SDK
- Migrating execute/verify workflows
- Changing planning command semantics or prompts
- Behavior-only refactors

---

## Execution Order

Plans execute in numeric order: 03-01 → 03-02 → 03-03

| Plan | Title | Est. | Status |
|------|-------|------|--------|
| 03-01 | Copilot Discuss Workflow Migration | 4h | [ ] |
| 03-02 | Copilot Plan Workflow Migration | 5h | [ ] |
| 03-03 | Parity Testing + Integration Validation | 6h | [ ] |

**Total Phase Duration:** ~15 hours

---

## Dependencies and Seams

### Phase 1 Assets (Already Complete)
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Copilot session backend, tool bridge
- `packages/pi-coding-agent/src/core/backends/event-translator.ts` — Event normalization to `AgentEvent`
- `createAgentSession()` in `packages/pi-coding-agent/src/core/sdk.ts` — Session backend routing
- `BackendConfig`, `BackendSessionHandle`, `SessionBackend` interfaces — Contract boundaries

### Phase 2 Assets (Already Complete)
- `packages/pi-coding-agent/src/core/backends/accounting/` — Stage routing, multiplier tiers
- Request tracking and budget guard infrastructure
- Premium request telemetry and CLI visibility

### Critical Integration Points
- `src/cli.ts` — where planning commands create sessions; backend routing must be consistent
- `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts` — RPC event/response contract consumed by headless/web
- `src/web/bridge-service.ts` — web bridge consumer of planning-session streams
- `packages/pi-coding-agent/src/core/backends/event-translator.ts` — normalization seam for streaming parity

---

## Decisions Locked for This Phase

From Phase 3 Context (03-CONTEXT.md):

**D-01:** Keep discuss and plan workflow definitions and prompts as-is; migrate runtime transport only (Pi backend path to Copilot backend path).

**D-02:** Preserve existing command semantics for flags/modes (`--auto`, `--batch`, `--text`, `--analyze`); no behavior-only refactors in this phase.

**D-03:** Treat normalized `AgentEvent` output as the parity contract; Copilot SDK events must continue to map into existing event categories.

**D-04:** Validate streaming parity against all planning surfaces (TUI, RPC/headless, web bridge) using observable event/state transitions, not provider-specific internals.

**D-05:** Keep plan-check validation logic and scoring unchanged; Phase 3 migration only changes runtime backend path.

**D-06:** Add parity-focused checks comparing pass/fail outcomes between Pi and Copilot planning paths.

**D-07:** Use session-manager IDs as source of truth; route Copilot create/resume through existing `createAgentSession` entrypoint.

**D-08:** Preserve interruption and resume behavior by preferring Copilot `resumeSession()` when planning state already exists.

**D-09:** Keep migration behind explicit backend/config selection; do NOT switch default backend in this phase.

**D-10:** Keep telemetry/debug visibility for migrated runs so parity regressions are diagnosable.

---

## Key Artifacts This Phase Produces

### Per-Plan Outputs
- **03-01-SUMMARY.md** — Discuss workflow migration verification and parity baseline
- **03-02-SUMMARY.md** — Plan workflow migration verification and artifact validation
- **03-03-SUMMARY.md** — Parity test results, integration validation, and rollout readiness assessment

### Code Changes
- Plan 03-01: `src/cli.ts`, `src/workflows/discuss-phase.ts`, backend routing in session creation
- Plan 03-02: `src/cli.ts`, `src/workflows/plan-phase.ts`, accounting integration with planning tier
- Plan 03-03: New parity test fixtures, comparison harness, plan-check equivalence validation

### Phase Summary Artifact
- `.planning/phases/03-planning-workflow-migration/03-SUMMARY.md` (written at phase completion)
- `.planning/phases/03-planning-workflow-migration/03-VERIFICATION.md` (parity test results)

---

## Rollout Safety Guardrails (D-09, D-10)

1. **Backend Selection Explicit:** Planning commands must check config/flag for backend choice; default remains Pi SDK
2. **Telemetry Visible:** Migrated runs emit `backend: "copilot"` in metrics/debug output
3. **Session IDs Unchanged:** Phase 3 uses same session-manager ID convention; no user-facing session changes
4. **Failure Isolation:** Copilot planning errors surface clearly with backend context (not silent degradation)

---

## Verification Strategy

Each plan includes:
- **Automated checks:** Workflow execution, artifact validity (YAML/Markdown structure), event stream shape
- **Parity assertions:** Question flow equivalence, PLAN content comparison, plan-check verdicts match
- **Surface coverage:** TUI interactive, RPC/headless JSON, web bridge event stream
- **Error handling:** Session interruption/recovery, model unavailability, timeout scenarios

Phase completion requires:
- All 3 plans complete with passing verification
- Parity test suite showing no regressions vs Pi SDK baseline
- Plan-check equivalence validated across at least 5 representative examples
- Streaming parity confirmed for at least 2 surfaces (TUI + RPC, or RPC + web)

---

## Next Phase Dependency (Phase 4)

Phase 4 (Parity Validation + Safe Switchover) depends on this phase completing with:
- Proven discuss/plan streaming parity across all surfaces
- Plan-check equivalence validation passed
- Session continuity under interruption verified
- Debug telemetry showing which backend was used for each planning run

Phase 4 will focus on automated parity tests run as CI, proving command equivalence at scale, and safe default backend switchover.

---

*Phase: 03-planning-workflow-migration*
*Status: Ready for auto-execution*
*Next: Start with plan 03-01*
