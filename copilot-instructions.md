<!-- GSD:project-start source:PROJECT.md -->
## Project

**GSD 2 Copilot SDK Migration**

This project migrates GSD 2 from its current Pi SDK-centric agent runtime to the GitHub Copilot SDK, while preserving current command workflows and user-facing behavior. It targets small teams who rely on repeatable, autonomous planning and execution loops. The migration emphasizes cost-aware orchestration so premium requests are used deliberately and efficiently.

**Core Value:** Deliver the same reliable GSD workflow outcomes while using fewer, higher-value premium requests per completed unit of work.

### Constraints

- **Compatibility**: Keep existing command UX and expected workflow behavior — parity-first objective
- **Cost Model**: GitHub Copilot premium requests are quota-constrained — each prompt must be intentional and high-yield
- **Migration Strategy**: Hybrid rollout is required — reduce disruption and allow incremental validation
- **Audience**: Small teams depend on predictable automation — avoid operational regressions during transition
- **Platform**: Node.js/TypeScript monorepo with existing service and extension contracts — preserve interfaces where practical
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.4.0 - Core application logic, agents, CLI, type definitions
- JavaScript (CommonJS/ESM) - Build scripts, development utilities
- Rust (stable, 2021 edition) - Native bindings for high-performance operations (`native/crates/`)
- HTML/CSS/JSX/TSX - Web UI (Next.js frontend)
- Shell scripting - CI/CD automation, git operations
## Runtime
- Node.js 22.0.0+ (LTS required)
- `node --experimental-strip-types` for TypeScript execution without bundling
- Electron for desktop UI (`studio/`)
- Docker (multi-stage: builder + runtime)
- npm 10.9.3 (workspace monorepo)
- Lockfile: `package-lock.json` present
- Workspaces: `packages/*`, `studio/`
## Frameworks
- Pi SDK (`@mariozechner/jiti`, `@gsd/pi-agent-core`) - Agent harness and execution framework
- VS Code Extension API - IDE integration (`vscode-extension/`)
- Next.js (v13+) - Web UI with React (`web/`)
- Radix UI (`@radix-ui/react-*`) - Component library
- CodeMirror (`@uiw/react-codemirror`) - Code editor
- xterm.js (`@xterm/xterm`) - Terminal emulation
- Tailwind CSS - Styling via `autoprefixer`
- Node native test runner (`node --test`) via `src/resources/extensions/gsd/tests/`)
- c8 11.0.0 - Code coverage with 50% statements/lines, 20% branches/functions threshold
- Playwright 1.58.2 - Browser automation (`test:browser-tools` suite)
- Fixtures and live test runners (`tests/fixtures/`, `tests/live/`)
- TypeScript compiler 5.4.0 - ES2022 target, strict mode
- Native Rust compiler (cross-compilation for linux-arm64)
- Cargo (Rust package manager, workspace-based in `native/`)
- Zod + zod-to-json-schema - Runtime validation and OpenAPI generation
- AJV 8.17.1 - JSON Schema validation with formats
- Marked 15.0.12 - Markdown parsing
- Chalk 5.6.2 - Terminal color output
- Chokidar 5.0.0 - File watching for dev mode
- Glob 13.0.1 - File pattern matching
- Diff 8.0.2 - Text diffing
## Key Dependencies
- `@anthropic-ai/sdk` 0.73.0 - Anthropic Claude API
- `@anthropic-ai/vertex-sdk` 0.14.4 - Claude via Google Vertex AI
- `openai` 6.26.0 - OpenAI API (completions + responses)
- `@aws-sdk/client-bedrock-runtime` 3.983.0 - AWS Bedrock (Claude, Nova)
- `@google/genai` 1.40.0 - Google Gemini API
- `@mistralai/mistralai` 1.14.1 - Mistral API
- MCP SDK via `@modelcontextprotocol/sdk` 1.27.1 - Model Context Protocol server
- `@modelcontextprotocol/sdk` 1.27.1 - MCP tool registration and execution
- `@octokit/rest` 22.0.1 - GitHub API client
- `undici` 7.24.2 - Modern HTTP client (replaces node-fetch)
- `proxy-agent` 6.5.0 - HTTP/HTTPS/SOCKS proxy support
- `proper-lockfile` 4.1.2 - Atomic file locking
- `sharp` 0.34.5 - High-performance image processing
- `file-type` 21.1.1 - Magic bytes file type detection
- `extract-zip` 2.0.1 - ZIP archive handling
- `mime-types` 3.0.1 - MIME type utilities
- `@silvia-odwyer/photon-node` 0.3.4 - Image effects (Photon library)
- `sql.js` 1.14.1 - SQLite in-memory/WASM database
- `yaml` 2.8.2 - YAML parsing and serialization
- `ignore` 7.0.5 - .gitignore pattern matching
- `minimatch` 10.2.3 - glob pattern matching
- `picomatch` 4.0.3 - Fast minimatch alternative
- `strip-ansi` 7.1.0 - ANSI escape code removal
- `@clack/prompts` 1.1.0 - Interactive CLI prompts
- `get-east-asian-width` 1.3.0 - Unicode width calculation
- `hosted-git-info` 9.0.2 - Git repository URL parsing
- `@sinclair/typebox` 0.34.41 - JSON Schema type builder
- `picocolors` 1.1.1 - Minimal color library
- `@types/node` 24.12.0 - Node.js type definitions
- `jiti` 2.6.1 - TypeScript executor for build scripts
## Configuration
- Base: `tsconfig.json` (ES2022, NodeNext, strict mode)
- Extensions: `tsconfig.extensions.json` (extension resources)
- Resources: `tsconfig.resources.json` (bundled resources)
- Compilation target: `dist/`, source root: `src/`
- No `.env` files required for core CLI (LLM API keys passed via CLI flags or env vars)
- Web mode loads keys from `process.env` via `getEnvApiKey()` in `packages/pi-ai/src/web-runtime-env-api-keys.ts`
- Supported env vars per provider (stored in models registry)
- `dist/` - Compiled TypeScript + resources
- `.next/` - Next.js web build (standalone server for web UI)
- `native/crates/target/` - Rust compiled binaries (darwin-{arm64,x64}, linux-{arm64-gnu,x64-gnu}, win32-x64-msvc)
## Platform Requirements
- Node.js 22 LTS (Node 24 recommended for v24-bookworm Docker images)
- npm 10.9.3
- Rust toolchain (stable) for native module rebuilds
- Python, Go, Java, Rust, etc. for ecosystem-specific worktree health checks
- Standalone Node.js executable (npm package: `gsd-pi`)
- Docker container: `ghcr.io/gsd-build/gsd-pi` (runtime image)
- Docker builder: `ghcr.io/gsd-build/gsd-ci-builder` (CI compilation)
- Git-capable environment (required for repo operations)
- System tools: bash/PowerShell, grep, file operations
- `@gsd-build/engine-*` - Platform-specific native engines (darwin-arm64, darwin-x64, linux-{arm64-gnu,x64-gnu}, win32-x64-msvc)
- `fsevents` (macOS) - Native file system events
- `koffi` 2.9.0 - Foreign function interface for system calls
## Compilation Targets
- `engine` - Core git/file system operations
- `grep` - High-performance text search (replaces grep binary dependency)
- `ast` - Abstract syntax tree parsing
- macOS: arm64, x64 (via `darwin-arm64`/`darwin-x64` engine packages)
- Linux: x64 (gnu), arm64 (gnu) (via `linux-x64-gnu`, `linux-arm64-gnu`)
- Windows: x64 (msvc) (via `win32-x64-msvc`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Kebab-case with `.ts` or `.tsx` extension: `web-mode.ts`, `headless-context.ts`, `artifact-manager.ts`
- Test files: `{name}.test.ts` pattern, located in `src/tests/` directory
- Integration tests: `{name}.test.ts` in `src/tests/integration/` subdirectory
- camelCase for regular functions: `parseCliArgs()`, `resolveSearchProvider()`, `makeTmpAuth()`
- camelCase for arrow functions: `const withEnv = (vars: ...) => { ... }`
- PascalCase for exported class methods: `createWindow()`, `streamOpenAIResponses()`
- camelCase: `projectRoot`, `launchInputs`, `spawnInvocation`, `stderrOutput`
- Constants in UPPERCASE with underscores: `PROJECT_ROOT`, `OPENAI_TOOL_CALL_PROVIDERS`
- Scoped constants with Set/Object definitions: `const OPENAI_TOOL_CALL_PROVIDERS = new Set([...])`
- PascalCase for interfaces: `RpcSessionState`, `ModelInfo`, `SessionStats`, `StreamOptions`
- PascalCase for type aliases
- Descriptive names: `OpenAIResponsesOptions`, `BashResult`, `AgentEvent`
- Named exports preferred: `export interface RpcSessionState { ... }`
- Barrel files use `export * from './module.js'` pattern for re-exporting (`packages/pi-ai/src/index.ts`)
- Default exports rare; specific named exports favored
## Code Style
- ESLint used for linting; ESLint configuration in `web/eslint.config.mjs`
- Biome support referenced in LSP defaults (`packages/pi-coding-agent/src/core/lsp/defaults.json`)
- TypeScript strict mode enabled in `tsconfig.json`
- Target: ES2022, Module: NodeNext
- eslint-disable comments for specific violations: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- biome-ignore used for biome-specific supression: `// biome-ignore lint/correctness/noSwitchDeclarations: fine`
- Comments explain the suppression reason
- Tabs used for indentation (observed in test files)
- Comments use visual separators:
## Import Organization
- Relative paths are preferred
- Workspace packages imported via `@gsd/{package}` (e.g., `@gsd/pi-coding-agent`, `@gsd/pi-ai`)
- .js extensions included for ESM compatibility
- `import type { ... }` used for types to enable tree-shaking
- Separate type imports from value imports
## Error Handling
- Use `throw new Error("message")` for immediate errors: `throw new Error("Invalid token")`
- Error messages are descriptive and include context: `throw new Error(response.error ?? "Unknown RPC error")`
- No custom error classes; standard Error constructor preferred
- Error propagation through async/await with try/finally
- Graceful fallback patterns with null checks: `getEnvApiKey(model.provider) || ""`
## Logging
- `console.log()` for informational output
- `console.error()` for error messages
- `process.stderr.write()` for direct stderr output with formatting
- Chalk library used for colored output: `chalk.yellow()`, `chalk.bold()`, `chalk.dim()`
- Tagged output with prefix: `[gsd]` or `[studio]` tags
## Comments
- Section headers with visual separators (see Indentation section)
- Complex logic or non-obvious workarounds
- Warnings about side effects or platform-specific behavior
- Lazy-loading notes: "Lazy-loaded: OpenAI SDK is imported on first use..."
- Used for function descriptions and public exports
- Format: `/** description */` followed by `@param` and return type hints
- Example:
- Use lint-disable comments with explanation: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Place immediately above the problematic line
## Function Design
- Avoid parameter objects when ≤3 parameters
- Use object destructuring for options/config: `{ cwd, projectSessionsDir, agentDir }`
- Type all parameters explicitly
- Functions return specific types, not union types where possible
- Async functions return Promise: `Promise<RunResult>`
- Helper functions often return { ..., cleanup: () => void } for resource management
## Module Design
- Named exports preferred over default exports
- Barrel file pattern: `index.ts` re-exports all public symbols
- Type exports separated: `export type { ... }` and `export { ... }`
- Dynamic imports via `await import(...)` used for optional dependencies
- Imports at function call time to defer initialization
- Example: `const { resolveSearchProvider } = await import('../provider.ts')`
- Utility functions grouped in helper sections marked with visual comment dividers
- Main logic follows helper functions
- Related constants defined near usage or at module top
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Entry point delegates to multiple execution modes (CLI, RPC, Web, MCP)
- Core coding agent abstracted to `@gsd/pi-coding-agent` package
- Service-oriented middleware layer bridges CLI to agent runtime
- Extension/skill system enables custom commands and tools
- Dual frontend: TUI (terminal) and Web (Next.js)
## Layers
- Purpose: Fast initialization, environment setup, mode detection
- Location: `src/loader.ts`, `src/cli.ts`
- Contains: Version checks, argument parsing, environment variables
- Depends on: `app-paths.js`, `extension-registry.ts`
- Used by: Node.js `bin` entry point defined in `package.json`
- Purpose: Parse user input and route to appropriate execution mode
- Location: `src/cli.ts`
- Contains: CliFlags interface, argument parsing, mode routing (interactive/RPC/web/headless)
- Depends on: `@gsd/pi-coding-agent`, `resource-loader.ts`, `wizard.ts`, `onboarding.ts`
- Used by: All CLI invocations
- Purpose: Orchestrate commands without TUI, handle auto-responses
- Location: `src/headless.ts`, `src/headless-ui.ts`, `src/headless-context.ts`
- Contains: HeadlessOptions, RPC client handling, UI request auto-responses, context loading
- Depends on: `@gsd/pi-coding-agent` RPC client, `bridge-service.ts`
- Used by: `gsd headless` command, web mode orchestration
- Purpose: Manage RPC communication between web frontend and backend agent
- Location: `src/web/bridge-service.ts`
- Contains: BridgeRpcClient, session management, workspace indexing, onboarding checks
- Depends on: `cli-entry.ts`, `onboarding-service.ts`, `auto-dashboard-service.ts`, `git-summary-service.ts`
- Used by: Web frontend HTTP handlers, session browser
- Purpose: Provide specialized domain functionality
- Location: `src/web/*.ts` (23 service files)
- Contains: Individual services (cleanup, recovery, hooks, knowledge, etc.)
- Depends on: File system, git, process execution, agent internals
- Used by: Bridge layer, CLI commands, web backend
- Purpose: Main coding agent execution engine
- Location: `packages/pi-coding-agent/src/` (internal)
- Contains: AgentSession, tool execution, message management, compaction
- Depends on: `@gsd/pi-ai` (models), `@gsd/pi-tui` (terminal UI)
- Used by: All execution modes
- Purpose: Web UI for interactive session management
- Location: `web/` (Next.js application)
- Contains: React components, pages, hooks (see web/app, web/components, web/lib)
- Depends on: Next.js, UI libraries (shadcn/ui), contract types from `web/lib/*-contract.ts`
- Used by: Web mode, browser-based access
- Purpose: Provide pluggable skills, agents, and extensions
- Location: `src/resources/`, `src/extension-registry.ts`, `src/extension-discovery.ts`
- Contains: Skill definitions, agent configurations, extension manifests
- Depends on: Dynamic loading via jiti
- Used by: Agent session for custom commands
## Data Flow
## Key Abstractions
- Purpose: Represents active coding session state
- Examples: `packages/pi-coding-agent/src/core/agent-session.ts`
- Pattern: Stateful manager for messages, tools, model cycles
- Manages: Conversation history, context compaction, extension state
- Purpose: Pluggable commands, tools, UI handlers
- Examples: `src/resources/extensions/gsd/` (built-in skills)
- Pattern: Registry of Extension factories, loaded at runtime via jiti
- Can define: Custom commands, tools, keyboard shortcuts, UI dialogs
- Purpose: Non-interactive agent control
- Examples: `@gsd/pi-coding-agent` modes/rpc/
- Pattern: JSON-RPC 2.0 over stdio
- Commands: get_state, send_message, execute_tool, etc.
- Purpose: Domain-specific functionality (isolated, single-responsibility)
- Examples: `src/web/git-summary-service.ts`, `src/web/onboarding-service.ts`
- Pattern: Pure functions or classes exporting async function(s)
- Used by: Bridge for REST endpoints, CLI commands
## Entry Points
- Location: `src/loader.ts`
- Triggers: `gsd` command execution
- Responsibilities: Version check, banner on first run, environment setup, agent dir configuration
- Location: `src/cli.ts` (--web flag) → `src/web-mode.ts`
- Triggers: `gsd --web` or `gsd:web` npm script
- Responsibilities: Bootstrap Next.js server, open browser, manage lifecycle
- Location: `src/cli.ts` (--mode rpc flag)
- Triggers: Orchestration, web bridge, headless automation
- Responsibilities: Spawn subprocess, manage stdio, relay RPC messages
- Location: `web/app/api/`
- Triggers: HTTP requests from frontend
- Responsibilities: Session management, state queries, RPC relay
## Error Handling
- CLI: Exit codes (0=success, 1=error, 2=blocker)
- RPC: Error codes in response (onboarding_locked, timeout, etc.)
- Web: HTTP status codes + error contract types (`web/lib/diagnostics-types.ts`)
- Agent: ExtensionError events with path, event type, and message
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
