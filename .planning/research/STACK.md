# Stack Research — v1.1 Additions

**Domain:** Copilot SDK Migration — execute/verify, autonomous orchestration, fallback layers
**Researched:** 2026-03-25
**Confidence:** HIGH (all additions build on shipped v1.0 adapter layer)

> **Scope:** This document covers ONLY new stack additions or changes needed for v1.1.
> The v1.0 foundation (`@github/copilot-sdk` 0.2.0, `CopilotSessionBackend`, accounting layer,
> tool bridge, event translator, planning workflow routing) is **shipped and stable**.
> See `.planning/milestones/` for v1.0 evidence.

---

## What v1.1 Requires That v1.0 Does Not Yet Provide

| Feature | Gap in v1.0 Stack | What Needs to Change |
|---------|-------------------|----------------------|
| **EXEC-01** Execute/verify workflows on Copilot backend | `execute-task` and `verify-work` stages route through the Copilot backend at the `createSession()` level, but the auto-mode `runUnit()` path — which creates sessions via `cmdCtx.newSession()` — has no explicit backend-routing integration. The `stage` hint flows to accounting but not to session-creation-time tool restriction. | Wire stage-aware tool filtering into `BackendConfig`; add `execute-phase` and `verify-phase` stage mappings where missing. |
| **EXEC-02** Full autonomous orchestration on Copilot backend | Auto-mode (`auto/loop.ts` → `runUnit()`) creates sessions via `AgentSession.newSession()`, which rebuilds the full tool set every time. No per-unit tool allow-listing. No per-unit model override based on stage tier. | Add `toolFilter` and `modelOverride` to `BackendConfig` (or a new `UnitSessionConfig`); plumb them from `runUnit()` → `newSession()` → backend. |
| **FLOW-01** Roadmap/requirements commands on Copilot backend | Remaining command handlers (roadmap, requirements) still call through the Pi-native `AgentSession.prompt()` path without explicit backend routing. | Extend `defaultBackend` settings plumbing to cover all command dispatch paths, not just plan/discuss. |
| **FLOW-02** Free-tier 0× model fallback under quota pressure | `BudgetGuard` throws `BudgetExceededError` or warns, but does NOT trigger an automatic model downgrade. No downgrade path exists in the accounting layer. | Add a `BudgetPolicy` strategy that intercepts budget warnings and swaps the model to a 0× tier before the send. |
| **FLOW-03** BYOK fallback when premium quota exhausted | `FallbackResolver` handles provider-level exhaustion and chain traversal, but has no integration with the Copilot backend `provider` config for BYOK session creation. BYOK sessions require a different `provider` block in `createSession()`. | Extend `CopilotSessionBackend.createSession()` to accept an optional `provider` override; wire `FallbackResolver` output into backend session config. |

---

## Recommended Stack Additions

### Core Technologies — No New Dependencies

No new npm packages are needed. All v1.1 features are implementable with the existing
`@github/copilot-sdk` 0.2.0 + internal abstractions. The work is wiring, not importing.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@github/copilot-sdk` | 0.2.0 (no change) | Session creation, tool bridging, model routing, BYOK provider config | Already installed. v1.1 uses existing SDK capabilities (`availableTools`, `provider` config, `model` param) that were not exercised in v1.0. No version bump required. **HIGH confidence** |
| Node.js | 22 LTS (no change) | Runtime | No change. **HIGH confidence** |
| TypeScript | 5.4+ (no change) | Compile target | No change. **HIGH confidence** |

### Internal Abstractions — New or Extended

These are NOT new packages. They are modifications to existing internal modules.

| Module | File | Change | Why |
|--------|------|--------|-----|
| `BackendConfig` | `backend-interface.ts` | Add optional `availableToolNames?: string[]` and `provider?: ByokProviderConfig` fields | Enables per-session tool restriction (EXEC-01/02) and BYOK provider injection (FLOW-03) at the backend boundary |
| `CopilotSessionBackend.createSession()` | `copilot-backend.ts` | Pass `availableToolNames` to SDK `tools` filtering; pass `provider` to SDK session config | Copilot SDK already supports `availableTools` and `provider` in its `createSession()` options — v1.0 just didn't wire them |
| `BudgetGuard` | `budget-guard.ts` | Add `suggestDowngrade(): ModelSuggestion \| null` method that returns a 0× model when budget pressure >= warnThreshold | Enables FLOW-02 without changing the send path signature — callers check before sending |
| `stage-router.ts` | `accounting/stage-router.ts` | Add missing stage keys: `"execute-phase"`, `"verify-phase"`, `"roadmap"`, `"requirements"` | Currently maps `"execute-task"` → standard and `"verify-work"` → free. The broader stage names used by auto-mode dispatch should also route correctly |
| `FallbackResolver` | `fallback-resolver.ts` | Add `toByokConfig(): ByokProviderConfig \| null` that converts the resolved fallback model into the SDK's provider config shape | Bridges the existing fallback chain output to the BYOK session creation path |
| `runUnit()` | `auto/run-unit.ts` | Accept `unitConfig?: { stage, toolFilter, modelHint }` and thread through `newSession()` | Auto-mode units currently pass only a prompt. Stage-aware config enables tool restriction and model routing per unit type |
| `auto-dispatch.ts` | Dispatch rules | Add stage metadata to `DispatchAction` so each unit type carries its stage name | Currently dispatch produces a unitType + prompt. Adding `stage` lets `runUnit()` configure the backend appropriately |

---

## Integration Points — How v1.1 Additions Connect to v1.0

### EXEC-01 + EXEC-02: Execute/Verify → Copilot Backend

```
auto-dispatch.ts                   auto/run-unit.ts                 AgentSession.newSession()
┌─────────────┐                   ┌──────────────┐                 ┌─────────────────────┐
│ DispatchRule │──stage,toolset──▶│  runUnit()   │──unitConfig──▶ │  newSession(opts)   │
│ "execute"   │                   │  with stage  │                 │  → createSession()  │
│ stage: exec │                   │  + toolFilter│                 │  w/ availableTools  │
└─────────────┘                   └──────────────┘                 └─────────────────────┘
                                                                            │
                                                                            ▼
                                                                   CopilotSessionBackend
                                                                   .createSession(config)
                                                                   ┌─────────────────────┐
                                                                   │ SDK createSession({  │
                                                                   │   model,             │
                                                                   │   tools: filtered,   │
                                                                   │   provider: byok?,   │
                                                                   │ })                   │
                                                                   └─────────────────────┘
