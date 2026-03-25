# Phase 1: Adapter Layer + SDK Foundation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a runtime adapter layer that lets GSD create, run, resume, and destroy workflow sessions on either Pi SDK or GitHub Copilot SDK without breaking current command UX. This phase includes tool bridging and event normalization needed for hybrid operation; it does not migrate all workflows or remove the Pi backend.

</domain>

<decisions>
## Implementation Decisions

### Backend Adapter Boundary
- **D-01:** Introduce a single backend seam for session runtime selection (`pi` vs `copilot`) and keep all Copilot SDK usage isolated behind that seam.
- **D-02:** Keep all existing consumers (CLI, headless/RPC, web bridge, MCP-facing surfaces) on existing contracts; route them through the backend seam instead of rewriting each caller.
- **D-03:** Migrate in hybrid mode with Pi backend still available as default safety path until parity evidence is complete.

### Session Lifecycle Parity
- **D-04:** Preserve current per-workflow session lifecycle semantics (create/use/destroy per workflow unit) while adding Copilot session create/resume behavior behind the adapter.
- **D-05:** Preserve GSD session identity and resume UX (session manager and session browser contracts stay authoritative) while adapter handles Copilot session ID translation internally.

### Tool Bridge Strategy
- **D-06:** Reuse existing tool business logic and extension tool registrations; implement a mechanical bridge to SDK-native tool definitions instead of rewriting tool implementations.
- **D-07:** Treat existing tool names and outcomes as compatibility contracts, so planning commands can run unchanged across both backends.

### Event Normalization
- **D-08:** Keep `AgentSessionEvent` semantics as the normalized event contract for internal consumers.
- **D-09:** Translate Copilot SDK streaming/events at adapter boundary into existing event categories used by RPC/headless/web (`tool_execution_*`, `session_state_changed`, etc.).

### Runtime Switching and Safety
- **D-10:** Add explicit backend selection via config/flag and support per-run switching without code changes to command workflows.
- **D-11:** Pin `@github/copilot-sdk` to an exact version and keep SDK-specific code localized to minimize technical-preview breakage risk.

### Auto-Selected Gray Areas (`--auto`)
- **D-12:** [auto] Selected all identified gray areas for this phase: adapter boundary, lifecycle mapping, tool bridge shape, event normalization, backend switching safety.
- **D-13:** [auto] For each area, selected the recommended default (parity-first and lowest migration risk).

### the agent's Discretion
- Exact file/module names under the adapter layer, as long as SDK calls remain isolated.
- Test fixture naming and test matrix structure for backend parity checks.
- Internal batching details for event conversion implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration Scope and Acceptance
- `.planning/ROADMAP.md` — Phase 1 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` — RUNT-01/02/03, TOOL-01, SAFE-01 acceptance constraints.
- `.planning/PROJECT.md` — parity-first migration constraints and core value focus.

### Copilot SDK Usage Rules
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — required SDK lifecycle/session/tool usage patterns and safety defaults.

### Existing Runtime Architecture
- `.planning/codebase/ARCHITECTURE.md` — current execution-mode layering and runtime integration points.
- `.planning/codebase/STRUCTURE.md` — module boundaries and where adapter code should live.
- `.planning/codebase/CONVENTIONS.md` — TypeScript conventions and error/logging patterns to preserve.

### Phase 1 Research Inputs
- `.planning/research/ARCHITECTURE.md` — proposed backend seam and bridge patterns for migration.
- `.planning/research/STACK.md` — SDK API mapping and migration stack assumptions.
- `.planning/research/SUMMARY.md` — migration risk profile and sequencing rationale.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/pi-coding-agent/src/core/sdk.ts` (`createAgentSession`) already centralizes session construction inputs (auth/model/settings/session/resource loader) and is the current runtime creation seam.
- `packages/pi-coding-agent/src/core/agent-session.ts` already defines a rich normalized event contract (`AgentSessionEvent`) and stable subscription API (`subscribe`).
- `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts` already streams session events and commands over JSONL, providing a stable integration channel for headless/web.
- `src/web/bridge-service.ts` already consumes `AgentSessionEvent`-typed bridge events and tracks live-state invalidation reasons tied to session state changes.

### Established Patterns
- Session creation is initiated from `src/cli.ts` through `createAgentSession`, then routed into interactive/print/RPC modes.
- Event consumers in headless and web pathways already rely on stable event categories like `tool_execution_start` and `session_state_changed`.
- Extension tooling is loaded once and bound via session-level APIs, so tool migration should preserve extension interface contracts.

### Integration Points
- `src/cli.ts` is the top-level runtime selection point and should invoke backend factory selection.
- `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts` should continue to emit normalized events regardless of backend.
- `src/web/bridge-service.ts` should remain backend-agnostic by depending only on normalized bridge/session event contracts.
- `src/headless.ts` event tracking logic should remain unchanged if adapter preserves current event shapes.

</code_context>

<specifics>
## Specific Ideas

- Favor a thin adapter layer with Pi and Copilot implementations behind one interface, then migrate mode by mode instead of changing all call sites at once.
- Preserve existing slash-command and headless behavior as a hard constraint in planning.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-adapter-layer-sdk-foundation*
*Context gathered: 2026-03-24*
