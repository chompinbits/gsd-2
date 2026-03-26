# Phase 11: Free-Tier Model Fallback — Research

**Researched:** 2026-03-26
**Requirement:** FLOW-02
**Discovery Level:** 1 (Quick Verification — all patterns established in codebase)

## Domain Analysis

Phase 11 adds automatic downgrade to 0× (free-tier) models when premium request budget reaches the warn threshold. All building blocks exist in the accounting subsystem; the work is wiring a new `suggestDowngrade()` function into the session-creation path and surfacing notifications.

## Architecture: Where Downgrade Logic Fits

### Existing Seams

1. **BudgetGuard.check(estimatedCost)** — Pre-send budget enforcement in `accounting/budget-guard.ts`. Returns `"ok"` | `BudgetWarning` | throws `BudgetExceededError`. Currently used only inside `AccountingSessionHandle.send()` (per-message check). Does NOT inform session creation.

2. **RequestTracker.getState()** — Returns `BudgetState` with `percentUsed`, `totalPremiumRequests`, `budgetLimit`. Available any time accounting is configured.

3. **MODEL_MULTIPLIER_MAP** in `accounting/multipliers.ts` — Maps model IDs to `MultiplierTier`. Free-tier models (0×) are the downgrade candidates: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o`, `gpt-4o-mini`, `gpt-5-mini`, etc.

4. **CopilotSessionBackend.createSession(config)** — Wraps raw session in `AccountingSessionHandle` when accounting is configured. The `config.model` field determines which model is used. This is the interception point for downgrade.

5. **loadAccountingConfig(configPath)** — Reads `premium_request` section from `config.json`. Provides `budgetLimit`, `warnThreshold`, `hardStop`.

6. **createAgentSession()** in `sdk.ts` — Entry point for all session creation (interactive, workflow, auto-mode). Loads accounting config, creates `CopilotSessionBackend`, calls `createSession()`. The `backend === "copilot"` branch is the target path.

### New Components Needed

1. **`suggestDowngrade(tracker, config)` function** — Pure function in `accounting/` that checks current budget pressure and returns a downgrade suggestion or null. Side-effect free per D-02.

2. **`FREE_TIER_CANDIDATES` ordered list** — Deterministic ordered list of known 0× model IDs extracted from `MODEL_MULTIPLIER_MAP`. Provider-aware: prefer models that can be resolved in the active runtime.

3. **Config extension** — Add `free_tier_fallback` section to `premium_request` config: `{ enabled: boolean, threshold_policy?: "warn" | "hard_stop" }`. Default: `enabled: true, threshold_policy: "warn"`.

4. **Notification emission** — Structured downgrade event on both interactive and headless surfaces.

5. **Telemetry annotation** — Tag sessions/requests created under downgrade so telemetry shows model tier.

## Integration Points

### Session Creation Flow (where downgrade is applied)

```
createAgentSession(options)
  → backend === "copilot"
    → loadAccountingConfig()
    → copilotBackend.setAccountingConfig(config)
    → copilotBackend.createSession(sessionConfig)
      → new AccountingSessionHandle(...)
```

**Downgrade injection point:** After `loadAccountingConfig()` and before `createSession()`, call `suggestDowngrade()` with the tracker from any prior session (or a newly loaded persisted tracker). If downgrade is suggested, override `sessionConfig.model` with the free-tier candidate.

**Challenge:** The tracker is created fresh per session in `CopilotSessionBackend.createSession()`. For the very first session, there's no prior tracker. Need to either:
- (a) Load persisted accounting state from `accounting.json` before deciding, or
- (b) Accept that the first session always uses the configured model (no prior budget data)

Option (b) is simpler and correct: if there's no budget history, there's no pressure.

For subsequent sessions (e.g., auto-mode creating multiple sessions), the `_currentTracker` on `CopilotSessionBackend` holds accumulated state. The `suggestDowngrade()` check can use that.

### Auto-Mode Session Creation

```
phases.ts: resolveDispatch()
  → runUnit(ctx, pi, s, unitType, unitId, prompt, unitConfig)
    → s.cmdCtx.newSession({ activeToolNames })
      → AgentSession → createAgentSession(...)
```

Auto-mode calls `newSession()` per unit. Each call goes through `createAgentSession()`, so the downgrade check naturally applies to all unit sessions.

### Workflow Wrapper Sessions (execute-phase, verify-work, etc.)

These also go through `createAgentSession()` via CLI dispatch. The downgrade check applies uniformly.

## Design Decisions Summary

| Decision | Implementation |
|----------|---------------|
| D-01: Trigger at warn_threshold | `suggestDowngrade()` returns suggestion when `percentUsed >= warnThreshold * 100` |
| D-02: Side-effect free | Pure function returning `DowngradeSuggestion \| null` |
| D-03: Pre-flight, not mid-session | Check runs before `createSession()` |
| D-04: Known 0× models only | Candidates from `MODEL_MULTIPLIER_MAP` where tier === "free" |
| D-05: Deterministic, ordered | Static ordered list, first available wins |
| D-06: No silent fallback to Pi | If no 0× model available, warn and continue with original model |
| D-07: New sessions only | Applied in `createSession()` path |
| D-08: No mid-send swap | Model locked per session |
| D-09: Continue on downgrade | Workflow continues at reduced quality |
| D-10: Extend existing budget config | Add to `premium_request` section |
| D-11: Structured notification | Emit across interactive + headless |
| D-12: Telemetry visibility | Session-level tier annotation |

## Standard Stack (no new dependencies)

All implementation uses existing codebase patterns:
- TypeScript in `packages/pi-coding-agent/src/core/backends/accounting/`
- Node native test runner (`node --test`) with `--import resolve-ts.mjs`
- Source-shape tests for contract verification (established in Phases 8-10)

## Validation Architecture

### Automated Tests
1. `suggestDowngrade()` returns null below threshold, returns suggestion at/above threshold
2. `suggestDowngrade()` respects `enabled: false` config
3. Free-tier candidate selection is deterministic and ordered
4. No-candidate scenario returns null with warning
5. Session creation applies downgrade when suggested
6. Integration: budget-pressured flow continues on downgraded model (D-14)

### Source-Shape Tests
7. `copilot-backend.ts` or `sdk.ts` calls `suggestDowngrade` before `createSession`
8. Notification emission exists in downgrade path

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| No 0× model available in runtime | Graceful fallback: warn and use original model (D-06) |
| Budget state not available for first session | Acceptable: no pressure → no downgrade |
| Downgrade during critical execution | User controls via config; warn_threshold is configurable |
| Headless mode misses notification | D-11 requires structured event output, not just stderr |

## Files to Create/Modify

### New Files
- `packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts` — `suggestDowngrade()`, `FREE_TIER_CANDIDATES`, `DowngradeSuggestion` type
- `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` — Unit tests for downgrade logic

### Modified Files
- `packages/pi-coding-agent/src/core/backends/accounting/types.ts` — Add `FreeTierFallbackConfig` to `AccountingConfig`
- `packages/pi-coding-agent/src/core/backends/accounting/config.ts` — Parse `free_tier_fallback` section
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Call `suggestDowngrade()` in `createSession()` and `resumeSession()`
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — Add downgrade tier annotation to summary
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` — Re-export downgrade module

---
*Research completed: 2026-03-26*
