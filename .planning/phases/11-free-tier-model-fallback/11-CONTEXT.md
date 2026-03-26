# Phase 11: Free-Tier Model Fallback - Context

**Gathered:** 2026-03-26 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

When premium request budget reaches quota pressure, new Copilot-backed sessions should route to 0x models automatically so workflows continue at reduced quality. This phase adds fallback policy, settings control, and visibility for FLOW-02. It does not include BYOK provider fallback (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Budget Trigger and Fallback Policy
- **D-01:** Trigger free-tier downgrade at `warn_threshold` (not only at hard stop). This preserves progress before `hard_stop` enforcement is reached.
- **D-02:** Keep budget checks side-effect free: budget logic returns a downgrade suggestion; session-routing logic decides whether to apply it.
- **D-03:** Downgrade evaluation runs as a pre-flight step before session creation paths, not inside timeout-sensitive session setup races.

### Fallback Model Selection
- **D-04:** Free-tier candidates come from known 0x models already mapped in accounting/multiplier contracts. Do not introduce 3x/30x routing.
- **D-05:** Selection is deterministic and provider-aware: prefer an available 0x model that can be resolved in the active runtime, then use ordered fallback candidates.
- **D-06:** If no valid 0x model is available, preserve existing behavior (visible warning/error flow), and never silently route to Pi.

### Session Scope and Continuity
- **D-07:** Apply downgrade to new sessions (including workflow wrappers and auto-mode unit sessions), aligning with Phase 11 SC-01 language.
- **D-08:** Do not perform mid-send model swaps in this phase; model choice is locked for each created session.
- **D-09:** Once downgraded due to quota pressure, workflow execution should continue on the downgraded model instead of halting from budget pressure in normal paths.

### User Configuration and Observability
- **D-10:** Expose fallback behavior in GSD settings by extending existing budget policy configuration rather than inventing a separate config channel.
- **D-11:** Emit explicit downgrade notification across interactive and headless surfaces (including structured event output), not only local stderr text.
- **D-12:** Surface active model/tier state in telemetry/metrics so users can verify when downgrade is active.

### Verification Evidence
- **D-13:** Add automated coverage for: trigger threshold behavior, downgrade candidate selection, no-silent-fallback behavior, and session-tier visibility.
- **D-14:** Add integration evidence that at least one budget-pressured flow continues on a downgraded 0x model.

### the agent's Discretion
- Exact shape/name of downgrade suggestion contract (for example `suggestDowngrade()` return type), as long as D-02, D-04, and D-05 are preserved.
- Exact fallback candidate ordering among validated 0x models, as long as ordering is deterministic and tested.
- Test partitioning (unit vs integration vs workflow) as long as D-13 and D-14 are covered.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` - Phase 11 goal, dependencies, and success criteria for FLOW-02.
- `.planning/REQUIREMENTS.md` - FLOW-02 requirement contract and milestone traceability.
- `.planning/PROJECT.md` - Cost-aware migration principles and parity constraints.
- `.planning/STATE.md` - Current milestone/phase sequencing and active blockers.

### Prior Locked Decisions
- `.planning/phases/08-execute-verify-backend-routing/08-CONTEXT.md` - No-silent-fallback and stage-accounting contracts carried forward.
- `.planning/phases/09-autonomous-orchestration-migration/09-CONTEXT.md` - Auto-mode session threading and per-unit config constraints.
- `.planning/phases/10-command-coverage-completion/10-CONTEXT.md` - Management-flow routing and telemetry contract continuity.

### Research Guidance for FLOW-02
- `.planning/research/STACK.md` - FLOW-02 gap analysis and suggested downgrade-policy seam.
- `.planning/research/PITFALLS.md` - FLOW-02 pitfalls, especially downgrade timing and missing headless notifications.
- `.planning/research/SUMMARY.md` - Sequencing rationale and fallback-threshold calibration note.

### Core Runtime Seams
- `packages/pi-coding-agent/src/core/sdk.ts` - Copilot session creation path and accounting config load entry point.
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` - Backend session config/send contract boundary.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` - Accounting session wrapper and pre-send budget check integration point.

### Accounting and Tier Contracts
- `packages/pi-coding-agent/src/core/backends/accounting/types.ts` - Tier values and accounting config defaults.
- `packages/pi-coding-agent/src/core/backends/accounting/config.ts` - `premium_request` config parsing and defaults.
- `packages/pi-coding-agent/src/core/backends/accounting/budget-guard.ts` - Warning/hard-stop enforcement behavior.
- `packages/pi-coding-agent/src/core/backends/accounting/multipliers.ts` - Known model-to-tier mappings including 0x models.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` - Stage-to-tier routing and conservative fallback defaults.
- `packages/pi-coding-agent/src/core/backends/accounting/request-tracker.ts` - Premium usage accumulation and budget-percent state.
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` - Premium summary formatting surface.

### Model Routing and UX Surfaces
- `src/resources/extensions/gsd/model-router.ts` - Existing downgrade/escalation semantics and tier-driven selection logic.
- `src/resources/extensions/gsd/auto-model-selection.ts` - Runtime model application and downgrade metadata emission patterns.
- `src/resources/extensions/gsd/preferences-models.ts` - Effective dynamic routing config resolution.
- `src/resources/extensions/gsd/preferences-types.ts` - User preference schema including routing/cost controls.
- `src/resources/extensions/gsd/metrics.ts` - Persisted model/tier telemetry fields used by dashboards and reports.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BudgetGuard.check()` already computes warn and hard-stop pressure and returns a structured warning path.
- `MODEL_MULTIPLIER_MAP` already contains known 0x candidates and can anchor downgrade candidate selection.
- `AccountingSessionHandle.send()` is the pre-send interception seam for budget policy + tracking.
- `RequestTracker` + `formatPremiumSummary` already expose budget percentage and stage-attributed costs.
- Auto-mode model selection code already tracks downgrade metadata (`tier`, `modelDowngraded`) and notifies UI.

### Established Patterns
- Backend routing stays config-first (`options.backend` -> settings default -> pi).
- Unknown stages/models use conservative defaults (`standard` tier) and explicit warnings.
- No silent fallback to Pi when Copilot path is explicitly selected (carried from prior phases).
- User-visible telemetry is emitted via stderr + metrics + event translation surfaces.

### Integration Points
- Add downgrade recommendation seam in accounting policy and consume it in Copilot backend session handling.
- Thread fallback configuration through existing settings/config loading path used by `createAgentSession`.
- Emit downgrade notifications through both interactive UI notices and headless-compatible event/log channels.
- Ensure auto-mode `newSession()` path receives downgrade decision before timeout-sensitive session creation.

</code_context>

<specifics>
## Specific Ideas

- [auto] Selected all gray areas for phase discussion: trigger policy, candidate selection, session scope, settings surface, and observability.
- [auto] Trigger policy: selected warn-threshold activation (recommended) over hard-stop-only behavior.
- [auto] Candidate source: selected existing 0x multiplier map + deterministic provider-aware resolution (recommended).
- [auto] Scope: selected new-session downgrade application (recommended) instead of mid-send model swapping.
- [auto] Configuration: selected extension of existing settings/config path (recommended) over standalone env-only controls.
- [auto] Notifications: selected structured downgrade visibility across stderr/headless telemetry (recommended).

</specifics>

<deferred>
## Deferred Ideas

- BYOK provider fallback and provider-config injection remain Phase 12 scope.

</deferred>

---

*Phase: 11-free-tier-model-fallback*
*Context gathered: 2026-03-26*
