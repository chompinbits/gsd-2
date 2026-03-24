# Roadmap: GSD 2 Copilot SDK Migration

## Overview

This roadmap migrates GSD 2 from the Pi SDK runtime to the GitHub Copilot SDK through four phases: build the adapter foundation and tool bridge, layer in premium-request accounting and multiplier-aware routing, migrate planning workflows as the first low-risk validation, then prove parity and session resilience before switching the default backend. Execution and auto-mode migration are deferred to v2 — this milestone delivers a safe, cost-aware planning path on Copilot SDK.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Adapter Layer + SDK Foundation** - Build session backend abstraction, tool bridge, and event normalization with hybrid runtime support
- [ ] **Phase 2: Request Accounting + Model Routing** - Add multiplier-aware model routing, premium-request telemetry, and budget guardrails
- [ ] **Phase 3: Planning Workflow Migration** - Migrate discuss and plan commands to Copilot SDK with streaming parity
- [ ] **Phase 4: Parity Validation + Safe Switchover** - Prove command equivalence, session resilience, and enable safe default backend switch

## Phase Details

### Phase 1: Adapter Layer + SDK Foundation
**Goal**: Users can create and run GSD workflow sessions against a Copilot SDK backend alongside the existing runtime
**Depends on**: Nothing (first phase)
**Requirements**: RUNT-01, RUNT-02, RUNT-03, TOOL-01, SAFE-01
**Success Criteria** (what must be TRUE):
  1. User can switch a workflow between Pi SDK and Copilot SDK backends via a configuration flag
  2. User can create, use, and destroy a Copilot SDK session for a single workflow unit
  3. User can resume a previously created Copilot SDK session by ID
  4. User can run an existing GSD tool (e.g., file read/write) through the Copilot SDK session without modifying tool code
  5. User sees SDK dependency pinned to an exact version with all SDK calls isolated within the adapter module
**Plans:** 4 plans
Plans:
- [x] 01-01-PLAN.md — Interface contracts, tool bridge, and event translator
- [x] 01-02-PLAN.md — CopilotClient manager and CopilotSessionBackend
- [x] 01-03-PLAN.md — Pi backend stub, createAgentSession wiring, parity tests
- [x] 01-04-PLAN.md — Gap closure: wire copilot session routing (close SC-1/2/3 gaps)

### Phase 2: Request Accounting + Model Routing
**Goal**: Users are protected from premium-request quota exhaustion through multiplier-aware routing and budget guardrails
**Depends on**: Phase 1
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. User can see which model multiplier tier (0×, 0.33×, 1×) is selected for each workflow stage
  2. User can view accumulated premium-request usage per workflow stage and per run
  3. User is warned or stopped when premium-request budget approaches or exceeds a configured threshold
  4. User benefits from automatic routing of low-complexity stages (discuss, verify) to 0× models
**Plans**: TBD

### Phase 3: Planning Workflow Migration
**Goal**: Users can run discuss and plan workflows through the Copilot SDK with behavior identical to the current experience
**Depends on**: Phase 1, Phase 2
**Requirements**: PLAN-01, PLAN-02, TOOL-02
**Success Criteria** (what must be TRUE):
  1. User can run `/gsd-discuss-phase` through the Copilot SDK backend and receive the same question flow
  2. User can run `/gsd-plan-phase` through the Copilot SDK backend and get a valid PLAN.md output
  3. User receives streaming output during planning commands with the same display behavior across TUI, headless, and web surfaces
  4. User sees plan-check validation produce equivalent pass/fail results on the migrated path
**Plans**: TBD
**UI hint**: yes

### Phase 4: Parity Validation + Safe Switchover
**Goal**: Users have verified command parity and session resilience before the Copilot SDK backend becomes the default
**Depends on**: Phase 3
**Requirements**: TOOL-03, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. User sees automated parity test results confirming planning command outputs match between Pi SDK and Copilot SDK backends
  2. User can recover a planning session after a process interruption and continue from where it stopped
  3. User sees key planning command outcomes (discuss, plan, plan-check) produce functionally equivalent artifacts on both backends
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Adapter Layer + SDK Foundation | 4/4 | Complete | 2026-03-24 |
| 2. Request Accounting + Model Routing | 0/0 | Not started | - |
| 3. Planning Workflow Migration | 0/0 | Not started | - |
| 4. Parity Validation + Safe Switchover | 0/0 | Not started | - |
