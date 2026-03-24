# Feature Landscape

**Domain:** Coding agent framework migration — Pi SDK to GitHub Copilot SDK with premium-request quota optimization
**Researched:** 2026-03-24

## Table Stakes

Features users expect for parity-preserving migration. Missing any of these = operational regression.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session lifecycle management | GSD dispatches fresh sessions per work unit; must create/resume/destroy sessions programmatically | Med | SDK provides `createSession`, `resumeSession`, `session.destroy`. Maps closely to current `createAgentSession()` in pi-coding-agent |
| Custom tool registration | Extensions/skills register tools dynamically — core workflow mechanism | Low | SDK `defineTool` with Zod schemas maps directly. Tool return supports `ToolResultObject` with success/failure metadata |
| System message customization | GSD injects context-rich dispatch prompts (task plan, prior summaries, roadmap excerpt) per unit | Low | SDK `systemMessage: { mode: "append", content }` preserves guardrails. Replace mode available for full control |
| Streaming event handling | TUI and web frontends consume token-by-token output | Low | SDK event model (`assistant.message.delta`, `session.idle`, etc.) maps to current `AgentSessionEvent` stream |
| Multi-model session selection | Users switch models mid-workflow; auto mode assigns models per-phase | Med | SDK `model` param on `createSession`. Per-session model selection, not per-client. Must create new session to switch models |
| File attachment support | Dispatch prompts reference workspace files for context | Low | SDK `attachments: [{ type: "file", path, displayName }]` on `session.send()` |
| MCP server integration | GSD already serves as MCP server; SDK sessions need to consume MCP tools | Med | SDK `mcpServers` in SessionConfig. Supports local and remote MCP servers |
| Permission/approval handling | Auto mode needs non-interactive tool approval for headless execution | Low | SDK `onPermissionRequest: approveAll` for headless. Custom handlers for interactive mode |
| Session resume and persistence | Crash recovery requires resuming sessions from saved state | Med | SDK `resumeSession(sessionId, config)` + `client.getLastSessionId()`. Must verify session artifacts survive across process restarts |
| Error event handling | Provider errors (rate limits, 5xx, auth) must surface for current recovery logic | Med | SDK `session.error` events + try/catch on session operations. Must map to GSD's 3-category error classification (rate limit / server / permanent) |
| RPC/headless mode compatibility | Auto mode, web bridge, and headless orchestration all use RPC subprocess pattern | High | SDK `CopilotClient` uses stdio transport by default. `useStdio: true` aligns with current RPC, but must validate subprocess spawning and signal handling |
| Multiple concurrent sessions | Parallel milestone workers each need independent sessions | Med | SDK supports `Promise.all([session1.send(), session2.send()])`. Must validate resource isolation under concurrent load |
| Extension-driven model registration | Extensions register custom providers via `pi.registerProvider()` | High | SDK BYOK `provider: { type, baseUrl, apiKey }` per-session only. Current system has global model registry with 15+ providers — must bridge or adapt |
| Context compaction | Long sessions need history compression to stay within token limits | Low | Copilot CLI auto-compacts at 95% context usage. Verify SDK sessions inherit this behavior or implement wrapper |
| Auto-restart on crash | Headless auto mode restarts with exponential backoff on session crash | Med | SDK `autoRestart: true` in CopilotClientOptions. Maps directly to current headless auto-restart. Verify backoff behavior matches |

## Differentiators

