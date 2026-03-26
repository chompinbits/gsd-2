# Phase 11: Free-Tier Model Fallback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves alternatives considered.

**Date:** 2026-03-26
**Phase:** 11-free-tier-model-fallback
**Mode:** discuss (`--auto`)
**Areas discussed:** Trigger policy, fallback model selection, session scope, settings surface, observability

---

## Trigger Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Warn-threshold activation | Trigger downgrade when budget reaches warn threshold so requests continue before hard-stop | x |
| Hard-stop-only activation | Wait until budget exceeded, then downgrade | |
| Manual-only activation | User must opt in at runtime; no automatic trigger | |

**User's choice:** [auto] Warn-threshold activation (recommended default)
**Notes:** Selected to satisfy SC-01 and SC-04 without waiting for budget exhaustion.

---

## Fallback Model Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing 0x multiplier map | Choose downgrade candidates from known free-tier mappings with deterministic ordering | x |
| Use dynamic routing tier models only | Drive fallback from `dynamic_routing.tier_models` configuration | |
| Reduce thinking only, keep model | Do not change model ID; only lower reasoning/settings | |

**User's choice:** [auto] Reuse existing 0x multiplier map (recommended default)
**Notes:** Aligns with current accounting contracts and avoids introducing new tier taxonomy.

---

## Session Scope

| Option | Description | Selected |
|--------|-------------|----------|
| New sessions only | Apply downgrade before creating each new session; keep current session model stable | x |
| Mid-send swap | Re-evaluate and potentially swap model on each send call | |
| Auto-mode-only | Apply fallback only in auto loop, not workflow wrappers | |

**User's choice:** [auto] New sessions only (recommended default)
**Notes:** Matches Phase 11 wording and reduces runtime churn/risk in active sessions.

---

## Settings Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing budget settings path | Keep fallback policy with existing budget config and expose via `gsd settings` | x |
| Preferences-only setting | Configure fallback only in preferences frontmatter (`dynamic_routing`) | |
| Environment-only toggle | Control fallback solely with env vars/flags | |

**User's choice:** [auto] Extend existing budget settings path (recommended default)
**Notes:** Preserves one coherent cost-control surface and reuses existing config loading.

---

## Observability

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-surface notification | Emit downgrade notice in stderr plus structured/headless telemetry event | x |
| Stderr warning only | Log downgrade only to terminal output | |
| Dashboard-only indicator | Show downgrade only in dashboard/metrics view | |

**User's choice:** [auto] Multi-surface notification (recommended default)
**Notes:** Addresses Pitfall 7 and ensures CI/headless users can detect downgrade events.

---

## the agent's Discretion

- Naming and shape of the downgrade recommendation object/method.
- Exact ordering among validated 0x candidates, provided it is deterministic and test-covered.
- Test split between unit, integration, and workflow-level checks.

## Deferred Ideas

- BYOK provider fallback remains out of scope for Phase 11 and is deferred to Phase 12.
