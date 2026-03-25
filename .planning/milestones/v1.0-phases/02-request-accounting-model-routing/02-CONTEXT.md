# Phase 2: Request Accounting + Model Routing - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multiplier-aware model routing and premium-request accounting to the Copilot SDK backend so users are protected from premium-request quota exhaustion. This phase includes request measurement, per-stage routing decisions, budget guardrails, and telemetry visibility — all configurable and actionable. It does not include execution/verify workflow migration or full autonomous auto-routing; those are deferred to v2.

</domain>

<decisions>
## Implementation Decisions

### Request Accounting Strategy
- **D-01:** Measure and count premium requests at **completion level** — when the Copilot SDK backend finishes a model call, capture the request and its token consumption (if available from response metadata).
- **D-02:** Track accumulated premium-request usage **per session** and **per run** (workflow unit) to enable both session-level and per-command visibility.
- **D-03:** Account for streaming responses as **one request per completion**, not per chunk — avoid overcounting during streaming scenarios.
- **D-04:** Store request accounting data in session state/artifacts (`$HOME/.gsd/agent/sessions/{id}/`) for durability and offline lookup.

### Model Routing Tiers and Triggers
- **D-05:** Implement three model multiplier tiers: **0× (free models, zero premium cost)**, **0.33× (lower-tier premium, restricted to low-complexity tasks)**, **1× (standard premium models for general use)**.
- **D-06:** Route by **workflow stage** as the primary decision point:
  - `discuss-phase` → 0× (information gathering, no complex reasoning needed)
  - `verify-work` → 0× (validation UAT, factual checks)
  - `plan-check` / `validate-phase` → 0.33× (moderate complexity, structured output)
  - `plan-phase` / `research-phase` → 1× (high complexity, strong reasoning required)
- **D-07:** Support **complexity hints** from callers (low/medium/high tags on requests) to allow case-by-case routing override within a stage, with conservative defaults (prefer lower tier when unsure).
- **D-08:** Hard-code tier mappings in the adapter layer; user config controls thresholds (when to warn/stop), not routing rules themselves — keep routing deterministic and predictable.

### Budget Guardrails and Enforcement
- **D-09:** Implement **graduated protection**: warn at 80% of budget, stop with error at 100% (hard limit). Both thresholds configurable via config.json or command-line flags.
- **D-10:** When budget is exceeded, **fail the current request with a clear error message** explaining the quota limit, how much was used, and how to adjust thresholds or request premium-request increase.
- **D-11:** Support **soft limits** (warnings only) and **hard limits** (stops execution). Default to **hard limit at 100%** for safety; users can override to warning-only if willing to accept quota overages.
- **D-12:** Store **budget state** in session context so users can check current usage without running a command: `gsd status --show-request-usage` or equivalent.

### Telemetry and Visibility
- **D-13:** Expose per-stage breakdown of premium-request usage: show how many requests used in discuss vs plan vs verify separately, so users understand which workflow stages are most expensive.
- **D-14:** Log all request accounting events to session artifacts (e.g., `$session/request-accounting.log` or embedded in session state JSON) for audit trail and debugging.
- **D-15:** Display request usage in **CLI output** (RPC mode: print summary to stderr; TUI mode: show in status bar or dashboard), and in **web UI** (request dashboard widget in session browser).
- **D-16:** Provide **per-run summaries** after each workflow unit completes (planning, execution, etc.): "Used X premium requests across Y stages. Budget: Z% remaining."

### Configuration and User Control
- **D-17:** Parameterize all user-configurable thresholds in `config.json`: `premium_request_budget_limit` (total quota), `premium_request_warn_threshold` (% to warn), `premium_request_hard_stop` (boolean for hard limit behavior).
- **D-18:** Support command-line flag overrides for one-off runs (e.g., `gsd plan --premium-limit 500` to increase budget for a single command) without modifying global config.
- **D-19:** Provide a **config reset/clear** command to restore defaults if user gets stuck or wants to experiment with different thresholds.
- **D-20:** Do NOT auto-downgrade models or auto-switch backends based on budget pressure in this phase — that complexity belongs in v2. This phase measures and guards; v2 will add automatic fallback strategies.

