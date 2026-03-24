# Project Research Summary

**Project:** GSD 2 — Copilot SDK Migration
**Domain:** Coding agent framework runtime migration with quota-optimized orchestration
**Researched:** 2026-03-24
**Confidence:** HIGH (stack + billing docs verified against official GitHub sources; SDK is technical preview — adapter isolation is mandatory)

## Executive Summary

GSD 2 is migrating its agent runtime from the Pi SDK to the GitHub Copilot SDK while preserving all existing multi-mode execution paths (interactive TUI, headless/RPC, web bridge, MCP server). The recommended approach is a **hybrid adapter strategy**: build a thin `SessionBackend` abstraction that routes all session creation through either the Pi SDK or the Copilot SDK at runtime, with a feature flag controlling the active backend per workflow stage. This preserves rollback capability throughout the migration and avoids a big-bang cutover that would risk parity regressions for users who depend on predictable automation.

The central economic constraint is **premium request quota**: under Copilot billing, each `session.sendAndWait()` call costs 1 premium request × the model's multiplier (0× for GPT-4.1/GPT-5 mini, 0.33× for Haiku 4.5/Gemini Flash, 1× for Sonnet 4.5/GPT-5.1-Codex, 3× for Opus 4.5, 30× for Opus 4.6 fast). A Pro subscriber has ~300 premium requests/month. Unconstrained auto-mode loops can exhaust this in hours. The migration must treat premium request consumption as a **first-class engineering constraint**, not an afterthought — implementing a request accounting layer alongside the SDK adapter before any orchestration flows are migrated.