Features that exploit premium-request economics for efficiency. Not expected from a naive port, but high-value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multiplier-aware model routing | Route tasks to 0x-multiplier models (GPT-4.1, GPT-5 mini) for simple work — zero premium-request cost on paid plans | Med | **Highest-leverage optimization.** Current dynamic routing tiers (Light/Standard/Heavy) map to multiplier tiers (0x→0.33x→1x→3x). Simple tasks on GPT-4.1 = free. [Source: docs.github.com/copilot/reference/ai-models/supported-models — HIGH confidence] |
| Multiplier-tiered model table | Extend current cost table with premium-request multiplier column: 0x (GPT-4.1, GPT-4o, GPT-5 mini), 0.33x (Haiku 4.5, Gemini 3 Flash, Codex-Mini), 1x (Sonnet 4.x, Gemini Pro, GPT-5.x), 3x (Opus 4.5/4.6), 30x (Opus 4.6 fast) | Low | Static configuration. Enables budget pressure to optimize for multiplier, not just dollar cost |
| Prompt-count-minimizing orchestration | Agent-mode billing counts only user prompts — tool calls and follow-ups are FREE. Restructure dispatch to maximize work done per prompt | High | **Architecture-level change.** Current pattern (1 fresh session per task) is already close to optimal: 1 prompt = 1 premium request × multiplier. But verification loops that re-prompt burn quota |
| Budget accounting in premium-request units | Track spend in premium requests (not just USD) so users see quota consumption directly | Med | New telemetry dimension. `premium_requests_used = prompt_count × model_multiplier`. Surfaces in dashboard alongside existing token/cost metrics |
| Auto model selection discount | Copilot offers 10% multiplier discount when auto model selection is used in VS Code | Low | Pass-through optimization. When running inside VS Code Copilot Chat, leverage auto model selection where possible [Source: docs.github.com/copilot/concepts/billing/copilot-requests — HIGH confidence] |
| Free-tier fallback strategy | When premium quota is exhausted, fall back to 0x-multiplier models (GPT-4.1/4o/5-mini) automatically — maintains functionality at zero additional cost | Med | Extends current budget pressure logic. At 100% quota: all tasks route to free models instead of halting |
| Prompt consolidation for multi-step plans | Combine sequential verification prompts into single compound prompts to reduce premium-request count | High | Must preserve output quality. Risk: overly complex prompts may produce worse results than focused ones |
| Context pre-loading yield maximization | Current dispatch prompts inline context (plans, summaries, decisions) to avoid tool-call exploration. Since tool calls don't cost premium requests, reconsider the balance | Med | **Inversion opportunity.** Under Pi SDK, inlining saved token cost. Under Copilot SDK, tool calls are free — could shift context loading to retrieval-on-demand pattern. But increases latency |
| Per-workflow-stage request telemetry | Measure premium requests consumed per stage (research, planning, execution, completion, reassessment) to identify optimization targets | Med | Extends current `metrics.json`. Required by PROJECT.md active requirements. Enables data-driven routing improvements |
| Adaptive multiplier learning | Extend current routing history to track which models at which multiplier tiers succeed for which task types, then route accordingly | Med | Builds on existing `routing-history.json`. Add `multiplier` field to outcome tracking. Target: minimize total multiplier cost for equivalent success rate |
| Hybrid runtime with progressive migration | Run Copilot SDK sessions alongside existing Pi SDK sessions during transition. Route specific workflow stages to SDK while legacy handles the rest | High | PROJECT.md explicitly requires hybrid transition. Feature flag per-stage: `"copilot_sdk": { "planning": true, "execution": false }`. Enables incremental validation |
| Session pooling for parallel workers | Pre-warm Copilot SDK sessions for parallel milestone workers to reduce cold-start latency | Med | `CopilotClient` supports multiple concurrent sessions from one client. Pool pattern: maintain N warm sessions, assign to workers on demand |

## Anti-Features

