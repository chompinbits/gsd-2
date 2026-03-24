# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
gsd-2/
├── src/                        # Main CLI and service layer
├── packages/                   # Shared workspace packages
│   ├── pi-coding-agent/        # Core agent engine
│   ├── pi-ai/                  # Models and provider APIs
│   ├── pi-tui/                 # Terminal UI components
│   └── pi-agent-core/          # Agent foundation types
├── web/                        # Next.js web frontend
├── native/                     # Rust native tools (fd, rg)
├── studio/                     # Studio/IDE utilities
├── tests/                      # Integration and fixture tests
├── docs/                       # Documentation and guides
├── scripts/                    # Build and utility scripts
├── vscode-extension/           # VS Code extension (external)
└── pkg/                        # Config shim for branding
```

## Directory Purposes

**src/ - CLI and Service Layer:**
- Purpose: Entry point, CLI routing, and backend services
- Contains: TypeScript source files
- Key structure:
  - `loader.ts`: Bootstrap entry point
  - `cli.ts`: Main command router
  - `headless.ts/headless-*.ts`: Orchestration APIs
  - `web/`: Service modules (17+ files)
  - `resources/`: Bundled skills and extensions
  - `tests/`: Unit and integration tests

**packages/ - Shared Modules:**
- Purpose: Modular, reusable libraries
- Contains: Independent npm workspaces
- Structure:
  - Each package has src/, dist/, package.json, tsconfig.json
  - Published separately to npm registry
  - Used by main `src/` and by external consumers

**web/ - Next.js Frontend:**
- Purpose: Browser-based UI for session management
- Contains: React components, pages, styles, hooks
- Key structure:
  - `app/`: Next.js App Router pages (layout, API routes)
  - `components/`: Reusable React components (using shadcn UI)
  - `lib/`: Utilities, hooks, contract types
  - `styles/`: CSS and Tailwind configuration
  - `public/`: Static assets (icons, etc.)

**packages/pi-coding-agent/ - Core Agent:**
- Purpose: Main coding agent runtime engine
- Contains: 
  - `core/`: Agent session, auth storage, compaction
  - `modes/`: Execution modes (interactive, rpc, print)
  - `extensions/`: Extension system, hooks, context
  - `tools/`: Built-in tools (read, write, bash, etc.)

**packages/pi-ai/ - Models and APIs:**
- Purpose: Unified interface to AI providers
- Contains:
  - `providers/`: Implementations for Claude, OpenAI, Google, Mistral, etc.
  - `types.ts`: API contracts, message types, tool definitions
  - `api-registry.ts`: Provider registration system
  - `models.ts/models.generated.ts`: Model catalog

**packages/pi-tui/ - Terminal UI:**
- Purpose: Interactive terminal interface for local sessions
- Contains: TUI rendering, layout system, input handling
- Used by: Interactive mode (local terminal sessions)

**src/resources/ - Bundled Assets:**
- Purpose: Provide default skills, agents, and extensions
- Contains:
  - `skills/`: GSD-cli skills (.gsd-skill.md files)
  - `agents/`: Agent configurations
  - `extensions/`: JavaScript extensions (gsd, browser-tools, etc.)
- Also includes: Themes, HTML export templates

**native/ - Rust Native Tools:**
- Purpose: High-performance utilities
- Contains:
  - `crates/`: Individual Rust crates
  - `npm/`: Node.js bindings
  - `scripts/`: Build configuration
- Provides: `fd` and `rg` binaries for efficient search

## Key File Locations

**Entry Points:**
- `src/loader.ts`: CLI bootstrap (fast ~version/--help)
- `src/cli.ts`: Main argument parser and mode router
- `web/app/page.tsx`: Web frontend home page
- `web/app/api/`: REST API endpoints for backend

**Configuration:**
- `package.json`: Root workspace config, build scripts
- `tsconfig.json`: TypeScript configuration
- `tsconfig.extensions.json`: Config for extensions (with jiti loader)
- `web/next.config.mjs`: Next.js configuration
- `web/tailwind.config.ts`: Tailwind CSS setup
- `web/components.json`: shadcn UI components registry

**Core Logic:**
- `packages/pi-coding-agent/src/core/agent-session.ts`: Main session class
- `src/web/bridge-service.ts`: RPC bridge between web and agent
- `src/app-paths.ts`: Path resolution (~/.gsd, ~/.gsd/agent, etc.)
- `src/extension-registry.ts`: Extension discovery and loading

**Testing:**
- `src/tests/*.test.ts`: Unit tests (Node.js native test runner)
- `src/resources/extensions/gsd/tests/*.test.ts`: Extension tests
- `tests/smoke/`: Smoke tests
- `tests/fixtures/`: Fixture-based tests
- `tests/live/`: Live integration tests

**Resources:**
- `src/resources/extensions/gsd/skills/`: Built-in .gsd-skill.md files
- `src/resources/extensions/gsd/agents/`: Agent definitions
- `src/resources/themes/`: VS Code theme JSON files
- `src/resources/export-html/`: HTML export templates

## Naming Conventions

**Files:**
- Index files: `index.ts` (exports from directory)
- Service modules: `*-service.ts` (`git-summary-service.ts`, `onboarding-service.ts`)
- Types/contracts: `*-contract.ts`, `*-types.ts` (`session-browser-contract.ts`)
- Tests: `*.test.ts`, `*.test.mjs` (mixing Node.js test and Jest-style)
- Utilities: `*-utils.ts` or standalone in lib/

**Directories:**
- Plural for collections: `src/tests/`, `src/resources/`, `packages/`
- Singular for domains: `src/web/`, `web/app/`, `web/lib/`
- Feature-specific: `web/components/`, `web/hooks/`

**Exports:**
- Barrel files: `index.ts` re-exports from directory
- Example: `packages/pi-ai/src/index.ts` exports from `providers/`, `api-registry.ts`, etc.

## Where to Add New Code

**New Service/Feature:**
1. Create module in `src/web/{feature}-service.ts`
2. Export async functions or classes
3. Import in `src/web/bridge-service.ts` if exposing via API
4. Add REST route in `web/app/api/{feature}/` if needed

**New Extension/Skill:**
1. Create skill in `src/resources/extensions/gsd/skills/{name}.gsd-skill.md`
2. Or create agent in `src/resources/extensions/gsd/agents/{name}.agent.md`
3. Or create extension in `src/resources/extensions/{name}/` directory
4. Load at runtime via extension registry (auto-discovered)

**New CLI Command:**
1. Add case handler in `src/cli.ts` main switch statement
2. Implement logic in separate module (e.g., `src/{command}-cmd.ts`)
3. Export and call from cli.ts

**New Web Component:**
1. Create in `web/components/` directory
2. Use shadcn/ui base components from `web/components/ui/`
3. Use hooks from `web/lib/` (use-editor-font-size, use-terminal-font-size, etc.)
4. Import in page or layout

**New Package (Library):**
1. Create directory in `packages/{package-name}/`
2. Create `package.json`, `tsconfig.json`, `src/index.ts`
3. Add to workspace in root `package.json`
4. Cross-import via `@gsd/{package-name}`

## Special Directories

**~/.gsd/ - User Config Root:**
- Purpose: Per-user GSD configuration and state
- Generated: Yes, on first run
- Committed: No (only in dotfiles repos)
- Contains:
  - `agent/`: Agent sessions
  - `auth.json`: API credentials

**~/.gsd/agent/sessions/ - Session Storage:**
- Purpose: Persist individual agent sessions
- Structure: `{sessionId}/` directories with messages, state
- Format: JSON message history and session metadata
- Lifecycle: Created on `gsd` command, resumed, forked, deleted

**src/resources/ - Bundled Defaults:**
- Purpose: Default skills, agents, extensions shipped with GSD
- Generated: No (committed to repo)
- Committed: Yes (part of distribution)
- Used by: Extension discovery on first load

**.planning/ - GSD Workflow State:**
- Purpose: Phase planning, requirements, verification (GSD internal)
- Generated: Yes, during project planning (`/gsd-*` commands)
- Committed: Yes (artifact of workflow)
- Contains: PLAN.md, phases, UAT, implementation notes

**dist/ - Compiled Output:**
- Purpose: JavaScript compiled from TypeScript
- Generated: Yes, by `npm run build`
- Committed: No (in .gitignore, published to npm only)
- Entry: `dist/loader.js` (from `src/loader.ts`)

**web/.next/ - Next.js Build Output:**
- Purpose: Compiled web application
- Generated: Yes, by `npm run build` or dev server
- Committed: No (in .gitignore)
- Served: By `next` CLI or packaged standalone

---

*Structure analysis: 2026-03-24*
