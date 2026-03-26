# Phase 10: Command Coverage Completion — Research

**Domain:** Management command backend routing through Copilot SDK
**Researched:** 2026-03-25
**Confidence:** HIGH — all changes replicate established Phase 8 patterns
**Requirement:** FLOW-01

---

## Phase Goal

Users can run roadmap and requirements management commands fully through Copilot SDK backend, with the same `defaultBackend` settings-driven routing chain used by discuss/plan/execute/verify.

## Success Criteria Reference (from ROADMAP)

1. User can run roadmap commands (new-project, new-milestone, add-phase, remove-phase) on Copilot backend
2. User can run requirements commands (plan-phase requirements parsing, progress status) on Copilot backend
3. All management commands respect `defaultBackend` config setting without per-command overrides

---

## Current Architecture

### CLI Dispatch Pattern (Phase 8 established)

```
src/cli.ts lines ~280-355:

if (cliFlags.messages[0] === '<command>') {
  const { runXxxWorkflow } = await import('./workflows/<command>.js')
  const backend = resolvePlanningBackendFromSettings()
  process.stderr.write(`[<command>] backend=${backend} tier=<tier>\n`)
  const result = await runXxxWorkflow(config, { backend })
  process.stderr.write(`[<command>] complete: ..., backend=${backend}\n`)
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  process.exit(0)
}
```

Currently 4 dispatch blocks exist: `discuss-phase`, `plan-phase`, `execute-phase`, `verify-work`.

### Workflow Wrapper Pattern (Phase 8 established)

Each workflow wrapper (`src/workflows/*.ts`) follows:

1. **Types**: Config, Options, Output interfaces
2. **Accounting constant**: Local tier reference (e.g., `const ACCOUNTING_TIER = 'low' as const`)
3. **Prompt template**: Stable string template for the workflow
4. **Entry function**: `runXxxWorkflow(config, options)` that:
   - Creates ephemeral `SessionManager.inMemory()`
   - Instantiates `AuthStorage`, `ModelRegistry`, `SettingsManager`, `DefaultResourceLoader`
   - Calls `createAgentSession({ ..., backend, stage })` — the only backend-specific branch
   - Binds extensions, builds prompt, sends message, collects events
   - Returns structured output

### Stage Router (stage-router.ts)

```typescript
export const STAGE_TIER_MAP: Record<string, MultiplierTier> = {
  // Free (0×)
  "discuss-phase": "free",
  "verify-work": "free",
  // Low (0.33×)
  "plan-check": "low",
  "validate-phase": "low",
  // Standard (1×)
  "plan-phase": "standard",
  "research-phase": "standard",
  "execute-task": "standard",
  // v1.1 aliases
  "execute-phase": "standard",
  "verify-phase": "free",
  "run-uat": "free",
};
```

**Missing entries for Phase 10:** `"roadmap"` and `"requirements"` at `"low"` tier (0.33×).

### Management Commands — Current State

Management commands currently flow through the guided-flow interactive path (`dispatchWorkflow()` in `src/resources/extensions/gsd/guided-flow.ts`). They have **no headless CLI dispatch blocks** in `src/cli.ts` and **no backend-agnostic workflow wrappers** in `src/workflows/`.

The guided-flow path uses `pi.sendMessage()` to dispatch prompts through the Pi SDK extension API — this path currently has no `defaultBackend` config threading.

### Relevant Commands

| Command Category | Commands | Stage Key | Tier |
|---|---|---|---|
| Roadmap | new-project, new-milestone, add-phase, remove-phase | `"roadmap"` | low (0.33×) |
| Requirements | requirements parsing, progress status | `"requirements"` | low (0.33×) |

---

## What Needs to Change

### Change 1: Stage Router Entries

**File:** `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`

Add two entries to `STAGE_TIER_MAP`:
```typescript
// Low (0.33×) — management commands: roadmap and requirements
"roadmap": "low",
"requirements": "low",
```

Single-line additions to existing map. No existing entries modified.

### Change 2: Management Command Workflow Wrappers

**Files:** `src/workflows/roadmap.ts`, `src/workflows/requirements.ts`

Two new workflow wrappers following the exact same pattern as `discuss-phase.ts`/`plan-phase.ts`:

**`roadmap.ts`:**
- Types: `RoadmapConfig { command: string; args: string; cwd?: string; projectContext?: string }`, `RoadmapOptions { backend?: 'pi' | 'copilot' }`, `RoadmapOutput { command: string; result: string; timestamp: number }`
- Stage: `"roadmap"` → `"low"` tier (0.33×)
- Tool profile: read/write only (no bash, no edit) per D-06
- Entry: `runRoadmapWorkflow(config, options)` following standard session creation pattern

**`requirements.ts`:**
- Types: `RequirementsConfig { command: string; args: string; cwd?: string; projectContext?: string }`, `RequirementsOptions { backend?: 'pi' | 'copilot' }`, `RequirementsOutput { command: string; result: string; timestamp: number }`
- Stage: `"requirements"` → `"low"` tier (0.33×)
- Tool profile: read/write only (no bash, no edit) per D-07
- Entry: `runRequirementsWorkflow(config, options)` following standard session creation pattern

### Change 3: CLI Dispatch Blocks

**File:** `src/cli.ts`

Add management command dispatch blocks immediately after the `verify-work` block (before `ensureManagedTools`). Pattern matches existing dispatch blocks exactly:

