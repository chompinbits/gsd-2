# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**Large Language Models (LLM Providers):**
- Anthropic Claude - SDK: `@anthropic-ai/sdk`, Auth env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_OAUTH_TOKEN`
- OpenAI (GPT-4, o1) - SDK: `openai@6.26.0`, Auth: `OPENAI_API_KEY`
- Google Gemini - SDK: `@google/genai`, Auth: `GEMINI_API_KEY`
- Google Vertex AI (Claude) - SDK: `@anthropic-ai/vertex-sdk`, Auth: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`
- AWS Bedrock (Claude, Nova) - SDK: `@aws-sdk/client-bedrock-runtime`, Auth: `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BEARER_TOKEN_BEDROCK`
- Mistral AI - SDK: `@mistralai/mistralai`, Auth: `MISTRAL_API_KEY`
- GitHub Copilot - SDK: `openai` (compatible), Auth: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`
- Groq - SDK: OpenAI-compatible, Auth: `GROQ_API_KEY`
- Cerebras - SDK: OpenAI-compatible, Auth: `CEREBRAS_API_KEY`
- xAI (Grok) - SDK: OpenAI-compatible, Auth: `XAI_API_KEY`
- OpenRouter - SDK: OpenAI-compatible, Auth: `OPENROUTER_API_KEY`
- Vercel AI Gateway - SDK: OpenAI-compatible, Auth: `AI_GATEWAY_API_KEY`
- ZAI (Reasoning) - SDK: Custom, Auth: `ZAI_API_KEY`
- MiniMax - SDK: Custom, Auth: `MINIMAX_API_KEY`, `MINIMAX_CN_API_KEY`
- HuggingFace - SDK: Custom, Auth: `HF_TOKEN`
- OpenCode - SDK: Custom, Auth: `OPENCODE_API_KEY`
- Kimi (Coding) - SDK: Custom, Auth: `KIMI_API_KEY`
- Alibaba Coding - SDK: Custom, Auth: `ALIBABA_API_KEY`
- Azure OpenAI - SDK: `openai` (Azure compatible), Auth: `AZURE_OPENAI_API_KEY`

**Implementation Location:** `packages/pi-ai/src/providers/`
- Provider modules: `anthropic.ts`, `openai-*.ts`, `bedrock.ts`, `vertex.ts`, `mistral.ts`, `google-*.ts`
- Dynamic provider loading via provider type dispatch
- Model registry: `packages/pi-ai/src/models.generated.ts` (auto-generated, ~2700+ models)

**SDK Configuration:**
- Base URLs: Provider-specific (OpenAI: api.openai.com, Anthropic: api.anthropic.com, AWS: bedrock-runtime.{region}.amazonaws.com)
- Custom OpenAI-compatible APIs supported via `baseUrl` and `compat` settings
- Token budgets configurable per thinking level (reasoning models)
- Price data embedded in models registry (input/output/cache rates)

## Data Storage

**Databases:**
- SQLite (in-memory) - via `sql.js@1.14.1` - Used in browser/headless contexts for temporary data
- File-based (local project state) - `.gsd/` directory for worktrees and milestone tracking
- No persistent server-side database

**File Storage:**
- Local filesystem only - Git repository as primary storage
- `.gsd/` structure for state: milestones, worktrees, task completion, cost tracking

**Caching:**
- Prompt caching native to LLM providers (Anthropic, OpenAI, Claude via Vertex)
- `cache_read_tokens`, `cache_write_tokens` tracking in usage metrics
- No external cache layer (Redis, Memcached, etc.)

## Authentication & Identity

**Auth Provider:**
- Multi-provider support - no centralized auth system
- Per-provider API keys/tokens via environment variables or CLI flags
- OAuth support for GitHub Copilot (COPILOT_GITHUB_TOKEN)
- GCP ADC (Application Default Credentials) for Google Vertex
- AWS credential chain (IAM roles, profiles, tokens) for Bedrock
- Zero persistent session (stateless CLI tool)

**Implementation:** `packages/pi-ai/src/web-runtime-env-api-keys.ts`
- Env var lookup per provider
- Credentials stored in user's environment, not in application
- V1 auth data signature verification for message integrity

## Git & Version Control

**Repository Operations:**
- Native Git via `engine` crate (Rust) - `native/crates/engine/`
- High-performance operations: branch creation, merge, diff
- Worktree management for parallel task isolation
- Squash-merge atomicity via native implementation
- Cross-compilation support (darwin-arm64, linux-x64-gnu, win32-x64-msvc)

**Git-Related Tools:**
- `@octokit/rest` 22.0.1 - GitHub API for PR creation, branch info
- `ignore` library - .gitignore pattern matching
- `diff` library 8.0.2 - Text diffing for change display

## API Clients

**GitHub:**
- Client: `@octokit/rest` 22.0.1
- Use cases: PR queries, branch operations, marketplace discovery
- Environment: `GITHUB_TOKEN` for auth (also accepts `GH_TOKEN`)

**HTTP/Network:**
- `undici` 7.24.2 - Modern HTTP client for API calls
- `proxy-agent` 6.5.0 - HTTP/HTTPS/SOCKS proxy support
- `fetch` (Node.js native) - Primary HTTP API

## File & Media Processing

**Image Processing:**
- `sharp` 0.34.5 - High-performance image resizing/encoding (JPEG, PNG, WebP, AVIF)
- `@silvia-odwyer/photon-node` 0.3.4 - Visual effects (Rust-based Photon library)
- Used for: Vision model inputs, resource thumbnails

**Zip Archive:**
- `extract-zip` 2.0.1 - ZIP extraction for extension packages
- Used for: Marketplace extension installation

**File Type Detection:**
- `file-type` 21.1.1 - Magic bytes detection (binary vs text)
- Used for: Safe file handling in various tools

## Monitoring & Observability

**Error Tracking:**
- None (external) - Errors logged locally to `.gsd/` state files
- Integration-agnostic: clients can capture errors from stdout/stderr

**Logs:**
- Console output (stdout/stderr) - User-visible progress and debug info
- State files: `.gsd/CONTEXT.md`, `.gsd/PLAN.md` - Persistent task tracking
- Session stats: input/output tokens, cost, errors tracked in memory

**Cost & Token Tracking:**
- Per-message token counts (input, output, cache_read, cache_write)
- Price calculation from embedded rate data (models registry)
- Cumulative tracking: `SessionStats` with `totalTokens`, `estimatedCost`
- No external billing service integration

## Browser Automation

**Testing & Simulation:**
- Playwright 1.58.2 - Chromium, Firefox, WebKit
- Browser tools suite: `src/resources/extensions/browser-tools/`
- Live browser testing: full page rendering, screenshot capture
- Used for: Web integration tests, browser-based tool validation

## CI/CD & Deployment

**Hosting/Distribution:**
- npm registry - package published as `gsd-pi@{version}`
- GitHub releases - binary artifacts and signatures
- Docker registries - `ghcr.io/gsd-build/gsd-pi` (runtime), `ghcr.io/gsd-build/gsd-ci-builder` (builder)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`) - Build, test, publish
- Multi-platform builds: darwin-{arm64,x64}, linux-{arm64-gnu,x64-gnu}, win32-x64-msvc
- Automated changelog generation and version bumping
- Docker multi-stage builds (builder → runtime)

