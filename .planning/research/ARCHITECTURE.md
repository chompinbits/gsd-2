# Architecture Patterns — v1.1

**Domain:** Copilot SDK Migration — execute/verify, orchestration, fallback
**Researched:** 2026-03-25

## Recommended Architecture

v1.1 extends the existing layered architecture established in v1.0. No structural changes.
All additions are wiring new config through existing boundaries.

### Component Boundaries (v1.1 additions highlighted)

| Component | Responsibility | v1.1 Change |
|-----------|---------------|-------------|
| `auto-dispatch.ts` | Declarative rules mapping GSD state → unit type + prompt | **Add `stage` metadata to `DispatchAction`** |
| `auto/run-unit.ts` | Single unit execution: session create → prompt → await | **Accept `unitConfig` with stage, toolFilter, modelHint** |
| `AgentSession` | Session lifecycle, tool registry, model management | **Thread `unitConfig` through `newSession()` options** |
| `CopilotSessionBackend` | SDK session creation, accounting wrapper | **Filter tools by `availableToolNames`; pass `provider` for BYOK** |
| `BackendConfig` | Runtime-agnostic session configuration | **Add `availableToolNames` and `provider` fields** |
| `BudgetGuard` | Budget enforcement and warnings | **Add `suggestDowngrade()` for 0× model fallback** |
| `FallbackResolver` | Provider fallback chain traversal | **Add `toByokConfig()` for SDK provider config** |
| `stage-router.ts` | Stage → billing tier mapping | **Add missing stage keys for auto-mode and commands** |

### Data Flow (v1.1 execute path)

```
User runs /gsd-auto
     │
     ▼
auto/loop.ts — autoLoop()
     │
     ├── runPreDispatch() — derive GSD state from disk
     ├── runDispatch() — match DispatchRule → DispatchAction
     │        │
     │        │ DispatchAction { unitType, prompt, stage, toolFilter }  ◄── NEW
     │        ▼
     ├── runGuards() — budget check, session lock
     │        │
     │        │ BudgetGuard.suggestDowngrade() → model override?  ◄── NEW (FLOW-02)
     │        ▼
     ├── runUnitPhase() → runUnit(ctx, pi, s, unitType, unitId, prompt, unitConfig)
     │        │
     │        │ unitConfig: { stage, toolFilter, modelHint }  ◄── NEW
     │        ▼
     │   cmdCtx.newSession(unitConfig)
     │        │
     │        ▼
     │   AgentSession.newSession()
     │        │ → _buildRuntime({ activeToolNames: unitConfig.toolFilter })
     │        │ → CopilotSessionBackend.createSession(config)
     │        │        │
     │        │        │ config.availableToolNames → filter SDK tools  ◄── NEW
     │        │        │ config.provider → BYOK if fallback active  ◄── NEW (FLOW-03)
     │        │        ▼
     │        │   SDK createSession({ model, tools, provider })
     │        ▼
     │   pi.sendMessage() → SDK send → agent_end
     │        │
     │        ▼
     └── runFinalize() — persist state, next iteration
```

## Patterns to Follow

### Pattern 1: Config Threading (not mutation)

**What:** Pass stage-aware configuration from dispatch through to backend as immutable data, rather than mutating global state.
**When:** Always — every unit execution in auto-mode.
**Example:**
```typescript
// In auto-dispatch.ts — dispatch rule carries stage config
const rule: DispatchRule = {
  unitType: "execute-task",
  stage: "execute-task",
  toolFilter: ["read", "write", "edit", "bash", "lsp", "Skill"],
  // ...
};

// In runUnit() — passed through, not looked up
async function runUnit(
  ctx, pi, s, unitType, unitId, prompt,
  unitConfig?: { stage?: string; toolFilter?: string[]; modelHint?: string },
) { /* ... */ }
```

### Pattern 2: Suggest, Don't Force (budget downgrade)

**What:** Budget system suggests model downgrades; callers decide whether to apply.
**When:** FLOW-02 free-tier fallback.
**Example:**
```typescript
// BudgetGuard suggests — doesn't mutate
const suggestion = guard.suggestDowngrade(currentModel, estimatedCost);
if (suggestion) {
  // Caller decides to apply or ignore
  config.model = suggestion.model;
  emitEvent({ type: "budget_model_downgrade", from: currentModel, to: suggestion.model });
}
```

### Pattern 3: Allow-List Over Block-List (tool restriction)

**What:** Use `availableToolNames` (allow-list) rather than `excludedTools` (block-list).
**When:** Per-session tool restriction for all session types.
**Rationale:** New tools added by extensions won't accidentally appear in restricted sessions.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Tool State for Per-Unit Restriction

**What:** Modifying the global tool registry to restrict tools for a single unit.
**Why bad:** Auto-mode creates sessions in sequence; global mutation affects subsequent units.
**Instead:** Pass `availableToolNames` per session config. Backend filters tools at creation time.

### Anti-Pattern 2: Model Downgrade Inside BudgetGuard.check()

**What:** Having `check()` side-effect by switching the model when budget pressure is detected.
**Why bad:** Callers expecting pure budget validation get surprising model changes. Untestable.
**Instead:** Separate method `suggestDowngrade()` returns a suggestion; caller applies it.

### Anti-Pattern 3: Separate BYOK Backend Implementation

**What:** Creating a `ByokSessionBackend` alongside `CopilotSessionBackend`.
**Why bad:** Duplicates session lifecycle, accounting wrapper, event translation. Two code paths to maintain.
**Instead:** Add `provider` field to `BackendConfig`. `CopilotSessionBackend.createSession()` passes it to SDK's `createSession({ provider })`.

---
*Architecture patterns for: GSD 2 v1.1*
*Researched: 2026-03-25*
