# GSD 2 Copilot SDK Migration

## Current State

- ✅ v1.0 and v1.1 are shipped and archived.
- ✅ Copilot SDK migration is complete for execute/verify workflows, autonomous orchestration, roadmap/requirements command coverage, and fallback safety (free-tier + BYOK).
- ✅ Milestone gaps identified in the initial v1.1 audit were closed by Phases 13-15.
- ✅ Nyquist compliance artifacts for Phases 08-12 are complete and aligned with verification status.

## Next Milestone Goals

- Define v1.2 scope from post-migration hardening opportunities.
- Decide whether to bridge accounting/fallback behavior into extension-session paths.
- Decide whether to add structured persistent telemetry beyond stderr summaries.
- Continue preserving parity-first behavior while reducing premium-request cost.

## Project Snapshot

**Core Value:** Deliver the same reliable GSD workflow outcomes while using fewer, higher-value premium requests per completed unit of work.

**Next Command:** `/gsd-new-milestone`

<details>
<summary>Archived pre-v1.1 project narrative</summary>

### What This Is

This project migrates GSD 2 from its current Pi SDK-centric agent runtime to the GitHub Copilot SDK, while preserving current command workflows and user-facing behavior. It targets small teams who rely on repeatable, autonomous planning and execution loops. The migration emphasizes cost-aware orchestration so premium requests are used deliberately and efficiently.

### Requirements (Historic)

#### Validated

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
- ✓ Phase 09 validated autonomous orchestration stage/tool config threading and Copilot-backed unit session setup (EXEC-02)
- ✓ Phase 10 validated roadmap/requirements management command routing through Copilot backend with full dispatch and test coverage (FLOW-01)
- ✓ Phase 11 validated free-tier model fallback: suggestDowngrade() wired into CopilotSessionBackend session creation with telemetry surfacing (FLOW-02)
- ✓ Phase 12 & 13 validated BYOK fallback: isQuotaExhausted() and resolveByokProvider() wired into CopilotSessionBackend; setSettingsManager() call fixed in sdk.ts; Phase 12 independently verified (FLOW-03)

#### Out of Scope

- Full rewrite of all subsystems in one cutover — too risky for parity-first migration
- Immediate removal of all legacy runtime paths on day one — hybrid transition is required for safety
- Breaking slash-command or workflow UX changes for existing users — would violate migration boundary

### Constraints

- **Compatibility**: Keep existing command UX and expected workflow behavior — parity-first objective
- **Cost Model**: GitHub Copilot premium requests are quota-constrained — each prompt must be intentional and high-yield
- **Migration Strategy**: Hybrid rollout is required — reduce disruption and allow incremental validation
- **Audience**: Small teams depend on predictable automation — avoid operational regressions during transition
- **Platform**: Node.js/TypeScript monorepo with existing service and extension contracts — preserve interfaces where practical

</details>

---
*Last updated: 2026-03-26 after v1.1 milestone archival*
