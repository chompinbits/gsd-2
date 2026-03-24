---
phase: 01-adapter-layer-sdk-foundation
verified: 2026-03-24T20:00:00Z
status: gaps_found
score: 3/5 success criteria verified
gaps:
  - truth: "User can switch a workflow between Pi SDK and Copilot SDK backends via a configuration flag"
    status: failed
    reason: "backend: copilot flag in createAgentSession initializes CopilotClientManager but discards the backend via void copilotBackend — the actual session is still created on the Pi path. The code comment reads: 'Phase 1 hybrid mode: backend is initialized for validation only. Full session routing to this backend is added in a later phase.'"
    artifacts:
      - path: "packages/pi-coding-agent/src/core/sdk.ts"
        issue: "Copilot backend initialized then discarded (void copilotBackend). Actual AgentSession creation and all downstream routing still goes through Pi runtime regardless of backend flag."
    missing:
      - "Route session creation through CopilotSessionBackend.createSession() when backend === 'copilot'"
      - "Return session handle from CopilotSessionBackend instead of Pi AgentSession"

  - truth: "User can create, use, and destroy a Copilot SDK session for a single workflow unit"
    status: partial
    reason: "CopilotSessionBackend.createSession(), send(), destroy() are correctly implemented and substantive. However, they are unreachable from the public createAgentSession API — the copilot branch discards the backend before any session is created on it."
    artifacts:
      - path: "packages/pi-coding-agent/src/core/sdk.ts"
        issue: "copilotBackend.createSession() is never called in the copilot branch; session object created later is a Pi AgentSession not a CopilotSessionHandle."
    missing:
      - "createSession call against CopilotSessionBackend and return of BackendSessionHandle when backend === 'copilot'"

  - truth: "User can resume a previously created Copilot SDK session by ID"
    status: partial
    reason: "CopilotSessionBackend.resumeSession() is implemented and calls client.resumeSession(). Not reachable from createAgentSession — same routing gap as create."
    artifacts:
      - path: "packages/pi-coding-agent/src/core/sdk.ts"
        issue: "No resumption path through CopilotSessionBackend; resume logic still uses Pi SessionManager"
    missing:
      - "Resume routing via CopilotSessionBackend.resumeSession() in createAgentSession"

human_verification:
  - test: "Copilot SDK API surface compatibility"
    expected: "CopilotClient.stop(), forceStop(), client.createSession(), client.resumeSession(), session.on(), session.sendAndWait(), session.abort(), session.destroy() all exist on @github/copilot-sdk@0.2.0"
    why_human: "SDK is a technical preview; cannot verify method signatures without installing and running the package in a compatible environment."
  - test: "Copilot SDK event types emitted match mapped types"
    expected: "SDK emits assistant.turn_start, assistant.message, assistant.message_delta, tool.execution_start, tool.execution_complete, session.idle, session.error events — the translateCopilotEvent switch covers real event names"
    why_human: "Cannot determine actual event type strings without a live SDK session trace."
---

# Phase 01: Adapter Layer + SDK Foundation — Verification Report

**Phase Goal:** Users can create and run GSD workflow sessions against a Copilot SDK backend alongside the existing runtime
**Verified:** 2026-03-24T20:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User can switch a workflow between Pi SDK and Copilot SDK backends via a configuration flag | ✗ FAILED | `backend: "copilot"` option exists but `void copilotBackend` in sdk.ts discards it; session routing stays on Pi path |
| SC-2 | User can create, use, and destroy a Copilot SDK session for a single workflow unit | ✗ FAILED | `CopilotSessionBackend.createSession/send/destroy` implemented but never called from `createAgentSession` |
| SC-3 | User can resume a previously created Copilot SDK session by ID | ✗ FAILED | `resumeSession()` implemented but not wired into public session creation flow |
| SC-4 | User can run an existing GSD tool through the Copilot SDK session without modifying tool code | ⚠ PARTIAL | `bridgeAllTools` is substantive and called inside `createSession`, but end-to-end unreachable due to SC-1/SC-2 gap |
| SC-5 | User sees SDK dependency pinned to an exact version with all SDK calls isolated within the adapter module | ✓ VERIFIED | `"@github/copilot-sdk": "0.2.0"` (exact, no ^ or ~); SDK imports confined to `backends/*.ts` files only |

