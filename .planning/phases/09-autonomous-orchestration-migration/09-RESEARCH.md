# Phase 9: Autonomous Orchestration Migration — Research

**Domain:** Auto-mode backend routing with per-unit stage-aware config threading
**Researched:** 2026-03-25
**Confidence:** HIGH — all changes extend shipped v1.0/Phase 8 infrastructure
**Requirement:** EXEC-02

---

## Phase Goal

Users can run full autonomous orchestration end-to-end with Copilot SDK as default backend, with correct per-unit tool filtering, stage-aware accounting, and session lifecycle across multi-phase runs.

## Success Criteria Reference (from ROADMAP)

1. All auto-mode units (discuss → plan → execute per phase) use Copilot backend
2. Auto-mode dispatch passes stage-aware config through `runUnit` → session creation chain
3. Per-unit tool restriction works correctly when auto-mode creates fresh sessions via `newSession()`
4. Session lifecycle (create, resume, destroy) functions correctly across multi-phase autonomous runs

---

## Current Architecture

### Auto-Mode Loop Flow

```
auto/loop.ts — autoLoop()
  │
  ├── runPreDispatch()  → derive GSD state, milestone transitions
  ├── runGuards()       → budget ceiling, context window, secrets
  ├── runDispatch()     → match DispatchRule → DispatchAction
  │        DispatchAction = { action, unitType, unitId, prompt }  ← NO stage/tool metadata
  ├── runUnitPhase()    → runUnit(ctx, pi, s, unitType, unitId, prompt)
  │        │
  │        └── s.cmdCtx.newSession()  ← NO backend config passed
  │            → AgentSession.newSession()
  │            → _buildRuntime({ activeToolNames: current, includeAllExtensionTools: true })
  │            → pi.sendMessage(prompt)
  │            → await agent_end
  └── runFinalize()     → post-unit verification, state persistence
```

### Key Observations

1. **`DispatchAction` lacks stage metadata.** Dispatch rules produce `unitType` + `prompt` but no `stage` or tool-profile hint. Stage derivation must be added at the dispatch boundary.

2. **`runUnit()` passes no config to `newSession()`.** Current signature: `runUnit(ctx, pi, s, unitType, unitId, prompt)`. The `newSession()` call has no options — it uses whatever active tools the session already has.

