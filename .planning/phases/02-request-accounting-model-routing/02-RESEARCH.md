# Phase 2: Request Accounting + Model Routing — Research

**Researched:** 2026-03-24
**Phase:** 02-request-accounting-model-routing
**Requirements:** COST-01, COST-02, COST-03

## Domain Analysis

### Premium Request Multiplier Model

GitHub Copilot's billing uses premium request multipliers — each model has a cost multiplier applied to the monthly quota. The key tiers:

| Multiplier | Examples | Use Case |
|------------|----------|----------|
| **0×** (free) | GPT-4.1, GPT-4o, GPT-5 mini | Information gathering, validation, simple tasks |
| **0.33×** | Claude Haiku 4.5, Gemini 3 Flash, Codex-Mini | Moderate complexity, structured output |
| **1×** | Claude Sonnet 4.x, GPT-5.x, Gemini Pro | Standard premium work — planning, execution |
| **3×** | Claude Opus 4.5/4.6 | Complex reasoning (avoid in automated flows) |
| **30×** | Claude Opus 4.6 fast | Never use in automated flows |

**Key insight from research (PITFALLS.md):** A single GSD milestone with 3 slices × 5 tasks = ~25 units. At 1× = 25 premium requests; at 3× = 75 requests (25% of a 300/month Pro quota). Budget enforcement is critical BEFORE any auto-mode dispatch is migrated.

### Tool Call Counting (Pitfall 2)

Community reports confirm the SDK's agentic loop counts each tool call interaction against premium quota. A single "execute-task" unit triggering 5 tool calls = 5 premium requests, not 1. However, this primarily applies to agent-mode execution (Phase 3+). For Phase 2 the accounting layer needs to be designed to handle this, but actual multi-turn counting will be validated empirically during Phase 3.

## Existing Codebase Assets

### Directly Reusable

| Asset | Location | Relevance |
|-------|----------|-----------|
| **Model router** | `src/resources/extensions/gsd/model-router.ts` | Has Light/Standard/Heavy tiers, `resolveModelForComplexity()`, cost table — Phase 2 extends with multiplier dimension |
| **Metrics system** | `src/resources/extensions/gsd/metrics.ts` | UnitMetrics already has `tier`, `modelDowngraded`, `apiRequests` fields — accounting can populate these |
| **Token counter** | `src/resources/extensions/gsd/token-counter.ts` | Provider-aware estimation — complementary but separate from premium request counting |
| **Context budget** | `src/resources/extensions/gsd/context-budget.ts` | Budget allocation patterns — similar warn/stop pattern can be reused for premium requests |
| **Adapter layer** | `packages/pi-coding-agent/src/core/backends/` | Phase 1 foundation — `CopilotSessionBackend`, `BackendSessionHandle`, event translator |
| **Session creation** | `packages/pi-coding-agent/src/core/sdk.ts` | `createAgentSession()` with `backend?: "pi" | "copilot"` — accounting initializes here |

### Patterns to Follow

1. **Adapter boundary isolation:** Per Phase 1 decisions (SAFE-01), all accounting code stays within `packages/pi-coding-agent/src/core/backends/accounting/` — no raw SDK types leak out.
2. **Stateless modules:** Phase 1 established stateless translation modules. Accounting modules should be side-effect-free where possible (tracker is stateful but passed explicitly, not global).
3. **Existing config pattern:** GSD uses `.planning/config.json` for project-level config. Premium request thresholds belong under a `premium_request` section.
4. **Session artifact pattern:** Files at `$HOME/.gsd/agent/sessions/{id}/` — accounting data fits as `request-accounting.json`.
5. **Service module pattern:** `src/web/*.ts` wrap domain logic — `request-accounting-service.ts` for web bridge integration.

### Integration Points

1. **`CopilotSessionBackend.createSession()`** → inject accounting context (multiplier, stage tier)
2. **`CopilotSessionHandle.send()`** → decorate to track premium request consumption + enforce budget guard
3. **`createAgentSession()` in sdk.ts** → initialize accounting tracker, pass config
4. **Extension event system** → emit accounting events for dashboard/TUI consumption
5. **`metrics.ts` UnitMetrics** → already has `apiRequests` field — populate with premium request count

