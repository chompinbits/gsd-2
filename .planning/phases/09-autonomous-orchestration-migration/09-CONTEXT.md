# Phase 9: Autonomous Orchestration Migration - Context

**Gathered:** 2026-03-25 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Thread stage-aware unit configuration (`unitConfig: { stage, toolFilter, modelHint }`)
from `DispatchAction` through `runUnit()` → `cmdCtx.newSession()` → `CopilotSessionBackend`,
so that all units executed in autonomous orchestration mode use the Copilot backend with
correct per-unit tool filtering and model routing. This phase does not include roadmap/
requirements command migration (Phase 10), free-tier fallback (Phase 11), or BYOK
fallback (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### unitConfig Shape
- **D-01:** `unitConfig` carries `stage: string`, `availableToolNames: string[]`, and
  `modelHint?: string`. The `availableToolNames` field (string array of explicit tool
  names) aligns with `BackendConfig.availableToolNames` from the architecture doc and
  with the Phase 8 tool-filtering contract (D-09). Resolved as a concrete list, not a
  semantic profile enum, so the filtering happens at the backend layer without an
  intermediate resolver.
- **D-02:** `unitConfig` is passed as an optional parameter to `runUnit()` and threaded
  into `cmdCtx.newSession()`. Callers in `runUnitPhase` (phases.ts) are responsible for
  assembling `unitConfig` from the `DispatchAction`; `runUnit` does not derive it.

### Stage Derivation Coverage
- **D-03:** Stage derivation must cover both standard auto-mode dispatch (unit type
  from `auto-dispatch.ts` → stage) and custom engine dispatch (unit type from GRAPH.yaml
  → stage). No special-case for custom engine path — both paths populate `DispatchAction`
  with a `stage` field using the same unit-type-to-stage map. Deferred custom engine
  support not acceptable here because SC-02 requires stage-aware config to flow through
  the full `runUnit → newSession` chain for all dispatch paths.
- **D-04:** Stage-to-tier map for auto-mode units: `discuss` → `free`; `plan` → `standard`;
  `execute-task` / `execute-phase` → `standard`; `verify-work` / `verify-phase` → `free`.
  Consistent with Phase 8 D-05 stage mappings.

### Tool Profile Per Unit
- **D-05:** Execute units receive full coding capabilities: read, write/edit, bash, lsp,
  skills/tools needed for implementation — matching Phase 8 D-07.
- **D-06:** Verify units are read-oriented: read, bash, lsp — no write/edit by default —
  matching Phase 8 D-08.
- **D-07:** Tool filtering is applied at every `newSession()` call in the auto loop so
  restrictions are not lost when the tool registry is rebuilt. This is required at the
  `_buildRuntime` → `BackendConfig` boundary — consistent with Phase 8 D-09.

### Session Lifecycle Across Multi-Phase Runs
- **D-08:** Each unit in the auto loop creates a fresh session via `newSession()` with its
  own `unitConfig`. The `AutoSession` object carries the backend config default (resolved
  from `defaultBackend` setting) so per-unit overrides layer on top of it without re-reading
  settings on every unit.
- **D-09:** Session create, resume, and destroy must function correctly across multi-phase
  autonomous runs. Session state (phase progress, artifacts) is persisted to disk via
  existing state primitives; backend session handles are ephemeral per-unit and not shared
  across units.

### Mid-Run Backend Error Handling
- **D-10:** When the Copilot backend fails to initialize for a unit, cancel that unit and
  surface a visible actionable error (matching Phase 8 D-03). The existing consecutive-
  error counter in `autoLoop` governs retry/abort behavior — no new abort policy needed.
  Auto-mode does not silently fall back to Pi for individual units mid-run.

### Verification Evidence
- **D-11:** Add automated tests covering: (a) per-unit tool profile enforcement — execute
  unit gets write, verify unit does not; (b) stage attribution propagates from
  `DispatchAction` through `newSession` to backend config; (c) session lifecycle across
  a simulated two-unit autonomous run (create → unit 1 → destroy → create → unit 2).
- **D-12:** Add live-path validation proving an autonomous run completes at least one
  discuss + plan unit pair on the Copilot backend with correct telemetry emitted.

### the agent's Discretion
- Exact naming of `unitConfig` type alias or interface (e.g., `UnitSessionConfig` vs
  extending `BackendConfig`), as long as the fields in D-01 are present and the plumbing
  in D-02 is explicit and testable.
- Exact test file partitioning (unit vs integration vs live), as long as D-11 and D-12
  are covered.
- Whether `DispatchAction` is extended in-place or a wrapper type is used — follow the
  existing pattern in `auto-dispatch.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` — Phase 9 goal and success criteria for EXEC-02.
- `.planning/REQUIREMENTS.md` — Requirement mapping for EXEC-02.
- `.planning/PROJECT.md` — Migration constraints and parity-first principles.
- `.planning/STATE.md` — Current milestone state and ordering assumptions.

### Auto-Mode Orchestration Entry Points
- `src/resources/extensions/gsd/auto/run-unit.ts` — Single unit execution: session
  create → prompt → await agent_end. Primary extension point for `unitConfig`.
- `src/resources/extensions/gsd/auto/loop.ts` — Main auto-mode execution loop;
  calls `runUnitPhase` with iteration context.
- `src/resources/extensions/gsd/auto/phases.ts` — Pipeline phases including
  `runDispatch` and `runUnitPhase`; where `DispatchAction` is assembled and
  `runUnit` is invoked.
- `src/resources/extensions/gsd/auto/session.ts` — `AutoSession` class; all new
  per-session backend config must be added here per the maintenance rule.
- `src/resources/extensions/gsd/auto/types.ts` — Type definitions including
  `DispatchAction`, `IterationContext`, `LoopState`.

### Backend and Stage-Routing Infrastructure
- `packages/pi-coding-agent/src/core/sdk.ts` — `createAgentSession` routing chain,
  `newSession()` interface, backend selection logic.
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` — `BackendConfig`
  contract; `availableToolNames` field lives here.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Copilot session
  creation, accounting wrapper, tool filtering at `createSession`.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` — Stage-to-
  tier map; Phase 9 must extend with any missing auto-mode stage keys.

### Phase 8 Decisions to Preserve/Extend
- `.planning/phases/08-execute-verify-backend-routing/08-CONTEXT.md` — Locked
  decisions D-01 through D-12; Phase 9 extends (does not replace) these.

### Research Inputs
- `.planning/research/STACK.md` — v1.1 stack-level implementation deltas including
  EXEC-02 gap analysis and the `toolFilter`/`modelOverride` BackendConfig proposal.
- `.planning/research/ARCHITECTURE.md` — v1.1 data-flow diagram and component
  boundary table; the `unitConfig` threading path is defined here.
- `.planning/research/PITFALLS.md` — Known failure modes to guard against in
  auto-mode backend routing.
- `.planning/research/SUMMARY.md` — Sequence rationale and risk focus for v1.1 phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/resources/extensions/gsd/auto/run-unit.ts`: Session creation entry point
  (`cmdCtx.newSession()`). Extend its signature to accept optional `unitConfig`.
- `src/resources/extensions/gsd/auto/session.ts`: `AutoSession` class with `reset()`
  and `toJSON()`. New per-session backend config state must be added here.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`: Existing
  stage-to-tier map. Extend with auto-mode stage keys (discuss, plan) where missing.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts`: Already supports
  `availableToolNames` in `BackendConfig` (from Phase 8 D-09 wiring). Phase 9 exercises
  this from the auto-mode path.

### Established Patterns
- Backend routing is config-first: `defaultBackend` setting → `createAgentSession` →
  `CopilotSessionBackend`. Phase 9 follows this same chain for auto-mode units.
- Auto-mode uses one fresh session per unit (`newSession()`). Every new session is a
  clean slate with explicit config — no ambient state carries over from the prior unit.
- `AutoSession` maintenance rule: all new mutable state goes in the class, not in
  module-level variables. Enforced by `auto-session-encapsulation.test.ts`.
- Existing consecutive-error counter in `autoLoop` handles mid-run backend failures;
  Phase 9 relies on this rather than adding a new abort policy.

### Integration Points
- `runUnitPhase` in `phases.ts` is where `DispatchAction` is available; this is where
  `unitConfig` should be assembled from the dispatch result before calling `runUnit`.
- `cmdCtx.newSession()` in `run-unit.ts` is the seam where `unitConfig.availableToolNames`
  and `unitConfig.stage` must be passed through to the backend.
- `stage-router.ts` is where auto-mode stage keys (discuss, plan) must be added if absent,
  consistent with the execute/verify keys added in Phase 8.

</code_context>

<specifics>
## Specific Ideas

- [auto] Context generation mode: all discovered gray areas were selected for decision
  capture.
- [auto] Recommended defaults accepted for unitConfig shape (string[] tool names),
  stage derivation coverage (both standard and custom engine paths), verification
  evidence scope (per-unit tool profiles + lifecycle + live path), and mid-run error
  handling (cancel unit, surface error, rely on existing consecutive-error counter).
- Keep decisions transport-focused: no product UX expansion beyond auto-mode backend
  config propagation required by Phase 9.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-autonomous-orchestration-migration*
*Context gathered: 2026-03-25*
