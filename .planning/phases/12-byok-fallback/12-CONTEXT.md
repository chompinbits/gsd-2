# Phase 12: BYOK Fallback - Context

**Gathered:** 2026-03-26 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

When Copilot premium quota is **fully exhausted** (hard_stop reached), new sessions fall back to a user-configured BYOK (Bring Your Own Key) provider so workflows can continue without consuming premium requests. This phase delivers: BYOK provider config in GSD settings, quota-exhaustion trigger that routes sessions through the BYOK provider, BYOK session creation through the existing `BackendSessionHandle` interface (no workflow changes), and visible BYOK indication to the user. It does not alter the free-tier model downgrade path from Phase 11.

</domain>

<decisions>
## Implementation Decisions

### BYOK Provider Config Shape
- **D-01:** Use the Copilot SDK's native `provider` config block for BYOK session creation: `{ type: "openai" | "anthropic" | "azure", baseUrl: string, apiKey: string }`. No new LLM provider SDKs required — the SDK handles the wire protocol.
- **D-02:** Introduce a new `byok?: ByokConfig` key at the top-level `Settings` interface with shape `{ enabled: boolean; type: "openai" | "anthropic" | "azure"; baseUrl: string; apiKey: string; model: string }`. Add getter (`getByokConfig()`) and setter (`setByokConfig()`) to `SettingsManager`. API key is stored in the settings file at rest — user is responsible for credential security, consistent with other credential patterns in GSD.
- **D-03:** Define a `ByokProviderConfig` type in `backend-interface.ts` alongside `BackendConfig`. Add an optional `provider?: ByokProviderConfig` field to `BackendConfig`. This field is per-session, never cached or reused across sessions (Pitfall 2 guard — prevents provider config leaking from a BYOK session to a subsequent normal session).

### Fallback Trigger
- **D-04:** BYOK fallback triggers when the premium budget is **fully exhausted** (hard_stop threshold reached at 100%), not at the warn_threshold. This keeps Phase 11's free-tier model downgrade as the first safety layer (at warn) and BYOK as the last resort (at exhaustion).
- **D-05:** BYOK trigger is a pre-flight check at `createSession()` / `resumeSession()` boundaries only — not inside `AccountingSessionHandle.send()` (consistent with Phase 11 D-03 / D-07 / D-08). No mid-send provider swap.
- **D-06:** If BYOK is not configured (disabled or missing config), preserve existing behavior: surface a visible actionable error on exhaustion. Never silently fall through to Pi backend (consistent with no-silent-fallback contract from Phase 8 / Phase 11).

### Implementation Seam
- **D-07:** Add `FallbackResolver.toByokConfig(result: FallbackResult): ByokProviderConfig | null` to bridge the existing chain output to the SDK provider config shape. When the resolved model is from a non-Copilot provider, always include the `provider` block (Pitfall 5 guard).
- **D-08:** `CopilotSessionBackend.createSession()` checks hard_stop state after the existing downgrade check (`_applyDowngradeIfNeeded`). If exhausted and BYOK is enabled, inject `provider: byokConfig` into the session config passed to `client.createSession()`. The `BackendConfig.provider` field carries the BYOK config into the session creation call.
- **D-09:** BYOK check reads BYOK config from `SettingsManager` at session-creation time. No caching of the resolved `ByokProviderConfig` across sessions.