3. **`AgentSession.newSession()` rebuilds tools only on cwd change.** Code at `agent-session.ts:1538-1542`:
   ```typescript
   if (this._cwd !== previousCwd) {
     this._buildRuntime({
       activeToolNames: this.getActiveToolNames(),
       includeAllExtensionTools: true,
     });
   }
   ```
   In auto-mode with worktrees, cwd DOES change → tools DO rebuild. But the rebuild uses `getActiveToolNames()` (prior session's tools) + all extensions. No per-unit filtering happens.

4. **`BackendConfig` already has `stage` field.** `CopilotSessionBackend.createSession()` passes `config.stage` to accounting. But auto-mode's per-unit sessions don't set stage because the config isn't threaded through.

5. **Copilot session handle is created once in `createAgentSession()`.** The SDK session persists across `newSession()` calls — `newSession()` resets message history and tools but doesn't create a new Copilot SDK session. This is correct behavior for auto-mode.

6. **Stage-router already has auto-mode stage keys.** Phase 8 added `execute-phase: standard`, `verify-phase: free`, `run-uat: free`. Missing: `discuss-milestone`, `research-milestone`, `plan-milestone`, `research-slice`, `plan-slice`, etc. These should map to their base-form equivalents.

---

## What Needs to Change

### Change 1: Add `unitConfig` to `DispatchAction` and `runUnit()`

**Files:** `src/resources/extensions/gsd/auto-dispatch.ts`, `src/resources/extensions/gsd/auto/run-unit.ts`, `src/resources/extensions/gsd/auto/types.ts`

**DispatchAction** needs a `stage` field (string):
```typescript
export type DispatchAction =
  | { action: "dispatch"; unitType: string; unitId: string; prompt: string;
      stage?: string; /* NEW — stage hint for accounting/routing */
      pauseAfterDispatch?: boolean; matchedRule?: string; }
  | ...;
```

**runUnit()** needs a `unitConfig` parameter:
```typescript
export async function runUnit(
  ctx, pi, s, unitType, unitId, prompt,
  unitConfig?: UnitSessionConfig,  // NEW
): Promise<UnitResult>
```

Where `UnitSessionConfig`:
```typescript
export interface UnitSessionConfig {
  stage?: string;
  availableToolNames?: string[];
  modelHint?: string;
}
```

### Change 2: Thread `unitConfig` through `newSession()`

**Files:** `packages/pi-coding-agent/src/core/extensions/types.ts`, `packages/pi-coding-agent/src/core/agent-session.ts`

Extend `newSession()` options:
```typescript
newSession(options?: {
  parentSession?: string;
  setup?: (sessionManager: SessionManager) => Promise<void>;
  activeToolNames?: string[];  // NEW — per-unit tool restriction
}): Promise<{ cancelled: boolean }>;
```

In `AgentSession.newSession()`, after rebuild, apply tool filter:
```typescript
// After _buildRuntime or when no rebuild needed:
if (options?.activeToolNames) {
  this.setActiveToolsByName(options.activeToolNames);
}
```

**Critical per Pitfall 1:** Tool filter MUST be applied AFTER `_buildRuntime()` completes, not before. Otherwise the rebuild overwrites the filter.

### Change 3: Stage derivation map

**File:** `src/resources/extensions/gsd/auto-dispatch.ts` or new helper

Map unit types to stages:
```typescript
const UNIT_TYPE_TO_STAGE: Record<string, string> = {
  "discuss-milestone": "discuss-phase",
  "research-milestone": "research-phase",
  "research-slice": "research-phase",
  "plan-milestone": "plan-phase",
  "plan-slice": "plan-phase",
  "execute-task": "execute-task",
  "complete-slice": "execute-task",
  "run-uat": "run-uat",
  "verify-phase": "verify-phase",
  "rewrite-docs": "execute-task",
  "reassess-roadmap": "plan-phase",
};
```

All these stages already exist in `STAGE_TIER_MAP` (or fall back to "standard").

### Change 4: Tool profile per unit type

**File:** `src/resources/extensions/gsd/auto-dispatch.ts` or `auto/run-unit.ts`

Map unit types to tool profiles:
```typescript
const UNIT_TYPE_TOOL_PROFILE: Record<string, "coding" | "readonly"> = {
  "discuss-milestone": "readonly",
  "research-milestone": "readonly",
  "research-slice": "readonly",
  "plan-milestone": "readonly",
  "plan-slice": "readonly",
  "execute-task": "coding",
  "complete-slice": "coding",
  "run-uat": "readonly",
  "verify-phase": "readonly",
  "rewrite-docs": "coding",
  "reassess-roadmap": "readonly",
};
```

Resolve to actual tool names:
- `"coding"` → `["read", "bash", "edit", "write", "lsp"]` (from `codingTools`)
- `"readonly"` → `["read", "bash", "lsp"]` (from `readOnlyTools`, per Phase 8 D-08)

**Per Pitfall 6:** Extension-registered tools (MCP, custom skills) should pass through — only restrict built-in tool names. The filter should be additive: allow listed built-in tools + all extension tools.

### Change 5: `AutoSession` default backend config

**File:** `src/resources/extensions/gsd/auto/session.ts`

Add `defaultBackend` to `AutoSession` so per-unit overrides layer on top:
```typescript
// In AutoSession class
defaultBackend: "pi" | "copilot" = "pi";
```

Set from settings at auto-mode start. Per-unit sessions inherit this default. (D-08 from CONTEXT.md)

### Change 6: Stage keys in stage-router

**File:** `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`

Auto-mode generates stage names from unit types. Most map cleanly to existing keys. Add missing aliases if any auto-mode stage name doesn't already have a mapping. Currently, auto-mode unit types that would flow as stage names:
- `discuss-milestone` → not in map (should be `free`, like `discuss-phase`)
- `research-milestone` → not in map (should be `standard`, like `research-phase`)
- `plan-milestone` → not in map (should be `standard`, like `plan-phase`)
- `execute-task` → already mapped to `standard` ✓
- `complete-slice` → not in map (should be `standard`)
- `run-uat` → already mapped to `free` ✓

**Decision:** Use the stage derivation map (Change 3) to normalize unit types to existing stage names. This avoids bloating `STAGE_TIER_MAP` with aliases that map identically. The map in Change 3 converts `discuss-milestone` → `discuss-phase` (already in router as `free`).

---

## Session Lifecycle Across Multi-Phase Runs

Per D-08 and D-09 from CONTEXT.md:
- Each unit creates a fresh session via `newSession()` with its own config
- Backend session handles are ephemeral per-unit
- Session state (phase progress, artifacts) persists to disk via existing state primitives
- `AutoSession` carries `defaultBackend` so per-unit overrides don't re-read settings

**No lifecycle changes needed.** The existing `autoLoop` → `runUnit` → `newSession()` cycle already:
1. Creates fresh session per unit
2. Destroys previous session state (messages, pending ops)
3. Rebuilds tools when cwd changes
4. Handles session creation failure with timeout and cancel

Phase 9 layers config threading ON TOP of this existing lifecycle. It doesn't change the lifecycle itself.

---

## Error Handling

Per D-10 from CONTEXT.md:
- When Copilot backend fails to initialize for a unit, cancel that unit and surface actionable error
- Existing consecutive-error counter in `autoLoop` governs retry/abort behavior
- No silent fallback to Pi for individual units mid-run

**No new error handling needed.** Current `runUnit()` already returns `{ status: 'cancelled' }` on session creation failure. The `autoLoop` catch block handles consecutive errors. Phase 9's config threading doesn't introduce new failure modes — it's additional data on existing paths.

---

## Testing Strategy

### Unit Tests (D-11 from CONTEXT.md)

1. **Per-unit tool profile enforcement:** Execute unit gets write tools, verify unit does not
   - Mock `newSession()`, assert `activeToolNames` parameter differs by unit type
   - Verify `coding` profile includes write/edit, `readonly` doesn't

2. **Stage attribution propagation:** Stage from `DispatchAction` flows to `newSession()` config
   - Mock dispatch → runUnit chain, assert stage value at `BackendConfig` boundary
   - Verify stage-router maps the propagated stage name correctly

3. **Session lifecycle across multi-unit run:** Create → unit 1 → destroy → create → unit 2
   - Simulate two-unit sequence, verify both get fresh sessions with correct config
   - Verify no config leaks between units

### Integration/Source-Shape Tests

4. **Tool profile map completeness:** All dispatch rule unit types have a tool profile
   - Extract all `unitType` values from `DISPATCH_RULES`, verify all appear in tool profile map

5. **Stage derivation map completeness:** All unit types map to valid stage-router keys
   - Cross-reference with `STAGE_TIER_MAP`

### Live-Path Validation (D-12 from CONTEXT.md)

6. **Autonomous run on Copilot backend:** Complete at least one discuss + plan unit pair
   - End-to-end integration test with real backend (or mock at SDK boundary)
   - Verify telemetry emits correct stage/tier for each unit

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Pitfall 1:** Extension rebuild overrides tool filter | HIGH if filter applied before rebuild | HIGH — verify units get full tool set | Apply filter AFTER `_buildRuntime()` in `newSession()` |
| **Pitfall 6:** Extension tools dropped by filter | MEDIUM | MEDIUM — skills/MCP unavailable | Filter only built-in tools; pass through all extension tools |
| **Stage name mismatch** | LOW — using derivation map | LOW — defaults to "standard" | Map normalizes unit types to existing stage keys |
| **Auto-mode regression** | LOW — additive changes only | HIGH — breaks existing auto runs | Source-shape tests verify existing dispatch rules unchanged |

---

## Implementation Order

1. **Types first:** `UnitSessionConfig` type, `DispatchAction.stage` field
2. **Backend plumbing:** Extend `newSession()` options with `activeToolNames`
3. **Stage + tool maps:** Unit-type-to-stage and unit-type-to-tool-profile maps
4. **Wire dispatch → runUnit:** Thread config from `DispatchAction` through `runUnitPhase` → `runUnit`
5. **AutoSession.defaultBackend:** Read from settings at auto-mode start
6. **Tests:** Source-shape + unit + live-path

## Validation Architecture

Phase 9 verification should confirm:
1. All 4 ROADMAP success criteria pass
2. Per-unit tool restriction observable in session debug logs
3. Stage attribution visible in accounting telemetry
4. No regression in existing auto-mode functionality

---

*Researched: 2026-03-25*
*Phase: 09-autonomous-orchestration-migration*
*Requirement: EXEC-02*
