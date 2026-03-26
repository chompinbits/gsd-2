# Roadmap: GSD 2 Copilot SDK Migration

## Milestones

- ✅ **v1.0 Copilot SDK Migration** — Phases 1-7 shipped on 2026-03-25 ([archive](milestones/v1.0-ROADMAP.md))
- 🚧 **v1.1 Next Steps** — Phases 8-12

## Overview

v1.1 completes the Copilot SDK migration by porting execute/verify workflows, full autonomous orchestration, remaining command coverage, and two cost-safety fallback layers. All work builds on the v1.0 foundation (adapter layer, accounting, tool bridge, planning workflow routing).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Adapter Foundation** - Copilot SDK adapter layer with tool/event bridging *(v1.0)*
- [x] **Phase 2: Request Accounting & Model Routing** - Multiplier tiers, budget guardrails, telemetry *(v1.0)*
- [x] **Phase 3: Planning Workflow Migration** - Discuss/plan backend routing with streaming parity *(v1.0)*
- [x] **Phase 4: Parity Safety Gates** - E2E parity suites and session resume/interruption checks *(v1.0)*
- [x] **Phase 5: Regression & Traceability** - Parity suites in default test path with requirement-level evidence *(v1.0)*
- [x] **Phase 6: Stage-Aware Accounting** - Accounting contract propagation from workflow stage hints *(v1.0)*
- [x] **Phase 7: Live Operations Validation** - Copilot-backed parity, switchover rollback, session resume evidence *(v1.0)*
- [x] **Phase 8: Execute & Verify Backend Routing** - Execute/verify workflows routed through Copilot SDK backend (completed 2026-03-26)
- [ ] **Phase 9: Autonomous Orchestration Migration** - Full auto-mode loop using Copilot backend with per-unit config
- [x] **Phase 10: Command Coverage Completion** - Roadmap/requirements management commands through Copilot backend (completed 2026-03-26)
- [ ] **Phase 11: Free-Tier Model Fallback** - Automatic downgrade to 0× models under quota pressure
- [ ] **Phase 12: BYOK Fallback** - BYOK provider injection when premium quota is exhausted

## Phase Details

### Phase 8: Execute & Verify Backend Routing
**Goal**: Users can run execute and verify workflows entirely on Copilot SDK backend
**Depends on**: Phase 7 (v1.0 foundation)
**Requirements**: EXEC-01
**Success Criteria** (what must be TRUE):
  1. User can run execute-phase with Copilot SDK as the backend and see plans executed successfully
  2. User can run verify-work with Copilot SDK backend and receive UAT verification results
  3. Backend routing config (defaultBackend: "copilot") controls execute/verify workflow paths without code changes
  4. Accounting telemetry captures per-plan premium request usage during execute/verify sessions
**Plans:** 3/3 plans complete

Plans:
- [x] 08-01-PLAN.md — Stage aliases + execute/verify workflow wrappers
- [x] 08-02-PLAN.md — Automated test coverage for routing, tiers, and tool profiles
- [x] 08-03-PLAN.md — Gap closure: CLI dispatch blocks for execute-phase and verify-work

### Phase 9: Autonomous Orchestration Migration
**Goal**: Users can run full autonomous orchestration end-to-end with Copilot SDK as default backend
**Depends on**: Phase 8
**Requirements**: EXEC-02
**Success Criteria** (what must be TRUE):
  1. User can run autonomous mode and have all units (discuss → plan → execute per phase) use Copilot backend
  2. Auto-mode dispatch passes stage-aware config through runUnit → session creation chain
  3. Per-unit tool restriction works correctly when auto-mode creates fresh sessions via newSession()
  4. Session lifecycle (create, resume, destroy) functions correctly across multi-phase autonomous runs
**Plans:** 1/2 plans executed

Plans:
- [x] 09-01-PLAN.md — UnitSessionConfig types, stage/tool maps, dispatch-to-session wiring
- [x] 09-02-PLAN.md — Automated tests for tool profiles, stage routing, and config threading

### Phase 10: Command Coverage Completion
**Goal**: Users can run roadmap and requirements management commands fully through Copilot SDK backend
**Depends on**: Phase 8
**Requirements**: FLOW-01
**Success Criteria** (what must be TRUE):
  1. User can run roadmap commands (new-project, new-milestone, add-phase, remove-phase) on Copilot backend
  2. User can run requirements commands (plan-phase requirements parsing, progress status) on Copilot backend
  3. All management commands respect defaultBackend config setting without per-command overrides
**Plans:** 2/2 plans complete

Plans:
- [x] 10-01-PLAN.md — Stage router entries, workflow wrappers, CLI dispatch blocks
- [x] 10-02-PLAN.md — Automated tests for routing, stage-tier, and dispatch coverage

### Phase 11: Free-Tier Model Fallback
**Goal**: Users receive configurable free-tier model fallback under quota pressure
**Depends on**: Phase 8
**Requirements**: FLOW-02
**Success Criteria** (what must be TRUE):
  1. When premium request budget reaches warn threshold, system automatically routes new sessions to 0× models
  2. User can configure free-tier fallback behavior in GSD settings (for example: enable/disable and threshold policy)
  3. User sees a notification or log entry when downgrade to free-tier model occurs
  4. Workflow execution continues at reduced quality rather than stopping when budget is tight
  5. User can observe current model tier in telemetry or session output
**Plans**: TBD

### Phase 12: BYOK Fallback
**Goal**: Users can configure and use a BYOK provider as fallback when premium quota is exhausted
**Depends on**: Phase 8, Phase 11
**Requirements**: FLOW-03
**Success Criteria** (what must be TRUE):
  1. User can configure a BYOK provider (API key + endpoint) in GSD settings
  2. When premium quota is fully exhausted, system falls back to configured BYOK provider automatically
  3. BYOK sessions route through the same BackendSessionHandle interface with no workflow changes needed
  4. User sees clear indication when running on BYOK provider vs Copilot premium
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Execute & Verify Backend Routing | 3/3 | Complete   | 2026-03-26 |
| 9. Autonomous Orchestration Migration | 1/2 | In Progress|  |
| 10. Command Coverage Completion | 2/2 | Complete   | 2026-03-26 |
| 11. Free-Tier Model Fallback | 0/? | Not started | - |
| 12. BYOK Fallback | 0/? | Not started | - |
