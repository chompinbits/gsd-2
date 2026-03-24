# Architecture Research: Copilot SDK Migration

**Domain:** CLI agent runtime migration (Pi SDK → GitHub Copilot SDK)
**Researched:** 2026-03-24
**Confidence:** MEDIUM — SDK is in technical preview; premium request accounting details verified against GitHub docs

## System Overview

### Current Architecture (Pi SDK)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Entry / CLI Router                              │
│  src/loader.ts → src/cli.ts                                          │
│  (env setup, arg parse, mode detection)                              │
├──────────────────────────────────────────────────────────────────────┤
│          ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│          │Interactive│  │  RPC /   │  │   Web    │  │   MCP    │     │
│          │  (TUI)   │  │ Headless │  │  Bridge  │  │  Server  │     │
│          └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│               │             │             │             │            │
├───────────────┴─────────────┴─────────────┴─────────────┴────────────┤
│                   @gsd/pi-coding-agent                                │
│  AgentSession · ExtensionRunner · Tool Registry · Session Manager    │
├──────────────────────────────────────────────────────────────────────┤
│                     @gsd/pi-agent-core                               │
│  Agent loop · Tool execution (sequential/parallel) · Stream fn       │
├──────────────────────────────────────────────────────────────────────┤
│                        @gsd/pi-ai                                    │
│  Model providers (Anthropic, OpenAI, Google, etc.) · OAuth · Stream  │
├──────────────────────────────────────────────────────────────────────┤
│               Extension / Resource Layer                             │
│  Skills · Custom tools · Extension factories · Dynamic loading       │
└──────────────────────────────────────────────────────────────────────┘
```

### Target Architecture (Copilot SDK Hybrid)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Entry / CLI Router                              │
│  src/loader.ts → src/cli.ts  (unchanged interface)                   │
├──────────────────────────────────────────────────────────────────────┤
│          ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│          │Interactive│  │  RPC /   │  │   Web    │  │   MCP    │     │
│          │  (TUI)   │  │ Headless │  │  Bridge  │  │  Server  │     │
│          └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│               │             │             │             │            │
├───────────────┴─────────────┴─────────────┴─────────────┴────────────┤
│              Orchestration Adapter (NEW BOUNDARY)                     │
│  ┌─────────────────────────┐  ┌─────────────────────────┐           │
│  │   Pi SDK Backend        │  │  Copilot SDK Backend     │           │
│  │  (existing, retained    │  │  CopilotClient           │           │
│  │   for hybrid rollback)  │  │  CopilotSession          │           │
│  │  AgentSession            │  │  defineTool() adapters   │           │
│  │  @gsd/pi-agent-core      │  │  Event → GSD event map   │           │
│  └─────────────────────────┘  └─────────────────────────┘           │
│                                                                      │
│         ┌──────────────────────────────────────────┐                 │
│         │   Request Accounting Middleware (NEW)     │                 │
│         │   Tracks premium requests per workflow    │                 │
│         │   Model multiplier awareness             │                 │
│         └──────────────────────────────────────────┘                 │
├──────────────────────────────────────────────────────────────────────┤
│               Extension / Resource Layer  (unchanged)                │
│  Skills · Custom tools · Extension factories                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current Implementation |
|-----------|----------------|------------------------|
| CLI Router | Arg parse, mode detect, delegate to execution mode | `src/cli.ts` — stable, no migration needed |
| Interactive Mode | TUI rendering, key handling, user input | `@gsd/pi-tui` + `InteractiveMode` — wraps session |
| RPC/Headless | Subprocess spawn, JSONL events, auto-respond | `src/headless.ts` + `RpcClient` — wraps session |
| Web Bridge | HTTP↔RPC relay, session browser, service layer | `src/web/bridge-service.ts` — wraps RPC child |
| MCP Server | External AI client tool exposure | `src/mcp-server.ts` — wraps tool registry |
| AgentSession | Conversation state, tool dispatch, compaction | `packages/pi-coding-agent/src/core/agent-session.ts` |
| Agent Loop | Model call → tool call → response cycle | `@gsd/pi-agent-core` Agent class |
| Model Providers | API auth, streaming, token counting | `@gsd/pi-ai` providers |
| Extension System | Pluggable commands, tools, UI handlers | `ExtensionRunner` + `extension-discovery.ts` |
| **Orchestration Adapter (NEW)** | Backend-agnostic session interface; routes to Pi or Copilot | To be created |
| **Request Accounting (NEW)** | Track premium request consumption per workflow stage | To be created |

## Recommended Migration Structure

### New Packages / Modules

```
src/
├── adapters/                    # NEW: Backend adapter layer
│   ├── types.ts                 # SessionBackend interface contract
│   ├── pi-backend.ts            # Wraps existing AgentSession
│   ├── copilot-backend.ts       # Wraps CopilotClient + CopilotSession
│   ├── tool-bridge.ts           # AgentTool ↔ defineTool() adapter
│   └── event-bridge.ts          # SessionEvent ↔ AgentSessionEvent mapper
├── accounting/                  # NEW: Premium request tracking
│   ├── request-tracker.ts       # Per-workflow request counter
│   ├── model-multipliers.ts     # Known multiplier table
│   └── budget-guard.ts          # Pre-flight cost check before session.send()
├── cli.ts                       # MODIFIED: backend selection flag
├── headless.ts                  # MODIFIED: pass backend choice through
└── ...                          # Existing unchanged modules
```

### Structure Rationale

- **adapters/:** Isolates all SDK-specific code behind a shared interface. Neither the CLI router, headless orchestrator, web bridge, nor extension system needs to know which backend is active. This is the single migration seam.
- **accounting/:** Premium request awareness is cross-cutting but must live close to the adapter boundary because it needs to intercept every `session.send()`. Separate from adapters to allow accounting even against the Pi backend (for dry-run comparison).

## Architectural Patterns

### Pattern 1: Backend Adapter with Runtime Selection

**What:** A `SessionBackend` interface that abstracts the differences between Pi SDK's `AgentSession` and Copilot SDK's `CopilotClient`+`CopilotSession`. A factory selects the backend at startup based on configuration or CLI flag.

**When to use:** Always — this is the core migration strategy. Every execution mode (TUI, RPC, Web, MCP) creates sessions through this adapter.

**Trade-offs:**
- Pro: Enables hybrid rollback — switch back to Pi with a flag
- Pro: Existing tests continue passing against Pi backend
- Con: Adapter layer adds indirection; must be thin to avoid overhead
- Con: Feature drift between backends requires parity testing

**Example:**
```typescript
// adapters/types.ts
export interface SessionBackend {
  createSession(opts: BackendSessionOptions): Promise<BackendSession>;
  resumeSession(id: string, opts: BackendSessionOptions): Promise<BackendSession>;
  destroy(): Promise<void>;
}

