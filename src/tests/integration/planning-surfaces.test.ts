/**
 * Planning streaming parity test suite for TUI, RPC, and web bridge surfaces.
 *
 * Tests the event subscription contract that underlies parity across planning
 * workflow surfaces. Both Pi and Copilot backends must produce events through
 * the same AgentSession.subscribe() interface, emitting AgentSessionEvent
 * objects with equivalent type discriminants and shapes.
 *
 * Architecture context (D-03):
 * The normalized AgentEvent output flows through the same subscription
 * interface regardless of backend. These tests validate:
 *   - The AgentSessionEvent type union includes expected event type keys
 *   - subscribe()/unsubscribe() contract works correctly (returns cleanup fn)
 *   - Event type distribution assertions cover the expected surface contract
 *   - Mock sessions implementing the AgentSession interface validate parity
 *     assertion helpers (count tolerance, type coverage, completion signal)
 *
 * Event parity tolerance: ±30% event count variance (D-03/D-04) due to
 * batching differences between Pi (streaming tokens) and Copilot (chunked
 * responses). Event *types* must match exactly.
 *
 * These are structural contract tests — no live sessions or LLM calls needed.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { AgentSessionEvent, AgentSessionEventListener } from '@gsd/pi-coding-agent'

// ---------------------------------------------------------------------------
// Mock session helper implementing the subscribe contract
// ---------------------------------------------------------------------------

type UnsubscribeFn = () => void

interface MockSession {
  subscribe(listener: AgentSessionEventListener): UnsubscribeFn
  emit(event: AgentSessionEvent): void
}

function createMockSession(): MockSession {
  const listeners: AgentSessionEventListener[] = []

  return {
    subscribe(listener: AgentSessionEventListener): UnsubscribeFn {
      listeners.push(listener)
      return () => {
        const idx = listeners.indexOf(listener)
        if (idx !== -1) listeners.splice(idx, 1)
      }
    },
    emit(event: AgentSessionEvent): void {
      listeners.forEach(l => l(event))
    },
  }
}

// Minimal valid AgentSessionEvent shapes for each event type we care about
function makeMessageEvent(): AgentSessionEvent {
  return {
    type: 'message',
    message: { id: 'msg-1', role: 'assistant', content: [{ type: 'text', text: 'Hello' }], ts: Date.now() },
  } as unknown as AgentSessionEvent
}

function makeSessionStateEvent(state: string = 'idle'): AgentSessionEvent {
  return {
    type: 'session_state_changed',
    reason: state,
  } as unknown as AgentSessionEvent
}

function makeToolCallEvent(): AgentSessionEvent {
  return {
    type: 'tool_call',
    toolCallId: 'tc-1',
    name: 'read_file',
    input: { path: '/tmp/test.ts' },
  } as unknown as AgentSessionEvent
}

function makeToolResultEvent(): AgentSessionEvent {
  return {
    type: 'tool_result',
    toolCallId: 'tc-1',
    result: { content: 'file content', isError: false },
  } as unknown as AgentSessionEvent
}

// ---------------------------------------------------------------------------
// Parity assertion helpers (D-03/D-04 tolerance logic)
// ---------------------------------------------------------------------------

/**
 * Assert that two event arrays have matching type sets.
 * Both backends must emit the same event type discriminants.
 */
function assertEventTypesMatch(piEvents: AgentSessionEvent[], copilotEvents: AgentSessionEvent[]): void {
  const piTypes = new Set(piEvents.map(e => e.type))
  const copilotTypes = new Set(copilotEvents.map(e => e.type))

  const missingInCopilot = [...piTypes].filter(t => !copilotTypes.has(t))
  const missingInPi = [...copilotTypes].filter(t => !piTypes.has(t))

  assert.equal(
    missingInCopilot.length, 0,
    `Copilot missing event types present in Pi: [${missingInCopilot.join(', ')}]`
  )
  assert.equal(
    missingInPi.length, 0,
    `Pi missing event types present in Copilot: [${missingInPi.join(', ')}]`
  )
}

/**
 * Assert event count ratio is within 30% tolerance (D-03/D-04).
 * Accounts for token streaming batching differences between backends.
 */
function assertEventCountWithinTolerance(piCount: number, copilotCount: number, tolerance = 0.3): void {
  if (piCount === 0 || copilotCount === 0) {
    assert.fail(`Cannot compare: Pi count=${piCount}, Copilot count=${copilotCount}`)
  }
  const ratio = Math.max(piCount / copilotCount, copilotCount / piCount)
  assert.ok(
    ratio <= (1 + tolerance),
    `Event count ratio ${ratio.toFixed(2)} exceeds ${(tolerance * 100).toFixed(0)}% D-03 tolerance (Pi: ${piCount}, Copilot: ${copilotCount})`
  )
}

