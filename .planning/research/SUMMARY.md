# Research Summary: GSD 2 v1.1 — Copilot SDK Migration Completion

**Domain:** Agent runtime migration — execute/verify workflows, autonomous orchestration, cost fallback
**Researched:** 2026-03-25
**Overall confidence:** HIGH

## Executive Summary

v1.1 completes the Copilot SDK migration by porting the remaining workflow stages (execute, verify, autonomous orchestration, roadmap/requirements commands) and adding two cost-safety layers (free-tier model fallback, BYOK fallback). The v1.0 foundation — adapter layer, accounting, tool bridge, event translator, planning workflow routing — is shipped and stable. All v1.1 work builds atop it. 

The critical finding is that **no new npm dependencies are needed**. The `@github/copilot-sdk` 0.2.0 already supports every capability v1.1 requires (`availableTools` filtering, `provider` BYOK config, per-session `model` routing). The work is internal wiring: threading stage-aware config from auto-mode dispatch through `runUnit()` → `AgentSession.newSession()` → `CopilotSessionBackend.createSession()`.

The highest-risk area is EXEC-02 (full autonomous orchestration on Copilot backend). Auto-mode's `runUnit()` creates sessions via `cmdCtx.newSession()` which rebuilds the full extension/tool runtime each time. Adding per-unit tool restriction and model routing requires changes at every layer of this chain. The architecture is well-factored (clear boundaries between dispatch, session creation, and backend), but the plumbing depth means integration bugs are likely.

The two fallback features (FLOW-02, FLOW-03) are lower risk because they extend existing subsystems (`BudgetGuard`, `FallbackResolver`) with new methods rather than restructuring call paths.

## Key Findings

**Stack:** No new dependencies. All v1.1 features use `@github/copilot-sdk` 0.2.0 capabilities that weren't exercised in v1.0.
**Architecture:** Stage-aware config must flow from `auto-dispatch.ts` → `runUnit()` → `AgentSession.newSession()` → `CopilotSessionBackend.createSession()`.
**Critical pitfall:** Auto-mode creates fresh sessions per unit via `newSession()` which rebuilds the full tool set. Per-unit tool restriction must be threaded through this chain without breaking the existing extension rebuild logic.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Execute/Verify Backend Routing** (EXEC-01) — Foundation phase
   - Addresses: Execute and verify workflows on Copilot backend
   - Avoids: Trying to do full auto-mode orchestration before the per-session backend routing works
   - Rationale: Must prove individual execute/verify sessions route correctly before wiring the auto-loop

2. **Autonomous Orchestration Migration** (EXEC-02) — Integration phase
   - Addresses: Full auto-mode loop using Copilot backend with per-unit config
   - Avoids: Modifying dispatch rules before individual session routing is validated
   - Rationale: Builds on EXEC-01's per-session routing; adds dispatch → unit config plumbing

3. **Remaining Command Coverage** (FLOW-01) — Breadth phase
   - Addresses: Roadmap/requirements commands through Copilot backend
   - Avoids: Over-optimizing before full command coverage exists
   - Rationale: Smaller scope; uses same `defaultBackend` routing as plan/discuss

4. **Free-Tier Model Fallback** (FLOW-02) — Cost safety layer 1
   - Addresses: Automatic downgrade to 0× models under quota pressure
   - Avoids: Users hitting hard budget stops without graceful degradation
   - Rationale: Extends existing `BudgetGuard`; self-contained change

5. **BYOK Fallback** (FLOW-03) — Cost safety layer 2
   - Addresses: BYOK provider injection when premium quota exhausted
   - Avoids: Users being completely blocked when quota runs out
   - Rationale: Extends existing `FallbackResolver`; requires `BackendConfig.provider` field from EXEC-01

**Phase ordering rationale:**
- EXEC-01 before EXEC-02: Individual session routing must work before the auto-loop orchestrates it
- EXEC-02 before FLOW-01: Auto-mode is the highest-complexity integration; command coverage is simpler
- FLOW-02 before FLOW-03: Free-tier fallback is self-contained; BYOK needs the `provider` field added in EXEC-01
- FLOW-01 can run in parallel with FLOW-02/FLOW-03 since it's independent command routing

**Research flags for phases:**
- EXEC-02: Likely needs deeper research (auto-mode session lifecycle, extension rebuild timing)
- FLOW-03: May need research on BYOK provider config edge cases (auth expiry, rate limits from direct providers)
- EXEC-01, FLOW-01, FLOW-02: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. SDK capabilities verified via Context7 + codebase inspection. |
| Features | HIGH | Requirements directly from PROJECT.md. Implementation paths traced through codebase. |
| Architecture | HIGH | All integration points verified by reading source. Plumbing chain is clear. |
| Pitfalls | MEDIUM | Auto-mode session lifecycle has edge cases around extension rebuild timing that need runtime validation, not just code reading. |

## Gaps to Address

- **SDK `provider` config runtime behavior:** Context7 docs confirmed the config shape but didn't detail error handling when BYOK provider auth fails mid-session. Needs runtime testing in FLOW-03.
- **Auto-mode `newSession()` timing:** When `newSession()` rebuilds tools, the extension runner may emit events that conflict with per-unit tool restriction. Needs integration testing in EXEC-02.
- **Budget threshold tuning:** `suggestDowngrade()` threshold (at warnThreshold vs hardStop) needs user testing to calibrate UX — too aggressive = unnecessary quality loss, too conservative = budget exhaustion.

---
*Research summary for: GSD 2 v1.1*
*Researched: 2026-03-25*
