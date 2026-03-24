# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner:**
- Node.js built-in test runner (node:test module)
- No external test framework needed; batteries included in Node 18+
- Config: `package.json` scripts define test commands

**Assertion Library:**
- `node:assert/strict` — strict equality assertions
- Imported as: `import assert from 'node:assert/strict'`

**Run Commands:**
```bash
npm run test:unit              # Run unit tests (src/tests/*.test.ts)
npm run test:integration      # Run integration tests (src/tests/integration/*.test.ts)
npm run test:coverage         # Generate coverage report with c8
npm run test                  # Run test:unit && test:integration
npm run test:smoke           # Black-box CLI smoke tests
npm run test:browser-tools   # Browser tools specific tests
npm run test:native          # Native module tests
npm run test:secret-scan     # Secret scanner tests
npm run test:marketplace     # Marketplace discovery tests
npm run test:live            # Live tests requiring API keys
```

**Coverage:**
- Tool: `c8` (coverage reporter)
- Configuration in `package.json` scripts
- Target thresholds: statements=50, lines=50, branches=20, functions=20
- Exclude patterns: tests, scripts, native, node_modules

## Test File Organization

**Location:**
- Unit tests: `src/tests/{name}.test.ts`
- Integration tests: `src/tests/integration/{name}.test.ts`
- Resource/extension tests: `src/resources/extensions/*/tests/*.test.ts` or `*.test.mjs`

**Naming:**
- Pattern: `{module-or-feature}.test.ts`
- Examples: `provider.test.ts`, `artifact-manager.test.ts`, `web-mode-cli.test.ts`, `secret-scan.test.ts`
- One test file per module being tested

**File Count:**
- 50+ test files documented (as of analysis date)
- Files distributed across `src/tests/`, `src/tests/integration/`, and `src/resources/extensions/gsd/tests/`

## Test Structure

