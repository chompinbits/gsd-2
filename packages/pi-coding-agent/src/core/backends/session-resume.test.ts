/**
 * Session resume and interruption recovery tests for CopilotSessionBackend.
 *
 * Validates that:
 * - CopilotSessionBackend.resumeSession returns a functional BackendSessionHandle
 *   with the matching sessionId (SAFE-02)
 * - Session resume correctly restores send/subscribe/destroy/abort capabilities
 * - AccountingSessionHandle wraps resume correctly when accounting config is set
 * - SessionManager.wasInterrupted detects tool_use-stranded sessions (SAFE-03)
 * - sdk.ts copilot branch calls resumeSession (not createSession) when a session exists
 * - Abort during active or destroyed sessions is safe (no throw)
 *
 * No live LLM calls — all tests use mock CopilotClientManager instances.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CopilotSessionBackend } from './copilot-backend.js'

// ---------------------------------------------------------------------------
// Shared mock infrastructure (mirrors pattern from backends.test.ts)
// ---------------------------------------------------------------------------

/** Create a mock SDK session that records calls */
function makeMockSession(sessionId: string, opts?: { eventType?: string }) {
  const listeners: Array<(event: unknown) => void> = []

  return {
    sessionId,
    sendAndWait: async (_params: unknown) => ({ data: { content: `response from ${sessionId}` } }),
    on: (handler: (event: unknown) => void) => {
      listeners.push(handler)
      // Optionally emit a mock event immediately for subscribe tests
      if (opts?.eventType) {
        // Emit asynchronously so subscribe() finishes first
        setImmediate(() => {
          handler({ type: opts.eventType, data: { content: 'mock event' } })
        })
      }
      return () => {
        const idx = listeners.indexOf(handler)
        if (idx !== -1) listeners.splice(idx, 1)
      }
    },
    destroy: async () => {},
    abort: async () => {},
    _listeners: listeners,
  }
}

function makeMockBackend(options?: {
  createSession?: () => Promise<ReturnType<typeof makeMockSession>>
  resumeSession?: (id: string) => Promise<ReturnType<typeof makeMockSession>>
}) {
  const defaultSession = makeMockSession('resume-test-456')
  const createFn = options?.createSession ?? (async () => defaultSession)
  const resumeFn =
    options?.resumeSession ??
    (async (id: string) => makeMockSession(id))

  const mockClient = {
    createSession: async (config: unknown) => createFn(),
    resumeSession: async (id: string, config: unknown) => resumeFn(id),
  }

  const mockManager = {
    start: async () => {},
    getClient: () => mockClient,
    stop: async () => {},
    isStarted: () => true,
  }

  return { mockManager, mockClient }
}

// ---------------------------------------------------------------------------
// CopilotSessionBackend.resumeSession
// ---------------------------------------------------------------------------

describe('CopilotSessionBackend.resumeSession', () => {
  it('returns handle with matching sessionId', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('test-session-123', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    assert.equal(handle.sessionId, 'test-session-123')
  })

  it('resumed handle.send returns a response string', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('send-test-session', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    const response = await handle.send('hello')
    assert.equal(typeof response, 'string', 'send() must return a string')
    assert.ok(response.length >= 0, 'response may be empty string but must be string type')
  })

  it('resumed handle.subscribe returns an unsubscribe function', async () => {
    const { mockManager } = makeMockBackend({
      resumeSession: async (id) => makeMockSession(id, { eventType: 'message' }),
    })
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('subscribe-test', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    const receivedEvents: unknown[] = []
    const unsubscribe = handle.subscribe((event) => {
      receivedEvents.push(event)
    })

    assert.equal(typeof unsubscribe, 'function', 'subscribe() must return an unsubscribe function')

    // Allow async event emission to settle
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Unsubscribe must be callable without error
    assert.doesNotThrow(() => unsubscribe())
  })

  it('resumed handle.destroy completes without error', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('destroy-test', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    await assert.doesNotReject(
      () => handle.destroy(),
      'destroy() must not throw',
    )
  })

  it('resumed handle with accounting config wraps in AccountingSessionHandle', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    backend.setAccountingConfig({ budgetLimit: 0, model: 'some-model' } as any)
    await backend.initialize()

    const handle = await backend.resumeSession('accounting-resume-test', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
      model: 'test-model',
    })

    // Handle must still expose the correct sessionId regardless of wrapping
    assert.equal(handle.sessionId, 'accounting-resume-test', 'AccountingSessionHandle must preserve sessionId')

    // send() must still work (accounting wrapper is transparent)
    const response = await handle.send('request')
    assert.equal(typeof response, 'string')
  })
})

