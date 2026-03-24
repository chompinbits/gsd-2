# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- Kebab-case with `.ts` or `.tsx` extension: `web-mode.ts`, `headless-context.ts`, `artifact-manager.ts`
- Test files: `{name}.test.ts` pattern, located in `src/tests/` directory
- Integration tests: `{name}.test.ts` in `src/tests/integration/` subdirectory

**Functions:**
- camelCase for regular functions: `parseCliArgs()`, `resolveSearchProvider()`, `makeTmpAuth()`
- camelCase for arrow functions: `const withEnv = (vars: ...) => { ... }`
- PascalCase for exported class methods: `createWindow()`, `streamOpenAIResponses()`

**Variables:**
- camelCase: `projectRoot`, `launchInputs`, `spawnInvocation`, `stderrOutput`
- Constants in UPPERCASE with underscores: `PROJECT_ROOT`, `OPENAI_TOOL_CALL_PROVIDERS`
- Scoped constants with Set/Object definitions: `const OPENAI_TOOL_CALL_PROVIDERS = new Set([...])`

**Types:**
- PascalCase for interfaces: `RpcSessionState`, `ModelInfo`, `SessionStats`, `StreamOptions`
- PascalCase for type aliases
- Descriptive names: `OpenAIResponsesOptions`, `BashResult`, `AgentEvent`

**Exports:**
- Named exports preferred: `export interface RpcSessionState { ... }`
- Barrel files use `export * from './module.js'` pattern for re-exporting (`packages/pi-ai/src/index.ts`)
- Default exports rare; specific named exports favored

## Code Style

**Formatting:**
- ESLint used for linting; ESLint configuration in `web/eslint.config.mjs`
- Biome support referenced in LSP defaults (`packages/pi-coding-agent/src/core/lsp/defaults.json`)
- TypeScript strict mode enabled in `tsconfig.json`
- Target: ES2022, Module: NodeNext

**Linting:**
- eslint-disable comments for specific violations: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- biome-ignore used for biome-specific supression: `// biome-ignore lint/correctness/noSwitchDeclarations: fine`
- Comments explain the suppression reason

**Indentation & Whitespace:**
- Tabs used for indentation (observed in test files)
- Comments use visual separators:
  ```typescript
  // ─── Helpers ──────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Descriptive Section Header
  // ═══════════════════════════════════════════════════════════════════════════
  ```

## Import Organization

**Order:**
1. Node.js built-in modules (e.g., `node:fs`, `node:path`)
2. Third-party packages (e.g., `chalk`, `zod-to-json-schema`)
3. Type imports from packages (e.g., `type { Model } from "../types.js"`)
4. Local relative imports (e.g., `from "../utils/helpers.js"`)

**Pattern Examples:**
```typescript
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js"
import { getEnvApiKey } from "../env-api-keys.js"
import type { Context, Model, StreamFunction } from "../types.js"
import { AssistantMessageEventStream } from "../utils/event-stream.js"
```

**Path Aliases:**
- Relative paths are preferred
- Workspace packages imported via `@gsd/{package}` (e.g., `@gsd/pi-coding-agent`, `@gsd/pi-ai`)
- .js extensions included for ESM compatibility

**Type Imports:**
- `import type { ... }` used for types to enable tree-shaking
- Separate type imports from value imports

## Error Handling

**Patterns:**
- Use `throw new Error("message")` for immediate errors: `throw new Error("Invalid token")`
- Error messages are descriptive and include context: `throw new Error(response.error ?? "Unknown RPC error")`
- No custom error classes; standard Error constructor preferred
- Error propagation through async/await with try/finally
- Graceful fallback patterns with null checks: `getEnvApiKey(model.provider) || ""`

**Try/Finally Patterns:**
```typescript
try {
  // operation
} finally {
  cleanup() // ensure cleanup runs even if error thrown
}
```

## Logging

**Framework:** Mostly `console` module (console.log, console.error)

**Patterns:**
- `console.log()` for informational output
- `console.error()` for error messages
- `process.stderr.write()` for direct stderr output with formatting
- Chalk library used for colored output: `chalk.yellow()`, `chalk.bold()`, `chalk.dim()`
- Tagged output with prefix: `[gsd]` or `[studio]` tags

**Example:**
```typescript
process.stderr.write(
  `[gsd] ${chalk.yellow('Version mismatch detected')}\n` +
  `[gsd] Synced resources are from ${chalk.bold(`v${managedVersion}`)}, but this \`gsd\` binary is ${chalk.dim(`v${currentVersion}`)}.\n`
)
```

**No logger framework:** No Winston, Pino, or similar; direct console calls expected

## Comments

**When to Comment:**
- Section headers with visual separators (see Indentation section)
- Complex logic or non-obvious workarounds
- Warnings about side effects or platform-specific behavior
- Lazy-loading notes: "Lazy-loaded: OpenAI SDK is imported on first use..."

**JSDoc/TSDoc:**
- Used for function descriptions and public exports
- Format: `/** description */` followed by `@param` and return type hints
- Example:
```typescript
/**
 * Tests for ArtifactManager: sequential ID allocation, save/retrieve,
 * and session resume (ID continuity).
 */

/**
 * Resolve cache retention preference.
 * Defaults to "short" and uses PI_CACHE_RETENTION for backward compatibility.
 */
function resolveCacheRetention(cacheRetention?: CacheRetention): CacheRetention {
  // ...
}
```

**Disabling Linting Rules:**
- Use lint-disable comments with explanation: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Place immediately above the problematic line

## Function Design

**Size:** Functions are focused and single-purpose; helpers extracted to separate functions for reusability

**Parameters:**
- Avoid parameter objects when ≤3 parameters
- Use object destructuring for options/config: `{ cwd, projectSessionsDir, agentDir }`
- Type all parameters explicitly

**Return Values:**
- Functions return specific types, not union types where possible
- Async functions return Promise: `Promise<RunResult>`
- Helper functions often return { ..., cleanup: () => void } for resource management

**Example Pattern:**
```typescript
function makeTmpAuth(data: Record<string, unknown> = {}): { authPath: string; cleanup: () => void } {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-provider-test-'))
  const authPath = join(tmp, 'auth.json')
  writeFileSync(authPath, JSON.stringify(data))
  return { authPath, cleanup: () => rmSync(tmp, { recursive: true, force: true }) }
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel file pattern: `index.ts` re-exports all public symbols
- Type exports separated: `export type { ... }` and `export { ... }`

**Lazy Imports:**
- Dynamic imports via `await import(...)` used for optional dependencies
- Imports at function call time to defer initialization
- Example: `const { resolveSearchProvider } = await import('../provider.ts')`

**File Organization:**
- Utility functions grouped in helper sections marked with visual comment dividers
- Main logic follows helper functions
- Related constants defined near usage or at module top

---

*Convention analysis: 2026-03-24*