export interface BackendSession {
  readonly id: string;
  send(prompt: string, attachments?: Attachment[]): Promise<void>;
  sendAndWait(prompt: string, timeoutMs?: number): Promise<string | null>;
  onEvent(handler: (event: NormalizedEvent) => void): () => void;
  abort(): Promise<void>;
  destroy(): Promise<void>;
}

// Factory
export function createBackend(config: { type: 'pi' | 'copilot' }): SessionBackend {
  if (config.type === 'copilot') return new CopilotBackend();
  return new PiBackend();
}
```

### Pattern 2: Tool Bridge (AgentTool ↔ defineTool)

**What:** GSD tools are defined as `AgentTool<TSchema>` with TypeBox schemas and `execute(toolCallId, args, signal, onUpdate)` signatures. Copilot SDK expects `defineTool({ name, description, parameters, handler })` with JSON Schema or Zod. The bridge converts between these.

**When to use:** When the Copilot backend is active. All existing GSD tools (read, write, edit, bash, grep, find, ls) plus extension-registered custom tools must work through the bridge.

**Trade-offs:**
- Pro: Zero rewrite of existing tools — bridge is purely mechanical
- Pro: TypeBox schemas already compile to JSON Schema; direct passthrough
- Con: `onUpdate` streaming callbacks from GSD tools have no direct Copilot SDK equivalent; must be buffered or dropped
- Con: Tool permission model differs — Copilot SDK uses `onPermissionRequest` at session level vs. GSD's per-extension model

**Example:**
```typescript
// adapters/tool-bridge.ts
import { defineTool } from '@github/copilot-sdk';
import type { AgentTool } from '@gsd/pi-agent-core';

