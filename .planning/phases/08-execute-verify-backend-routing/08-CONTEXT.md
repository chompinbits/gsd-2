# Phase 8: Execute & Verify Backend Routing - Context

**Gathered:** 2026-03-25 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Route execute and verify workflows through the Copilot SDK backend under config control, with stage-correct accounting telemetry and verification evidence. This phase does not include full autonomous orchestration migration, roadmap/requirements command migration, or fallback-policy features beyond what is needed for execute/verify backend routing.

</domain>

<decisions>
## Implementation Decisions

### Backend Routing Contract
- **D-01:** Execute and verify workflow entry points must use the existing backend resolution chain (`options.backend` -> `settings.defaultBackend` -> `"pi"`) through `createAgentSession`, not command-local backend switches.
- **D-02:** `defaultBackend: "copilot"` is the single runtime switch for execute/verify routing, matching discuss/plan behavior.
- **D-03:** When Copilot backend is explicitly selected and cannot initialize, return a visible actionable error instead of silently falling back to Pi.

### Stage and Accounting Semantics
- **D-04:** Workflow stage metadata must be forwarded from execute/verify dispatch paths into backend session creation and send calls.
- **D-05:** Stage mapping must explicitly cover both current and alias names used by routing paths: `execute-task` and `execute-phase` map to `standard`; `verify-work`, `verify-phase`, and `run-uat` map to `free`.
- **D-06:** Accounting telemetry must preserve stage attribution per session so per-plan premium usage is inspectable after execute/verify runs.

### Tool Access Profiles
- **D-07:** Execute sessions keep full coding capabilities (read, write/edit, bash, lsp, skills/tools needed for implementation).
- **D-08:** Verify sessions are read-oriented by default (read, bash, lsp) and must not expose write/edit by default.
- **D-09:** Session tool filtering must be applied at the runtime rebuild boundary (`newSession`/tool refresh) so restrictions are not lost when extension tools are rehydrated.

### Verification Evidence
- **D-10:** Add automated coverage for backend routing selection, stage-tier attribution, and execute-vs-verify tool profile enforcement.
- **D-11:** Add live-path validation proving `execute-phase` and `verify-work` complete on Copilot backend and emit expected telemetry.
- **D-12:** Keep Pi-path parity checks as control by running the same workflows with `defaultBackend: "pi"` and `"copilot"` in the same environment.

### the agent's Discretion
- Exact wrapper/module naming for execute/verify workflow adapters, as long as routing and stage propagation remain explicit and testable.
- Exact test file partitioning (unit vs integration vs live), as long as D-10 through D-12 are covered.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` - Phase 8 goal and success criteria for EXEC-01.
- `.planning/REQUIREMENTS.md` - Requirement mapping for EXEC-01.
- `.planning/PROJECT.md` - Migration constraints and parity-first principles.
- `.planning/STATE.md` - Current milestone state and ordering assumptions.

### Existing Backend Routing and Accounting
- `packages/pi-coding-agent/src/core/sdk.ts` - `createAgentSession` routing chain, stage propagation, and Copilot backend init path.
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` - Backend config/session contracts.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` - Copilot session creation, accounting wrapper, and stage-aware send accounting.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` - Stage-to-tier map and effective tier semantics.

### Execute/Verify Runtime Integration Points
- `src/resources/extensions/gsd/auto/run-unit.ts` - New-session execution seam for per-unit routing config.
- `src/resources/extensions/gsd/auto/phases.ts` - Unit execution phase, lock/closeout sequencing, and artifact verification behavior.
- `src/resources/extensions/gsd/auto/loop.ts` - Dispatch/guards/run/finalize orchestration loop.

### Proven Migration Patterns to Reuse
- `src/workflows/discuss-phase.ts` - Existing backend-agnostic wrapper pattern.
- `src/workflows/plan-phase.ts` - Existing backend-agnostic wrapper plus stage-tier telemetry pattern.
- `.planning/milestones/v1.0-phases/03-planning-workflow-migration/03-CONTEXT.md` - Prior migration decisions for discuss/plan parity.
- `.planning/milestones/v1.0-phases/04-parity-validation-safe-switchover/04-VERIFICATION.md` - Config-driven backend switchover verification precedent.

### Phase Research Inputs
- `.planning/research/STACK.md` - v1.1 stack-level implementation deltas and recommended wiring.
- `.planning/research/ARCHITECTURE.md` - v1.1 architecture threading pattern for stage/tool config.
- `.planning/research/PITFALLS.md` - Known failure modes to guard against in execute/verify routing.
- `.planning/research/SUMMARY.md` - Sequence rationale and risk focus for v1.1 phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/workflows/discuss-phase.ts`: Existing backend-agnostic workflow wrapper with stable prompt/output parsing pattern.
- `src/workflows/plan-phase.ts`: Existing backend-agnostic wrapper with stage-aware telemetry logging and artifact parsing.
- `packages/pi-coding-agent/src/core/sdk.ts`: Central backend selection and session creation seam already used by migrated workflows.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts`: Session backend implementation with accounting wrapper and stage-aware `send` options.

### Established Patterns
- Backend routing is config-first (`defaultBackend`) with explicit per-call override support.
- Stage-to-tier accounting is deterministic with conservative defaults in `stage-router.ts`.
- Auto-mode uses one fresh session per unit (`newSession`) and relies on post-unit artifact verification before completion.

### Integration Points
- Thread execute/verify stage and tool profile metadata from dispatch paths into `newSession` and backend config.
- Ensure tool filtering survives runtime rebuild in the `newSession` path.
- Extend tests in backend routing/accounting and auto-mode seams where execute/verify paths are currently implicit.

</code_context>

<specifics>
## Specific Ideas

- [auto] Context generation mode: all discovered gray areas were selected for decision capture.
- [auto] Recommended defaults accepted for routing contract, stage semantics, tool profiles, and verification evidence scope.
- Keep decisions transport-focused: no product UX expansion beyond execute/verify backend behavior required by Phase 8.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-execute-verify-backend-routing*
*Context gathered: 2026-03-25*