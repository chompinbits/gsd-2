# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript 5.4.0 - Core application logic, agents, CLI, type definitions
- JavaScript (CommonJS/ESM) - Build scripts, development utilities
- Rust (stable, 2021 edition) - Native bindings for high-performance operations (`native/crates/`)

**Secondary:**
- HTML/CSS/JSX/TSX - Web UI (Next.js frontend)
- Shell scripting - CI/CD automation, git operations

## Runtime

**Environment:**
- Node.js 22.0.0+ (LTS required)
- `node --experimental-strip-types` for TypeScript execution without bundling
- Electron for desktop UI (`studio/`)
- Docker (multi-stage: builder + runtime)

**Package Manager:**
- npm 10.9.3 (workspace monorepo)
- Lockfile: `package-lock.json` present
- Workspaces: `packages/*`, `studio/`

## Frameworks

**Core Platform:**
- Pi SDK (`@mariozechner/jiti`, `@gsd/pi-agent-core`) - Agent harness and execution framework
- VS Code Extension API - IDE integration (`vscode-extension/`)

**Frontend:**
- Next.js (v13+) - Web UI with React (`web/`)
- Radix UI (`@radix-ui/react-*`) - Component library
- CodeMirror (`@uiw/react-codemirror`) - Code editor
- xterm.js (`@xterm/xterm`) - Terminal emulation
- Tailwind CSS - Styling via `autoprefixer`

**Testing:**
- Node native test runner (`node --test`) via `src/resources/extensions/gsd/tests/`)
- c8 11.0.0 - Code coverage with 50% statements/lines, 20% branches/functions threshold
- Playwright 1.58.2 - Browser automation (`test:browser-tools` suite)
- Fixtures and live test runners (`tests/fixtures/`, `tests/live/`)

**Build & Compilation:**
- TypeScript compiler 5.4.0 - ES2022 target, strict mode
- Native Rust compiler (cross-compilation for linux-arm64)
- Cargo (Rust package manager, workspace-based in `native/`)

**Utilities & Tools:**
- Zod + zod-to-json-schema - Runtime validation and OpenAPI generation
- AJV 8.17.1 - JSON Schema validation with formats
- Marked 15.0.12 - Markdown parsing
- Chalk 5.6.2 - Terminal color output
- Chokidar 5.0.0 - File watching for dev mode
- Glob 13.0.1 - File pattern matching
- Diff 8.0.2 - Text diffing

## Key Dependencies

**Critical - LLM Integration:**
- `@anthropic-ai/sdk` 0.73.0 - Anthropic Claude API
- `@anthropic-ai/vertex-sdk` 0.14.4 - Claude via Google Vertex AI
- `openai` 6.26.0 - OpenAI API (completions + responses)
- `@aws-sdk/client-bedrock-runtime` 3.983.0 - AWS Bedrock (Claude, Nova)
- `@google/genai` 1.40.0 - Google Gemini API
- `@mistralai/mistralai` 1.14.1 - Mistral API
- MCP SDK via `@modelcontextprotocol/sdk` 1.27.1 - Model Context Protocol server

**Infrastructure & Protocol:**
- `@modelcontextprotocol/sdk` 1.27.1 - MCP tool registration and execution
- `@octokit/rest` 22.0.1 - GitHub API client
- `undici` 7.24.2 - Modern HTTP client (replaces node-fetch)
- `proxy-agent` 6.5.0 - HTTP/HTTPS/SOCKS proxy support
- `proper-lockfile` 4.1.2 - Atomic file locking

**File & Media Processing:**
- `sharp` 0.34.5 - High-performance image processing
- `file-type` 21.1.1 - Magic bytes file type detection
- `extract-zip` 2.0.1 - ZIP archive handling
- `mime-types` 3.0.1 - MIME type utilities
- `@silvia-odwyer/photon-node` 0.3.4 - Image effects (Photon library)

**Database & Data:**
- `sql.js` 1.14.1 - SQLite in-memory/WASM database
- `yaml` 2.8.2 - YAML parsing and serialization

**Utilities:**
- `ignore` 7.0.5 - .gitignore pattern matching
- `minimatch` 10.2.3 - glob pattern matching
- `picomatch` 4.0.3 - Fast minimatch alternative
- `strip-ansi` 7.1.0 - ANSI escape code removal
- `@clack/prompts` 1.1.0 - Interactive CLI prompts
- `get-east-asian-width` 1.3.0 - Unicode width calculation
- `hosted-git-info` 9.0.2 - Git repository URL parsing
- `@sinclair/typebox` 0.34.41 - JSON Schema type builder
- `picocolors` 1.1.1 - Minimal color library

**Development:**
- `@types/node` 24.12.0 - Node.js type definitions
- `jiti` 2.6.1 - TypeScript executor for build scripts

## Configuration

**TypeScript:**
- Base: `tsconfig.json` (ES2022, NodeNext, strict mode)
- Extensions: `tsconfig.extensions.json` (extension resources)
- Resources: `tsconfig.resources.json` (bundled resources)
- Compilation target: `dist/`, source root: `src/`

**Environment:**
- No `.env` files required for core CLI (LLM API keys passed via CLI flags or env vars)
- Web mode loads keys from `process.env` via `getEnvApiKey()` in `packages/pi-ai/src/web-runtime-env-api-keys.ts`
- Supported env vars per provider (stored in models registry)

**Build Artifacts:**
- `dist/` - Compiled TypeScript + resources
- `.next/` - Next.js web build (standalone server for web UI)
- `native/crates/target/` - Rust compiled binaries (darwin-{arm64,x64}, linux-{arm64-gnu,x64-gnu}, win32-x64-msvc)

## Platform Requirements

**Development:**
- Node.js 22 LTS (Node 24 recommended for v24-bookworm Docker images)
- npm 10.9.3
- Rust toolchain (stable) for native module rebuilds
- Python, Go, Java, Rust, etc. for ecosystem-specific worktree health checks

**Production/Deployment:**
- Standalone Node.js executable (npm package: `gsd-pi`)
- Docker container: `ghcr.io/gsd-build/gsd-pi` (runtime image)
- Docker builder: `ghcr.io/gsd-build/gsd-ci-builder` (CI compilation)
- Git-capable environment (required for repo operations)
- System tools: bash/PowerShell, grep, file operations

**Optional Dependencies:**
- `@gsd-build/engine-*` - Platform-specific native engines (darwin-arm64, darwin-x64, linux-{arm64-gnu,x64-gnu}, win32-x64-msvc)
- `fsevents` (macOS) - Native file system events
- `koffi` 2.9.0 - Foreign function interface for system calls

## Compilation Targets

**Native Modules (Rust):**
- `engine` - Core git/file system operations
- `grep` - High-performance text search (replaces grep binary dependency)
- `ast` - Abstract syntax tree parsing

**Multi-Platform Builds:**
- macOS: arm64, x64 (via `darwin-arm64`/`darwin-x64` engine packages)
- Linux: x64 (gnu), arm64 (gnu) (via `linux-x64-gnu`, `linux-arm64-gnu`)
- Windows: x64 (msvc) (via `win32-x64-msvc`)

---

*Stack analysis: 2026-03-24*
