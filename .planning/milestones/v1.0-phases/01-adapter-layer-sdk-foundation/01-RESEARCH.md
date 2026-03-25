# Phase 1 Research: Adapter Layer + SDK Foundation

**Researched:** 2026-03-24
**Phase:** 01-adapter-layer-sdk-foundation
**Requirements:** RUNT-01, RUNT-02, RUNT-03, TOOL-01, SAFE-01

## Domain

Build a backend adapter layer that allows GSD sessions to run on either the existing Pi SDK runtime or the GitHub Copilot SDK (`@github/copilot-sdk`), selected via configuration. Preserve all existing consumer contracts (CLI, RPC, headless, web bridge).

## Standard Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| SDK Package | `@github/copilot-sdk` (exact pinned version) | Official Node.js/TypeScript SDK for Copilot CLI |
| Tool Definition | `defineTool()` from SDK | SDK-native tool registration with JSON Schema params |
| Event System | `session.on()` callback | SDK streaming event subscription |
| Session Resume | `client.resumeSession(id, config)` | SDK-native session ID-based resume |
| Validation | Zod (existing dependency) | Already used in codebase, SDK supports Zod schemas for tools |
| Config | `SettingsManager` extension | Existing settings pattern for backend selection |

## Architecture Patterns

### Backend Adapter Pattern

The adapter sits between `createAgentSession()` and the underlying runtime. A `SessionBackend` interface defines the contract both runtimes must satisfy:

```
cli.ts → createAgentSession() → SessionBackend.create()
                                   ├── PiSessionBackend (existing behavior)
                                   └── CopilotSessionBackend (new)
```

**Key insight:** The existing `createAgentSession()` in `packages/pi-coding-agent/src/core/sdk.ts` already centralizes all session construction. The backend selection should happen _inside_ this function, driven by settings/flag, not at the CLI layer. This preserves all existing call sites unchanged.

### Event Translation

Copilot SDK events → `AgentSessionEvent` mapping:

| Copilot SDK Event | GSD AgentSessionEvent |
|---|---|
| `tool.execution_start` | `{ type: "tool_execution_start", ... }` |
| `tool.execution_complete` | `{ type: "tool_execution_end", ... }` |
| `assistant.message` | `{ type: "assistant_message", ... }` |
| `assistant.message_delta` | `{ type: "text_delta", ... }` (streaming) |
| `session.idle` | `{ type: "turn_end" }` |
| `session.error` | Error handling via Agent retry logic |
| `assistant.usage` | Token/usage telemetry (Phase 2 concern) |

### Tool Bridge

GSD tools are defined as `Tool` objects with `name`, `description`, `parameters` (Zod or JSON Schema), and an `execute` function. The bridge converts them to Copilot SDK format:

```typescript
// GSD Tool → Copilot defineTool
function bridgeTool(tool: Tool): CopilotTool {
  return defineTool(tool.name, {
    description: tool.description,
    parameters: tool.parameters, // Already JSON Schema compatible
    handler: async (args) => tool.execute(args, context),
  });
}
```

**Critical:** Tool business logic stays in existing modules. Only the registration interface changes.

### Session Lifecycle Mapping

| GSD Concept | Pi SDK | Copilot SDK |
|---|---|---|
| Create session | `new Agent()` + `new AgentSession()` | `client.createSession(config)` |
| Send message | `agent.run(messages)` | `session.send({ prompt })` |
| Resume session | `SessionManager.open(path)` + message restore | `client.resumeSession(id, config)` |
| Destroy session | Session cleanup + file persistence | `session.destroy()` + file persistence |
| Model selection | `agent.state.model` | `SessionConfig.model` |

**Session persistence:** GSD's `SessionManager` handles file-based session persistence. This must continue to work regardless of backend — the adapter translates between Copilot session IDs and GSD's file-based session model.

## Don't Hand-Roll

- **Event system:** Don't create a custom event bus — reuse existing `AgentSessionEvent` subscription pattern
- **Tool schema conversion:** Don't manually translate Zod/JSON Schema — the SDK accepts both formats natively
- **HTTP/transport:** Don't manage Copilot CLI process lifecycle manually — the SDK's `CopilotClient` handles spawn/restart
- **Auth:** Don't implement Copilot auth — the SDK uses GitHub Copilot CLI's existing authentication

## Common Pitfalls

1. **Leaking SDK types across boundaries:** Keep all `@github/copilot-sdk` imports within the adapter module. Other GSD code should only see `AgentSessionEvent` and existing tool types.
2. **Two-way session state drift:** GSD maintains rich session state (messages, model, thinking level). The adapter must be the single source of truth for state synchronization.
3. **Tool execution context:** GSD tools receive execution context (cwd, session, etc.). The Copilot tool handler must provide this context from the adapter, not from the SDK.
4. **Streaming behavior differences:** Copilot SDK sends `assistant.message_delta` events. Some GSD consumers expect complete messages. The adapter may need to buffer deltas for non-streaming consumers.
5. **Client lifecycle management:** `CopilotClient` must be started before sessions and stopped on process exit. This lifecycle is new — current GSD has no equivalent "client" object.

## Validation Architecture

### Testable Boundaries

1. **Backend interface compliance:** Both PiSessionBackend and CopilotSessionBackend must satisfy the same interface tests
2. **Event translation accuracy:** Each Copilot SDK event type maps to the correct AgentSessionEvent
3. **Tool bridge round-trip:** Tools registered through the bridge execute correctly and return results in expected format
4. **Session lifecycle:** Create/resume/destroy works for both backends
5. **Config-driven selection:** Setting `backend: "copilot"` routes to CopilotSessionBackend

### Test Strategy

- Unit tests for event translation functions (pure mapping)
- Unit tests for tool bridge (schema conversion + handler invocation)
- Integration test: create session with Copilot backend, send message, verify event stream
- Config switching test: same workflow, different backend setting, equivalent output

## Key Integration Points

Reading the codebase, these are the specific files/functions that form the adapter surface:

| File | Function/Export | Role |
|---|---|---|
| `packages/pi-coding-agent/src/core/sdk.ts` | `createAgentSession()` | Session factory — backend selection point |
| `packages/pi-coding-agent/src/core/agent-session.ts` | `AgentSession` class | Normalized session — consumers depend on this |
| `packages/pi-coding-agent/src/core/agent-session.ts` | `AgentSessionEvent` type | Event contract — must not change |
| `packages/pi-coding-agent/src/modes/rpc/rpc-mode.ts` | `runRpcMode()` | RPC mode — must work with either backend |
| `src/web/bridge-service.ts` | Bridge event handling | Web bridge — consumes AgentSessionEvent |
| `src/cli.ts` | Mode routing | CLI entry — unchanged, delegates to createAgentSession |

## File Placement

New adapter code should live in `packages/pi-coding-agent/src/core/backends/`:
- `backend-interface.ts` — SessionBackend interface
- `pi-backend.ts` — Extracts existing Pi SDK logic
- `copilot-backend.ts` — New Copilot SDK integration
- `tool-bridge.ts` — Tool format translation
- `event-translator.ts` — Event format translation
- `copilot-client-manager.ts` — CopilotClient lifecycle management

This keeps SDK-specific code isolated within the coding-agent package, close to the existing session management code, per D-01 and SAFE-01.

---

*Research: 2026-03-24*
