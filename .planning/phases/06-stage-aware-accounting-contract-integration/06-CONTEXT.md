# Phase 6: Stage-Aware Accounting Contract Integration - Context

**Gathered:** 2026-03-25 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Propagate workflow stage metadata end-to-end for migrated planning calls so accounting records are attributed to the intended stage tier instead of the current unknown fallback path.

</domain>

<decisions>
## Implementation Decisions

### Send Contract Shape
- **D-01:** Extend the backend send contract to carry explicit stage metadata alongside prompt payloads instead of inferring stage inside accounting wrappers.
- **D-02:** Keep migration safety by making stage metadata additive at the interface boundary, with controlled compatibility behavior for legacy call sites.

### Stage Ownership and Propagation
- **D-03:** Workflow entry points own stage identity and pass canonical stage values at send time (for migrated planning paths at minimum: discuss-phase, plan-phase, plan-check).
- **D-04:** Propagate stage unchanged through SDK wrappers and backend session handles into accounting tracker recording; avoid deriving stage from prompt content, model, or call stack heuristics.

### Fallback and Guardrails
- **D-05:** Keep `unknown` only as a temporary compatibility fallback for non-migrated paths; migrated planning workflows should not emit unknown stage accounting records.
- **D-06:** Preserve existing stage-router tier mapping semantics (`STAGE_TIER_MAP`) and budget guard behavior; this phase fixes metadata propagation, not pricing policy.

### Verification Strategy
- **D-07:** Add integration tests that assert stage propagation from workflow invocation through backend accounting records, including correct stage-tier attribution for discuss and plan flows.
- **D-08:** Add contract coverage for create/resume session paths to ensure stage-aware send semantics remain stable across wrappers.

### Auto-Selected Gray Areas (`--auto`)
- **D-09:** [auto] Selected all identified gray areas: send contract shape, stage source ownership, fallback policy, and verification scope.
- **D-10:** [auto] Chose recommended defaults favoring explicit stage metadata, additive compatibility, and integration-level verification.

### the agent's Discretion
- Exact type names and parameter object naming for stage-carrying send payloads.
- Whether compatibility fallback logs at warn or debug level, as long as unknown usage remains visible in diagnostics.
- Exact test fixture layout and helper abstractions for propagation assertions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Acceptance
- `.planning/ROADMAP.md` — Phase 6 goal, gap-closure note, and success criteria for stage propagation.
- `.planning/REQUIREMENTS.md` — COST-01 and COST-02 acceptance constraints tied to stage-based accounting visibility.
- `.planning/PROJECT.md` — parity-first migration constraints and cost-efficiency priorities.

### Prior Decisions to Carry Forward
- `.planning/phases/02-request-accounting-model-routing/02-CONTEXT.md` — locked accounting strategy, stage-tier semantics, and guardrail constraints.
- `.planning/phases/03-planning-workflow-migration/03-CONTEXT.md` — planning workflow parity and backend migration boundaries.
- `.planning/STATE.md` — recorded Phase 2/3/4 decisions including known `stage=unknown` fallback gap.

### Existing Architecture and Contracts
- `.planning/codebase/ARCHITECTURE.md` — runtime layering and backend seams.
- `.planning/codebase/STRUCTURE.md` — module boundaries and expected integration points.
- `.planning/codebase/CONVENTIONS.md` — TypeScript and compatibility conventions for contract evolution.
- `.planning/codebase/INTEGRATIONS.md` — external/runtime integration context for backend behavior.

### Contract and Runtime Hotspots
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` — current `BackendSessionHandle.send(prompt, attachments?)` contract.
- `packages/pi-coding-agent/src/core/sdk.ts` — Copilot handle lifecycle and wrapper delegation path.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — accounting wrapper where `stage = "unknown"` is currently hardcoded.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` — canonical stage-to-tier mapping and fallback semantics.
- `packages/pi-coding-agent/src/core/backends/accounting/request-tracker.ts` — per-stage accounting record aggregation.
- `src/workflows/discuss-phase.ts` — migrated discuss workflow entry point.
- `src/workflows/plan-phase.ts` — migrated plan workflow entry point and accounting tier telemetry notes.
- `.planning/phases/05-planning-parity-evidence-revalidation/05-VERIFICATION.md` — parity regression gate evidence baseline that Phase 6 must preserve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CopilotSessionBackend` with `AccountingSessionHandle` already wraps send calls and records telemetry; this is the primary insertion point for stage-aware attribution.
- `RequestTracker` already groups records by stage and exposes summary/state APIs needed for verification.
- `STAGE_TIER_MAP` and `getStageMultiplierTier()` already encode policy for stage routing; only metadata propagation is missing.
- Migrated workflows (`discuss-phase`, `plan-phase`) already centralize prompt dispatch and are natural stage-source boundaries.

### Established Patterns
- Backend-specific behavior is contained behind adapter interfaces and wrappers; transport evolution should remain additive and parity-safe.
- Planning workflows are backend-agnostic wrappers and log telemetry to stderr for parity diagnostics.
- Accounting policy is deterministic and centralized in accounting helpers; phase 6 should reuse these functions rather than duplicating tier logic.

### Integration Points
- `BackendSessionHandle` contract evolution point in `backend-interface.ts`.
- Wrapper passthrough in `sdk.ts` (`withCopilotSessionCleanup`) that must preserve any stage metadata.
- Accounting send path in `copilot-backend.ts` where stage is currently lost.
- Workflow call sites in `src/workflows/*.ts` where canonical stage values should be supplied.
- Backend/accounting test suites under `packages/pi-coding-agent/src/core/backends/**/*.test.ts` for propagation and resume coverage.

</code_context>

<specifics>
## Specific Ideas

- Prefer explicit stage values from workflow entrypoints over implicit inference.
- Treat unknown-stage records on migrated planning flows as a regression signal.
- Keep phase 6 scoped to metadata contract integration and verification, without introducing new routing policies.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-stage-aware-accounting-contract-integration*
*Context gathered: 2026-03-25*
