# Technology Stack

**Project:** GSD 2 — Copilot SDK Migration
**Researched:** 2026-03-24
**Mode:** Subsequent milestone — migrating existing TypeScript CLI agent platform to GitHub Copilot SDK

## Recommended Stack

### Core Runtime: GitHub Copilot SDK (Node.js)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@github/copilot-sdk` | latest (technical preview) | Agent orchestration, session management, tool execution loop | Replaces Pi SDK agent core (`@gsd/pi-agent-core`, `@gsd/pi-ai`) with GitHub's production-tested agentic loop. Provides model management, auth, MCP server integration, streaming, and multi-turn execution out of the box. **HIGH confidence** — Context7 + official SDK docs verified. |
| Node.js | 22 LTS (existing) | Runtime environment | SDK requires Node.js 18+; project already targets 22 LTS. No change needed. **HIGH confidence** |
| TypeScript | 5.4+ (existing) | Type-safe application code | SDK ships full TypeScript type definitions (`SessionEvent`, `CopilotClient`, `defineTool`, etc.). Existing strict-mode tsconfig compatible. **HIGH confidence** |
| GitHub Copilot CLI | latest (npm install) | Backend process managed by SDK | The SDK spawns and manages a Copilot CLI process via JSON-RPC. Must be installed and in PATH (or configured via `cliPath`). The SDK communicates via stdio (default) or TCP transport. **HIGH confidence** — verified in SDK docs. |

### Session & Orchestration Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `CopilotClient` | from SDK | Client lifecycle (start/stop, session factory) | Replaces `createAgentSession()` from `@gsd/pi-coding-agent`. Manages CLI process lifecycle, auto-restart on crash, connection state. Use `autoStart: false` for explicit control matching GSD's current startup sequence. **HIGH confidence** |
| `session.createSession()` | from SDK | Per-workflow session with model, tools, hooks, agents | Maps to current `AgentSession`. Supports model selection, custom tools (via `defineTool`), MCP servers, custom agents, hooks, streaming, and BYOK provider config. **HIGH confidence** |
| `session.sendAndWait()` | from SDK | Synchronous prompt-response for orchestration steps | Replaces current RPC `prompt()` + `waitForIdle()` pattern. Single call sends prompt and blocks until `session.idle`. Critical for headless/RPC orchestration. **HIGH confidence** |
| Session Hooks (`onPreToolUse`, `onPostToolUse`, `onSessionStart`, `onSessionEnd`) | from SDK | Permission control, telemetry, tool restriction | Replaces current `ExtensionRunner` permission checks and tool filtering. Enables request-efficiency telemetry (count prompts, tool calls, duration per session). **HIGH confidence** |
| Custom Agents (`customAgents` config) | from SDK | Sub-agent orchestration (researcher/editor pattern) | SDK supports defining lightweight sub-agents with own system prompts and tool restrictions. Runtime auto-delegates tasks. Maps to GSD's existing skill/command orchestration. **HIGH confidence** |

### Model Selection & Cost Optimization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Copilot model routing | via SDK `model` param | Model selection per session | SDK accepts model names (`"gpt-5"`, `"claude-sonnet-4.5"`, `"gpt-4.1"`, etc.). Model multiplier determines premium request cost. **HIGH confidence** — official billing docs verified. |
| 0× included models (GPT-5 mini, GPT-4.1, GPT-4o) | via SDK | Zero-cost operations for planning scaffolding, confirmations, triage | On paid plans, these models consume **zero** premium requests. Use for: discuss-phase Q&A, plan validation, progress checks, template generation. **HIGH confidence** — verified in GitHub billing docs (March 2026). |
| 0.33× models (Claude Haiku 4.5, Gemini 3 Flash, GPT-5.1-Codex-Mini) | via SDK | Low-cost execution for routine code generation | Each prompt costs 0.33 premium requests. Use for: straightforward code edits, test generation, file operations. **HIGH confidence** |
| 1× models (Claude Sonnet 4.5/4.6, Gemini 2.5/3/3.1 Pro, GPT-5.1, GPT-5.1-Codex) | via SDK | High-quality execution for complex reasoning | Each prompt costs 1 premium request. Use for: architecture decisions, complex refactors, multi-file changes, verification. **HIGH confidence** |
| BYOK Provider (`provider` config) | from SDK | Fallback to direct API keys when quota exhausted | SDK supports `type: "openai"`, `type: "anthropic"`, `type: "azure"` providers with custom `baseUrl` and `apiKey`. Enables graceful degradation when premium requests run out. **HIGH confidence** — verified in SDK BYOK docs. |

