/**
 * Source-shape tests for CLI dispatch blocks added in Phase 8 plan 03.
 *
 * Verifies that src/cli.ts contains correct dispatch wiring for:
 *   - `gsd execute-phase` → runExecuteWorkflow (SC1)
 *   - `gsd verify-work`   → runVerifyWorkflow  (SC2)
 *   - resolvePlanningBackendFromSettings() controls both paths (SC3)
 *
 * Uses readFileSync + regex assertions — no runtime execution, no SDK deps.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CLI_SOURCE = readFileSync(
  join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, 'cli.ts'),
  'utf-8',
)

// ═══════════════════════════════════════════════════════════════════════════
// 1. Dispatch block presence (SC1, SC2)
// ═══════════════════════════════════════════════════════════════════════════

describe('execute-phase dispatch block', () => {
  it('contains execute-phase message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'execute-phase'`),
      'cli.ts must contain execute-phase dispatch block',
    )
  })

  it('imports runExecuteWorkflow from ./workflows/execute-phase.js', () => {
    assert.match(CLI_SOURCE, /runExecuteWorkflow.*=.*await import\(['"]\.\/workflows\/execute-phase\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in execute-phase block', () => {
    // Find the execute-phase block and verify it has the backend resolution call
    const executeBlock = CLI_SOURCE.slice(
      CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'execute-phase'`),
      CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'verify-work'`),
    )
    assert.ok(
      executeBlock.includes('resolvePlanningBackendFromSettings()'),
      'execute-phase block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-10 telemetry with backend and tier for execute-phase', () => {
    assert.match(CLI_SOURCE, /\[execute-phase\] backend=/)
  })
})

describe('verify-work dispatch block', () => {
  it('contains verify-work message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'verify-work'`),
      'cli.ts must contain verify-work dispatch block',
    )
  })

  it('imports runVerifyWorkflow from ./workflows/verify-work.js', () => {
    assert.match(CLI_SOURCE, /runVerifyWorkflow.*=.*await import\(['"]\.\/workflows\/verify-work\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in verify-work block', () => {
    // Find the verify-work block and verify it has the backend resolution call
    const verifyStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'verify-work'`)
    const verifyEnd = CLI_SOURCE.indexOf('ensureManagedTools', verifyStart)
    const verifyBlock = CLI_SOURCE.slice(verifyStart, verifyEnd)
    assert.ok(
      verifyBlock.includes('resolvePlanningBackendFromSettings()'),
      'verify-work block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-10 telemetry with backend and tier for verify-work', () => {
    assert.match(CLI_SOURCE, /\[verify-work\] backend=/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Total backend routing coverage (SC3)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolvePlanningBackendFromSettings call count', () => {
  it('is called exactly 4 times across all dispatch blocks (discuss, plan, execute, verify)', () => {
    // Count call sites via assignment pattern (excludes function definition line)
    const matches = CLI_SOURCE.match(/=\s*resolvePlanningBackendFromSettings\(\)/g)
    assert.equal(
      matches?.length ?? 0,
      4,
      `Expected 4 resolvePlanningBackendFromSettings() call sites, got ${matches?.length ?? 0}`,
    )
  })
})