```typescript
// `gsd new-project [description]` — roadmap management via /settings backend
if (cliFlags.messages[0] === 'new-project') {
  const { runRoadmapWorkflow } = await import('./workflows/roadmap.js')
  const backend = resolvePlanningBackendFromSettings()
  process.stderr.write(`[new-project] backend=${backend} stage=roadmap\n`)
  const description = cliFlags.messages.slice(1).join(' ') || 'new project'
  const result = await runRoadmapWorkflow(
    { command: 'new-project', args: description, cwd: process.cwd() },
    { backend },
  )
  process.stderr.write(`[new-project] complete: backend=${backend}, ts=${result.timestamp}\n`)
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  process.exit(0)
}
```

Similarly for: `new-milestone`, `add-phase`, `remove-phase`, `progress`.

This adds 5 more `resolvePlanningBackendFromSettings()` call sites (total: 9).

### Change 4: Guided-Flow Backend Threading (Secondary Path)

**File:** `src/resources/extensions/gsd/guided-flow.ts`

Thread `defaultBackend` through `dispatchWorkflow()` for interactive management flows. This is the secondary path — the CLI dispatch blocks are the primary verification path per D-03.

The `dispatchWorkflow()` function currently takes `(pi, note, customType, ctx, unitType)`. Backend config can be read from SettingsManager inside the function and applied when creating sessions.

**Approach:** Read `defaultBackend` from SettingsManager within `dispatchWorkflow()` at the point where `pi.sendMessage()` is called. The Pi SDK extension API's `sendMessage` method does not currently accept backend config — the backend is determined at session creation time. For the guided-flow path, the session is already created when the TUI starts. Backend selection for guided-flow happens at the session-level, not per-dispatch.

**Conclusion:** The guided-flow path inherits the session-level backend from initial `createAgentSession()` in the TUI startup chain. Phase 10 focuses on the CLI dispatch path (primary for FLOW-01 verification). The guided-flow path can be validated by verifying the TUI session creation reads `defaultBackend` from settings — this is already established in all four Phase 8 dispatch blocks and applies transitively to any `pi.sendMessage()` call within that session.

### Change 5: Automated Tests

**Files:** `src/cli-dispatch.test.ts` (extend), `src/workflows/roadmap.test.ts` (new), `src/workflows/requirements.test.ts` (new), `packages/pi-coding-agent/src/core/backends/accounting/stage-router.test.ts` (extend or new)

1. **CLI dispatch tests** (`src/cli-dispatch.test.ts`): Extend existing source-shape tests to cover management command dispatch blocks — checking presence, import, `resolvePlanningBackendFromSettings()` call, telemetry logging. Update total call count assertion from 4 to 9.

2. **Workflow wrapper tests** (`roadmap.test.ts`, `requirements.test.ts`): Source-shape tests verifying session creation pattern, stage parameter, and export presence, matching Phase 8 `execute-phase.test.ts` / `verify-work.test.ts` patterns.

3. **Stage router tests**: Verify `getStageMultiplierTier("roadmap") === "low"` and `getStageMultiplierTier("requirements") === "low"`, plus absence of any stage name variants not in the map (Pitfall 4 guard per D-12).

---

## Validation Architecture

### Test Dimensions

| Dimension | What It Proves | How |
|---|---|---|
| Stage routing | roadmap/requirements → low tier | Unit test on `getStageMultiplierTier()` |
| CLI dispatch | Management commands resolve backend from settings | Source-shape test on `cli.ts` |
| Workflow shape | Wrappers use `createAgentSession` with correct stage | Source-shape test on workflow files |
| Tool profile | No bash/edit tools in management sessions | Source-shape test on workflow `availableToolNames` |
| Telemetry | Stage name in stderr output matches router key | Source-shape test for `stage=roadmap`/`stage=requirements` |
| Call count | Total `resolvePlanningBackendFromSettings()` sites = 9 | Regex count on `cli.ts` |

### Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stage name mismatch (Pitfall 4) | LOW | Automated test checks all management stage names exist in STAGE_TIER_MAP |
| Tool allow-list drops extension tools (Pitfall 6) | LOW | Workflow wrappers use same `createAgentSession` pattern that already handles extension tools |
| Breaking existing dispatch blocks | LOW | Source-shape tests verify existing blocks unchanged |
| guided-flow backend threading incomplete | MEDIUM | Scoped to CLI path for FLOW-01; guided-flow inherits session-level backend |

### Technical Decisions

1. **Grouped vs. split workflow wrappers:** Two wrappers (`roadmap.ts`, `requirements.ts`) grouping by stage category — balances file count against per-command specificity. Each wrapper handles multiple sub-commands via the `command` field.

2. **Tool profile enforcement:** Applied via `availableToolNames` in session options, consistent with Phase 8/9 patterns. Management commands get `['read', 'write']` — no `bash` or `edit`.

3. **CLI dispatch block pattern:** Individual dispatch blocks per command (5 blocks), not a grouped management block. This preserves the exact Pattern from Phase 8 and makes each command independently testable.

---

## Existing Patterns to Follow

- **CLI dispatch:** 4 existing blocks in `src/cli.ts` lines 280-355 — replicate exact structure
- **Workflow wrapper:** `src/workflows/discuss-phase.ts` (most complete reference) — session creation, event collection, structured output
- **Stage routing:** Extend `STAGE_TIER_MAP` with new keys — same pattern as Phase 8's v1.1 aliases
- **Source-shape tests:** `src/cli-dispatch.test.ts` — readFileSync + regex assertions
- **Test hook:** `node --experimental-strip-types --test` with `--import resolve-ts.mjs` when importing .js paths

## Pitfall Summary

1. **Pitfall 4 (Stage name mismatch):** Every stage name used in telemetry logging and workflow wrappers must be present as a key in `STAGE_TIER_MAP`. Test this explicitly.
2. **Pitfall 6 (Tool allow-list):** Do not filter extension tools — use the same `createAgentSession` path that handles extension tool passthrough.

---

*Research complete — ready for planning*