```

**Key insight:** `runUnit()` calls `s.cmdCtx!.newSession()` which goes to `AgentSession.newSession()` → rebuilds tools → calls `CopilotSessionBackend.createSession()`. The plumbing path already exists. What's missing is per-unit configuration flowing through this chain.

### FLOW-02: Free-Tier Fallback Path

```
BudgetGuard.check()  ──quota pressure──▶  BudgetPolicy.suggestDowngrade()
     │                                          │
     │ "warning"                                 │ { model: "gpt-5-mini", tier: "free" }
     ▼                                          ▼
AccountingSessionHandle.send()     ──▶  CopilotSessionBackend override model
                                          for this session
```

**Key insight:** The existing `BudgetGuard.check()` already detects quota pressure and returns `BudgetWarning`. Adding a `suggestDowngrade()` method lets the `AccountingSessionHandle` (or a new wrapper) swap models before the SDK `send()` call. The 0× models (GPT-5 mini, GPT-4.1, GPT-4o) are already mapped in `multipliers.ts`.

### FLOW-03: BYOK Fallback Path

```
FallbackResolver.findFallback()
     │
     │ FallbackResult { model, chainName }
     ▼
FallbackResolver.toByokConfig()
     │
     │ { type: "openai"|"anthropic"|"azure", baseUrl, apiKey }
     ▼
BackendConfig.provider = byokConfig
     │
     ▼
CopilotSessionBackend.createSession()
     │
     │ SDK createSession({ provider: { type, baseUrl, apiKey } })
     ▼