**Package Management:**
- npm workspace monorepo - local linked packages during dev
- Postinstall script: `scripts/postinstall.js` - Ensures workspaces built before use
- Optional dependencies: platform-specific native engines

## Webhooks & Callbacks

**Incoming:**
- None - CLI-driven (user-initiated commands)
- MCP server mode: stdin/stdout for tool requests from external hosts

**Outgoing:**
- Git push operations - Updates remote branches
- GitHub PR creation via Octokit - Comments, labels, status checks
- No polling or async callback patterns

## Development & Testing Infrastructure

**Test Runners:**
- Node native test runner - Primary unit/integration tests
- Playwright - Browser automation and E2E tests
- Fixtures framework - Test data recording/playback for deterministic tests
- Coverage reporting: c8 with 50% statements/lines, 20% branches/functions thresholds

**Development Servers:**
- Web UI: Next.js dev server (`npm run dev` in `web/`)
- CLI dev mode: TypeScript recompilation on file changes
- Browser tools live testing via Playwright

**Utilities:**
- JITI - TypeScript module execution (dynamic imports in build scripts)
- File watchers: Chokidar 5.0.0 for dev rebuild triggers
- Secret scanning: `scripts/secret-scan.sh` - Prevents credential leaks in commits

---

*Integration audit: 2026-03-24*