**Score:** 1/5 fully verified, 1/5 partial, 3/5 failed (infrastructure complete, session routing absent)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pi-coding-agent/src/core/backends/backend-interface.ts` | SessionBackend interface + BackendSessionHandle + BackendConfig | ✓ VERIFIED | Exports `SessionBackend`, `BackendSessionHandle`, `BackendConfig`; no SDK imports (SAFE-01 compliant) |
| `packages/pi-coding-agent/src/core/backends/tool-bridge.ts` | AgentTool → Copilot SDK tool conversion | ✓ VERIFIED | `bridgeToolToCopilot`, `bridgeAllTools` substantive; uses `defineTool` from SDK; wraps `AgentTool.execute` correctly |
| `packages/pi-coding-agent/src/core/backends/event-translator.ts` | Copilot SDK event → AgentEvent translation | ✓ VERIFIED | `translateCopilotEvent` maps 5 event types; returns null for lifecycle/telemetry events; `isSessionIdle`/`isSessionError` guards present |
| `packages/pi-coding-agent/src/core/backends/copilot-client-manager.ts` | CopilotClient lifecycle management | ✓ VERIFIED | start/stop/getClient/isStarted; 5-second timeout with `forceStop` fallback; singleton guard on `started` flag |
| `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` | CopilotSessionBackend implements SessionBackend | ✓ VERIFIED | `implements SessionBackend` explicit; `createSession`, `resumeSession`, `shutdown` all substantive; internal `CopilotSessionHandle` wraps SDK session |
| `packages/pi-coding-agent/src/core/backends/pi-backend.ts` | PiSessionBackend implementation stub | ⚠ STUB | `implements SessionBackend` ✓; but `createSession` and `resumeSession` throw `Error("not used directly")` — by design, Pi uses legacy path; not a real routing implementation |
| `packages/pi-coding-agent/src/core/sdk.ts` | Updated createAgentSession with backend selection | ⚠ HOLLOW | `backend?: "pi" | "copilot"` option added; copilot branch initializes `CopilotSessionBackend` but discards it via `void copilotBackend`; actual session creation unchanged from Pi path |
| `packages/pi-coding-agent/src/core/backends/index.ts` | Barrel re-exports | ✓ VERIFIED | All 7 exports present: `SessionBackend`, `BackendConfig`, `BackendSessionHandle`, `bridgeAllTools`, `bridgeToolToCopilot`, `CopilotClientManager`, `CopilotSessionBackend`, `PiSessionBackend`, translators |
| `packages/pi-coding-agent/src/core/backends/backends.test.ts` | Parity guard tests | ✓ VERIFIED | Tests for `PiSessionBackend` shape, event translation (4 cases), SDK version pin, and tool bridge construction |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `tool-bridge.ts` | `@gsd/pi-agent-core` | `import type { AgentTool, AgentToolResult }` | ✓ WIRED | Line 2: `import type { AgentTool, AgentToolResult } from "@gsd/pi-agent-core"` |
| `event-translator.ts` | `@gsd/pi-agent-core` | `import type { AgentEvent }` | ✓ WIRED | Line 1: `import type { AgentEvent } from "@gsd/pi-agent-core"` |
| `copilot-backend.ts` | `backend-interface.ts` | `implements SessionBackend` | ✓ WIRED | Line 46: `export class CopilotSessionBackend implements SessionBackend` |
| `copilot-backend.ts` | `tool-bridge.ts` | `bridgeAllTools` call | ✓ WIRED | Lines 54+67: `bridgeAllTools(config.tools, {})` in createSession and resumeSession |
| `copilot-backend.ts` | `event-translator.ts` | `translateCopilotEvent` call | ✓ WIRED | Line 26: `const translated = translateCopilotEvent(event)` in subscribe handler |
| `pi-backend.ts` | `backend-interface.ts` | `implements SessionBackend` | ✓ WIRED | Line 3: `export class PiSessionBackend implements SessionBackend` |
| `sdk.ts` | `copilot-backend.ts` | lazy import on `backend === "copilot"` | ⚠ PARTIAL | Import exists but `copilotBackend` is discarded (`void copilotBackend`); not used for session creation |
| `src/cli.ts` | `sdk.ts` | `createAgentSession` call | ✓ WIRED | Existing callers unchanged; `backend` is optional with `"pi"` default |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `copilot-backend.ts` CopilotSessionHandle | `sdkSession.sendAndWait()` response | `CopilotClient.createSession()` → real SDK session | Yes (if called) | ⚠ HOLLOW — wired internally but unreachable from public session flow |
| `sdk.ts` copilot branch | `copilotBackend` | `new CopilotSessionBackend(clientManager)` | Initialized only | ✗ DISCONNECTED — discarded before any session operation |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 8 plan task commits exist in git history | `git log --oneline \| grep "56962ba\|72d8207\|ab25e4e\|89ba8ca\|0d017c8\|50f4739\|98010f2\|0598b90"` | 8/8 found | ✓ PASS |
| SDK version pin is exact (no ^ or ~) | `grep "@github/copilot-sdk" packages/pi-coding-agent/package.json` | `"0.2.0"` — no range specifier | ✓ PASS |
| No SDK imports leak outside backends/ | `grep -rn "@github/copilot-sdk" src/ packages/pi-coding-agent/src/ \| grep -v backends/` | 0 results | ✓ PASS |
| backend option exists on CreateAgentSessionOptions | grep sdk.ts for `backend` | `backend?: "pi" \| "copilot"` at line 80 | ✓ PASS |
| copilot branch actually routes sessions (not just initializes) | grep sdk.ts for `copilotBackend.createSession\|copilotBackend.resumeSession` | 0 matches — `void copilotBackend` discards it | ✗ FAIL |
| PiSessionBackend.createSession is callable | read pi-backend.ts | Throws `Error("not used directly")` | ✗ FAIL (by design, but stub not a real impl) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RUNT-01 | 01-02, 01-03 | User can run GSD workflows through Copilot SDK backend | ✗ BLOCKED | Backend initialized; session routing to it absent (`void copilotBackend`) |
| RUNT-02 | 01-03 | User can keep using existing runtime path in parallel | ✓ SATISFIED | Pi path unchanged; `backend` defaults to `"pi"`; all existing consumers work |
| RUNT-03 | 01-02, 01-03 | User can create, resume, and destroy Copilot SDK sessions reliably | ✗ BLOCKED | `CopilotSessionBackend` methods are implemented but not reachable from `createAgentSession` |
| TOOL-01 | 01-01, 01-03 | User can run existing tools through Copilot SDK without rewriting | ⚠ PARTIAL | `bridgeAllTools` in `createSession` is correct; end-to-end blocked by RUNT-01 routing gap |
| SAFE-01 | 01-01, 01-02 | SDK version pinning and adapter isolation contain breakage risk | ✓ SATISFIED | Exact `0.2.0` pin in package.json; SDK imports confined to `backends/*.ts` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/pi-coding-agent/src/core/sdk.ts` | 208-211 | `void copilotBackend` — backend discarded after initialization | 🛑 Blocker | Users selecting `backend: "copilot"` get Pi runtime behavior, not Copilot SDK; phase goal unfulfilled |
| `packages/pi-coding-agent/src/core/backends/pi-backend.ts` | 11-18 | `createSession`/`resumeSession` throw errors rather than delegating | ⚠ Warning | `PiSessionBackend` is not a real `SessionBackend` implementation; satisfies interface shape only |

---

### Human Verification Required

#### 1. Copilot SDK API Surface Compatibility

**Test:** Install `@github/copilot-sdk@0.2.0` in a Node environment and verify: `CopilotClient` accepts `{ autoStart: false, autoRestart: true }` constructor options; `client.start()`, `client.stop()`, `client.forceStop()`, `client.createSession()`, `client.resumeSession()` are callable; session has `.on()`, `.sendAndWait({ prompt })`, `.destroy()`, `.abort()` methods.

**Expected:** All methods exist and match the signatures assumed by `CopilotClientManager` and `CopilotSessionBackend`.

**Why human:** SDK is a technical preview. Method names cannot be verified without running the package.

#### 2. Copilot SDK Event Type String Coverage

**Test:** Initiate a live Copilot SDK session and log all event `.type` strings emitted during a prompt/tool-call round trip. Compare against the `translateCopilotEvent` switch cases: `assistant.turn_start`, `assistant.message`, `assistant.message_delta`, `tool.execution_start`, `tool.execution_complete`, `session.idle`, `session.error`, `assistant.usage`.

**Expected:** All emitted event types are handled (mapped or explicitly null-ed) in the translator.

**Why human:** Cannot determine real SDK event type strings without a live SDK trace.

---

### Gaps Summary

The adapter layer infrastructure is well-built: contracts are clean, the tool bridge and event translator are stateless and correct, `CopilotClientManager` has proper lifecycle semantics, and `CopilotSessionBackend` implements the full interface with real SDK calls. SDK version pinning and adapter isolation (SAFE-01) are fully satisfied.

**Root cause of gaps:** In `packages/pi-coding-agent/src/core/sdk.ts`, the `backend === "copilot"` branch initializes `CopilotClientManager` and `CopilotSessionBackend` (to prove startup works) but then discards the backend with `void copilotBackend` and proceeds with the existing Pi session creation path. The code comment is explicit: *"Phase 1 hybrid mode: backend is initialized for validation only. Full session routing to this backend is added in a later phase."*

This means success criteria 1–3 (switching to Copilot backend, creating/using/destroying sessions, resuming sessions) cannot be exercised by any user action — the routing simply doesn't exist yet. SC-4 (tools) is partial because the bridge works inside `CopilotSessionBackend.createSession()` but that method is never called.

**Fix required:** Wire `copilotBackend.createSession()` into the session return path in `createAgentSession` when `backend === "copilot"`, and propagate `send()` / event subscriptions through `BackendSessionHandle` instead of the Pi `AgentSession`. `PiSessionBackend.createSession/resumeSession` should also either delegate to the Pi runtime or the plan should acknowledge they are intentional stubs with no routing role.

---

_Verified: 2026-03-24T20:00:00Z_
_Verifier: the agent (gsd-verifier)_
