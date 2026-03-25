# Phase 3: Planning Workflow Migration - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the planning workflow commands (`/gsd-discuss-phase` and `/gsd-plan-phase`) to run through the Copilot SDK backend while keeping user-visible behavior equivalent to the current path. This includes streaming behavior parity across TUI, headless/RPC, and web bridge surfaces, and equivalent plan-check outcomes on the migrated path. It does not migrate execute/verify workflows or change the default backend.

</domain>

<decisions>
## Implementation Decisions

### Planning Command Parity
- **D-01:** Keep the discuss and plan workflow definitions and prompts as-is; migrate runtime transport only (Pi backend path to Copilot backend path) so question flow and artifacts remain equivalent.
- **D-02:** Preserve existing command semantics for flags and modes already used by planning workflows (`--auto`, `--batch`, `--text`, `--analyze`) and avoid behavior-only refactors in this phase.

### Streaming and Event Equivalence
- **D-03:** Treat normalized `AgentEvent` output as the parity contract; Copilot SDK events must continue to map into existing event categories consumed by RPC/headless/web paths.
- **D-04:** Validate streaming parity against all planning surfaces (interactive TUI, RPC/headless, and web bridge) using the same observable event/state transitions rather than provider-specific internals.

### Plan-Check Validation Path
- **D-05:** Keep plan-check validation logic and scoring contracts unchanged; Phase 3 migration should only change runtime backend path used to produce planning artifacts.
- **D-06:** Add parity-focused checks that compare pass/fail outcomes and core artifact validity between Pi and Copilot planning paths.

### Session Continuity and Recovery
- **D-07:** Continue using session-manager IDs as the source of truth for planning sessions, and route Copilot create/resume through the existing `createAgentSession` entrypoint.
- **D-08:** Preserve interruption and resume behavior by preferring Copilot `resumeSession(sessionId, ...)` when planning state already exists for the current workflow unit.

### Rollout Safety
- **D-09:** Keep backend migration for planning workflows behind explicit backend/config selection during Phase 3; do not switch default backend in this phase.
- **D-10:** Keep telemetry/debug visibility for migrated planning runs so parity regressions are diagnosable without changing user command UX.

### Auto-Selected Gray Areas (`--auto`)
- **D-11:** [auto] Selected all identified gray areas for this phase: planning command parity, streaming/event parity, plan-check equivalence, session continuity, and rollout safety.
- **D-12:** [auto] For each area, selected the recommended default (parity-first, lowest-risk migration path).

### the agent's Discretion
- Exact test fixture shape and naming for parity checks, as long as behavior equivalence remains verifiable.
- Internal implementation details for event batching/forwarding as long as externally observed streaming behavior remains unchanged.
- Exact location of migration guardrails/feature-flag checks, as long as planning workflow routing is deterministic and debuggable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Acceptance
- `.planning/ROADMAP.md` — Phase 3 goal, dependencies, and success criteria for discuss/plan migration.
- `.planning/REQUIREMENTS.md` — PLAN-01, PLAN-02, TOOL-02 requirements that define planning-path parity.
- `.planning/PROJECT.md` — parity-first migration constraints and hybrid rollout safety expectations.

### Prior Locked Decisions
- `.planning/phases/01-adapter-layer-sdk-foundation/01-CONTEXT.md` — adapter boundary, event normalization, and hybrid backend strategy to preserve.
- `.planning/phases/02-request-accounting-model-routing/02-CONTEXT.md` — stage routing/accounting assumptions already locked for planning commands.
- `.planning/STATE.md` — current project position and recently locked migration decisions affecting Phase 3.

### Runtime Contracts and SDK Rules
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — Copilot SDK session lifecycle, streaming, and tool integration guardrails.
- `.planning/codebase/ARCHITECTURE.md` — cross-surface flow contracts (interactive, RPC/headless, web bridge).
- `.planning/codebase/CONVENTIONS.md` — TypeScript/code-style conventions for parity-safe changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/pi-coding-agent/src/core/sdk.ts`: `createAgentSession()` already supports backend selection (`pi`/`copilot`), shared Copilot client lifecycle, and session-id-aware create/resume.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts`: Copilot session backend, tool bridge wiring, accounting wrapper, and backend session handle contract are already in place.
- `packages/pi-coding-agent/src/core/backends/event-translator.ts`: existing translation seam from Copilot session events to normalized `AgentEvent` messages/tool events.
- `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts`: established RPC event/response contract consumed by headless and web bridge flows.

### Established Patterns
- Planning command invocations flow through the same core session creation path used by interactive and print/rpc modes.
- Headless and web bridge paths rely on normalized event shapes and session state events rather than provider-specific payloads.
- Migration work in prior phases favored additive backend support and parity testing over UX-level command rewrites.

### Integration Points
- `src/cli.ts`: session creation sites for interactive/print mode where backend routing must remain consistent for planning commands.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` + `packages/pi-coding-agent/src/core/backends/event-translator.ts`: streaming/event behavior parity enforcement seam.
- `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts` and `src/headless.ts`: parity-critical consumers for non-TUI planning flows.
- `src/web/bridge-service.ts`: parity-critical web bridge consumer of planning-session event/state streams.

</code_context>

<specifics>
## Specific Ideas

- Keep Pi backend planning path as the control baseline while validating Copilot planning parity in the same command surfaces.
- Prefer contract/parity tests around observable outputs (question flow, PLAN artifact validity, plan-check verdicts, stream visibility) instead of implementation-coupled assertions.
- Preserve stage-tier semantics already established in Phase 2 (`discuss-phase` free tier, `plan-phase` standard tier, `plan-check` low tier) during migration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-planning-workflow-migration*
*Context gathered: 2026-03-24*
