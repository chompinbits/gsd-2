# Phase 1: Adapter Layer + SDK Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-adapter-layer-sdk-foundation
**Areas discussed:** Backend adapter boundary, session lifecycle parity, tool bridge strategy, event normalization, runtime switching and safety

---

## Backend adapter boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Single adapter seam with backend factory | Add one runtime seam (`pi`/`copilot`) and keep callers unchanged; migrate mode-by-mode | ✓ |
| Direct in-place replacement | Replace existing runtime calls directly in each execution mode | |
| Mixed per-command migration | Choose backend behavior ad hoc by command without a shared seam | |

**User's choice:** [auto] Single adapter seam with backend factory (recommended default)
**Notes:** [auto] Selected all gray areas and used parity-first default.

---

## Session lifecycle parity

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve existing lifecycle semantics | Keep create/use/destroy + resume behavior stable; adapter translates SDK-specific IDs | ✓ |
| Full session manager rewrite first | Redesign session persistence before adapter integration | |
| Copilot-native only semantics | Shift immediately to SDK-managed session semantics everywhere | |

**User's choice:** [auto] Preserve existing lifecycle semantics (recommended default)
**Notes:** [auto] Compatibility-first decision to avoid UX regressions.

---

## Tool bridge strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanical tool bridge | Adapt existing tool definitions/handlers to SDK registration with no business-logic rewrites | ✓ |
| Rewrite tools for SDK | Re-implement tools against SDK-specific abstractions | |
| Restrict tools in migration | Temporarily disable complex tools for Copilot backend | |

**User's choice:** [auto] Mechanical tool bridge (recommended default)
**Notes:** [auto] Protects command parity while reducing migration risk.

---

## Event normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve `AgentSessionEvent` contract | Keep current internal event shape; translate backend-specific events at adapter boundary | ✓ |
| Adopt SDK event shape directly | Refactor all consumers to Copilot-native event types | |
| Dual event streams to consumers | Expose both event families and let consumers choose | |

**User's choice:** [auto] Preserve `AgentSessionEvent` contract (recommended default)
**Notes:** [auto] Selected to keep headless/web/RPC consumers stable.

---

## Runtime switching and safety

| Option | Description | Selected |
|--------|-------------|----------|
| Config/flag-based hybrid switching + exact SDK pin | Runtime toggle with Pi fallback and isolated SDK dependency | ✓ |
| Copilot default immediately | Switch defaults now and remove Pi fallback early | |
| Environment-only hidden switch | Use undocumented env toggles without explicit user-facing backend flag | |

**User's choice:** [auto] Config/flag-based hybrid switching + exact SDK pin (recommended default)
**Notes:** [auto] Aligns with SAFE-01 and roadmap parity constraints.

---

## the agent's Discretion

- Adapter module internal naming and file organization.
- Event conversion helper implementation details.
- Parity test fixture naming and matrix ordering.

## Deferred Ideas

None.
