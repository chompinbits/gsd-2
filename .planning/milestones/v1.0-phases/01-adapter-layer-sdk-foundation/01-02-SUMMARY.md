---
phase: 01-adapter-layer-sdk-foundation
plan: 02
subsystem: infra
tags: [copilot-sdk, backend, sessions, lifecycle]
requires:
  - phase: 01-01
    provides: Backend contracts and translator modules
provides:
  - CopilotClient lifecycle manager with timeout-safe shutdown
  - CopilotSessionBackend implementing SessionBackend contracts
  - Exact SDK dependency pin for adapter stability
affects: [01-03, runtime-backends, session-creation]
tech-stack:
  added: ["@github/copilot-sdk@0.2.0"]
  patterns: [backend-handle-wrapper, sdk-isolated-session-adapter]
key-files:
  created:
    - packages/pi-coding-agent/src/core/backends/copilot-client-manager.ts
    - packages/pi-coding-agent/src/core/backends/copilot-backend.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/index.ts
    - packages/pi-coding-agent/package.json
key-decisions:
  - "Use CopilotSessionHandle as an internal wrapper to keep SDK session types from leaking through backend contracts"
  - "Use a 5-second stop timeout with forceStop fallback to avoid backend shutdown hangs"
  - "Pin @github/copilot-sdk to 0.2.0 exactly to reduce technical-preview drift risk"
patterns-established:
  - "Session adapters expose normalized BackendSessionHandle regardless of runtime"
  - "SDK imports stay inside backends module files only"
requirements-completed: [RUNT-01, RUNT-03, SAFE-01]
duration: 1 min
completed: 2026-03-24
---

# Phase 01 Plan 02: Copilot Client and Session Backend Summary

**Copilot runtime backend now supports managed client lifecycle plus create/resume session handling behind the common adapter interface.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-24T19:19:03Z
- **Completed:** 2026-03-24T19:20:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `CopilotClientManager` with explicit start/get/stop/isStarted lifecycle controls and timeout-protected shutdown.
- Implemented `CopilotSessionBackend` and internal `CopilotSessionHandle` to create/resume sessions, send prompts, subscribe to translated events, and destroy/abort sessions.
- Pinned `@github/copilot-sdk` to exact version `0.2.0` in `@gsd/pi-coding-agent` package dependencies.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement CopilotClientManager** - `89ba8ca7` (feat)
2. **Task 2: Implement CopilotSessionBackend** - `0d017c8f` (feat)

## Files Created/Modified
- `packages/pi-coding-agent/src/core/backends/copilot-client-manager.ts` - Managed CopilotClient startup/shutdown API.
- `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` - Session backend and handle implementation for Copilot SDK.
- `packages/pi-coding-agent/src/core/backends/index.ts` - Backend barrel exports for new classes.
- `packages/pi-coding-agent/package.json` - Exact SDK dependency pin (`0.2.0`).

## Decisions Made
- Keep SDK session object typed as internal `any` within the handle wrapper to preserve SDK-agnostic public interfaces.
- Apply timeout-driven force stop to make backend shutdown resilient during process teardown.
- Reuse translation and tool bridge modules from Plan 01 to keep behavior consistent across backends.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No scope drift; all changes directly support backend runtime integration goals.

## Issues Encountered
- Type-check command remains environment-blocked in this workspace because local Node type definitions are not installed for ad-hoc compiler invocation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 01-03 can now wire backend selection in `createAgentSession` using concrete `PiSessionBackend`/`CopilotSessionBackend` classes.
- Backend adapter surface now has enough implementation coverage to add parity tests.

---
*Phase: 01-adapter-layer-sdk-foundation*
*Completed: 2026-03-24*
