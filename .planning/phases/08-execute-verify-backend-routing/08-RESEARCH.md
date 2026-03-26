# Phase 8 Research: Execute & Verify Backend Routing

**Phase:** 08 — Execute & Verify Backend Routing
**Requirement:** EXEC-01
**Researched:** 2026-03-25
**Confidence:** HIGH

## Scope

Route execute-phase and verify-work workflows through the Copilot SDK backend under `defaultBackend: "copilot"` config control — matching the discuss/plan pattern shipped in v1.0. Add stage-tier aliases, enforce per-session tool profiles, and produce verification evidence.

This phase does NOT include: full autonomous orchestration (EXEC-02), roadmap/requirements commands (FLOW-01), or fallback features (FLOW-02/03).

## Standard Stack

No new dependencies. All work uses `@github/copilot-sdk` 0.2.0 capabilities already installed in v1.0.

## Architecture Patterns

### Pattern: Backend-Agnostic Workflow Wrapper (reuse from v1.0)

`discuss-phase.ts` and `plan-phase.ts` already implement this pattern:

```typescript
// 1. Session creation with backend selection
const sessionOptions = {
  backend,          // "pi" | "copilot" — from options or settings
  stage,            // workflow stage for accounting
  // ... standard session config
}
const { session } = await createAgentSession(sessionOptions)

// 2. Prompt execution — identical across backends
await session.prompt(prompt, { expandPromptTemplates: false })

// 3. Response extraction — identical across backends
const messages = session.state.messages
// ... extract text from last assistant message
```

Phase 8 creates `execute-phase.ts` and `verify-work.ts` following this exact pattern.

### Pattern: Config Threading (not mutation)

Stage metadata and tool profile flow from dispatch → session creation as immutable data:
- `stage` propagates to `createAgentSession()` → `BackendConfig.stage` → `AccountingSessionHandle` for tier-aware billing
- `tools` parameter controls which built-in tools are available per session type

### Pattern: Allow-List Over Block-List (tool restriction)

Execute sessions: full coding tools (`codingTools` = read, bash, edit, write)
Verify sessions: read-oriented tools (`readOnlyTools` = read, bash) — no write/edit

Tool restriction is applied via the existing `tools` parameter on `createAgentSession()`, not a new filtering mechanism.

## Key Integration Points

### 1. `createAgentSession()` — Central routing seam

Location: `packages/pi-coding-agent/src/core/sdk.ts`

Already handles:
- `backend` param → Pi or Copilot session creation
- `stage` param → forwarded to `BackendConfig.stage` for accounting
- `tools` param → controls which tools are available in the session

The execute/verify wrappers just need to call this with the right parameters.

### 2. `STAGE_TIER_MAP` — Stage-to-tier accounting

Location: `packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts`

Current mappings:
- `execute-task` → `standard` (1×) ✓
- `verify-work` → `free` (0×) ✓

Missing mappings per D-05:
- `execute-phase` → `standard` (1×) — alias used by auto-dispatch
- `verify-phase` → `free` (0×) — alias used by auto-dispatch
- `run-uat` → `free` (0×) — alias used by UAT workflow

### 3. Tool profiles per D-07/D-08

Execute sessions use `codingTools` (read, bash, edit, write) — full capability.
Verify sessions use `readOnlyTools` (read, bash) — no write/edit to prevent accidental modification.

Both tool sets are already exported from `packages/pi-coding-agent/src/core/tools/index.js`.

## Implementation Approach

### Workflow Wrappers

Create two new files following the discuss/plan pattern:

**`src/workflows/execute-phase.ts`:**
- Accepts objective/plan description + project context
- Creates session with `backend`, `stage: 'execute-task'`, `tools: codingTools`
- Sends execution prompt
- Collects response text
- Returns structured `ExecuteOutput`

**`src/workflows/verify-work.ts`:**
- Accepts verification scope + UAT criteria
- Creates session with `backend`, `stage: 'verify-work'`, `tools: readOnlyTools`
- Sends verification prompt
- Collects response text
- Returns structured `VerifyOutput`

### Stage Router Updates

Add 3 missing stage aliases to `STAGE_TIER_MAP`:
- `execute-phase` → `standard`
- `verify-phase` → `free`
- `run-uat` → `free`

### Verification Evidence

Automated tests covering:
1. Backend routing selection — execute/verify workflow creates session with correct backend
2. Stage-tier attribution — `execute-task` maps to `standard`, `verify-work` maps to `free`, aliases resolve correctly
3. Tool profile enforcement — execute gets write tools, verify does not
4. Pi-path parity — same workflows produce structurally equivalent output on both backends

## Pitfalls to Guard Against

### Pitfall 1: Tool Profile Lost on Session Rebuild (from PITFALLS.md)

Not applicable to Phase 8 — workflow wrappers create fresh sessions with explicit `tools` param. The extension rebuild issue only affects auto-mode `newSession()` calls (EXEC-02).

### Pitfall 4: Stage Name Mismatch (from PITFALLS.md)

Directly addressed by adding `execute-phase`, `verify-phase`, `run-uat` to `STAGE_TIER_MAP`. Without these, telemetry would report unmapped stage names even though the default (`standard`) is accidentally correct.

## Dont Hand-Roll

- **Session management** — use `createAgentSession()`, don't create raw SDK sessions
- **Accounting** — use existing `AccountingSessionHandle` wrapper, don't manually track requests
- **Tool sets** — use exported `codingTools`/`readOnlyTools`, don't construct custom tool arrays
- **Backend selection** — use `options.backend ?? settingsManager.getDefaultBackend()` chain, don't read settings directly

## Validation Architecture

### Testable Behaviors

| Behavior | Input | Expected Output | Test Type |
|----------|-------|-----------------|-----------|
| Execute routing to copilot backend | `backend: "copilot"` | Session created via CopilotSessionBackend | Unit |
| Verify routing to copilot backend | `backend: "copilot"` | Session created via CopilotSessionBackend | Unit |
| Execute uses coding tools | `runExecuteWorkflow()` | Session tools include write, edit | Unit |
| Verify uses read-only tools | `runVerifyWorkflow()` | Session tools exclude write, edit | Unit |
| Stage `execute-task` → standard tier | `getStageMultiplierTier("execute-task")` | `"standard"` | Unit |
| Stage `execute-phase` → standard tier | `getStageMultiplierTier("execute-phase")` | `"standard"` | Unit |
| Stage `verify-work` → free tier | `getStageMultiplierTier("verify-work")` | `"free"` | Unit |
| Stage `verify-phase` → free tier | `getStageMultiplierTier("verify-phase")` | `"free"` | Unit |
| Stage `run-uat` → free tier | `getStageMultiplierTier("run-uat")` | `"free"` | Unit |
| Execute Pi/Copilot parity | Same prompt, both backends | Structurally equivalent output | Integration |
| Verify Pi/Copilot parity | Same prompt, both backends | Structurally equivalent output | Integration |

### Test File Structure

- `src/workflows/execute-phase.test.ts` — Unit tests for execute workflow routing and tool profile
- `src/workflows/verify-work.test.ts` — Unit tests for verify workflow routing and tool profile
- `packages/pi-coding-agent/src/core/backends/accounting/accounting.test.ts` — Extended with new stage alias tests

---
*Research for Phase 08 — Execute & Verify Backend Routing*
*Researched: 2026-03-25*
