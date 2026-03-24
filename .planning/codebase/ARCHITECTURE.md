# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Modular layered architecture with pluggable execution modes

**Key Characteristics:**
- Entry point delegates to multiple execution modes (CLI, RPC, Web, MCP)
- Core coding agent abstracted to `@gsd/pi-coding-agent` package
- Service-oriented middleware layer bridges CLI to agent runtime
- Extension/skill system enables custom commands and tools
- Dual frontend: TUI (terminal) and Web (Next.js)

## Layers

**Entry Point Layer:**
- Purpose: Fast initialization, environment setup, mode detection
- Location: `src/loader.ts`, `src/cli.ts`
- Contains: Version checks, argument parsing, environment variables
- Depends on: `app-paths.js`, `extension-registry.ts`
- Used by: Node.js `bin` entry point defined in `package.json`

**CLI Router Layer:**
- Purpose: Parse user input and route to appropriate execution mode
- Location: `src/cli.ts`
- Contains: CliFlags interface, argument parsing, mode routing (interactive/RPC/web/headless)
- Depends on: `@gsd/pi-coding-agent`, `resource-loader.ts`, `wizard.ts`, `onboarding.ts`
- Used by: All CLI invocations

**Orchestration/Headless Layer:**
- Purpose: Orchestrate commands without TUI, handle auto-responses
- Location: `src/headless.ts`, `src/headless-ui.ts`, `src/headless-context.ts`
- Contains: HeadlessOptions, RPC client handling, UI request auto-responses, context loading
- Depends on: `@gsd/pi-coding-agent` RPC client, `bridge-service.ts`
- Used by: `gsd headless` command, web mode orchestration

**Web Bridge Service Layer:**
- Purpose: Manage RPC communication between web frontend and backend agent
- Location: `src/web/bridge-service.ts`
- Contains: BridgeRpcClient, session management, workspace indexing, onboarding checks
- Depends on: `cli-entry.ts`, `onboarding-service.ts`, `auto-dashboard-service.ts`, `git-summary-service.ts`
- Used by: Web frontend HTTP handlers, session browser

**Service Modules Layer:**
- Purpose: Provide specialized domain functionality
- Location: `src/web/*.ts` (23 service files)
- Contains: Individual services (cleanup, recovery, hooks, knowledge, etc.)
- Depends on: File system, git, process execution, agent internals
- Used by: Bridge layer, CLI commands, web backend

**Agent Core Layer:**
- Purpose: Main coding agent execution engine
- Location: `packages/pi-coding-agent/src/` (internal)
- Contains: AgentSession, tool execution, message management, compaction
- Depends on: `@gsd/pi-ai` (models), `@gsd/pi-tui` (terminal UI)
- Used by: All execution modes

**Frontend Layer:**
- Purpose: Web UI for interactive session management
- Location: `web/` (Next.js application)
- Contains: React components, pages, hooks (see web/app, web/components, web/lib)
- Depends on: Next.js, UI libraries (shadcn/ui), contract types from `web/lib/*-contract.ts`
- Used by: Web mode, browser-based access

**Extension/Resource Layer:**
- Purpose: Provide pluggable skills, agents, and extensions
- Location: `src/resources/`, `src/extension-registry.ts`, `src/extension-discovery.ts`
- Contains: Skill definitions, agent configurations, extension manifests
- Depends on: Dynamic loading via jiti
- Used by: Agent session for custom commands

## Data Flow

**Interactive Mode (TUI):**

1. User runs `gsd` command
2. `src/loader.ts` initializes environment (versions, paths, env vars)
3. `src/cli.ts` parses arguments, detects interactive mode
4. Calls `createAgentSession()` from `@gsd/pi-coding-agent`
5. Session loads resources (extensions, skills)
6. TUI renderer (from `@gsd/pi-tui`) displays interface
7. User input → tool calls → model responses → stream to terminal
8. Session state persisted to `~/.gsd/agent/sessions/`

**RPC/Headless Mode:**