## Architecture Decision

### Accounting Module Location

Place accounting logic at the adapter boundary: `packages/pi-coding-agent/src/core/backends/accounting/`

**Rationale:**
- Accounting must intercept at the adapter seam before requests reach the SDK
- Keeps it alongside the Copilot backend (same package, same abstraction level)
- Not in extension layer (too high — extensions are loaded dynamically)
- Not in SDK core (too low — session management doesn't know about premium requests)

### Module Structure

```
packages/pi-coding-agent/src/core/backends/accounting/
├── types.ts               # Interfaces: MultiplierTier, AccountingConfig, RequestRecord, etc.
├── multipliers.ts         # Model → multiplier mapping table (static, per D-05/D-08)
├── stage-router.ts        # Workflow stage → multiplier tier mapping (per D-06/D-07)
├── request-tracker.ts     # Accumulator: tracks premium requests per session/run (per D-01/D-02/D-03)
├── budget-guard.ts        # Pre-send enforcement: warn/stop based on budget (per D-09/D-10/D-11)
├── config.ts              # Load/merge config from config.json + CLI flags (per D-17/D-18/D-19)
├── telemetry.ts           # Format per-stage breakdowns and per-run summaries (per D-13/D-14/D-15/D-16)
├── index.ts               # Barrel exports
└── accounting.test.ts     # Unit tests for all accounting modules
```

### Stage-to-Tier Mapping (D-06)

```
discuss-phase    → 0× (information gathering)
verify-work      → 0× (validation UAT, factual checks)
plan-check       → 0.33× (moderate complexity, structured output)
validate-phase   → 0.33× (moderate complexity)
plan-phase       → 1× (high complexity, strong reasoning)
research-phase   → 1× (high complexity)
execute-task     → 1× (standard premium — Phase 3+)
```

### Budget Guard Algorithm (D-09/D-10/D-11)

```typescript
// Pre-send check:
1. Calculate estimated premium request cost = 1 × model_multiplier
2. Project new total = tracker.totalPremiumRequests + estimated
3. If (new_total / budget_limit) >= hard_stop_threshold (default 100%):
   → If hard_stop enabled: throw BudgetExceededError with actionable message
   → If soft limit: log warning, proceed
4. If (new_total / budget_limit) >= warn_threshold (default 80%):
   → Emit warning event (for CLI/TUI/web display)
5. Proceed with request
```

## Validation Strategy

### Automated Tests

Each module has unit tests verifying:
- Multiplier table returns correct values for known models
- Stage router maps all GSD workflow stages correctly
- Request tracker accumulates correctly across multiple requests
- Budget guard triggers at correct thresholds
- Configuration merges defaults + file + CLI flags correctly
- Telemetry formats per-stage breakdowns correctly

### Integration Verification

After all plans complete:
1. Create a Copilot session with accounting enabled → verify tracker initializes
2. Send a request → verify premium request counted with correct multiplier
3. Configure budget at low threshold → verify warning fires
4. Exceed budget → verify hard stop triggers with actionable error message
5. Check session artifacts → verify `request-accounting.json` persisted

## Risk Analysis

| Risk | Mitigation |
|------|-----------|
| SDK doesn't expose model info in response | Design tracker to accept model from request config (known at send time), not response metadata |
| Multiplier table becomes stale | Static table with easy-to-update mapping; version pinned to match SDK version |
| Budget guard adds latency to every request | Pure computation (< 1ms) — no I/O in hot path |
| Premium request counting differs from GitHub's actual billing | Document as "estimated" — provide config to calibrate; exact billing is GitHub-side |
| Phase 3 multi-turn counting changes assumptions | Tracker designed to count per-completion (D-03); multiplier applied per tracked request |

## Research Conclusion

Phase 2 is well-scoped: mostly new additive modules at the adapter boundary plus configuration. The existing codebase provides strong patterns (metrics tracking, model routing, budget management) that the accounting modules can follow. No external dependencies needed beyond what Phase 1 already installed (`@github/copilot-sdk`).

**Discovery Level:** Level 1 (Quick Verification) — well-understood domain, building on established codebase patterns with known SDK.

---
*Research completed: 2026-03-24*
*Phase: 02-request-accounting-model-routing*