### Existing Stack (Retained)

| Technology | Version | Purpose | Why Kept |
|------------|---------|---------|----------|
| Extension/Skill system | existing | Pluggable commands, workflows (GSD skills) | SDK's `skillDirectories` config maps directly. Custom tools via `defineTool` + Zod schemas. Minimal adaptation needed. |
| `@modelcontextprotocol/sdk` | 1.27.1 | MCP tool registration | SDK has native MCP server support (`mcpServers` config). Can run both: GSD as MCP server (existing) AND connect to external MCP servers per session. |
| Session persistence | existing files | `.gsd/agent/sessions/` | SDK has `resumeSession()` for continuing sessions. GSD session manager needs adapter to bridge. |
| Zod | existing | Runtime validation, tool parameter schemas | SDK's `defineTool` accepts Zod schemas directly for parameters. Existing Zod usage maps perfectly. |
| Web frontend (Next.js) | existing | Browser UI | Bridge service needs migration from Pi RPC to Copilot SDK events. Event types differ but map 1:1. |
| TUI (`@gsd/pi-tui`) | existing | Terminal UI rendering | Decoupled from agent core. Receives events; event shape changes but rendering logic stays. |

### Supporting Libraries (New or Changed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `defineTool` (from SDK) | from SDK | Type-safe tool definitions with Zod params | Replace all current `AgentTool` definitions in `tools/index.ts` with SDK-compatible `defineTool`. Supports JSON-serializable returns or `ToolResultObject` for explicit control. |
| SDK Hooks API | from SDK | Telemetry, permissions, context injection | Use `onPreToolUse` for tool allow-listing (replaces current extension permission system). Use `onSessionStart`/`onSessionEnd` for request-efficiency metrics. Use `onUserPromptSubmitted` for prompt counting. |
| `approveAll` / custom `onPermissionRequest` | from SDK | Tool execution permission handling | `approveAll` for headless/auto mode. Custom handler for interactive mode with selective approval (shell, write, etc.). |

## Migration Abstraction Layer

### Hybrid Runtime Interface

The migration requires an abstraction layer that lets GSD run against either Pi SDK or Copilot SDK during transition. Key interface:

```typescript
// Proposed: Runtime-agnostic session interface
interface GsdRuntimeSession {
  // Core operations
  sendPrompt(prompt: string, options?: PromptOptions): Promise<string>;
  sendAndWait(prompt: string, timeoutMs?: number): Promise<SessionResponse | null>;
  
  // Event subscription
  on(handler: (event: GsdSessionEvent) => void): () => void;
  
  // Lifecycle
  abort(): Promise<void>;
  destroy(): Promise<void>;
  
  // State
  readonly sessionId: string;
  getMessages(): Promise<SessionMessage[]>;
}

// Factory selects runtime based on config
interface GsdRuntimeFactory {
  createSession(config: GsdSessionConfig): Promise<GsdRuntimeSession>;
}
```

**Rationale:** GSD's existing consumers (CLI router, headless orchestrator, web bridge, RPC mode) all interact through `AgentSession`. A thin adapter over Copilot SDK's `CopilotSession` preserves all call sites while the migration proceeds. Switch the factory implementation per mode/phase — not the consumers.

### Tool Migration Pattern

```typescript
// Current Pi SDK tool (from packages/pi-coding-agent/src/core/tools/)
const readTool: AgentTool = {
  name: "read",
  description: "Read file contents",
  parameters: { /* JSON Schema */ },
  execute: async (args) => { /* ... */ },
};

// Copilot SDK equivalent
import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

const readTool = defineTool({
  name: "read",
  description: "Read file contents",
  parameters: z.object({
    file_path: z.string().describe("Absolute path to file"),
    offset: z.number().optional().describe("Start line (1-based)"),
    limit: z.number().optional().describe("Number of lines"),
  }),
  handler: async (args) => { /* same implementation */ },
});
```