### the agent's Discretion
- Exact telemetry event names and JSON schema for request accounting logs.
- Which response fields to extract for token counts (some model providers may not expose token counts; handle gracefully).
- Whether to batch request accounting updates to session state or log each request individually (both are acceptable; optimize for performance).
- Specific placement of guardrail checks in the request pipeline (as long as they fire before the request is sent).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goals and Requirements
- `.planning/ROADMAP.md` §Phase 2 — Goal, dependencies, and success criteria for request accounting + model routing.
- `.planning/REQUIREMENTS.md` — COST-01, COST-02, COST-03 acceptance criteria (multiplier tiers, usage visibility, budget guardrails).
- `.planning/PROJECT.md` — Core value ("fewer, higher-value premium requests") and cost-aware execution philosophy.

### Backend and SDK Contracts
- `.planning/codebase/ARCHITECTURE.md` — Data flow, layer contracts, and where accounting logic should attach (likely in adapter or session lifecycle).
- `.planning/codebase/STRUCTURE.md` — Session state storage location ($HOME/.gsd/agent/sessions/) and existing patterns for persisting run metadata.
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — SDK session API and response metadata availability for extracting token counts.

### Phase 1 Adapter Foundation
- `.planning/phases/01-adapter-layer-sdk-foundation/01-CONTEXT.md` — Backend seam, tool bridge, event normalization decisions that Phase 2 builds on.
- `.planning/phases/01-adapter-layer-sdk-foundation/01-VERIFICATION.md` — Parity evidence from Phase 1 that Phase 2 should preserve.

### Cost Modeling and Multiplier Logic
- `.planning/research/` — Check for any ecosystem research on model pricing tiers, token measurement patterns, or budget guardrail best practices from Phase 2 research artifacts (if any).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/pi-coding-agent/src/core/agent-session.ts` already has rich session state management and subscription APIs — request accounting can hook into session state updates without new event categories.
- `packages/pi-ai/src/providers/` already abstracts model selection (Claude, OpenAI, etc.) — adapter can inject routing tier decision at provider selection time.
- `src/web/bridge-service.ts` already tracks session events and state invalidation — telemetry can reuse existing bridge event channel to push usage updates to the web UI.
- Session artifacts are stored in `$HOME/.gsd/agent/sessions/{id}/` — new `request-accounting.json` or `usage-telemetry.json` file fits existing pattern.

### Established Patterns
- Session lifecycle ties to CLI mode (interactive/RPC/web) — request accounting should initialize with session and persist across mode boundaries.
- Existing service modules in `src/web/*.ts` already wrap domain logic (cleanup, recovery, hooks) — accounting service can follow same pattern (`request-accounting-service.ts`).
- Config parameters stored in `.planning/config.json` — premium-request thresholds belong in same file under a new `premium_request` section.
- Error handling uses descriptive messages and error propagation via try/finally — guardrail errors should match this pattern.

### Integration Points
- Adapter layer is the natural seam to inject request accounting (measure after SDK completes model calls).
- Session creation already happens in `packages/pi-coding-agent/src/core/sdk.ts` (`createAgentSession`) — accounting can initialize there.
- CLI mode routing in `src/cli.ts` should pass accounting context down so each mode (interactive/RPC/web) reports usage correctly.
- Bridge service in `src/web/` should receive accounting telemetry stream and expose it to web UI components.

</code_context>

<specifics>
## Specific Ideas

- Consider exposing a hidden `gsd status --premium-usage` command early for debugging and testing the accounting implementation before full integration.
- When displaying request totals, show both "requests used in this session" and "remaining in monthly quota" so users have immediate feedback on resource availability.
- Make guardrail error messages actionable: "Used 450/500 requests. Current plan covers until 2026-04-24. Upgrade to increase limit or use `/gsd-set-profile` to reduce model tier for future commands."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-request-accounting-model-routing*
*Context gathered: 2026-03-24*
*Auto-selected: All gray areas with recommended defaults per cost-aware migration strategy*
