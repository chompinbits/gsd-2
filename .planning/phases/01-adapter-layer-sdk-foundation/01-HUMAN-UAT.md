---
status: partial
phase: 01-adapter-layer-sdk-foundation
source: [01-VERIFICATION.md]
started: 2026-03-24T20:21:26Z
updated: 2026-03-24T20:21:26Z
---

## Current Test

Awaiting human verification of Copilot SDK runtime behavior for resume semantics and live SDK event/API compatibility.

## Tests

### 1. SC-3: Copilot session resume by ID
expected: When a previous `sessionId` exists, calling `createAgentSession` with `backend: "copilot"` resumes rather than creates a new session. If SDK does not resume via `createSession(sessionId)`, sdk.ts must call `copilotBackend.resumeSession()` explicitly.
result: pending

### 2. Copilot SDK API surface compatibility
expected: `CopilotClient.stop()`, `forceStop()`, `client.createSession()`, `client.resumeSession()`, `session.on()`, `session.sendAndWait()`, `session.abort()`, and `session.destroy()` exist and behave as assumed for `@github/copilot-sdk@0.2.0`.
result: pending

### 3. Copilot SDK event type coverage
expected: Live SDK events include the translated types used in `translateCopilotEvent` (`assistant.turn_start`, `assistant.message`, `assistant.message_delta`, `tool.execution_start`, `tool.execution_complete`, `session.idle`, `session.error`).
result: pending

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- status: pending
  item: SC-3 resume behavior validation
- status: pending
  item: SDK API surface compatibility validation
- status: pending
  item: SDK event mapping validation