### Event Mapping

| Pi SDK Event (`AgentSessionEvent`) | Copilot SDK Event (`SessionEvent`) | Notes |
|-------------------------------------|-------------------------------------|-------|
| `agent_event` (message start/delta/end) | `assistant.message` / `assistant.message.delta` | Delta only when `streaming: true` |
| `tool_execution_start` | `tool.executionStart` | |
| `tool_execution_end` | `tool.executionComplete` | |
| `session_state_changed` | `session.idle` / `session.start` | |
| `auto_compaction_start/end` | No direct equivalent | GSD must handle compaction externally or use SDK's context management |
| `auto_retry_start/end` | `session.error` + retry logic | SDK has `autoRestart` for client-level crashes; retry logic may need custom implementation |
| `fallback_provider_switch` | No direct equivalent | BYOK fallback must be orchestrated by GSD; SDK doesn't auto-fallback between providers |

## Premium Request Optimization Strategy

### Model Tiering for GSD Workflows

| GSD Workflow Stage | Recommended Model Tier | Multiplier | Rationale |
|--------------------|-----------------------|------------|-----------|
| `/gsd-discuss-phase` (Q&A, context gathering) | GPT-5 mini or GPT-4.1 | **0×** | Pure conversation, no code execution. Zero premium cost. |
| `/gsd-plan-phase` (plan generation) | GPT-5 mini (draft) → GPT-5.1-Codex-Mini (refine) | **0× → 0.33×** | Generate plan skeleton free, refine with cheapest code model. |
| `/gsd-execute-phase` (code generation, tool use) | Claude Sonnet 4.5 or GPT-5.1-Codex | **1×** | Complex reasoning requires premium model. One request per sub-agent task. |
| `/gsd-verify-work` (UAT validation) | GPT-4.1 or GPT-5 mini | **0×** | Test execution and result checking don't need premium reasoning. |
| `/gsd-autonomous` (full loop) | Mixed: 0× discuss → 0.33× plan → 1× execute → 0× verify | **varies** | Per-stage model routing maximizes value per premium request. |
| Compaction / context management | GPT-5 mini | **0×** | Summarization for context window management. |
| Error retry / fallback | Current model → BYOK fallback | **0× if BYOK** | When quota exhausted, fall back to direct API keys. |

### Key Optimization Patterns

1. **"Two-lane" routing:** Route exploration/confirmation to 0× models, execution to 1× models. Never run confirmations ("is this right?") on premium models.

2. **Session-per-task isolation (Ralph Loop):** Fresh session per phase/task. Clean context = fewer tokens = more efficient prompts. Avoid context bloat from long-lived sessions.

3. **`sendAndWait` over event polling:** Single round-trip per interaction. Eliminates wasted requests from polling/retry patterns.

4. **Tool allow-listing via hooks:** Use `onPreToolUse` to restrict tools per session type. Read-only sessions (research) should block write tools. Prevents wasted requests on tool-call errors.

5. **Auto model selection discount:** When model selection isn't critical, use `model: "auto"` for 10% multiplier discount (0.9 coefficient) on premium requests.

6. **Batch prompts, not chatty exchanges:** Combine context + instructions into single rich prompts rather than multi-turn conversations. Each `send()` is a billable request on premium models.

### Anti-Patterns That Burn Premium Requests