### User Configuration and Observability
- **D-10:** BYOK config lives in `Settings.byok` and is surfaced via the same GSD settings command channel as `defaultBackend` and `budget_ceiling`. No separate config file or env-var-only path.
- **D-11:** Emit explicit BYOK activation notification on stderr when a session routes to the BYOK provider: `[gsd:accounting] ⚡ BYOK provider active: <type>@<baseUrl> (premium quota exhausted)`. Mirrors Phase 11 downgrade notification pattern.
- **D-12:** Add a `byok_active` telemetry field (consistent with Phase 11's model downgrade telemetry) so dashboards and reports can indicate when sessions ran on BYOK.

### Verification Evidence
- **D-13:** Add automated coverage for: BYOK trigger at hard_stop (not at warn), `toByokConfig()` conversion correctness, no-provider-leak between sessions (Pitfall 2), and no-silent-fallback when BYOK is not configured.
- **D-14:** Add integration evidence that at least one quota-exhausted flow completes using a BYOK-configured session (session creation succeeds with provider block injected).

### the agent's Discretion
- Exact type name for the BYOK provider config struct (e.g., `ByokProviderConfig` vs `ExternalProviderConfig`), as long as D-01 and D-03 are preserved.
- Method name for the hard_stop exhaustion check in `CopilotSessionBackend`, as long as D-04 and D-08 are followed.
- Test partitioning (unit vs integration), as long as D-13 and D-14 are covered.
- Whether to add a `getBudgetExhausted(): boolean` helper on `BudgetGuard` or inline the check, as long as D-05 applies.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` — Phase 12 goal, dependencies, and success criteria for FLOW-03.
- `.planning/REQUIREMENTS.md` — FLOW-03 requirement contract and milestone traceability.
- `.planning/PROJECT.md` — Cost-aware migration principles, no-silent-fallback constraint, parity objectives.
- `.planning/STATE.md` — Current milestone/phase sequencing and active blockers.

### Prior Locked Decisions
- `.planning/phases/08-execute-verify-backend-routing/08-CONTEXT.md` — No-silent-fallback and stage-accounting contracts carried forward.
- `.planning/phases/11-free-tier-model-fallback/11-CONTEXT.md` — Free-tier downgrade seam, pre-flight pattern, D-03/D-07/D-08 session-scope constraints.

### Research Guidance for FLOW-03
- `.planning/research/STACK.md` — FLOW-03 path diagram, `ByokProviderConfig` shape, `toByokConfig()` seam, SDK provider block usage, and alternatives analysis.
- `.planning/research/PITFALLS.md` — Pitfall 2 (provider config leaking between sessions) and Pitfall 5 (BYOK model without provider block).
- `.planning/research/SUMMARY.md` — Implementation sequencing rationale.

### Core Runtime Seams
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` — `BackendConfig` (add `provider?` field) and `BackendSessionHandle` interface boundary.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — `CopilotSessionBackend.createSession()` / `resumeSession()` — BYOK injection point alongside existing downgrade check.
- `packages/pi-coding-agent/src/core/fallback-resolver.ts` — `FallbackResolver` — add `toByokConfig()` bridge method.
- `packages/pi-coding-agent/src/core/settings-manager.ts` — `Settings` interface (add `byok?` key), `FallbackSettings`, `SettingsManager` getters/setters.
- `packages/pi-coding-agent/src/core/sdk.ts` — Session creation entry point; where backend is selected and `createSession()` is invoked.

### Accounting and Budget Contracts
- `packages/pi-coding-agent/src/core/backends/accounting/budget-guard.ts` — Hard-stop enforcement and budget pressure state — BYOK trigger reads from this.
- `packages/pi-coding-agent/src/core/backends/accounting/types.ts` — Tier values and accounting config defaults.
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — Premium summary formatting surface — add `byok_active` field.

### Phase 11 Downgrade Module (pattern reference)
- `packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts` — `suggestDowngrade()` pattern and `DowngradeSuggestion` type — mirror for BYOK check.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CopilotSessionBackend._applyDowngradeIfNeeded()` — Pre-flight pattern to follow for BYOK check. Add a parallel `_applyByokIfExhausted()` method (or combine logic).
- `BudgetGuard.check()` — Already computes hard_stop pressure. Add `isExhausted(): boolean` check or read existing state.
- `FallbackResolver.findFallback()` — Already traverses user-configured chains. `toByokConfig()` is an additive method translating `FallbackResult` to the SDK's provider config shape.
- `formatPremiumSummary` with optional `downgrades` param — Extend pattern with `byokActive` flag for telemetry output.
- `process.stderr.write` notification pattern from Phase 11 — Reuse exactly for BYOK activation message.

### Established Patterns
- Backend routing is config-first: `options.backend` → `settingsManager.getDefaultBackend()` → `"pi"`.
- No silent fallback when Copilot backend is selected (consistent through phases 8, 9, 10, 11).
- Pre-flight budget checks at `createSession()` / `resumeSession()` boundaries, never inside `send()`.
- Per-session decisions: config is resolved fresh at creation, never cached across sessions.
- Settings changes use `setGlobalSetting()` / `setNestedGlobalSetting()` helpers in `SettingsManager`.

### Integration Points
- Add `provider?: ByokProviderConfig` to `BackendConfig` in `backend-interface.ts`.
- Add BYOK exhaustion check in `CopilotSessionBackend.createSession()` / `resumeSession()` after downgrade block.
- Inject `provider` block into Copilot SDK `createSession()` call when BYOK is active.
- Add `byok?: ByokConfig` field to `Settings` interface with `getByokConfig()` / `setByokConfig()` on `SettingsManager`.
- Extend `formatPremiumSummary` (or telemetry equivalent) with BYOK active indicator.

</code_context>

<specifics>
## Specific Ideas

- [auto] Selected all gray areas: provider config shape, fallback trigger threshold, implementation seam, settings schema, and observability.
- [auto] Provider config shape: Copilot SDK native `provider` block (`type`, `baseUrl`, `apiKey`) — no new LLM SDKs required (STACK.md recommendation).
- [auto] Fallback trigger: hard_stop exhaustion (100%) — BYOK is last resort after free-tier downgrade (warn threshold). Keeps Phase 11 layer intact.
- [auto] Implementation seam: `FallbackResolver.toByokConfig()` + `BackendConfig.provider?` field + injection in `CopilotSessionBackend.createSession()` (STACK.md recommended approach over new backend class).
- [auto] Settings schema: new `byok?` key in top-level `Settings` with `{enabled, type, baseUrl, apiKey, model}`.
- [auto] Observability: stderr `[gsd:accounting] ⚡ BYOK provider active:` notification + `byok_active` telemetry field.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-byok-fallback*
*Context gathered: 2026-03-26*
