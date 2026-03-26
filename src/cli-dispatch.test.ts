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

describe('new-project dispatch block', () => {
  it('contains new-project message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'new-project'`),
      'cli.ts must contain new-project dispatch block',
    )
  })

  it('imports runRoadmapWorkflow from ./workflows/roadmap.js', () => {
    assert.match(CLI_SOURCE, /runRoadmapWorkflow.*=.*await import\(['"]\.\/workflows\/roadmap\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in new-project block', () => {
    const blockStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'new-project'`)
    const blockEnd = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'new-milestone'`, blockStart)
    const block = CLI_SOURCE.slice(blockStart, blockEnd)
    assert.ok(
      block.includes('resolvePlanningBackendFromSettings()'),
      'new-project block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-05 telemetry with stage=roadmap for new-project', () => {
    assert.match(CLI_SOURCE, /\[new-project\] backend=.*stage=roadmap/)
  })
})

describe('new-milestone dispatch block', () => {
  it('contains new-milestone message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'new-milestone'`),
      'cli.ts must contain new-milestone dispatch block',
    )
  })

  it('imports runRoadmapWorkflow from ./workflows/roadmap.js for new-milestone', () => {
    // Multiple import sites exist — verify at least one roadmap.js import
    assert.match(CLI_SOURCE, /runRoadmapWorkflow.*=.*await import\(['"]\.\/workflows\/roadmap\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in new-milestone block', () => {
    const blockStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'new-milestone'`)
    const blockEnd = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'add-phase'`, blockStart)
    const block = CLI_SOURCE.slice(blockStart, blockEnd)
    assert.ok(
      block.includes('resolvePlanningBackendFromSettings()'),
      'new-milestone block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-05 telemetry with stage=roadmap for new-milestone', () => {
    assert.match(CLI_SOURCE, /\[new-milestone\] backend=.*stage=roadmap/)
  })
})

describe('add-phase dispatch block', () => {
  it('contains add-phase message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'add-phase'`),
      'cli.ts must contain add-phase dispatch block',
    )
  })

  it('imports runRoadmapWorkflow from ./workflows/roadmap.js for add-phase', () => {
    assert.match(CLI_SOURCE, /runRoadmapWorkflow.*=.*await import\(['"]\.\/workflows\/roadmap\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in add-phase block', () => {
    const blockStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'add-phase'`)
    const blockEnd = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'remove-phase'`, blockStart)
    const block = CLI_SOURCE.slice(blockStart, blockEnd)
    assert.ok(
      block.includes('resolvePlanningBackendFromSettings()'),
      'add-phase block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-05 telemetry with stage=roadmap for add-phase', () => {
    assert.match(CLI_SOURCE, /\[add-phase\] backend=.*stage=roadmap/)
  })
})

describe('remove-phase dispatch block', () => {
  it('contains remove-phase message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'remove-phase'`),
      'cli.ts must contain remove-phase dispatch block',
    )
  })

  it('imports runRoadmapWorkflow from ./workflows/roadmap.js for remove-phase', () => {
    assert.match(CLI_SOURCE, /runRoadmapWorkflow.*=.*await import\(['"]\.\/workflows\/roadmap\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in remove-phase block', () => {
    const blockStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'remove-phase'`)
    const blockEnd = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'progress'`, blockStart)
    const block = CLI_SOURCE.slice(blockStart, blockEnd)
    assert.ok(
      block.includes('resolvePlanningBackendFromSettings()'),
      'remove-phase block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-05 telemetry with stage=roadmap for remove-phase', () => {
    assert.match(CLI_SOURCE, /\[remove-phase\] backend=.*stage=roadmap/)
  })
})

describe('progress dispatch block', () => {
  it('contains progress message check', () => {
    assert.ok(
      CLI_SOURCE.includes(`cliFlags.messages[0] === 'progress'`),
      'cli.ts must contain progress dispatch block',
    )
  })

  it('imports runRequirementsWorkflow from ./workflows/requirements.js', () => {
    assert.match(CLI_SOURCE, /runRequirementsWorkflow.*=.*await import\(['"]\.\/workflows\/requirements\.js['"]\)/)
  })

  it('calls resolvePlanningBackendFromSettings() in progress block', () => {
    const blockStart = CLI_SOURCE.indexOf(`cliFlags.messages[0] === 'progress'`)
    const blockEnd = CLI_SOURCE.indexOf('ensureManagedTools', blockStart)
    const block = CLI_SOURCE.slice(blockStart, blockEnd)
    assert.ok(
      block.includes('resolvePlanningBackendFromSettings()'),
      'progress block must call resolvePlanningBackendFromSettings()',
    )
  })

  it('logs D-05 telemetry with stage=requirements for progress', () => {
    assert.match(CLI_SOURCE, /\[progress\] backend=.*stage=requirements/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Total backend routing coverage (SC3)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolvePlanningBackendFromSettings call count', () => {
  it('is called exactly 9 times across all dispatch blocks (discuss, plan, execute, verify, new-project, new-milestone, add-phase, remove-phase, progress)', () => {
    // Count call sites via assignment pattern (excludes function definition line)
    const matches = CLI_SOURCE.match(/=\s*resolvePlanningBackendFromSettings\(\)/g)
    assert.equal(
      matches?.length ?? 0,
      9,
      `Expected 9 resolvePlanningBackendFromSettings() call sites, got ${matches?.length ?? 0}`,
    )
  })
})