**Suite Organization:**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function helperName(): ReturnType {
  // ...
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Section Title
// ═══════════════════════════════════════════════════════════════════════════

test('test description', () => {
  // arrange
  // act
  assert.equal(actual, expected)
})

test('another test', () => {
  // test body
})
```

**Patterns:**

1. **Helpers Section:** Test utilities grouped at the top with visual separators
   ```typescript
   function withEnv(
     vars: Record<string, string | undefined>,
     fn: () => void,
   ): void {
     const originals: Record<string, string | undefined> = {}
     // capture and restore env vars
   }
   ```

2. **Section Headers:** Logical grouping with visual separators
   ```typescript
   // ═══════════════════════════════════════════════════════════════════════════
   // 1. resolveSearchProvider — 8 scenarios
   // ═══════════════════════════════════════════════════════════════════════════
   ```

3. **Setup/Teardown:** Try/finally pattern for resource cleanup
   ```typescript
   test('description', () => {
     const { sessionFile, cleanup } = makeTmpSession()
     try {
       // test body
       assert.ok(expected)
     } finally {
       cleanup() // ensures cleanup even if assertion fails
     }
   })
   ```

4. **Async Tests:** Standard async/await
   ```typescript
   test('async test', async () => {
     const { resolveSearchProvider } = await import('../provider.ts')
     const result = await someAsyncFn()
     assert.equal(result, expected)
   })
   ```

5. **Test Options:** Using test second parameter for skip/skip conditions
   ```typescript
   test('detects AWS access key', { skip: isWindows }, () => {
     // skipped on Windows platforms
   })
   ```

## Mocking

**Framework:** No dedicated mocking library (sinon, jest.mock, etc.)

**Patterns:**

1. **Dependency Injection:** Pass mock implementations as test parameters
   ```typescript
   const status = await launchWebMode(
     { cwd: '/tmp', projectSessionsDir: '...' },
     {
       initResources: () => { initResourcesCalled = true },
       resolvePort: async () => 45123,
       spawn: (command, args, options) => {
         spawnInvocation = { command, args, options }
         return { pid: 99999, unref: () => {} } as any
       },
     },
   )
   ```

2. **Environment Variable Mocking:** Store originals, mutate, restore in finally
   ```typescript
   function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
     const originals: Record<string, string | undefined> = {}
     for (const key of Object.keys(vars)) {
       originals[key] = process.env[key]
       if (vars[key] === undefined) {
         delete process.env[key]
       } else {
         process.env[key] = vars[key]
       }
     }
     try {
       fn()
     } finally {
       // restore all original values
     }
   }
   ```

3. **File System Mocks:** Use real temp directories, clean up in finally
   ```typescript
   const tmp = mkdtempSync(join(tmpdir(), 'test-prefix-'))
   try {
     writeFileSync(path, content)
     // test against real files
   } finally {
     rmSync(tmp, { recursive: true, force: true })
   }
   ```

4. **What NOT to Mock:**
   - File system operations (use temp directories instead)
   - Node.js built-in imports (use real APIs)
   - Child process spawning for integration tests

## Fixtures and Factories

**Test Data:**
Factory functions return objects with cleanup handlers:
```typescript
function makeTmpAuth(data: Record<string, unknown> = {}): {
  authPath: string
  cleanup: () => void
} {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-provider-test-'))
  const authPath = join(tmp, 'auth.json')
  writeFileSync(authPath, JSON.stringify(data))
  return {
    authPath,
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  }
}
```

**Location:**
- Fixtures defined within test files (no separate fixtures directory)
- Factory functions placed before test suite sections
- Reusable test helpers in helper section at top of file

**Pattern:**
```typescript
function makeTestResource(config = {}): { resource: Thing; cleanup: () => void } {
  const tmp = mkdtempSync(...)
  const resource = new Thing(tmp)
  return {
    resource,
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  }
}
```

## Coverage

**Requirements:** 50% minimum per metric (statements, lines) with biome-ignore available for gaps

**Metrics:**
- Statements: 50%
- Lines: 50%
- Branches: 20%
- Functions: 20%

**View Coverage:**
```bash
npm run test:coverage  # Generates LCOV report in coverage/
```

**Tools:**
- `c8`: Code coverage reporter
- Coverage output: text reporter + LCOV file format
- Reports generated to `coverage/` directory

## Test Types

**Unit Tests:**
- Scope: Individual functions, modules, classes
- Location: `src/tests/{name}.test.ts`
- Run: `npm run test:unit`
- Approach: Direct function/method calls with assertions
- No external dependencies or API calls

**Integration Tests:**
- Scope: Multi-module interactions, contracts between components
- Location: `src/tests/integration/{name}.test.ts`
- Run: `npm run test:integration`
- Approach: Test entire workflows (e.g., CLI entry, web mode launch)
- May spawn child processes, use real filesystems
- Examples: `web-mode-cli.test.ts` (CLI → web launcher flow)

**E2E Smoke Tests:**
- Scope: Full CLI binary execution
- Location: `src/tests/integration/e2e-smoke.test.ts`
- Run: Not in default `npm test`; requires `npm run build` first
- Approach: Black-box testing by spawning `node dist/loader.js` as child process
- Assertion on exit codes, stdout/stderr output
- No API keys required; gracefully handles "No model selected" paths

**Regression/Live Tests:**
- Scope: Real API integrations, requires credentials
- Location: `src/tests/` or separate test suites
- Run: Set `GSD_LIVE_TESTS=1 npm run test:live`
- Approach: Authenticate with real providers, test actual responses
- Platform-specific: Skipped on Windows (require bash/POSIX)

## Common Patterns

**Async Testing:**
```typescript
test('async operation', async () => {
  const result = await asyncFunction()
  assert.equal(result, expected)
})
```

**Error Testing:**
```typescript
test('throws on invalid input', () => {
  assert.throws(() => {
    functionThatThrows()
  }, /Expected error message/)
})
```

**Output Assertion with Regex:**
```typescript
test('output contains pattern', () => {
  const result = someOperation()
  assert.match(result.stdout, /version \d+\.\d+/)
  assert.match(result.stderr, /error text/i)
})
```

**Skip Conditions:**
```typescript
const isWindows = platform() === 'win32'

test('POSIX-only test', { skip: isWindows }, () => {
  // test body
})
```

**Process Spawning for CLI Testing:**
```typescript
function runGsd(args: string[], timeoutMs = 8_000): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const child = spawn('node', [loaderPath, ...args], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.stdin.end() // non-TTY
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code, timedOut: false })
    })
  })
}
```

---

*Testing analysis: 2026-03-24*