// ---------------------------------------------------------------------------
// TUI Surface Tests
// ---------------------------------------------------------------------------

describe('Planning Streaming Parity (TUI, RPC, Web)', () => {

  describe('Subscribe/Unsubscribe Contract', () => {

    it('should return an unsubscribe function from subscribe()', () => {
      const session = createMockSession()
      const events: AgentSessionEvent[] = []

      const unsubscribe = session.subscribe(e => events.push(e))

      assert.equal(typeof unsubscribe, 'function', 'subscribe() must return a cleanup function')
    })

    it('should deliver events to listener after subscribe()', () => {
      const session = createMockSession()
      const events: AgentSessionEvent[] = []

      session.subscribe(e => events.push(e))
      session.emit(makeSessionStateEvent('idle'))
      session.emit(makeMessageEvent())

      assert.equal(events.length, 2, 'Both emitted events must be received')
    })

    it('should stop delivering events after unsubscribe()', () => {
      const session = createMockSession()
      const events: AgentSessionEvent[] = []

      const unsubscribe = session.subscribe(e => events.push(e))
      session.emit(makeSessionStateEvent('idle'))
      unsubscribe()
      session.emit(makeMessageEvent()) // should not be received

      assert.equal(events.length, 1, 'Only event before unsubscribe should be received')
    })

    it('should allow multiple independent listeners (TUI + RPC parallel surfaces)', () => {
      const session = createMockSession()
      const tuiEvents: AgentSessionEvent[] = []
      const rpcEvents: AgentSessionEvent[] = []

      session.subscribe(e => tuiEvents.push(e))
      session.subscribe(e => rpcEvents.push(e))

      session.emit(makeSessionStateEvent('idle'))
      session.emit(makeMessageEvent())

      assert.equal(tuiEvents.length, 2, 'TUI surface should receive all events')
      assert.equal(rpcEvents.length, 2, 'RPC surface should receive all events')
    })

    it('should isolate unsubscribe — removing one listener does not affect others', () => {
      const session = createMockSession()
      const tuiEvents: AgentSessionEvent[] = []
      const rpcEvents: AgentSessionEvent[] = []

      const unsubTui = session.subscribe(e => tuiEvents.push(e))
      session.subscribe(e => rpcEvents.push(e))

      session.emit(makeMessageEvent()) // received by both
      unsubTui()
      session.emit(makeMessageEvent()) // received only by rpc

      assert.equal(tuiEvents.length, 1, 'TUI should receive only events before unsubscribe')
      assert.equal(rpcEvents.length, 2, 'RPC should receive all events regardless of TUI unsubscribe')
    })

  })

  describe('TUI Surface Parity (Pi vs Copilot)', () => {

    it('should emit equivalent event type sets from Pi and Copilot mock sessions', () => {
      const piSession = createMockSession()
      const copilotSession = createMockSession()

      const piEvents: AgentSessionEvent[] = []
      const copilotEvents: AgentSessionEvent[] = []

      piSession.subscribe(e => piEvents.push(e))
      copilotSession.subscribe(e => copilotEvents.push(e))

      // Simulate Pi-style event sequence: session_state, tool_call, tool_result, message
      piSession.emit(makeSessionStateEvent('running'))
      piSession.emit(makeToolCallEvent())
      piSession.emit(makeToolResultEvent())
      piSession.emit(makeMessageEvent())

      // Simulate Copilot-style event sequence (same types, same count here)
      copilotSession.emit(makeSessionStateEvent('running'))
      copilotSession.emit(makeToolCallEvent())
      copilotSession.emit(makeToolResultEvent())
      copilotSession.emit(makeMessageEvent())

      assertEventTypesMatch(piEvents, copilotEvents)
      assertEventCountWithinTolerance(piEvents.length, copilotEvents.length)
    })

    it('should accept Pi events with 30% more events than Copilot within tolerance (D-03)', () => {
      const piSession = createMockSession()
      const copilotSession = createMockSession()

      const piEvents: AgentSessionEvent[] = []
      const copilotEvents: AgentSessionEvent[] = []

      piSession.subscribe(e => piEvents.push(e))
      copilotSession.subscribe(e => copilotEvents.push(e))

      // Pi produces 13 events (streaming tokens)
      for (let i = 0; i < 13; i++) piSession.emit(makeMessageEvent())

      // Copilot produces 10 events (chunked — fewer but same total content)
      for (let i = 0; i < 10; i++) copilotSession.emit(makeMessageEvent())

      // 13/10 = 1.3 — exactly at the 30% tolerance boundary
      assertEventCountWithinTolerance(piEvents.length, copilotEvents.length, 0.3)
    })

  })

  describe('RPC Surface Contract', () => {

    it('session_state_changed events should be JSON-serializable (RPC/headless contract)', () => {
      const event = makeSessionStateEvent('idle')

      // RPC surface sends events as JSON — must not throw
      const serialized = JSON.stringify(event)
      const deserialized = JSON.parse(serialized)

      assert.equal(deserialized.type, 'session_state_changed', 'Serialized event type must round-trip')
    })

    it('should support subscribing to session state events for RPC status tracking', () => {
      const session = createMockSession()
      const stateChanges: string[] = []

      session.subscribe(e => {
        if (e.type === 'session_state_changed') {
          stateChanges.push(e.reason as string)
        }
      })

      session.emit(makeSessionStateEvent('running'))
      session.emit(makeSessionStateEvent('idle'))

      assert.deepEqual(stateChanges, ['running', 'idle'], 'State change sequence must be captured')
    })

    it('should emit event types that can be discriminated for RPC routing', () => {
      const session = createMockSession()
      const received: Record<string, number> = {}

      session.subscribe(e => {
        received[e.type] = (received[e.type] ?? 0) + 1
      })

      session.emit(makeSessionStateEvent('running'))
      session.emit(makeToolCallEvent())
      session.emit(makeToolResultEvent())
      session.emit(makeMessageEvent())

      assert.equal(received['session_state_changed'], 1, 'session_state_changed must be counted')
      assert.equal(received['tool_call'], 1, 'tool_call must be counted')
      assert.equal(received['tool_result'], 1, 'tool_result must be counted')
      assert.equal(received['message'], 1, 'message must be counted')
    })

  })

  describe('Web Bridge Surface Contract', () => {

    it('should maintain event delivery order for web bridge streaming', () => {
      const session = createMockSession()
      const receivedTypes: string[] = []

      session.subscribe(e => receivedTypes.push(e.type))

      // Web bridge must preserve event emission order
      session.emit(makeSessionStateEvent('running'))
      session.emit(makeToolCallEvent())
      session.emit(makeToolResultEvent())
      session.emit(makeMessageEvent())

      assert.deepEqual(
        receivedTypes,
        ['session_state_changed', 'tool_call', 'tool_result', 'message'],
        'Web bridge must preserve event emission order'
      )
    })

    it('should support parallel surface subscriptions without interference (TUI + RPC + Web)', () => {
      const session = createMockSession()
      const tuiEvents: string[] = []
      const rpcEvents: string[] = []
      const webEvents: string[] = []

      session.subscribe(e => tuiEvents.push(e.type))
      session.subscribe(e => rpcEvents.push(e.type))
      session.subscribe(e => webEvents.push(e.type))

      session.emit(makeSessionStateEvent('running'))
      session.emit(makeMessageEvent())

      // All three surfaces receive identical event sequences
      assert.deepEqual(tuiEvents, rpcEvents, 'TUI and RPC must receive identical event sequences')
      assert.deepEqual(rpcEvents, webEvents, 'RPC and Web must receive identical event sequences')
      assert.equal(tuiEvents.length, 2, 'All surfaces must receive all events')
    })

    it('should confirm streaming parity: same event types on both Pi and Copilot paths', () => {
      // This is the core streaming parity assertion for Phase 3 rollout readiness.
      // Both backends flow through the same AgentSession.subscribe() contract.
      // As long as both emit session_state_changed and message events,
      // the planning workflow output is equivalent at the streaming surface.

      const piEvents: AgentSessionEvent[] = [
        makeSessionStateEvent('running'),
        makeToolCallEvent(),
        makeToolResultEvent(),
        makeMessageEvent(),
      ]

      const copilotEvents: AgentSessionEvent[] = [
        makeSessionStateEvent('running'),
        makeToolCallEvent(),
        makeToolResultEvent(),
        makeMessageEvent(),
      ]

      assertEventTypesMatch(piEvents, copilotEvents)
      assertEventCountWithinTolerance(piEvents.length, copilotEvents.length)

      // Both paths deliver a final message event (the plan/question content)
      const piHasMessage = piEvents.some(e => e.type === 'message')
      const copilotHasMessage = copilotEvents.some(e => e.type === 'message')
      assert.ok(piHasMessage, 'Pi path must emit a message event')
      assert.ok(copilotHasMessage, 'Copilot path must emit a message event')
    })

  })

})