Key risks concentrate around three areas: (1) tool call round-trips triggering more premium requests per unit than expected (the SDK's agentic loop counts each LLM tool-use turn), (2) SDK technical preview instability requiring strict version pinning and adapter isolation, and (3) verification retry spirals consuming 3-6× expected quota on failing tasks. All three are preventable by addressing the adapter layer and accounting middleware in Phase 1, before migrating production orchestration paths.

---

## Key Findings

### Recommended Stack

The migration adds one new primary dependency (`@github/copilot-sdk`) and reduces several others. The Copilot SDK replaces `@gsd/pi-agent-core` and `@gsd/pi-ai` for model calls routed through GitHub's infrastructure, and handles auth, model routing, retry, streaming, and MCP server integration natively. Existing Zod schemas, MCP server setup, and session persistence patterns all map directly. The Node.js 22 LTS runtime and TypeScript 5.4+ strict configuration require no changes.

**Core technologies:**
- `@github/copilot-sdk` (pinned exact version): Agent session orchestration, model routing, MCP integration — replaces Pi SDK agent loop; must be pinned due to technical preview instability
- `CopilotClient` + `session.createSession()`: Per-workflow session factory with model, tools, hooks, and BYOK config — replaces `createAgentSession()` in pi-coding-agent
- `session.sendAndWait()`: Single-call prompt → idle round-trip — replaces manual `prompt()` + `waitForIdle()` polling, eliminating wasted intermediate requests
- `defineTool()` + Zod schemas: Type-safe tool definitions — maps directly from existing `AgentTool` + TypeBox pattern with mechanical bridge
- Session hooks (`onPreToolUse`, `onPostToolUse`, `onSessionStart`, `onSessionEnd`): Tool allow-listing, telemetry, permission control — replaces `ExtensionRunner` permission checks
- BYOK provider config (`type: "openai"/"anthropic"/"azure"`): Fallback to direct API keys when quota exhausted — enables graceful degradation without halting workflows

**Premium request model tiers (authoritative, verified March 2026):**

| Multiplier | Models | Use for |
|-----------|--------|---------|
| **0×** | GPT-4.1, GPT-4o, GPT-5 mini | Discuss, confirm, plan scaffold, verify, progress checks — free |
| **0.33×** | Claude Haiku 4.5, Gemini 3 Flash, GPT-5.1-Codex-Mini | Routine code edits, test gen, file ops |
| **1×** | Claude Sonnet 4.5/4.6, Gemini 2.5/3 Pro, GPT-5.1-Codex | Architecture, complex refactor, multi-file execution |
| **3×** | Claude Opus 4.5 | Explicit user opt-in only — never auto-mode default |
| **30×** | Claude Opus 4.6 fast | Interactive user sessions only — completely blocked from automation |

**Candidates for removal after full migration:** `@anthropic-ai/sdk`, `@anthropic-ai/vertex-sdk`, `openai`, `@aws-sdk/client-bedrock-runtime` — significant dependency reduction when Copilot SDK covers all routed paths.

---

### Expected Features

**Must have (table stakes) — missing any = operational regression:**
- Session lifecycle management (create / resume / destroy per unit) — SDK `createSession` + `resumeSession` map closely to current pattern
- Custom tool registration — `defineTool()` + Zod maps existing tools with a mechanical bridge adapter
- System message customization — SDK `systemMessage: { mode: "append", content }` injects GSD's dispatch context without removing Copilot guardrails
- Streaming event handling — SDK event model maps to current `AgentSessionEvent` shape with a normalization adapter
- Multi-model session selection — `model` param on `createSession`; new session required to switch models mid-workflow
- File attachment support — `attachments: [{ type: "file", path }]` on `session.send()`
- MCP server integration — `mcpServers` config in SessionConfig; SDK manages MCP lifecycle per session
- Permission / approval handling — `approveAll` for headless auto-mode; custom `onPermissionRequest` handler for interactive mode
- Session resume + persistence — `resumeSession(sessionId)` + `client.getLastSessionId()`; must survive process restarts
- Error event handling — `session.error` events + try/catch; must map to GSD's 3-category error classification
- Auto-restart on crash — `autoRestart: true` in `CopilotClientOptions`; maps to current headless auto-restart directly
- Multiple concurrent sessions — `Promise.all([session1.send(), session2.send()])`; needs validation under parallel workstream load
- Extension-driven model registration — **High complexity**: current global model registry (15+ providers) must bridge behind per-session BYOK config; no direct SDK equivalent

**Should have (differentiators — exploit premium-request economics):**
- **Multiplier-aware model routing** — highest-leverage optimization: route all plan/discuss/verify to 0× models → zero premium cost. Maps existing Light/Standard/Heavy tiers to 0×/0.33×/1× multiplier tiers
- **Multiplier-tiered model table** — static config extending current `model-registry.ts` with `premiumRequestMultiplier` field; unlocks all routing and budget features
- **Budget accounting in premium-request units** — `premium_requests_used = prompt_count × model_multiplier` telemetry dimension; surfaces in dashboard alongside existing token/cost metrics
- **Free-tier fallback strategy** — at 100% quota, auto-route all tasks to 0× models instead of halting; extends current budget pressure logic
- **Per-workflow-stage request telemetry** — measure premium requests per stage (research, plan, execute, verify, reassess) to identify optimization targets; required by PROJECT.md active requirements
- **Hybrid runtime with feature flags** — `"copilot_sdk": { "planning": true, "execution": false }` per stage; enables incremental validation with rollback safety

**Defer:**
- **Adaptive multiplier learning** — requires telemetry data from production use first (builds on `routing-history.json`)
- **Session pooling for parallel workers** — premature optimization; validate multi-session correctness first
- **Prompt consolidation for multi-step plans** — high complexity, uncertain quality impact; measure after baseline established
- **Context pre-loading inversion** (tool calls are free, so shift to retrieval-on-demand) — architectural experiment; only after parity verified

---

### Architecture Approach

The target architecture inserts a new **Orchestration Adapter layer** directly above the existing execution mode interfaces (TUI, RPC/headless, web bridge, MCP server). All session creation flows through a `SessionBackend` interface that routes to either the Pi SDK or Copilot SDK backend at runtime. A new **Request Accounting Middleware** sits at the adapter boundary and intercepts every `session.send()` to track premium request consumption per workflow stage. Neither the CLI router, headless orchestrator, web bridge, nor extension system needs to know which backend is active — the seam is the adapter.

**Major components:**

1. **`src/adapters/`** (new) — `types.ts` (interface contract), `pi-backend.ts` (wraps existing AgentSession), `copilot-backend.ts` (wraps CopilotClient + CopilotSession), `tool-bridge.ts` (AgentTool↔defineTool adapter), `event-bridge.ts` (SessionEvent↔AgentSessionEvent mapper). This is the single migration seam — all SDK code lives here.
2. **`src/accounting/`** (new) — `request-tracker.ts` (per-workflow request counter), `model-multipliers.ts` (authoritative multiplier table), `budget-guard.ts` (pre-flight cost check before session.send()). Cross-cutting but must stay close to the adapter boundary.
3. **`CopilotBackend`** — wraps `CopilotClient` + `CopilotSession`; implements `SessionBackend` interface; handles SDK-specific session lifecycle, event normalization, tool bridging, and BYOK config injection
4. **`PiBackend`** — wraps existing `AgentSession`; implements same `SessionBackend` interface; remains functional throughout migration for rollback
5. **Event Normalization Layer** — translates Copilot SDK `SessionEvent` types into GSD `AgentSessionEvent` shape; all downstream consumers (TUI, JSONL, web SSE) continue working unchanged
6. **Tool Bridge** — converts existing `AgentTool<TSchema>` + TypeBox schema to `defineTool()` + JSON Schema format; purely mechanical, zero rewrite of tool implementations

---

### Critical Pitfalls

1. **Request multiplier explosion in auto-mode loops** — GSD auto-mode can dispatch 25+ units per milestone; at Claude Sonnet (1×) = 25 premium requests, at Opus (3×) = 75. Add a premium-request budget ceiling (`budget-guard.ts`) *before* migrating any auto-mode dispatch. Never default to 3× or 30× models in automated flows.

2. **Hidden request inflation from tool call round-trips** — The SDK's agentic loop counts each tool invocation as a separate LLM turn (= additional premium requests). One "execute-task" unit could consume 5-15 premium requests instead of 1. Restrict available tools per session type via `availableTools`/`excludedTools`. For non-agentic units (complete-slice, run-uat, reassess), exclude all tools to force single-turn response.

3. **SDK technical preview instability** — Pin `@github/copilot-sdk` to an exact version (no `^` or `~`). All SDK calls must go through the `copilot-backend.ts` adapter — never scatter raw SDK calls across dispatch modules. Add an integration test (create session → send prompt → verify response shape) to CI so breakage is detected immediately.

4. **Session-per-unit overhead** — 25+ `createSession`/`destroy` cycles per milestone adds latency and potential rate limits. Use a **single `CopilotClient`** per auto-mode run; create/destroy sessions per unit; only stop the client at run end. Measure creation latency — if >2s, consider session reuse with context-clearing prefixes.

5. **Verification retry spiral burning premium requests** — Failed verification gate retries + timeout recovery can consume 3-6× expected premium requests per unit. Add a per-unit premium-request budget check before each retry. Reduce retry count from 2→1 for non-critical units. Infrastructure errors (ENOENT, ECONNRESET) must skip immediately, never retry.

6. **Prompt cache optimization invalidation** — Do NOT port `prompt-cache-optimizer.ts` or `prompt-ordering.ts` to the SDK path. The SDK inserts its own system prompt and conversation history before GSD's content, invalidating all prefix caching assumptions. Focus on prompt size reduction instead.

7. **Model selection control loss under SDK routing** — Always set `model` explicitly in `SessionConfig` — never use `"auto"` for auto-mode dispatch (SDK may silently override). Define a within-multiplier-tier fallback chain (e.g., Sonnet 4 → Sonnet 4.5 → GPT-5.1-Codex, all at 1×) so fallbacks don't accidentally change cost tier.

8. **Auto-compaction triggering uncontrolled requests** — Copilot CLI auto-compacts at 95% context utilization; compaction is a model call (= another premium request). GSD's existing `MAX_PREAMBLE_CHARS = 30_000` is large. Default to `minimal` prompt profile for SDK execution sessions. Apply `excludedTools` to prevent unnecessary file reads that bloat context.

---

## Implications for Roadmap

### Phase 1: Adapter Layer + SDK Foundation
**Rationale:** The adapter must exist before any orchestration is migrated. It is also the isolation boundary that prevents SDK technical preview instability (Pitfall 3) from spreading. Nothing else can proceed safely without this seam.
**Delivers:** `src/adapters/` interface + Pi backend (functional), Copilot backend stub (connects to SDK, creates/destroys sessions), tool bridge, event normalization layer. End-to-end: one GSD workflow unit executes against Copilot SDK backend via feature flag.
**Addresses:** Session lifecycle management, custom tool registration, streaming event handling, permission handling (table stakes)
**Avoids:** Pitfall 3 (SDK instability), Pitfall 4 (session overhead — establishes single-client pattern)
**Research flag:** May need brief API research on `CopilotClient` connection lifecycle and stdio transport behavior

### Phase 2: Request Accounting + Model Multiplier Routing
**Rationale:** Must ship before any auto-mode orchestration is migrated to Copilot SDK. The accounting layer is the safety net for Pitfall 1 (multiplier explosion) and Pitfall 7 (retry spiral). Without it, quota can be exhausted before the migration is even complete.
**Delivers:** `src/accounting/` middleware — multiplier table, request tracker, budget guard with warn/pause/halt modes. Multiplier-tiered model table extending `model-registry.ts`. Updated complexity router routing 0×/0.33×/1× by GSD workflow stage. Premium-request budget ceiling enforced alongside USD ceiling.
**Addresses:** Multiplier-aware model routing, budget accounting in PR units (differentiators); premium-request optimization requirement from PROJECT.md
**Avoids:** Pitfall 1 (multiplier explosion), Pitfall 7 (retry spiral), Pitfall 8 (model selection control loss)
**Research flag:** Verify actual premium request counting behavior for tool-call turns in SDK agentic loop (Pitfall 2 — needs empirical measurement to tune `availableTools` strategy)

### Phase 3: Planning Workflow Migration — discuss + plan
**Rationale:** Planning workflows are the highest-leverage optimization target from PROJECT.md ("prioritize phase planning workflows first"). They use 0× models (discuss = GPT-5 mini, plan draft = GPT-5 mini, plan refine = 0.33× Codex-Mini) meaning they can run at effectively zero premium cost once migrated. This validates the adapter + accounting stack at low risk before touching execution.
**Delivers:** `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-list-phase-assumptions` running through Copilot SDK sessions. Hybrid feature flag: `"copilot_sdk": { "planning": true, "execution": false }`. Per-stage request telemetry live.
**Addresses:** Multiplier-aware model routing (planning tier = 0×), request telemetry, hybrid runtime feature
**Avoids:** Pitfall 5 (auto-compaction — planning prompts are smaller), Pitfall 6 (don't port cache optimizer)

### Phase 4: Execution Workflow Migration — execute + verify
**Rationale:** Execution is where quota is consumed: Claude Sonnet 4.5 (1×) per execute-task unit. Tool call round-trips (Pitfall 2) must be solved here — empirical measurement from Phase 2 research flag informs the `availableTools` strategy applied here.
**Delivers:** `/gsd-execute-phase` and `/gsd-verify-work` running through Copilot SDK sessions. Restricted tool sets per session type (agentic execution vs. single-turn verification). Per-unit premium-request budget checks on retries. Verification retry reduction to 1 attempt for non-critical units.
**Addresses:** All table-stakes features for execution path; prompt-count-minimizing orchestration; retry budget enforcement
**Avoids:** Pitfall 2 (tool call inflation — tool allow-listing), Pitfall 5 (auto-compaction — minimal prompt profile), Pitfall 7 (retry spiral — per-unit budget guard)

### Phase 5: Full Auto-Mode Migration + BYOK Fallback
**Rationale:** Auto-mode orchesrates all other workflows end-to-end. Only migrate after Phases 3 and 4 have validated planning and execution independently. BYOK fallback is critical here — when monthly quota is exhausted mid-run, auto-mode should continue on direct API rather than halt.
**Delivers:** Full auto-mode orchestration (`/gsd-autonomous`) on Copilot SDK backend. Free-tier fallback strategy (0× models when quota exhausted). BYOK provider config as secondary fallback (direct Anthropic/OpenAI API). Session pooling for parallel workstreams (single `CopilotClient`, multiple concurrent sessions). Retirement of Pi SDK backend behind feature flag.
**Addresses:** Free-tier fallback, session pooling (differentiators); RPC/headless mode compatibility, multiple concurrent sessions (table stakes)
**Avoids:** Pitfall 4 (session overhead — single client + session pool), Pitfall 1 (multiplier explosion — full accounting live)

### Phase Ordering Rationale

- **Adapter before migration:** The adapter layer is a prerequisite for every subsequent phase. Without it, SDK changes would scatter across the codebase.
- **Accounting before auto-mode:** The request accounting layer must precede any automatically-invoked SDK sessions. Quota exhaustion cannot be the first signal that accounting was needed.
- **Planning before execution:** Planning workflow migration validates the stack at negligible premium-request cost (0× models). Execution migration has 1× cost per unit — do planning first to prove the infrastructure.
- **Execution before full auto-mode:** Auto-mode composes planning + execution + verification. Migrate leaf workflows before the orchestrator that calls them.
- **Telemetry runs throughout:** Per-stage request telemetry must be live from Phase 2 onward to measure optimization effectiveness and catch anomalies before they exhaust quota.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Empirical tool-call round-trip premium request counting — needs actual SDK integration to measure (cannot be determined from docs alone)
- **Phase 4:** `availableTools`/`excludedTools` behavior and granularity — SDK technical preview; verify field semantics and session-level vs. client-level scoping
- **Phase 5:** BYOK fallback behavior when switching mid-session — not documented in SDK; needs integration test to verify session state is preserved

Phases with standard patterns (skip research-phase):
- **Phase 1:** Backend adapter pattern is well-established; TypeBox→JSON Schema passthrough is mechanical; existing Pi SDK well-understood
- **Phase 3:** Model selection for planning stages is static config (multiplier table from STACK.md); no algorithmic complexity
- **Phase 5 (session pooling):** Standard singleton CopilotClient + per-unit session pattern; no research needed beyond Phase 4 validation

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core SDK APIs, model multiplier table, BYOK config all verified against official GitHub docs (March 2026). SDK technical preview is the only uncertainty — mitigated by pinning and adapter isolation |
| Features | HIGH | Table stakes mapped against codebase + SDK docs. Differentiators derived from verified billing model. Extension-driven model registration (15+ providers) rated HIGH complexity but well-scoped |
| Architecture | MEDIUM-HIGH | Adapter + accounting structure is sound and well-precedented. Actual performance characteristics (session creation latency, tool call round-trip count) require empirical measurement once integration exists |
| Pitfalls | MEDIUM-HIGH | 7 of 8 pitfalls derived from SDK docs + verified billing model. Pitfall 2 (tool call round-trips) quantified from community reports — needs own measurement in Phase 2 |

**Overall confidence:** HIGH for approach and stack; MEDIUM for specific performance bounds (session latency, tool call overhead) — these are empirically determined risks with clear measurement triggers.

### Gaps to Address

- **Tool call premium request counting (Pitfall 2):** Exact count of premium requests consumed per agentic tool-use loop is not precisely documented. Community report of 5-15× is a range. Phase 2 must include a measurement task: dispatch a representative execute-task unit, count emitted `tool.executionStart` events, correlate against billing. This determines whether `availableTools` restriction is sufficient or if a more aggressive single-turn pattern is needed for execution units.
- **Extension-driven model registration bridge:** Current GSD system has 15+ providers registered globally via `pi.registerProvider()`. Copilot SDK BYOK is per-session only. How to bridge the global registry to per-session config without breaking extension contracts needs design attention in Phase 1 — the adapter interface should expose a provider config injection mechanism.
- **Session resume across process restarts:** SDK `resumeSession(sessionId)` is documented but whether session artifacts survive OS-level process termination (not just SDK crash) is unverified. The existing Pi SDK's file-backed session state has known persistence semantics. Phase 1 adapter should include an integration test for this boundary case.
- **Copilot CLI auto-compaction observability:** There is no documented way to monitor context utilization before compaction triggers from within the SDK. Proactive mitigation (minimal prompt profiles) is the only lever available; reactive detection relies on recognizing compaction-summary response patterns in event streams.

---

## Sources

**From STACK.md:**
- [GitHub Copilot supported AI models — multiplier table](https://docs.github.com/copilot/reference/ai-models/supported-models) — HIGH confidence
- [Requests in GitHub Copilot — billing model](https://docs.github.com/en/copilot/concepts/billing/copilot-requests) — HIGH confidence
- [Copilot SDK getting started](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started) — HIGH confidence
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — SDK API reference in repo — HIGH confidence

**From FEATURES.md:**
- [Agent mode billing — prompts only, tool calls free](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide?tool=vscode) — HIGH confidence
- GSD 2 internal: `packages/pi-ai/src/`, `packages/pi-coding-agent/src/core/model-registry.ts`, `docs/token-optimization.md`, `docs/cost-management.md`, `docs/dynamic-model-routing.md`

**From ARCHITECTURE.md:**
- GSD 2 internal: `src/cli.ts`, `packages/pi-coding-agent/src/core/agent-session.ts`, `@gsd/pi-agent-core`, `@gsd/pi-ai`, `src/mcp-server.ts` — verified via codebase

**From PITFALLS.md:**
- GitHub Discussion #187486 — community report on tool call premium request counting — MEDIUM confidence
- GSD 2 internal: `auto-prompts.ts` (`MAX_PREAMBLE_CHARS = 30_000`), `auto-verification.ts`, `auto-timeout-recovery.ts`, `auto-model-selection.ts`, `complexity-classifier.ts`, `model-router.ts`, `context-budget.ts`, `prompt-cache-optimizer.ts`, `prompt-ordering.ts` — verified via codebase