Features to explicitly NOT build. Would burn quota, cause regression, or waste engineering effort.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Conversational multi-turn within single work units | Each follow-up prompt in a session costs another premium request × multiplier. Multi-turn chat for a single task burns quota linearly | Keep current pattern: one focused prompt per dispatch unit. Maximize first-prompt success rate via rich context injection |
| Aggressive retry-on-failure without model downgrade | Retrying the same prompt at the same model tier doubles premium-request cost with no structural improvement | Maintain current escalate_on_failure: retry at different tier. On Copilot SDK, retry at lower-multiplier model first (e.g., 3x → 1x → 0x) |
| Opus 4.6 fast mode for any automated workflow | 30x multiplier means one prompt costs 30 premium requests. Entire monthly quota could be consumed in ~10 prompts | Restrict to explicit user-initiated interactive sessions only. Never route auto mode to 30x models |
| Real-time model discovery via SDK | Current system has dynamic model discovery for 15+ providers. Copilot SDK model list is fixed by GitHub plan | Use static multiplier table. Model availability is determined by Copilot plan tier, not runtime discovery |
| Full system message replacement in production | SDK `mode: "replace"` removes Copilot guardrails. May produce unexpected behavior or policy violations | Use `mode: "append"` for production. Reserve "replace" for isolated testing only |
| Migrating all providers simultaneously | GSD supports Anthropic, OpenAI, Google, Bedrock, Vertex, Mistral, etc. via direct API. Copilot SDK routes through GitHub's infrastructure | Migrate Copilot-routed models first (those in the multiplier table). Keep direct-API providers as fallback via existing pi-ai layer. Dual-runtime is the correct architecture |
| Removing budget ceiling enforcement | Premium request quotas are hard limits — can't be managed purely by hope | Extend budget ceiling to track premium requests as unit of account. USD ceiling alongside request ceiling |
| Exposing raw Copilot SDK primitives to extensions | Extensions currently use `pi.registerProvider()` API. Leaking SDK internals creates coupling | Maintain current `ProviderConfigInput` interface as abstraction layer. Map Copilot SDK calls behind it |
| Over-inlining context when tool calls are free | Under Copilot billing, tool calls don't consume premium requests. Stuffing everything into system message wastes context window for no cost benefit | Adopt balanced approach: inline critical context (task plan, dependencies), let agent retrieve supplementary context via tools. Reduces prompt size, preserves reasoning bandwidth |

## Feature Dependencies

```
Multiplier-aware model routing → Multiplier-tiered model table (needs rate data)
Budget accounting in PR units → Multiplier-tiered model table (needs multiplier values)
Free-tier fallback strategy → Multiplier-aware model routing (routes to 0x models)
Free-tier fallback strategy → Budget accounting in PR units (needs threshold detection)
Hybrid runtime → Session lifecycle management (needs SDK sessions working)
Hybrid runtime → Extension-driven model registration (needs provider bridge)
Per-workflow-stage telemetry → Budget accounting in PR units (needs request counting)
Adaptive multiplier learning → Per-workflow-stage telemetry (needs outcome data)
Prompt consolidation → Context pre-loading yield maximization (related optimization axis)
Session pooling → Multiple concurrent sessions (needs multi-session working first)
```

## MVP Recommendation

Prioritize:
1. **Session lifecycle management + custom tools** — enables first end-to-end Copilot SDK workflow
2. **Multiplier-tiered model table** — static config, unlocks all routing optimizations
3. **Multiplier-aware model routing** — highest-leverage efficiency gain (routes simple tasks to 0x = free)
4. **Hybrid runtime** — enables incremental migration with rollback safety
5. **Budget accounting in premium-request units** — makes quota visible to users

Defer:
- **Prompt consolidation** — high complexity, uncertain quality impact, optimize after baseline established
- **Adaptive multiplier learning** — requires telemetry data from production use first
- **Session pooling** — premature optimization until parallel workers are validated on SDK
- **Context pre-loading inversion** — requires careful quality benchmarking, only after parity achieved

## Sources

- [GitHub Copilot supported AI models — multiplier table](https://docs.github.com/copilot/reference/ai-models/supported-models) — HIGH confidence
- [Requests in GitHub Copilot — billing model](https://docs.github.com/en/copilot/concepts/billing/copilot-requests) — HIGH confidence
- [Agent mode billing — prompts only, tool calls free](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide?tool=vscode) — HIGH confidence
- [Copilot SDK getting started](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started) — HIGH confidence
- [GitHub Copilot CLI auto-compaction](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) — HIGH confidence
- GSD 2 internal: `packages/pi-ai/src/` (model registry, provider abstraction) — verified via codebase
- GSD 2 internal: `packages/pi-coding-agent/src/core/model-registry.ts` (dynamic model registration) — verified via codebase
- GSD 2 internal: `docs/token-optimization.md`, `docs/cost-management.md`, `docs/dynamic-model-routing.md` — verified via codebase
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — SDK API reference in repo — HIGH confidence
