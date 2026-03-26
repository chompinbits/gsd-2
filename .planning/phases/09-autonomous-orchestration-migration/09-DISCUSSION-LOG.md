# Phase 9: Autonomous Orchestration Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 09-autonomous-orchestration-migration
**Mode:** auto (--auto flag; all gray areas selected automatically, recommended defaults chosen)
**Areas discussed:** unitConfig shape, stage derivation coverage, tool profile per unit, mid-run backend error handling, verification evidence scope

---

## unitConfig Shape

| Option | Description | Selected |
|--------|-------------|----------|
| `availableToolNames: string[]` (explicit list) | Matches `BackendConfig.availableToolNames` shape from ARCHITECTURE.md. Backend does the filtering. Aligns with Phase 8 D-09 tool-filtering contract. | ✓ |
| `toolProfile: 'execute' \| 'verify' \| 'full'` (semantic profile) | Higher-level enum resolved at backend layer. Cleaner call sites but adds a resolution step not present in existing BackendConfig. | |

**[auto] choice:** `availableToolNames: string[]` (recommended default — aligns with existing BackendConfig contract and Phase 8 decisions)
**Notes:** `unitConfig` also carries `stage: string` and optional `modelHint?: string`. Passed from `runUnitPhase` in phases.ts to `runUnit` to `cmdCtx.newSession()`.

---

## Stage Derivation Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Cover both standard and custom engine dispatch paths | Both paths populate `DispatchAction` with a `stage` field using the same unit-type-to-stage map. No special-casing. Satisfies SC-02 fully. | ✓ |
| Cover standard dispatch only; custom engine uses default `standard` | Simpler for Phase 9 but leaves SC-02 partially unmet for custom engine users. Could defer custom engine integration. | |

**[auto] choice:** Cover both paths (recommended — SC-02 requires stage-aware config through the full runUnit chain for all dispatch paths)
**Notes:** Stage map: discuss → free, plan → standard, execute-task/execute-phase → standard, verify-work/verify-phase → free.

---

## Tool Profile Per Unit

| Option | Description | Selected |
|--------|-------------|----------|
| Execute=full coding tools, Verify=read-only (same as Phase 8 D-07/D-08) | Consistent with existing Phase 8 decisions. Applied at every `newSession()` to survive runtime rebuild. | ✓ |
| Execute and Verify use same full tool set in auto mode | Simpler wiring but violates Phase 8 D-08 read-only verify contract. Not acceptable. | |

**[auto] choice:** Execute=full, Verify=read-only, applied per-unit at newSession() boundary (mandatory — extends Phase 8 D-07/D-08/D-09)
**Notes:** Tool filter applied at `_buildRuntime` → `BackendConfig` boundary on every `newSession()` call.

---

## Mid-Run Backend Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel unit, surface visible error; rely on existing consecutive-error counter | Consistent with Phase 8 D-03. Auto-loop's existing error recovery handles retry/abort. No new abort policy needed. | ✓ |
| Abort the entire auto-mode run immediately on backend init failure | Safer but more disruptive — one bad unit could stop a long multi-phase run. Existing counter already handles this escalation. | |
| Silent fallback to Pi backend for failed units | Violates Phase 8 D-03 (no silent fallback). Not acceptable. | |

**[auto] choice:** Cancel unit + surface error + rely on consecutive-error counter (recommended — consistent with Phase 8 D-03, no new abort policy)
**Notes:** The autoLoop consecutive-error counter escalates to stop if failures repeat, without Phase 9 needing to add new logic.

---

## Verification Evidence Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-unit tool profile tests + lifecycle test + live-path validation | Covers SC-03 (tool restriction per unit), SC-04 (session lifecycle), and SC-01/SC-02 (end-to-end on Copilot backend). Most thorough. | ✓ |
| Single end-to-end autonomous run test only | Broader coverage of the happy path but does not provide granular evidence for tool profile enforcement or lifecycle isolation. | |
| Unit tests only (no live path) | Faster CI but does not satisfy SC-01 requirement for end-to-end Copilot backend evidence. | |

**[auto] choice:** Per-unit tool profile tests + multi-unit lifecycle test + live-path validation (recommended — covers all four success criteria)
**Notes:** Tests: (a) execute unit gets write tools, verify unit does not; (b) stage propagates DispatchAction → newSession → backend; (c) simulated two-unit lifecycle; (d) live discuss+plan pair on Copilot backend with telemetry.

---

## the agent's Discretion

- Exact naming of `unitConfig` interface (`UnitSessionConfig` vs extending `BackendConfig`)
- Exact test file partitioning (unit vs integration vs live)
- Whether `DispatchAction` is extended in-place or via wrapper type

## Deferred Ideas

None — discussion stayed within phase scope.