Direct API call (no premium requests consumed)
```

**Key insight:** `FallbackResolver` already resolves the next available model from user-configured chains. The gap is translating `FallbackResult` into the SDK's `provider` config shape and passing it through `BackendConfig` → `createSession()`.

---

## Stage Router Additions

Current `STAGE_TIER_MAP` (from v1.0):

```typescript
// Already mapped
"discuss-phase":  "free"      // 0×
"verify-work":    "free"      // 0×
"plan-check":     "low"       // 0.33×
"validate-phase": "low"       // 0.33×
"plan-phase":     "standard"  // 1×
"research-phase": "standard"  // 1×
"execute-task":   "standard"  // 1×
```

New entries for v1.1:

```typescript
// Add for EXEC-01/EXEC-02/FLOW-01
"execute-phase":    "standard"  // 1× — synonym used by auto-dispatch
"verify-phase":     "free"      // 0× — synonym used by auto-dispatch
"roadmap":          "low"       // 0.33× — structure generation
"requirements":     "low"       // 0.33× — requirement management
"complete-milestone": "free"    // 0× — bookkeeping after execution
"run-uat":          "free"      // 0× — user acceptance test execution
```

---

## Tool Restriction Profiles

v1.1 needs per-session tool filtering to prevent wasted premium requests from tool-call errors.

| Session Type | Allowed Tools | Blocked Tools | Rationale |
|-------------|---------------|---------------|-----------|
| `execute-task` | All (read, write, edit, bash, lsp, Skill) | — | Full capability for code generation |
| `verify-work` | read, bash, lsp | write, edit | Read-only verification — writing would be incorrect |
| `discuss-phase` | read | write, edit, bash | Discussion only — no execution |
| `plan-phase` | read, bash (read-only) | write, edit | Planning reads codebase, shouldn't modify |
| `roadmap` | read, write | bash, edit | Writes planning files, no code execution |
| `requirements` | read, write | bash, edit | Writes planning files, no code execution |

**Implementation:** Add `availableToolNames` to `BackendConfig`. In `CopilotSessionBackend.createSession()`, filter the bridged tools list to only include allowed tools before passing to the SDK.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Extend `BackendConfig` with `availableToolNames` | Use SDK `excludedTools` config | `availableToolNames` is an allow-list (safer default-deny) vs SDK's `excludedTools` block-list. Allow-listing prevents new tools from accidentally being available in restricted sessions. |
| Add `BudgetPolicy.suggestDowngrade()` | Auto-switch model inside `BudgetGuard.check()` | Side-effectful budget checks violate single-responsibility. `suggestDowngrade()` returns a suggestion; the caller decides whether to apply it. Testable and predictable. |
| Thread `ByokProviderConfig` through `BackendConfig` | Create a separate `ByokSessionBackend` | Separate backend doubles code paths. The SDK already handles BYOK via `provider` config in `createSession()` — passing it through `BackendConfig` is one added field. |
| Add stage metadata to `DispatchAction` | Look up stage from unitType in `runUnit()` | Lookup creates a second source of truth. Stage on the dispatch action is declarative and matches the dispatch rules table pattern. |
| Keep `@github/copilot-sdk` at 0.2.0 | Upgrade to latest | v1.1 features need no new SDK capabilities. Upgrading mid-milestone adds unnecessary risk. Pin for stability; bump at next milestone boundary. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New LLM provider SDKs (`openai`, `@anthropic-ai/sdk`, etc.) | BYOK goes through Copilot SDK's `provider` config — no direct provider SDK needed | `provider: { type: "openai", baseUrl, apiKey }` in session config |
| Session pooling library | Auto-mode already uses one-shot Ralph Loop sessions (fresh per unit). Pooling adds complexity with no benefit for the one-session-per-unit model | Keep `newSession()` per unit |
| External rate limiting / token bucket library | `BudgetGuard` + `RequestTracker` already track usage. Model downgrade is a policy decision, not a rate limit | Extend `BudgetGuard` with `suggestDowngrade()` |
| New testing framework | Existing vitest + parity suite infrastructure from v1.0 covers unit + integration | Extend parity suites for execute/verify/auto stages |
| Workflow engine / state machine library | `auto/loop.ts` already is a declarative state machine (dispatch rules → guards → run → finalize). Adding a library would require rewriting working code | Keep existing auto-loop architecture |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@github/copilot-sdk@0.2.0` | Node.js 18+ | Currently on Node 22 LTS. No issues. |
| `@github/copilot-sdk@0.2.0` | TypeScript 5.4+ | SDK ships `.d.ts` types. Compatible with existing strict-mode tsconfig. |
| `@github/copilot-sdk@0.2.0` | Zod 3.x | `defineTool` accepts Zod schemas. Existing Zod version compatible. |
| `@github/copilot-sdk@0.2.0` | `approveAll` | Used for headless/auto-mode permission bypass. No changes needed. |

---

## Installation

```bash
# No new packages required for v1.1.
# All changes are internal wiring against existing @github/copilot-sdk@0.2.0.
```

---

## Sources

- **Codebase inspection** (HIGH confidence):
  - `backend-interface.ts` — `BackendConfig`, `SessionBackend` interfaces
  - `copilot-backend.ts` — `CopilotSessionBackend.createSession()` implementation
  - `stage-router.ts` — `STAGE_TIER_MAP`, `resolveEffectiveTier()`
  - `budget-guard.ts` — `BudgetGuard.check()`, `BudgetExceededError`
  - `multipliers.ts` — Model tier mappings
  - `fallback-resolver.ts` — `FallbackResolver.findFallback()`, chain traversal
  - `run-unit.ts` — `runUnit()` session-per-unit pattern
  - `auto-dispatch.ts` — `DISPATCH_RULES`, `DispatchAction`

- **Context7 — GitHub Copilot SDK docs** (HIGH confidence):
  - Library ID: `/websites/github_en_copilot` — session lifecycle, streaming, tools, events, hooks
  - Library ID: `/github/copilot-cli` — custom agents, skills, tool permissions, CLI flags

- **v1.0 STACK.md** (HIGH confidence):
  - BYOK provider config shape: `type: "openai" | "anthropic" | "azure"` with `baseUrl` and `apiKey`
  - Model tiering: 0× (GPT-5 mini, GPT-4.1, GPT-4o), 0.33× (Claude Haiku 4.5, Gemini 3 Flash), 1× (Claude Sonnet 4.5/4.6, GPT-5.1)
  - SDK `availableTools` / `excludedTools` config for tool restriction per session

---
*Stack research for: GSD 2 v1.1 — execute/verify, autonomous orchestration, fallback layers*
*Researched: 2026-03-25*