| Anti-Pattern | Cost Impact | Fix |
|--------------|-------------|-----|
| Running confirmations on Opus (30× fast mode) or Sonnet (1×) | 10 confirmations = 10-300 requests | Route to GPT-5 mini (0×) |
| Long-lived sessions with growing context | More tokens → slower response → more requests for same work | Ralph Loop: fresh session per task |
| Not using `sendAndWait` (manual idle polling) | Extra round-trips per interaction | Use `sendAndWait()` |
| Hardcoding a premium model for all operations | All prompts cost 1×+ | Per-stage model routing |
| Retrying failed prompts on same premium model | Double cost on failures | Catch errors, downgrade model or use BYOK |
| Not filtering tools (model calls wrong tool, retries) | Wasted tool execution + retry | `availableTools` / `excludedTools` / `onPreToolUse` hook |
| Forgetting the 10% auto-selection discount | Steady 10% waste | Use `"auto"` when model choice is flexible |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Agent runtime | GitHub Copilot SDK | Keep Pi SDK (`@gsd/pi-agent-core` + `@gsd/pi-ai`) | Pi SDK requires managing auth, model routing, provider integrations, retry logic, compaction — all reimplemented. Copilot SDK handles these. Migration goal is specifically to Copilot SDK. |
| Agent runtime | GitHub Copilot SDK | LangChain / LangGraph | Adds heavyweight dependency. Copilot SDK is purpose-built for GitHub ecosystem. Premium request billing is GitHub-native — no advantage to wrapping. |
| Agent runtime | GitHub Copilot SDK | Vercel AI SDK | Good for web apps but not for CLI agent orchestration. No premium request integration. Different cost model. |
| Model routing | SDK `model` param + custom tiering | OpenRouter | Adds intermediary. Premium requests already give multi-model access. BYOK covers fallback. |
| Tool definitions | SDK `defineTool` + Zod | Keep Pi `AgentTool` format | `defineTool` is SDK-native, supports Zod directly, auto-serializes returns. Less glue code. |
| Session persistence | Adapter over SDK `resumeSession` | Full rewrite of session manager | `resumeSession(sessionId)` preserves conversation state. Adapter layer cheaper than rewrite. |
| Permission handling | SDK hooks (`onPermissionRequest`, `onPreToolUse`) | Keep extension permission system | Hooks are more flexible and first-class in SDK. Extension system can delegate to hooks. |
| MCP integration | SDK `mcpServers` config | Standalone MCP server setup | SDK manages MCP server lifecycle per session. Less infrastructure code. |
| BYOK fallback | SDK `provider` config (openai/anthropic/azure) | Maintain all direct provider SDKs | BYOK covers escape hatch. Can drop `@anthropic-ai/sdk`, `openai`, `@aws-sdk/*`, `@google/genai`, `@mistralai/mistralai` as direct dependencies after full migration. Significant dependency reduction. |

## Installation

```bash
# Core — new dependency
npm install @github/copilot-sdk

# Copilot CLI — required backend (must be in PATH)
npm install -g @anthropic-ai/copilot-cli  # or via GitHub CLI:
# gh extension install github/copilot-cli

# Existing — retained as-is
# npm install zod (already present)
# npm install @modelcontextprotocol/sdk (already present)

# Existing — candidates for removal after full migration
# @anthropic-ai/sdk, @anthropic-ai/vertex-sdk
# openai
# @aws-sdk/client-bedrock-runtime
# @google/genai
# @mistralai/mistralai
# (These become unnecessary when all model routing goes through Copilot SDK)
```

## Migration Phases (Stack Perspective)

### Phase 1: SDK Bootstrap + Adapter Layer
- Install `@github/copilot-sdk`
- Create `GsdRuntimeSession` adapter interface
- Implement Copilot SDK adapter (`CopilotRuntimeSession`)
- Wire `CopilotClient` lifecycle into GSD startup/shutdown
- **Stack change:** Add `@github/copilot-sdk` dependency. No removals yet.

### Phase 2: Tool Migration
- Convert `AgentTool` definitions to `defineTool` format with Zod schemas
- Map existing tool names to SDK tool registration
- Verify tool execution parity via hooks
- **Stack change:** Tools dual-registered (Pi + Copilot format). No removals.

### Phase 3: Session & Model Routing
- Implement per-workflow model tiering (0×/0.33×/1× routing)
- Add request-efficiency telemetry via session hooks
- Migrate headless orchestrator to `sendAndWait` pattern
- Implement BYOK fallback on quota exhaustion
- **Stack change:** Model routing logic moves from `ModelRegistry` to SDK config. Pi `ModelRegistry` retained for hybrid mode.

