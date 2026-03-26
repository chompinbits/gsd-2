# Domain Pitfalls — v1.1

**Domain:** Copilot SDK Migration — execute/verify, orchestration, fallback
**Researched:** 2026-03-25

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Extension Rebuild Conflicts with Per-Unit Tool Restriction

**What goes wrong:** `AgentSession.newSession()` calls `_buildRuntime()` which rebuilds the full extension runner and tool registry. If `runUnit()` passes `toolFilter` to `newSession()`, the rebuild may re-add all extension tools, overriding the filter.
**Why it happens:** `_buildRuntime()` calls `_refreshToolRegistry({ includeAllExtensionTools: true })` which activates all extension-registered tools. The tool filter from dispatch gets lost.
**Consequences:** Restricted sessions (verify, discuss) get full tool sets. Premium model calls fail on write tools in verify sessions, wasting premium requests on error + retry cycles.
**Prevention:** Apply tool filtering AFTER `_buildRuntime()` completes, or pass the filter into `_refreshToolRegistry()` as `activeToolNames`. The `_refreshToolRegistry(options)` already accepts `activeToolNames` — use it.
**Detection:** Parity tests that assert tool count per session type. If a verify session has write/edit tools, the test fails.

### Pitfall 2: BYOK Provider Config Leaking Between Sessions

**What goes wrong:** BYOK `provider` config set for a fallback session persists to the next session if `BackendConfig` isn't reset.
**Why it happens:** `CopilotSessionBackend` or `AccountingSessionHandle` caches the provider config from the last `createSession()` call.
**Consequences:** After BYOK fallback resolves (premium quota recovers), subsequent sessions still use BYOK provider instead of premium requests. User gets charged by the BYOK provider unnecessarily.
**Prevention:** `BackendConfig.provider` must be set per-session, not cached. `CopilotSessionBackend.createSession()` should use config.provider (or undefined) each call, never a stored default.
**Detection:** Test that creates a BYOK session, then a normal session, and asserts the normal session has no provider override.

### Pitfall 3: Auto-Mode Session Timeout Discards Budget Downgrade

**What goes wrong:** `runUnit()` races `newSession()` against a timeout (`NEW_SESSION_TIMEOUT_MS`). If session creation is slow due to budget downgrade negotiation, the timeout fires and returns `{ status: 'cancelled' }`, losing the downgrade.
**Why it happens:** Budget downgrade adds a decision step before session creation. If the downgrade lookup is slow (e.g., checking available models, verifying API keys), total session creation time exceeds the timeout.
**Consequences:** Auto-mode repeatedly cancels sessions under budget pressure, making no progress. Appears stuck.
**Prevention:** Perform budget downgrade check BEFORE the timeout race, not inside session creation. The downgrade decision is a pre-flight check, not part of session setup.
**Detection:** Integration test that simulates budget pressure and asserts auto-mode completes at least one unit on a downgraded model.

## Moderate Pitfalls

### Pitfall 4: Stage Name Mismatch Between Dispatch and Router

**What goes wrong:** Auto-dispatch uses `"execute-phase"` but stage-router maps `"execute-task"`. Stage falls through to `"standard"` default (correct by accident), but billing telemetry reports wrong stage name.
**Prevention:** Add all stage name variants to `STAGE_TIER_MAP`. Alternatively, normalize stage names at the dispatch boundary.

### Pitfall 5: FallbackResolver Returns Model Not in Copilot SDK

**What goes wrong:** `FallbackResolver.findFallback()` returns a model from the user's fallback chain that's a BYOK-only model (e.g., a custom fine-tuned model). The SDK's `createSession()` doesn't know this model.
**Prevention:** `toByokConfig()` must always include the `provider` block when the resolved model is from a non-Copilot provider. Never pass a BYOK model name to SDK without the provider config.

### Pitfall 6: Tool Allow-List Breaks Extension-Registered Tools

**What goes wrong:** Extensions register custom tools (MCP servers, custom skills). The per-session `availableToolNames` filter doesn't include these because the dispatch rules only list built-in tool names.
**Prevention:** Tool filter should have two modes: (1) restrict built-in tools, (2) pass through all extension-registered tools unless explicitly blocked. Or include a wildcard for extension tools in the allow-list.

## Minor Pitfalls

### Pitfall 7: Budget Downgrade Notification Missing from Headless Output

**What goes wrong:** `suggestDowngrade()` triggers a model change but headless/RPC mode doesn't emit a user-visible event. Users running CI automation see unexpected model in session stats.
**Prevention:** Emit a `budget_model_downgrade` event that headless event translator includes in JSONL output.

### Pitfall 8: Verify Session Gets Stale Read Cache

**What goes wrong:** Verify session (read-only) reads files that were modified by the preceding execute session. If the read tool caches aggressively, verification sees stale content.
**Prevention:** Auto-mode already creates fresh sessions per unit, so tool instances are new. Just ensure no cross-session file read cache exists at the OS level (unlikely in Node.js).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| EXEC-01 (execute routing) | Pitfall 1 — extension rebuild overrides tool filter | Use `_refreshToolRegistry({ activeToolNames })` |
| EXEC-02 (auto orchestration) | Pitfall 3 — timeout discards budget downgrade | Pre-flight budget check before timeout race |
| FLOW-01 (command coverage) | Pitfall 4 — stage name mismatch | Normalize all stage names in router |
| FLOW-02 (free-tier fallback) | Pitfall 7 — missing headless notification | Emit `budget_model_downgrade` event |
| FLOW-03 (BYOK fallback) | Pitfall 2 — provider config leaks between sessions | Per-session config, no caching |
| FLOW-03 (BYOK fallback) | Pitfall 5 — BYOK model without provider config | Always include provider block for non-Copilot models |

## Sources

- Codebase inspection of `AgentSession.newSession()` → `_buildRuntime()` → `_refreshToolRegistry()` chain
- Codebase inspection of `auto/run-unit.ts` timeout race pattern
- Codebase inspection of `FallbackResolver.findFallback()` chain traversal
- Codebase inspection of `CopilotSessionBackend.createSession()` session config handling
- v1.0 parity test patterns in `.planning/milestones/`

---
*Domain pitfalls for: GSD 2 v1.1*
*Researched: 2026-03-25*
