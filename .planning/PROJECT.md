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

### Active

- [ ] Port core agent orchestration from Pi SDK runtime integration to GitHub Copilot SDK session/client primitives
- [ ] Preserve existing command UX and workflow behavior during migration (hybrid transition path)
- [ ] Optimize prompt/request strategy for GitHub premium request accounting (reduce total requests and increase per-request yield)
- [ ] Prioritize premium-request optimization in phase planning workflows first, then expand to execution and verification loops
- [ ] Add measurable request-efficiency telemetry per workflow stage (prompt count, completion yield, avoidable retries)

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

- Phase 01 complete: adapter layer, tool bridge, event translation, create-session routing, and explicit Copilot session resume path are verified.
- Phase 02 complete: request accounting and model routing are verified, including per-stage premium usage tracking and budget guardrails in the Copilot backend path.
- Phase 03 complete: planning workflows migrated with parity verification and GO rollout assessment.
- Next focus: Phase 04 parity validation + safe switchover.

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
*Last updated: 2026-03-25 after Phase 03 completion*