### Phase 4: Extension System Bridge
- Map GSD skills/extensions to SDK `skillDirectories` and `customAgents`
- Bridge extension UI requests to SDK event system
- Migrate permission handling to SDK hooks
- **Stack change:** Extension loader gets SDK compatibility layer.

### Phase 5: Consumer Migration
- Migrate CLI interactive mode to Copilot SDK sessions
- Migrate web bridge RPC to SDK events
- Migrate MCP server mode to SDK integration
- **Stack change:** Start removing Pi SDK imports from consumer code.

### Phase 6: Pi SDK Removal
- Remove `@gsd/pi-agent-core`, `@gsd/pi-ai` agent-loop code (retain data types if needed)
- Remove direct LLM provider SDKs (`@anthropic-ai/sdk`, `openai`, etc.)
- Remove hybrid adapter layer
- **Stack change:** Major dependency reduction. Single runtime path.

## SDK Status & Risk Assessment

| Factor | Status | Risk | Mitigation |
|--------|--------|------|------------|
| SDK maturity | Technical preview (since Jan 22, 2026) | **MEDIUM** — Breaking changes expected | Adapter layer isolates breaking changes to one file. Pin SDK version per milestone. |
| Protocol version | v2 (requires CLI v0.0.392+ via npm) | **LOW** — Well-documented | Install CLI via npm, not winget/brew (ensures protocol v2). |
| Premium request billing | GA (since June 2025) | **HIGH** — Quota constraints are real | Per-stage model routing + BYOK fallback + telemetry monitoring. |
| BYOK support | Available | **LOW** | Supports OpenAI, Anthropic, Azure, Ollama (local). Proven escape hatch. |
| MCP integration | Native in SDK | **LOW** | Direct `mcpServers` config per session. |
| Custom agents | Supported | **MEDIUM** — Auto-inference behavior may be unpredictable | Use `infer: false` for dangerous agents. Test delegation patterns. |
| Session persistence | `resumeSession(id)` available | **MEDIUM** — May not map 1:1 to GSD's session format | Adapter layer translates. May need dual-write during transition. |
| Windows support | Known issues (protocol/CLI install) | **LOW** for GSD — primary Linux/macOS | Test Windows CI path with npm-installed CLI. |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| SDK API surface | **HIGH** | Verified via Context7 + official repo docs + .instructions.md |
| Premium request billing model | **HIGH** | Verified via GitHub official billing docs + community reports |
| Model multiplier rates | **HIGH** | Directly from docs.github.com/en/copilot/concepts/billing/copilot-requests (March 2026) |
| BYOK capability | **HIGH** | Verified in SDK docs — OpenAI, Anthropic, Azure providers confirmed |
| Migration adapter pattern | **MEDIUM** | Architecture pattern is sound but SDK preview may introduce friction |
| Dependency removal timeline | **MEDIUM** | Feasible after full migration but may need provider SDKs retained for edge cases |
| SDK stability for production | **LOW** | Technical preview with known issues. Breaking changes between versions expected. |
| Compaction/context management | **LOW** | SDK doesn't expose compaction primitives. GSD may need to retain custom compaction logic. |

## Sources

- Context7 `/github/copilot-sdk` — SDK documentation and code examples (HIGH authority)
- GitHub Blog: "Build an agent into any app with the GitHub Copilot SDK" — https://github.blog/news-insights/company-news/build-an-agent-into-any-app-with-the-github-copilot-sdk/ (HIGH)
- GitHub Docs: "Requests in GitHub Copilot" — https://docs.github.com/en/copilot/concepts/billing/copilot-requests (HIGH)
- GitHub Copilot SDK repository — https://github.com/github/copilot-sdk (HIGH)
- GitHub Copilot SDK issues #115, #118 — Known issues with billing and protocol versions (MEDIUM)
- SmartScope: "GitHub Copilot Premium Request Optimization" — https://smartscope.blog/en/generative-ai/github-copilot/github-copilot-premium-request-optimization/ (MEDIUM)
- GSD 2 codebase analysis: `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md` (HIGH — primary source)
- `.github/instructions/copilot-sdk-nodejs.instructions.md` — Local SDK reference (HIGH)

---

*Stack research: 2026-03-24*
