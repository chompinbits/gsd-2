# Phase 14: Telemetry Consumer Wiring - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `getDowngrades()` and `getByokActivations()` return values into `formatPremiumSummary`
callers so that the structured telemetry report is reachable in the production path for both
model-downgrade events (FLOW-02) and BYOK fallback events (FLOW-03).

The infrastructure is already complete — accessors exist on `CopilotSessionBackend`, and
`formatPremiumSummary` already accepts optional `downgrades` and `byokActive` parameters.
The gap is that no production call site retrieves these records from the backend and passes
them to the formatter.

</domain>

<decisions>
## Implementation Decisions

### Call Site Location
- **D-01:** The call to `formatPremiumSummary` (with real backend data) goes in `sdk.ts`,
  within the `backend === "copilot"` block, at session teardown time. `copilotBackend` is
  already a closure variable there — no interface changes to `BackendSessionHandle` or
  `CreateAgentSessionResult` are required.
- **D-02:** Concretely: wrap the cleanup callback passed to `withCopilotSessionCleanup` (or
  add an equivalent destroy-time hook) so that before `releaseSharedCopilotClientManager` is
  called, the tracker + downgrade/BYOK data are retrieved and the summary is emitted.

### Output Channel
- **D-03:** Emit the formatted summary via `process.stderr.write` — consistent with the
  established `[gsd:accounting]` pattern from Phases 11 and 12. No new output mechanism is
  needed.

### Emit Conditionality
- **D-04:** Emit whenever the tracker exists and has at least one recorded request. Always
  pass `copilotBackend.getDowngrades()` as the `downgrades` argument, and derive `byokActive`
  from `copilotBackend.getByokActivations().length > 0`. This ensures the telemetry report is
  reachable for any Copilot backend session with activity.

### Test Approach
- **D-05:** Two-layer test coverage:
  1. **Source-shape test** — grep that the new call site exists in `sdk.ts` (produces the
     call with both downgrade and byok args).
  2. **Functional test** — stub `CopilotSessionBackend` with mock downgrade and BYOK records,
     trigger the teardown path, and assert `process.stderr.write` output contains the expected
     "Model downgrades:" and "⚡ BYOK fallback" lines from `formatPremiumSummary`.

### Agent's Discretion
- Exact mechanism for hooking teardown (modify existing callback vs. separate wrapper) — agent
  chooses the cleanest approach that keeps the `copilotBackend` closure visible at call time.
- Whether to import `formatPremiumSummary` at the top of sdk.ts or via a lazy dynamic import
  (consistent with existing lazy import pattern for Copilot code in sdk.ts).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Accessor implementations
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` — `getDowngrades()` (line ~139), `getByokActivations()` (line ~143), `getTracker()` (line ~135), `_downgrades` and `_byokActivations` fields

### Formatter definition
- `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` — `formatPremiumSummary()` signature with optional `downgrades` and `byokActive` params (line ~27)

### Primary call site target
- `packages/pi-coding-agent/src/core/sdk.ts` — `createAgentSession()` function; Copilot backend block (lines ~273–305); `withCopilotSessionCleanup` usage; `copilotBackend` closure variable

### Accounting barrel (imports)
- `packages/pi-coding-agent/src/core/backends/accounting/index.ts` — exports `formatPremiumSummary`, `persistSessionAccounting`, `loadPersistedAccounting`

### Gap documentation (background)
- `.planning/v1.1-MILESTONE-AUDIT.md` — Documents orphaned accessor gaps for FLOW-02 and FLOW-03

### Prior phase context (established patterns)
- `.planning/phases/11-free-tier-model-fallback/11-CONTEXT.md` — D-06 `process.stderr.write` notification pattern; `getDowngrades()` accessor rationale
- `.planning/phases/12-byok-fallback/12-CONTEXT.md` — `getByokActivations()` accessor and `byokActive` telemetry extension

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CopilotSessionBackend.getDowngrades()` — returns `Array<{ originalModel, downgradedTo, percentUsed }>`, ready to pass to `formatPremiumSummary`
- `CopilotSessionBackend.getByokActivations()` — returns `Array<{ type, baseUrl, percentUsed }>`, used to derive `byokActive` boolean
- `CopilotSessionBackend.getTracker()` — returns `RequestTracker | undefined`; needed to call `tracker.getSummary()` if that exists, or check total requests
- `formatPremiumSummary(summary, config, downgrades?, byokActive?)` — complete and tested; only needs a caller

### Established Patterns
- `process.stderr.write("[gsd:accounting] ...")` — used by Phases 11 and 12 for downgrade/BYOK notifications; same channel for the summary report
- Lazy dynamic imports in sdk.ts for Copilot code — `await import("./backends/...")` pattern keeps the Pi path unaffected
- `withCopilotSessionCleanup(handle, cleanupFn)` — existing wrapper in sdk.ts that adds cleanup to session destroy

### Integration Points
- `sdk.ts` `backend === "copilot"` block — `copilotBackend` is a local variable with full access to getters; `accountingConfig` is also in scope
- `RequestTracker.getSummary()` (if it exists) or extract tracker data — check telemetry.ts and request-tracker.ts for the correct method name to produce a `PremiumRequestSummary`

</code_context>

<specifics>
## Specific Ideas

- The Milestone Audit noted two equally valid approaches: (A) expose backend through return type, (B) call at teardown via closure. Decision D-01/D-02 selects approach B as the less invasive option.
- `formatPremiumSummary` already has all required parameters — this is purely a wiring task, not a new feature.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-telemetry-consumer-wiring*
*Context gathered: 2026-03-26*