export function bridgeTool(gsdTool: AgentTool<any>): ReturnType<typeof defineTool> {
  return defineTool({
    name: gsdTool.name,
    description: gsdTool.description,
    parameters: gsdTool.parameters,  // TypeBox → JSON Schema is passthrough
    handler: async (args) => {
      const result = await gsdTool.execute('copilot-call', args);
      // Map GSD content array to Copilot textResultForLlm
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      return { textResultForLlm: text, resultType: 'success' };
    },
  });
}
```

### Pattern 3: Event Normalization Layer

**What:** GSD's `AgentSessionEvent` is a discriminated union covering turn lifecycle, tool execution, extension events, compaction, and session state changes. Copilot SDK emits `SessionEvent` types (`assistant.message`, `tool.executionStart`, `session.idle`, etc.). The event bridge normalizes Copilot events into the GSD event shape so downstream consumers (TUI, RPC JSONL, web bridge) continue working unchanged.

**When to use:** When Copilot backend is active. All existing event consumers — TUI rendering, JSONL streaming, web SSE — subscribe to GSD-shaped events.

**Trade-offs:**
- Pro: Zero rewrite of presentation layer
- Con: Some GSD events have no Copilot SDK equivalent (e.g., compaction events, extension errors); these become backend-specific
- Con: Streaming deltas (`assistant.message.delta`) need mapping to GSD's `MessageUpdateEvent`

### Pattern 4: Request Accounting Middleware

**What:** A middleware that wraps `session.send()` to track premium request consumption. Uses model multiplier tables to estimate cost before sending and records actual consumption after session.idle.

**When to use:** Always when Copilot backend is active. Critical for GSD's autonomous workflows where a single `/gsd-autonomous` run can chain 10+ phases, each with multiple model turns.

**Trade-offs:**
- Pro: Enables budget-aware workflow decisions (pause before exceeding quota)
- Pro: Telemetry for request-efficiency optimization
- Con: Multiplier tables must be maintained as GitHub updates them
- Con: Exact accounting is impossible client-side; GitHub tracks server-side

## Data Flow

### Request Flow (Copilot Backend)

```
┌──────────────────────────────────────────────────────────────┐
│ User Action (TUI input / RPC command / Web prompt)           │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Execution Mode (Interactive / Headless / Bridge)              │
│ Calls: backend.send(prompt, attachments)                      │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Request Accounting Middleware                                  │
│ 1. Look up model multiplier                                   │
│ 2. Check remaining budget (optional guard)                    │
│ 3. Record: { workflow, phase, timestamp, estimatedCost }      │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Copilot Backend Adapter                                       │
│ 1. copilotSession.send({ prompt, attachments })               │
│ 2. Wait for events via session.on(handler)                    │
│ 3. On tool.executionStart → dispatch to bridged GSD tool      │
│ 4. Tool result → automatic return to Copilot CLI              │
│ 5. On session.idle → resolve send()                           │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Event Bridge                                                  │
│ Copilot SessionEvent → GSD AgentSessionEvent                  │
│ assistant.message → MessageEndEvent                           │
│ assistant.message.delta → MessageUpdateEvent                  │
│ tool.executionStart → ToolExecutionStartEvent                 │
│ tool.executionComplete → ToolExecutionEndEvent                │
│ session.idle → TurnEndEvent                                   │
│ session.error → error emission                                │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ Presentation Layer (unchanged)                                │
│ TUI renderer / JSONL stderr / Web SSE / MCP response          │
└───────────────────────────────────────────────────────────────┘
```

### Premium Request Accounting Points

| Point | What's Tracked | Where |
|-------|---------------|-------|
| **Pre-send** | Model multiplier × 1 = estimated premium cost | `accounting/budget-guard.ts` |
| **Post-idle** | Actual turn count, cumulative cost for workflow | `accounting/request-tracker.ts` |
| **Workflow boundary** | Total requests per phase/milestone | Written to `.planning/` artifacts |
| **Session summary** | Aggregate request efficiency metrics | Extension or post-session hook |

### State Management

```
┌─────────────────────────────────┐
│ Session State                   │
│ (conversation, tools, model)    │
│                                 │
│  Pi Backend: SessionManager     │  ← file-based JSON entries
│  Copilot Backend: SDK-managed   │  ← Copilot CLI persistent sessions
│                                 │
│  Shared: .planning/ artifacts   │  ← workflow state (unchanged)
└─────────────────────────────────┘
```

**Critical difference:** Pi SDK session management is fully GSD-controlled (file-based entries in `~/.gsd/agent/sessions/`). Copilot SDK manages its own session persistence internally. The adapter must reconcile these by:
1. Using Copilot `sessionId` as the primary key when Copilot backend is active
2. Maintaining a thin mapping file (`session-map.json`) linking GSD session paths to Copilot session IDs
3. Deferring to Copilot SDK for `resumeSession()` rather than replaying entries

## Migration Build Order

Build order is sequenced to maintain a working system at every step. Each step is independently deployable and rollback-safe.

### Phase 1: Adapter Interface + Pi Backend (Foundation)

**Build:** `adapters/types.ts`, `adapters/pi-backend.ts`
**What:** Define `SessionBackend` and `BackendSession` interfaces. Implement `PiBackend` that wraps the existing `createAgentSession()` + `AgentSession`. Wire one execution mode (headless/RPC first — simplest, no TUI) to use the adapter.
**Rollback:** Revert to direct `createAgentSession()` calls — zero behavioral change.
**Validates:** Interface design is sufficient. No regressions in headless flows.

### Phase 2: Tool Bridge

**Build:** `adapters/tool-bridge.ts`
**What:** Implement `bridgeTool()` that converts `AgentTool<TSchema>` → Copilot `defineTool()`. Test with all 7 built-in tools (read, write, edit, bash, grep, find, ls) + at least one custom extension tool.
**Rollback:** Bridge is only called when Copilot backend is selected; Pi backend ignores it.
**Validates:** Schema conversion, argument passing, result mapping, abort signal propagation.

### Phase 3: Event Bridge

**Build:** `adapters/event-bridge.ts`
**What:** Map Copilot `SessionEvent` types to GSD `AgentSessionEvent` types. Handle streaming deltas, tool lifecycle, session state changes. Stub events that have no Copilot equivalent (compaction, extension errors).
**Rollback:** Event bridge is backend-specific; removing it falls back to Pi event stream.
**Validates:** TUI rendering, JSONL headless output, web bridge SSE all work off normalized events.

### Phase 4: Copilot Backend + Hybrid Switch

**Build:** `adapters/copilot-backend.ts`, factory in `adapters/types.ts`, CLI flag `--backend copilot`
**What:** Implement `CopilotBackend` wrapping `CopilotClient` + `CopilotSession`. Connect tool bridge and event bridge. Add `--backend copilot|pi` CLI flag (default: `pi`). Wire all four execution modes through the adapter.
**Rollback:** Default is `pi` — existing behavior is default. `--backend copilot` is opt-in.
**Validates:** Full E2E: user prompt → model call → tool calls → response → session persistence.

### Phase 5: Request Accounting

**Build:** `accounting/request-tracker.ts`, `accounting/model-multipliers.ts`, `accounting/budget-guard.ts`
**What:** Wrap `BackendSession.send()` with accounting middleware. Track per-workflow premium request estimates. Emit accounting data as extension events. Optional budget guard that warns/blocks before exceeding configured threshold.
**Rollback:** Accounting is additive — removing it doesn't affect session behavior.
**Validates:** Cost visibility per phase, per workflow. Budget guard respects configured limits.

### Phase 6: Session Management Reconciliation

**Build:** Session mapping between GSD file-based sessions and Copilot SDK sessions.
**What:** Implement `session-map.json` linking GSD session identifiers to Copilot session IDs. Handle `resumeSession()` correctly for both backends. Ensure `gsd sessions` list and resume work across backend switches.
**Rollback:** If Copilot session management proves incompatible, fall back to Pi's file-based system.
**Validates:** Session resume, session list, session fork all work with Copilot backend.

### Phase 7: Default Flip + Pi Backend Deprecation Path

**Build:** Change default from `pi` to `copilot`. Add deprecation warning for `--backend pi`.
**What:** Only after all execution modes are validated with Copilot backend. Keep Pi backend available for at least one milestone cycle.
**Rollback:** Flip default back to `pi`.
**Validates:** Production usage across real workflows without regressions.

## Anti-Patterns

### Anti-Pattern 1: Big-Bang Backend Swap

**What people do:** Replace all `createAgentSession()` calls with `CopilotClient` calls in one shot.
**Why it's wrong:** Breaks all execution modes simultaneously. No rollback path. Session management divergence causes data loss.
**Do this instead:** Backend adapter with runtime flag. Migrate one execution mode at a time (headless → TUI → web → MCP).

### Anti-Pattern 2: Dual-Writing Events to Both Shapes

**What people do:** Emit both GSD events and Copilot events everywhere, let consumers pick.
**Why it's wrong:** Doubles event surface area, creates subtle inconsistencies, forces all consumers to handle both shapes.
**Do this instead:** Single normalized event shape (GSD's existing `AgentSessionEvent`). Event bridge translates at the adapter boundary.

### Anti-Pattern 3: Ignoring Model Multipliers

**What people do:** Treat all premium requests as equal (1:1 cost).
**Why it's wrong:** Claude Opus 4.5 costs 3× per prompt. An autonomous workflow using 10 turns at 3× = 30 premium requests, not 10. Budget calculations are wildly inaccurate.
**Do this instead:** Multiplier-aware accounting from day one. Use model-specific multiplier table; default to 1× for unknown models.

### Anti-Pattern 4: Reimplementing Session Persistence

**What people do:** Build custom session save/restore on top of Copilot SDK.
**Why it's wrong:** Copilot SDK manages its own session persistence. Duplicating it creates conflicts, stale state, and resume failures.
**Do this instead:** Delegate session persistence to Copilot SDK when Copilot backend is active. Map GSD session IDs to Copilot session IDs.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Copilot CLI process | `CopilotClient` spawns/manages it. Uses stdio or TCP transport | SDK handles lifecycle. `autoRestart: true` handles crashes. Set `cwd` to project directory |
| GitHub auth | Copilot CLI handles auth via `gh` CLI or Copilot token | Different from Pi's `AuthStorage` + OAuth flow. Migration must handle auth transition |
| Model selection | `SessionConfig.model` string (`"gpt-5"`, `"claude-sonnet-4.5"`) | Simpler than Pi's `ModelRegistry` — just a model name string |
| Premium request API | No client-side API; estimate from multiplier tables | Cannot query exact remaining quota programmatically |

### Internal Boundaries

| Boundary | Communication | Migration Impact |
|----------|---------------|-----------------|
| CLI Router ↔ Session | Function call (`createAgentSession()`) | Changes to: `backend.createSession()` via adapter |
| Session ↔ Tools | `AgentTool.execute()` | Unchanged for Pi; bridged for Copilot via `tool-bridge.ts` |
| Session ↔ Extensions | `ExtensionRunner` events + tool registration | Extension tools go through `tool-bridge.ts`; extension events stay GSD-native |
| Headless ↔ RPC Child | JSON-RPC over stdio | No change — RPC child internally uses whichever backend is configured |
| Web Bridge ↔ RPC | Same JSON-RPC protocol | No change — bridge is transport-level, backend-agnostic |
| MCP Server ↔ Tools | `McpToolDef` interface | Wraps `AgentTool` — unaffected by backend choice; tools remain GSD-native |

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Copilot SDK breaking changes (technical preview) | HIGH | Pin SDK version. Adapter boundary absorbs API changes. Run CI against both backends |
| Session persistence format incompatibility | MEDIUM | Thin session mapping layer. Don't assume Copilot stores in same format as Pi |
| Tool `onUpdate` streaming lost in bridge | LOW | Buffer updates and include in final result text. Most tools don't use `onUpdate` |
| Extension permission model mismatch | MEDIUM | Use `approveAll` for Copilot sessions (GSD already handles permission at extension level). Document the divergence |
| Model multiplier table going stale | MEDIUM | Maintain as config, not hardcoded. Log warnings when unknown model is used |
| Premium quota exhaustion during autonomous workflows | HIGH | Budget guard with configurable threshold. Warn at 80% estimated consumption. Allow user override |
| Auth transition (Pi OAuth → Copilot CLI auth) | MEDIUM | Support both auth methods during hybrid period. Detect which is available at startup |
| Compaction not available via Copilot SDK | MEDIUM | Copilot SDK manages context internally. If compaction control is needed, remain on Pi backend for those workflows |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 developer / 300 requests/mo (Pro) | Budget guard essential. Prefer included models (GPT-4.1, GPT-4o) for low-value turns. Reserve premium models for planning phases |
| Small team / 300 per seat (Business) | Per-seat accounting. Headless workflows should use cheapest viable model. Multiplier awareness critical |
| Heavy usage / 1500 requests/mo (Pro+) | Request telemetry per workflow stage. Identify and optimize most expensive phases. Auto-model-routing: use included models for tool-heavy turns, premium for reasoning |

## Sources

- GitHub Docs — Premium request billing: https://docs.github.com/en/copilot/concepts/billing/copilot-requests (HIGH confidence — official docs, verified 2026-03-24)
- Copilot SDK repo: https://github.com/github/copilot-sdk (HIGH confidence — source code)
- Copilot SDK Node.js instructions: `.github/instructions/copilot-sdk-nodejs.instructions.md` in this repo (HIGH confidence — maintained locally)
- GSD 2 codebase architecture: `.planning/codebase/ARCHITECTURE.md` (HIGH confidence — first-party analysis)
- GitHub community discussions on premium request multipliers (MEDIUM confidence — user reports, corroborated by official docs)

---
*Architecture research for: GSD 2 Copilot SDK Migration*
*Researched: 2026-03-24*
