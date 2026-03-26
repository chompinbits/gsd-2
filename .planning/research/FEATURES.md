# Feature Landscape — v1.1

**Domain:** Copilot SDK Migration — execute/verify, orchestration, fallback
**Researched:** 2026-03-25

## Table Stakes

Features users expect for v1.1 to be considered complete. Missing = migration is unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Execute workflows on Copilot backend (EXEC-01) | v1.0 shipped planning workflows only — execute is the other half | Medium | `runUnit()` → `newSession()` → `CopilotSessionBackend` plumbing exists; needs stage-aware tool filtering |
| Verify workflows on Copilot backend (EXEC-01) | Verification is always paired with execution | Low | Same plumbing as execute; different tool profile (read-only) |
| Full autonomous orchestration on Copilot (EXEC-02) | Auto-mode is the primary workflow; can't stay on Pi backend | High | Every auto-loop unit type must route through Copilot backend with correct stage config |
| Roadmap/requirements commands on Copilot (FLOW-01) | Command completeness — users expect all commands to use same backend | Low | Same `defaultBackend` routing pattern as plan/discuss |
| Backend parity verification | Users need confidence that Copilot path produces same results as Pi path | Medium | Extend v1.0 parity suite to cover execute/verify/auto stages |

## Differentiators

Features that aren't strictly required but provide significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Free-tier model fallback (FLOW-02) | Graceful degradation when budget pressure detected — users keep working instead of hitting hard stops | Medium | Extends `BudgetGuard` with `suggestDowngrade()` that routes to 0× models |
| BYOK fallback (FLOW-03) | Premium quota exhaustion doesn't block work — users fall back to their own API keys | Medium | Extends `FallbackResolver` to produce `ByokProviderConfig` for SDK `provider` session config |
| Per-session tool restriction | Prevents wasted premium requests from tool-call errors in restricted contexts | Low | Allow-list per session type; verify sessions can't write, discuss sessions can't execute |
| Stage-aware model routing | Automatic model selection based on workflow stage tier (0×/0.33×/1×) | Low | Already mapped in `multipliers.ts`; just needs threading through auto-mode dispatch |
| Quota pressure visibility | Users see budget warnings and model downgrade notifications in real-time | Low | `BudgetWarning` events already emitted; add downgrade notification event |

## Anti-Features

Features to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Session pooling / reuse across units | Auto-mode's Ralph Loop (fresh session per unit) is intentional — clean context per task prevents bloat and billing confusion | Keep `newSession()` per unit; measure if startup cost is acceptable |
| Custom model training / fine-tuning integration | Out of scope for runtime migration; adds complexity with no parity benefit | Use SDK's standard model routing |
| Real-time premium request dashboard | Useful but not blocking — telemetry already persists to session files | Defer to v1.2; use existing `/session` stats for now |
| Multi-provider concurrent execution | Running same prompt against multiple providers and picking best result — wasteful | Single provider path with fallback chain |
| Automatic Pi-to-Copilot backend migration of in-flight sessions | Sessions are short-lived (per unit); forcing mid-session backend switches risks data loss | New sessions use Copilot; existing sessions finish on current backend |

## Feature Dependencies

```
EXEC-01 (execute/verify routing)
   └──▶ EXEC-02 (full auto-mode orchestration) — requires per-session routing
   └──▶ FLOW-03 (BYOK fallback) — requires BackendConfig.provider field

FLOW-01 (command coverage) — independent, can run in parallel

FLOW-02 (free-tier fallback) — independent of routing features
   └──▶ Extends BudgetGuard (no routing dependency)

FLOW-03 (BYOK fallback) — depends on EXEC-01 for provider field
   └──▶ Extends FallbackResolver → BackendConfig.provider
```

## MVP Recommendation

Prioritize:
1. **EXEC-01** — Execute/verify backend routing (unlocks EXEC-02 and FLOW-03)
2. **EXEC-02** — Full autonomous orchestration (highest user impact)
3. **FLOW-01** — Remaining command coverage (completeness)

Defer if needed:
- **FLOW-02** (free-tier fallback): Important but not blocking migration completion. Can ship in v1.1.1.
- **FLOW-03** (BYOK fallback): Highest complexity of fallback features. Can ship after FLOW-02.

---
*Feature landscape for: GSD 2 v1.1*
*Researched: 2026-03-25*