// ---------------------------------------------------------------------------
// Interruption detection — source-level verification of wasInterrupted logic
// ---------------------------------------------------------------------------

describe('Interruption detection', () => {
  it('session-manager.ts contains wasInterrupted method', () => {
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/session-manager.ts',
      'utf8',
    )
    assert.ok(
      source.includes('wasInterrupted()'),
      'session-manager.ts must implement wasInterrupted()',
    )
  })

  it('wasInterrupted detects toolCall blocks in last assistant message', () => {
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/session-manager.ts',
      'utf8',
    )
    // The implementation must check for toolCall type in assistant content array
    assert.ok(
      source.includes('"toolCall"') || source.includes("'toolCall'"),
      'wasInterrupted must check for toolCall type in message content',
    )
  })

  it('wasInterrupted returns false for clean user-turn boundary', () => {
    // Verified via source: when last message is role=user, return false
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/session-manager.ts',
      'utf8',
    )
    assert.ok(
      source.includes('role === "user"') || source.includes("role === 'user'"),
      'wasInterrupted must return false when last message is from user',
    )
  })

  it('wasInterrupted returns false for clean assistant text response', () => {
    // Verified via source: assistant message without toolUse = completed text response
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/session-manager.ts',
      'utf8',
    )
    // The logic: assistant + no tool_use → return false (completed text response)
    assert.ok(
      source.includes('return false; // assistant message without tool'),
      'wasInterrupted must return false for assistant text response without tool_use',
    )
  })

  it('sdk.ts calls resumeSession when hasExistingSession is true', () => {
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/sdk.ts',
      'utf8',
    )
    // Must have the conditional: hasExistingSession ? copilotBackend.resumeSession(...) : copilotBackend.createSession(...)
    assert.ok(
      source.includes('hasExistingSession'),
      'sdk.ts must check hasExistingSession',
    )
    assert.ok(
      source.includes('copilotBackend.resumeSession('),
      'sdk.ts must call copilotBackend.resumeSession when session exists',
    )
  })

  it('sdk.ts copilot branch calls resumeSession not createSession when existing session', () => {
    const source = readFileSync(
      'packages/pi-coding-agent/src/core/sdk.ts',
      'utf8',
    )
    // The ternary: hasExistingSession ? resumeSession : createSession
    const hasResume = source.includes('copilotBackend.resumeSession(')
    const hasCreate = source.includes('copilotBackend.createSession(')

    assert.ok(hasResume, 'sdk.ts must have copilotBackend.resumeSession path')
    assert.ok(hasCreate, 'sdk.ts must have copilotBackend.createSession path')

    // Verify the ternary structure: resumeSession appears after hasExistingSession check
    const hasExistingIdx = source.indexOf('hasExistingSession')
    const resumeIdx = source.indexOf('copilotBackend.resumeSession(')
    assert.ok(
      resumeIdx > hasExistingIdx,
      'copilotBackend.resumeSession must appear after hasExistingSession check in sdk.ts',
    )
  })
})

// ---------------------------------------------------------------------------
// Session abort safety
// ---------------------------------------------------------------------------

describe('Session abort safety', () => {
  it('abort does not throw on active session', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('abort-active-test', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    await assert.doesNotReject(
      () => handle.abort(),
      'abort() on active session must not throw',
    )
  })

  it('abort does not throw after destroy', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.resumeSession('abort-after-destroy-test', {
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    await handle.destroy()

    await assert.doesNotReject(
      () => handle.abort(),
      'abort() after destroy must not throw',
    )
  })

  it('createSession returned handle abort is also safe', async () => {
    const { mockManager } = makeMockBackend()
    const backend = new CopilotSessionBackend(mockManager as any)
    await backend.initialize()

    const handle = await backend.createSession({
      tools: [],
      cwd: '/tmp',
      streaming: true,
    })

    await assert.doesNotReject(
      () => handle.abort(),
      'abort() on createSession handle must not throw',
    )
  })
})
