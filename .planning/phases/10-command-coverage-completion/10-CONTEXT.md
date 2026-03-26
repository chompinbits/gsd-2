# Phase 10: Command Coverage Completion - Context

**Gathered:** 2026-03-25 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `defaultBackend` settings-driven routing to cover roadmap commands
(new-project, new-milestone, add-phase, remove-phase) and requirements commands
(plan-phase requirements parsing, progress status), so they follow the same
`options.backend` → `settings.defaultBackend` → `"pi"` selection chain as
discuss/plan/execute/verify. No new command UX, no new capabilities — this phase
delivers backend routing parity for the remaining management commands required
by FLOW-01. Does not include free-tier fallback (Phase 11) or BYOK fallback
(Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Command Scope and Routing Chain
- **D-01:** The management commands in scope are: roadmap commands (new-project,
  new-milestone, add-phase, remove-phase) and requirements commands (plan-phase
  requirements parsing, progress status). These map to the "roadmap" and
  "requirements" stage categories respectively.
- **D-02:** All management commands must use the same backend selection chain as
  discuss/plan/execute/verify: `options.backend` → `settings.defaultBackend` →
  `"pi"`. Implemented via `resolvePlanningBackendFromSettings()` at CLI dispatch,
  threaded to `createAgentSession`. No per-command backend override — SC-3 requires
  defaultBackend to be the single switch.
- **D-03:** Primary path: standalone CLI dispatch blocks in `src/cli.ts` for
  headless/programmatic invocations (matching discuss/plan/execute/verify pattern),
  each calling `resolvePlanningBackendFromSettings()` and dispatching to a
  workflow wrapper. The interactive guided-flow path (`dispatchWorkflow()` in
  `guided-flow.ts`) should also receive backend config threading so the full
  coverage requirement is met. Priority is CLI dispatch blocks first.

### Stage and Accounting Semantics
- **D-04:** Stage keys `"roadmap"` and `"requirements"` must be added to
  `stage-router.ts` at `"low"` tier (0.33×) per STACK.md specification.
  Stage aliases: new-project / new-milestone / add-phase / remove-phase → `"roadmap"`;
  plan-phase requirements parsing / progress-status → `"requirements"`. All
  stage name variants used at dispatch must be present in the router (Pitfall 4 guard).
- **D-05:** Telemetry: emit `[<command>] backend=<backend> stage=<stage>` to
  stderr at command start, matching the D-10 pattern from Phase 8. Billing stage
  name must match the canonical router key.

### Tool Access Profiles
- **D-06:** Roadmap sessions (new-project, new-milestone, add-phase, remove-phase)
  use a read/write profile — allow: read, write; block: bash, edit. These commands
  write planning files but do not need code execution capabilities.
- **D-07:** Requirements sessions (requirements parsing, progress status) use the
  same profile as roadmap: read, write — no bash, edit.
- **D-08:** Pitfall 6 guard: tool allow-list filtering must not drop
  extension-registered tools (custom skills, MCP extensions). Either pass through
  extension tools via wildcard or implement a two-mode filter: restrict built-ins
  by name, pass through all extension-registered tools. Consistent with Phase 8
  D-09's rebuild-boundary filtering rule.

### Error Handling
- **D-09:** When Copilot backend is selected and fails to initialize for any
  management command, surface a visible actionable error. No silent fallback to Pi.
  Consistent with Phase 8 D-03 and Phase 9 D-10.

### Verification Evidence
- **D-10:** Add automated tests covering: (a) management command routing — when
  `defaultBackend: "copilot"`, roadmap and requirements commands resolve to
  Copilot backend; (b) stage-tier attribution — roadmap/requirements commands bill
  at "low" tier (0.33×); (c) tool profile enforcement — management sessions do
  not expose bash or edit tools.
- **D-11:** Live-path validation: at least one roadmap command (e.g., add-phase)
  completes on Copilot backend and emits expected telemetry with correct stage name.
- **D-12:** Stage name normalization coverage: automated test confirming all
  management stage name variants ("roadmap", "requirements", and any aliases used
  by dispatch) are present in `stage-router.ts` (Pitfall 4 guard).

### the agent's Discretion
- Whether management command wrappers are grouped into one `management-commands.ts`
  file or split per command, as long as D-02 routing chain is explicit and testable.
- Exact CLI dispatch block structure (individual or grouped), as long as each
  command has its own `resolvePlanningBackendFromSettings()` call and stage telemetry.
- Test file partitioning (unit vs integration vs live), as long as D-10 through
  D-12 are covered.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` — Phase 10 goal and success criteria for FLOW-01.
- `.planning/REQUIREMENTS.md` — Requirement mapping for FLOW-01.
- `.planning/PROJECT.md` — Migration constraints and parity-first principles.
- `.planning/STATE.md` — Current milestone state and ordering assumptions.

### Existing Backend Routing Pattern to Replicate
- `src/cli.ts` — Existing CLI dispatch blocks for discuss-phase, plan-phase,
  execute-phase, verify-work (lines ~277–355). Phase 10 adds parallel blocks for
  management commands using the same `resolvePlanningBackendFromSettings()` pattern.
- `src/workflows/discuss-phase.ts` — Reference backend-agnostic wrapper with
  `createAgentSession` routing, stage telemetry, and accounting pattern.
- `src/workflows/plan-phase.ts` — Reference backend-agnostic wrapper with
  stage-aware telemetry logging.

### Stage-Routing and Accounting
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts` —
  Stage-to-tier map. Add `"roadmap": "low"` and `"requirements": "low"` entries.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — Copilot
  session creation with tool filtering at `createSession`.
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` — `BackendConfig`
  contract including `availableToolNames`.
- `packages/pi-coding-agent/src/core/sdk.ts` — `createAgentSession` routing chain.

### Interactive Dispatch Path
- `src/resources/extensions/gsd/guided-flow.ts` — `dispatchWorkflow()` function
  (lines ~217–256). Thread `defaultBackend` backend config here for interactive
  new-milestone and related flows.

### Phase 8 and 9 Decisions to Preserve
- `.planning/phases/08-execute-verify-backend-routing/08-CONTEXT.md` — Locked
  decisions D-01 through D-12; Phase 10 extends (does not replace) these.
- `.planning/phases/09-autonomous-orchestration-migration/09-CONTEXT.md` — Locked
  decisions D-01 through D-12; Phase 10 is a sibling (parallel path, not dependent).

### Research Inputs
- `.planning/research/STACK.md` — Stage tier table and tool restriction profiles
  for roadmap/requirements commands (FLOW-01 section).
- `.planning/research/PITFALLS.md` — Pitfall 4 (stage name mismatch) and
  Pitfall 6 (allow-list breaks extension tools) — both apply to Phase 10.
- `.planning/research/SUMMARY.md` — Sequence rationale and risk focus for v1.1 phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.ts` `resolvePlanningBackendFromSettings()`: Already implemented
  backend resolver used by all four migrated workflow dispatch blocks. Phase 10
  reuses this for management command dispatch.
- `src/workflows/discuss-phase.ts` and `src/workflows/plan-phase.ts`: Reference
  patterns for thin backend-agnostic workflow wrappers with `createAgentSession`,
  stage telemetry, and JSON output. Phase 10 creates equivalent wrappers for
  management commands.
- `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`:
  Existing stage-to-tier map. Extend with "roadmap" and "requirements" keys at
  "low" tier without modifying existing mappings.

### Established Patterns
- Backend routing is config-first: `defaultBackend` setting →
  `resolvePlanningBackendFromSettings()` → `createAgentSession(options)`. All
  migrated commands follow this exact chain.
- Stage telemetry is emitted to stderr at start and completion:
  `[<command>] backend=<backend> stage=<stage>` / `[<command>] complete: ...`.
- Tool filtering is applied at `createAgentSession` via `BackendConfig.availableToolNames`.

### Integration Points
- `src/cli.ts` dispatch area (~line 280+): Add new management command dispatch
  blocks adjacent to the existing discuss/plan/execute/verify blocks.
- `stage-router.ts`: One-line additions for "roadmap" and "requirements" tier
  mappings.
- `src/resources/extensions/gsd/guided-flow.ts` `dispatchWorkflow()`: Thread
  backend config parameter for interactive management commands.

</code_context>

<specifics>
## Specific Ideas

- [auto] Context generation mode: all gray areas selected for decision capture.
- [auto] Recommended defaults accepted for command scope (roadmap + requirements
  stage categories), routing chain (resolvePlanningBackendFromSettings + createAgentSession,
  matching Phase 8 pattern), stage tiers (low 0.33× for both categories per STACK.md),
  tool profiles (read/write, no bash/edit per STACK.md), and verification evidence
  scope (routing + stage-tier + tool profile tests, matching Phase 8 D-10/D-11/D-12).
- Keep decisions transport-focused: no product UX expansion beyond management
  command backend routing required by Phase 10.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-command-coverage-completion*
*Context gathered: 2026-03-25*
