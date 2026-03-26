# GSD 2 Copilot SDK Migration

## What This Is

This project migrates GSD 2 from its current Pi SDK-centric agent runtime to the GitHub Copilot SDK, while preserving current command workflows and user-facing behavior. It targets small teams who rely on repeatable, autonomous planning and execution loops. The migration emphasizes cost-aware orchestration so premium requests are used deliberately and efficiently.

## Core Value

Deliver the same reliable GSD workflow outcomes while using fewer, higher-value premium requests per completed unit of work.

## Requirements

### Validated

- ✓ Multi-mode execution works (interactive CLI, headless/RPC, web, MCP) with shared orchestration flows — existing
- ✓ Extension and skill-driven command system supports rich workflow automation — existing
- ✓ Planning and state artifacts drive autonomous execution and progress tracking — existing
- ✓ Tooling already supports cost and token visibility across workflows — existing
- ✓ Phase 01 validated Copilot adapter foundations: create, resume, destroy, and tool bridging now work on the Copilot backend while preserving the Pi default path
- ✓ Phase 02 validated request accounting and model routing: multiplier tiers, per-stage usage tracking, budget guardrails, and telemetry/session persistence on the Copilot path
- ✓ Phase 03 validated planning workflow migration parity: discuss/plan backend routing, plan-check equivalence, and streaming parity across TUI/RPC/web contracts
- ✓ Phase 04 validated parity safety gates: end-to-end planning parity suites and session interruption/resume recovery checks
- ✓ Phase 05 revalidated requirement traceability: parity suites wired into default regression path with requirement-level verification evidence
- ✓ Phase 06 validated stage-aware accounting contract propagation from workflow stage hints through backend send accounting
- ✓ Phase 07 validated live operations: Copilot-backed parity, switchover rollback, and session resume flow evidence captured in live runs
- ✓ Phase 08 validated execute/verify workflow CLI dispatch and settings-driven backend routing (EXEC-01)

### Active

- [ ] User can run full autonomous orchestration with Copilot SDK as default backend (EXEC-02)
- [ ] User can run roadmap and requirements management commands fully through Copilot SDK backend (FLOW-01)
- [ ] User receives free-tier fallback to 0x models automatically under quota pressure (FLOW-02)
- [ ] User can use BYOK fallback when premium quota is exhausted (FLOW-03)

### Out of Scope

- Full rewrite of all subsystems in one cutover — too risky for parity-first migration
- Immediate removal of all legacy runtime paths on day one — hybrid transition is required for safety
- Breaking slash-command or workflow UX changes for existing users — would violate migration boundary

## Context

GSD 2 is a large TypeScript monorepo with modular layers for CLI routing, orchestration/headless execution, web bridge services, and extension resources. The current runtime centers around Pi SDK abstractions and an internal coding-agent package, with persistent session/state artifacts and workflow-oriented command orchestration. Existing architecture and stack documentation already exist under .planning/codebase/, and this migration should leverage those established boundaries rather than re-architecting from scratch.

## Constraints

- **Compatibility**: Keep existing command UX and expected workflow behavior — parity-first objective
- **Cost Model**: GitHub Copilot premium requests are quota-constrained — each prompt must be intentional and high-yield
- **Migration Strategy**: Hybrid rollout is required — reduce disruption and allow incremental validation
- **Audience**: Small teams depend on predictable automation — avoid operational regressions during transition
- **Platform**: Node.js/TypeScript monorepo with existing service and extension contracts — preserve interfaces where practical

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use hybrid transition instead of big-bang rewrite | Preserves stability and allows side-by-side validation | — Pending |
| Optimize both request count and request yield | Pricing pressure and quota efficiency both matter | Phase 02 introduced multiplier-aware accounting, budget enforcement, and telemetry visibility |
| Prioritize phase planning workflows for first optimization wave | High leverage area with repeated orchestration overhead | — Pending |
| Enforce behavioral parity before aggressive redesign | Reduces user-facing risk during runtime migration | — Pending |
| Additive Copilot session handle plus explicit resume routing before full session swap | Delivers validated backend parity without breaking the existing AgentSession path | Phase 01 complete |

## Current State

- v1.0 Copilot SDK Migration is shipped and archived.
- Phase 01 through Phase 07 are complete, including live parity/switchover/resume validation evidence.
- Runtime foundation, planning parity, accounting telemetry propagation, and live operational safety checks now have milestone-level artifacts in `.planning/milestones/`.
- Phase 08 is complete: execute-phase/verify-work CLI dispatch now routes through settings-driven backend selection for Copilot parity.

## Current Milestone: v1.1 Next Steps

**Goal:** Complete the Copilot SDK migration by porting execute/verify workflows, full autonomous orchestration, and remaining command coverage — fulfilling everything deferred from v1.0.

**Target features:**
- Execute and verify workflows on Copilot SDK backend (EXEC-01)
- Full autonomous orchestration with Copilot SDK as default (EXEC-02)
- Roadmap/requirements management commands through Copilot SDK (FLOW-01)
- Free-tier 0× model fallback under quota pressure (FLOW-02)
- BYOK fallback when premium quota is exhausted (FLOW-03)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 — Phase 08 complete (EXEC-01 validated)*
