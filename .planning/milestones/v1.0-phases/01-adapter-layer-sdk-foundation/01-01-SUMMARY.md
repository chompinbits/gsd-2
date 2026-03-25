---
phase: 01-adapter-layer-sdk-foundation
plan: 01
subsystem: infra
tags: [copilot-sdk, adapter, tools, events]
requires: []
provides:
  - SessionBackend adapter contracts
  - AgentTool to Copilot tool bridge
  - Copilot stream event to AgentEvent translator
affects: [01-02, 01-03, runtime-backends]
tech-stack:
  added: []
  patterns: [sdk-agnostic-backend-interface, translation-boundary]
key-files:
  created:
    - packages/pi-coding-agent/src/core/backends/backend-interface.ts
    - packages/pi-coding-agent/src/core/backends/tool-bridge.ts
    - packages/pi-coding-agent/src/core/backends/event-translator.ts
  modified:
    - packages/pi-coding-agent/src/core/backends/index.ts
key-decisions:
  - "Keep backend-interface.ts free of @github/copilot-sdk imports to preserve SAFE-01 isolation"
  - "Normalize non-agent-facing Copilot session events (idle/error/usage/unknown) to null at adapter boundary"
  - "Bridge tool results by extracting text blocks only and returning a serializable string payload"
patterns-established:
  - "Adapter boundary: backend interface exports only core agent contracts"
  - "Translation modules are stateless and side-effect free"
requirements-completed: [TOOL-01, SAFE-01]
duration: 2 min
completed: 2026-03-24
---

# Phase 01 Plan 01: Adapter Contracts, Tool Bridge, and Event Translation Summary

**Backend interface seam plus stateless tool and event translators that isolate Copilot SDK details from core runtime contracts.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T19:14:02Z
- **Completed:** 2026-03-24T19:16:34Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Defined `BackendConfig`, `BackendSessionHandle`, and `SessionBackend` contracts as the runtime adapter seam.
- Added `bridgeToolToCopilot` and `bridgeAllTools` to mechanically wrap existing `AgentTool` instances with SDK `defineTool` handlers.
- Added `translateCopilotEvent` with session utility guards to normalize Copilot event stream payloads into `AgentEvent` variants.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define SessionBackend interface and BackendSessionHandle** - `56962ba2` (feat)
2. **Task 2: Implement tool bridge (AgentTool → Copilot SDK tool format)** - `72d82070` (feat)
3. **Task 3: Implement event translator (Copilot SDK events → AgentEvent)** - `ab25e4e8` (feat)

## Files Created/Modified
- `packages/pi-coding-agent/src/core/backends/backend-interface.ts` - SDK-agnostic backend lifecycle contracts.
- `packages/pi-coding-agent/src/core/backends/tool-bridge.ts` - AgentTool adapter into Copilot SDK `defineTool` handlers.
- `packages/pi-coding-agent/src/core/backends/event-translator.ts` - Copilot stream event translator and idle/error guards.
- `packages/pi-coding-agent/src/core/backends/index.ts` - Barrel exports for all backend contracts and translators.

## Decisions Made
- Keep all backend contracts independent of Copilot SDK types to enforce adapter isolation from day one.
- Treat session lifecycle/telemetry events as non-AgentEvent concerns in this phase and map them to `null`.
- Keep translation modules stateless so later backend implementations can compose them without shared runtime state.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No scope change and no architecture changes required.

## Issues Encountered
- Package-level TypeScript verification command required `tsc`, but this workspace install does not include local Node type definitions (`@types/node`), so strict compile verification is currently environment-blocked.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 01-02 can now implement Copilot client/session backend directly against stable backend contracts and bridge/translator exports.
- No blockers in code artifacts for Wave 2.

---
*Phase: 01-adapter-layer-sdk-foundation*
*Completed: 2026-03-24*