1. `src/cli.ts` detects `--mode rpc` flag
2. Spawns child process via `runRpcMode()` from pi-coding-agent
3. `src/headless.ts` wraps child process with RpcClient
4. Extension UI requests auto-respond via `handleExtensionUIRequest()`
5. Progress streamed to stderr as JSONL
6. Exit codes: 0 (success), 1 (error), 2 (blocker)

**Web Mode (Browser):**

1. `src/cli.ts` detects `--web` flag
2. `src/web-mode.ts` spawns Next.js dev server (`web/package.json` scripts)
3. Web frontend loads at http://127.0.0.1:PORT
4. Frontend opens HTTP connection to backend via `/api/session/rpc`
5. `src/web/bridge-service.ts` spawns GSD subprocess in RPC mode
6. Bridge relays RPC messages between frontend and agent
7. Session browser at `/api/sessions` lists available sessions
8. User can create, resume, fork sessions via REST API

**MCP Server Mode:**

1. `src/mcp-server.ts` implements Model Context Protocol
2. Registers GSD tools for external AI clients
3. External client (Claude Desktop, etc.) connects via stdio
4. MCP tools/list → returns tool definitions
5. MCP tools/call → executes tool via agent tool registry
6. Response streamed back to client

## Key Abstractions

**AgentSession:**
- Purpose: Represents active coding session state
- Examples: `packages/pi-coding-agent/src/core/agent-session.ts`
- Pattern: Stateful manager for messages, tools, model cycles
- Manages: Conversation history, context compaction, extension state

**Extension System:**
- Purpose: Pluggable commands, tools, UI handlers
- Examples: `src/resources/extensions/gsd/` (built-in skills)
- Pattern: Registry of Extension factories, loaded at runtime via jiti
- Can define: Custom commands, tools, keyboard shortcuts, UI dialogs

**RPC Client/Server:**
- Purpose: Non-interactive agent control
- Examples: `@gsd/pi-coding-agent` modes/rpc/
- Pattern: JSON-RPC 2.0 over stdio
- Commands: get_state, send_message, execute_tool, etc.

**Service Modules:**
- Purpose: Domain-specific functionality (isolated, single-responsibility)
- Examples: `src/web/git-summary-service.ts`, `src/web/onboarding-service.ts`
- Pattern: Pure functions or classes exporting async function(s)
- Used by: Bridge for REST endpoints, CLI commands

## Entry Points

**CLI Entry:**
- Location: `src/loader.ts`
- Triggers: `gsd` command execution
- Responsibilities: Version check, banner on first run, environment setup, agent dir configuration

**Web Entry:**
- Location: `src/cli.ts` (--web flag) → `src/web-mode.ts`
- Triggers: `gsd --web` or `gsd:web` npm script
- Responsibilities: Bootstrap Next.js server, open browser, manage lifecycle

**RPC Entry:**
- Location: `src/cli.ts` (--mode rpc flag)
- Triggers: Orchestration, web bridge, headless automation
- Responsibilities: Spawn subprocess, manage stdio, relay RPC messages

**Web API Routes:**
- Location: `web/app/api/`
- Triggers: HTTP requests from frontend
- Responsibilities: Session management, state queries, RPC relay

## Error Handling

**Strategy:** Structured error responses with categorized codes

**Patterns:**
- CLI: Exit codes (0=success, 1=error, 2=blocker)
- RPC: Error codes in response (onboarding_locked, timeout, etc.)
- Web: HTTP status codes + error contract types (`web/lib/diagnostics-types.ts`)
- Agent: ExtensionError events with path, event type, and message

## Cross-Cutting Concerns

**Logging:** `@gsd/pi-coding-agent` event stream (AgentSessionEvent) + extension events
**Validation:** Input arg parsing in `src/cli.ts`, RPC request schema in pi-coding-agent
**Authentication:** OAuth via `@gsd/pi-ai` providers, stored in `~/.gsd/auth.json`
**Resource Discovery:** `src/extension-discovery.ts` scans for user/bundled extensions
**Paths:** `src/app-paths.ts` centralizes all directory resolution (agentDir, sessionsDir, etc.)

---

*Architecture analysis: 2026-03-24*
