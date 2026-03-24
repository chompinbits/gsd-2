# Phase 2: Request Accounting + Model Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Mode:** Auto-selected (--auto flag)

## Auto-Selection Summary

In `--auto` mode, the agent selected all identified gray areas and applied recommended defaults that align with the project's cost-aware migration philosophy. Each major area was analyzed and a clear decision path was chosen based on existing Phase 1 foundations, requirement acceptance criteria, and established architectural patterns.

## Gray Areas Identified and Auto-Selected

### 1. Request Accounting Strategy
**Options considered:**
- Measure at completion level (selected) vs measure at tool-invocation level vs measure at token level
- Track per-session + per-run (selected) vs aggregate across all sessions vs per-command fine-grain
- Count streaming as one request (selected) vs count per-chunk streaming cost

**Selected:** Complete-level measurement, per-session + per-run granularity, streaming as one request.

**Rationale:** Aligns with Copilot SDK response structure where token counts are available post-completion. Per-session tracking enables both session replay and cost visibility. Streaming-as-one-request simplifies accounting without losing accuracy for GSD's batch planning workflows.

---

### 2. Model Routing Tiers and Triggers
**Options considered:**
- Three-tier system (selected) vs two-tier vs per-model configuration
- Workflow stage (selected) as primary trigger vs complexity heuristics vs per-request user choice
- Hard-coded stage→tier mapping (selected) vs user-configurable routing table

**Selected:** 0×/0.33×/1× tiers, stage-based routing (discuss/verify→0×, plan-check→0.33×, planning→1×), hard-coded with complexity hints.

**Rationale:** Three tiers well-established in Azure/GitHub models. Stage-based routing is deterministic and predictable — users know in advance which stages cost premium requests. Hard-coded defaults prevent misconfiguration while complexity hints allow case-by-case override.

---

### 3. Budget Guardrails and Enforcement
**Options considered:**
- Graduated protection with warn@80%, stop@100% (selected) vs aggressive early warnings vs permissive warnings only
- Hard limit stops execution (selected) vs soft limit with automatic downgrade vs manual acknowledgment flow
- Configurable thresholds (selected) vs fixed hard limits

**Selected:** Graduated—warn 80%, hard-stop 100%, both configurable, clear error messages on overrun.

**Rationale:** Graduated approach gives users visibility (warning) before hard stop. Hard limit default protects against surprise quota overages — critical for cost control. Configurability lets different teams/users tune risk appetite.

---

### 4. Telemetry and Visibility
**Options considered:**
- Per-stage breakdown (selected) vs aggregate-only vs detailed per-request logging
- Session artifacts file (selected) vs in-memory only vs database
- CLI + Web UI (selected) vs CLI-only vs web-only
- Per-run summaries (selected) vs end-of-session summary vs no summary

**Selected:** Per-stage breakdown, session artifacts storage, both CLI and web surfaces, per-run summaries.

**Rationale:** Per-stage breakdown directly supports cost transparency goal. Session artifacts enable offline audit trail (required for compliance/debugging). Multi-surface visibility ensures users see data regardless of interface. Per-run summaries create natural checkpoints for cost awareness.

---

### 5. Configuration and User Control
**Options considered:**
- Code-based config (config.json) with CLI flag overrides (selected) vs environment variables only vs config UI
- Per-threshold parameterization (selected) vs preset profiles vs all-or-nothing
- Config reset command (selected) vs help-only vs auto-reset on error

**Selected:** config.json + CLI flags, individual thresholds (`premium_request_budget_limit`, etc.), config reset command provided.

**Rationale:** config.json is established persistent store. CLI flags enable one-off tuning without permanent config changes. Individual thresholds give fine-grained control. Reset command lowers friction for experimentation.

---

### 6. Deferral of Auto-Downgrade and Fallback Strategies
**Decision:** Do NOT implement automatic model downgrade or backend switching based on budget in Phase 2.

**Why deferred:** v2 scope explicitly includes automatic fallback strategies. Phase 2 focuses on measurement + guardrails. Separating concerns keeps Phase 2 scope tight and Phase 3 (planning migration) unblocked.

---

## Questions Not Asked (All Pre-Answered)

Due to Phase 1 foundations and explicit requirements:
- Backend integration point: **Phase 1 established adapter seam** — no discussion needed on where to attach.
- Event contracts: **Phase 1 normalized `AgentSessionEvent`** — accounting reuses existing event channel.
- Session identity: **Phase 1 preserved GSD session identity** — accounting hooks into existing lifecycle.
- Parity requirement: **Project.md mandates parity-first migration** — means guardrails must not break existing workflows.

---

## Recommendations for Planning Phase

- Start with request accounting measurement (D-01 to D-04) isolated in a feature branch so Phase 3 planning migration can validate measurement accuracy without depending on full guardrail + telemetry.
- Early smoke test: instrument a single planning workflow to verify token counting works end-to-end.
- Use telemetry (D-13 to D-16) to build visibility dashboards — teams need to trust the numbers before guardrails are enforced.
- Configuration (D-17 to D-19) should be tested with both `--auto` and manual threshold tuning to ensure both modes work predictably.

---

## Deferred Considerations (Not in Phase 2 Scope)

- Automatic model downgrade when budget is near limit (Phase 3+ consideration)
- Free-tier fallback when premium requests exhausted (Phase 2+ consideration)  
- Multiplier pricing adjustments based on changing GitHub Copilot pricing (track as potential seed)
- User-level quota enforcement across multiple team members (out of scope for v1)

---

*Phase: 02-request-accounting-model-routing*
*Discussion completed: 2026-03-24*
*All decisions frozen for planning phase*
