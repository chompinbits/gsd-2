---
phase: 01-adapter-layer-sdk-foundation
verified: 2026-03-24T21:00:00Z
status: human_needed
score: 4/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 1/5
  gaps_closed:
    - "SC-1: User can switch workflow to Copilot SDK backend — copilotBackend.createSession() now called (void discarded removed)"
    - "SC-2: User can create/use/destroy a Copilot SDK session — session handle returned as copilotSessionHandle on CreateAgentSessionResult"
    - "SC-4: User can run existing GSD tools through Copilot SDK — bridgeAllTools path now reachable"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "SC-3: Copilot session resume by ID"
    expected: "When a previous sessionId exists, calling createAgentSession with backend='copilot' resumes rather than creates a new session. sdk.ts passes sessionId to createSession but does not call copilotBackend.resumeSession(). Whether the SDK resumes from a previously-created sessionId in createSession requires live SDK testing."
    why_human: "copilotBackend.resumeSession() exists but is not called from sdk.ts. The current code passes sessionId to createSession — whether this triggers resume on the SDK side cannot be determined without a live session trace."
  - test: "Copilot SDK API surface compatibility"
    expected: "CopilotClient.stop(), forceStop(), client.createSession(), client.resumeSession(), session.on(), session.sendAndWait(), session.abort(), session.destroy() all exist on @github/copilot-sdk@0.2.0"
    why_human: "SDK is a technical preview; cannot verify method signatures without installing and running the package in a compatible environment."
  - test: "Copilot SDK event types emitted match mapped types"
    expected: "SDK emits assistant.turn_start, assistant.message, assistant.message_delta, tool.execution_start, tool.execution_complete, session.idle, session.error events — the translateCopilotEvent switch covers real event names"
    why_human: "Cannot determine actual event type strings without a live SDK session trace."
---

# Phase 01: Adapter Layer + SDK Foundation — Verification Report

**Phase Goal:** Users can create and run GSD workflow sessions against a Copilot SDK backend alongside the existing runtime
**Verified:** 2026-03-24T21:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure via 01-04-PLAN.md

## Re-verification Summary

Previous status: `gaps_found` (1/5, 2026-03-24T20:00:00Z)
Gaps closed by 01-04: SC-1, SC-2, SC-4 (routing wired, handle exposed, tools reachable)
Remaining: SC-3 resume behavior requires human/live SDK validation

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User can switch a workflow between Pi SDK and Copilot SDK backends via a configuration flag | ✓ VERIFIED | `copilotBackend.createSession()` called at sdk.ts:208; no `void copilotBackend`; `copilotSessionHandle` returned on result |
| SC-2 | User can create, use, and destroy a Copilot SDK session for a single workflow unit | ✓ VERIFIED | `CopilotSessionBackend.createSession()` called; returns `CopilotSessionHandle` with `send/subscribe/destroy/abort`; exposed as `copilotSessionHandle` on `CreateAgentSessionResult` |
| SC-3 | User can resume a previously created Copilot SDK session by ID | ? UNCERTAIN | `copilotBackend.resumeSession()` not called from sdk.ts; `createSession` passes `sessionId` which may trigger SDK-level resume — requires live SDK test to confirm |
| SC-4 | User can run an existing GSD tool through the Copilot SDK session without modifying tool code | ✓ VERIFIED | `bridgeAllTools` called inside `CopilotSessionBackend.createSession`; path now reachable end-to-end; tool bridge confirmed substantive |
| SC-5 | User sees SDK dependency pinned to an exact version with all SDK calls isolated within the adapter module | ✓ VERIFIED | `"@github/copilot-sdk": "0.2.0"` (exact); 0 SDK imports outside `backends/` (grep confirmed) |

**Score:** 4/5 verified, 1/5 needs human validation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pi-coding-agent/src/core/backends/backend-interface.ts` | SessionBackend interface + BackendSessionHandle + BackendConfig | ✓ VERIFIED | Unchanged — exports `SessionBackend`, `BackendSessionHandle`, `BackendConfig`; no SDK imports (SAFE-01 compliant) |
| `packages/pi-coding-agent/src/core/backends/tool-bridge.ts` | AgentTool → Copilot SDK tool conversion | ✓ VERIFIED | `bridgeToolToCopilot`, `bridgeAllTools` substantive; uses `defineTool` from SDK; wraps `AgentTool.execute` correctly |
| `packages/pi-coding-agent/src/core/backends/event-translator.ts` | Copilot SDK event → AgentEvent translation | ✓ VERIFIED | `translateCopilotEvent` maps 5 event types; returns null for lifecycle/telemetry events; `isSessionIdle`/`isSessionError` guards present |
| `packages/pi-coding-agent/src/core/backends/copilot-client-manager.ts` | CopilotClient lifecycle management | ✓ VERIFIED | Unchanged — start/stop/getClient/isStarted; 5-second timeout with `forceStop` fallback |
| `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` | CopilotSessionBackend implements SessionBackend | ✓ VERIFIED | Unchanged — `createSession`, `resumeSession`, `shutdown` all substantive; `CopilotSessionHandle` wraps SDK session |
| `packages/pi-coding-agent/src/core/backends/pi-backend.ts` | PiSessionBackend implementation stub | ⚠ STUB | `implements SessionBackend` ✓; `createSession`/`resumeSession` throw `Error("not used directly")` — by design; Pi uses legacy path |
| `packages/pi-coding-agent/src/core/sdk.ts` | createAgentSession with live copilot routing | ✓ VERIFIED | `copilotBackend.createSession()` called at L208; `copilotSessionHandle` declared (L198), assigned, returned (L452); `void copilotBackend` removed |
| `packages/pi-coding-agent/src/core/backends/index.ts` | Barrel re-exports | ✓ VERIFIED | All exports present: `SessionBackend`, `BackendConfig`, `BackendSessionHandle`, `bridgeAllTools`, `bridgeToolToCopilot`, `CopilotClientManager`, `CopilotSessionBackend`, `PiSessionBackend`, translators |
| `packages/pi-coding-agent/src/core/backends/backends.test.ts` | Parity + routing guard tests | ✓ VERIFIED | New `copilot session routing` describe block (4 tests): routing call, no-void guard, handle field, handle shape |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `sdk.ts` | `copilot-backend.ts` | `copilotBackend.createSession()` at L208 | ✓ WIRED | Live call replacing previous `void copilotBackend` discard |
| `sdk.ts` | `backend-interface.ts` | `BackendSessionHandle` declared at L198, returned at L452 | ✓ WIRED | `copilotSessionHandle?: BackendSessionHandle` on `CreateAgentSessionResult` |
| `tool-bridge.ts` | `@gsd/pi-agent-core` | `import type { AgentTool, AgentToolResult }` | ✓ WIRED | Unchanged |
| `event-translator.ts` | `@gsd/pi-agent-core` | `import type { AgentEvent }` | ✓ WIRED | Unchanged |
| `copilot-backend.ts` | `tool-bridge.ts` | `bridgeAllTools` in createSession and resumeSession | ✓ WIRED | Unchanged |
| `copilot-backend.ts` | `event-translator.ts` | `translateCopilotEvent` in subscribe | ✓ WIRED | Unchanged |
| `pi-backend.ts` | `backend-interface.ts` | `implements SessionBackend` | ✓ WIRED | Unchanged |
| `sdk.ts` copilot branch | `copilot-backend.ts` `resumeSession` | (not wired) | ? UNCERTAIN | `copilotBackend.resumeSession()` not called; sessionId passed to `createSession` may serve as resume hint to SDK |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `sdk.ts` copilot branch | `copilotSessionHandle` | `copilotBackend.createSession()` → `CopilotSessionHandle` | Yes — real SDK session object | ✓ FLOWING |
| `CopilotSessionHandle.send()` | `sdkSession.sendAndWait()` | `CopilotClient.createSession()` → real SDK client | Yes (if SDK available) | ✓ FLOWING (pending SDK surface human check) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 01-04 task commits exist in git history | `git log --oneline \| grep -E "12f5a8e9\|8e3bce15"` | Both found: `8e3bce15 test(01-04)…`, `12f5a8e9 fix(01-04)…` | ✓ PASS |
| SDK version pin is exact | `grep "@github/copilot-sdk" packages/pi-coding-agent/package.json` | `"0.2.0"` — no range specifier | ✓ PASS |
| No SDK imports leak outside backends/ | `grep -rn "@github/copilot-sdk" packages/pi-coding-agent/src/ \| grep -v backends/ \| wc -l` | 0 | ✓ PASS |
| `void copilotBackend` removed from sdk.ts | `grep -n "void copilotBackend" sdk.ts` | 0 matches | ✓ PASS |
| `copilotBackend.createSession()` called at runtime | `grep -n "copilotBackend\.createSession(" sdk.ts` | L208: `copilotSessionHandle = await copilotBackend.createSession({` | ✓ PASS |
| `copilotSessionHandle` returned on result | `grep -n "copilotSessionHandle" sdk.ts` | L93 (interface), L198 (decl), L208 (assign), L452 (return) | ✓ PASS |
| Routing parity tests present | `grep -n "copilot session routing" backends.test.ts` | L103: `describe("copilot session routing", ...)` with 4 tests | ✓ PASS |
| Handle shape test present | `grep -n "BackendSessionHandle-shaped" backends.test.ts` | L125: it present | ✓ PASS |
| `copilotBackend.resumeSession()` called from sdk.ts | `grep "copilotBackend.resumeSession" sdk.ts` | 0 matches | ? HUMAN — needs live SDK test |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RUNT-01 | 01-02, 01-03, 01-04 | User can run GSD workflows through Copilot SDK backend | ✓ SATISFIED | `copilotBackend.createSession()` called at sdk.ts L208; real `CopilotSessionHandle` returned as `copilotSessionHandle` |
| RUNT-02 | 01-03 | User can keep using existing runtime path in parallel | ✓ SATISFIED | Pi `AgentSession` creation at L434 unchanged; `backend` defaults to `"pi"` |
| RUNT-03 | 01-02, 01-03, 01-04 | User can create, resume, and destroy Copilot SDK sessions reliably | ⚠ PARTIAL | Create: ✓ wired. Destroy: ✓ on `BackendSessionHandle`. Resume: `CopilotSessionBackend.resumeSession()` exists but not called from sdk.ts; sessionId passed to createSession |
| TOOL-01 | 01-01, 01-03, 01-04 | User can run existing tools through Copilot SDK without rewriting | ✓ SATISFIED | `bridgeAllTools` called inside `createSession`; code path now reachable; tools bridged stateless |
| SAFE-01 | 01-01, 01-02 | SDK version pinning and adapter isolation contain breakage risk | ✓ SATISFIED | Exact `0.2.0` pin; 0 SDK imports outside `backends/` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/pi-coding-agent/src/core/sdk.ts` | 208-211 | `void copilotBackend` — backend discarded after initialization | 🛑 Blocker | Users selecting `backend: "copilot"` get Pi runtime behavior, not Copilot SDK; phase goal unfulfilled |
| `packages/pi-coding-agent/src/core/backends/pi-backend.ts` | 11-18 | `createSession`/`resumeSession` throw errors rather than delegating | ⚠ Warning | `PiSessionBackend` is not a real `SessionBackend` implementation; satisfies interface shape only |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/pi-coding-agent/src/core/sdk.ts` | 214 | `console.error("[gsd] Copilot SDK session created:...")` — debug log in production path | ⚠ Warning | Will emit to stderr on every copilot session creation; noisy in production but not a blocker |
| `packages/pi-coding-agent/src/core/backends/pi-backend.ts` | 11-18 | `createSession`/`resumeSession` throw errors rather than delegating | ⚠ Warning | By design — `PiSessionBackend` is an interface-shape stub; Pi uses legacy `Agent`/`AgentSession` directly |

**No blocker anti-patterns.** Previous 🛑 Blocker (`void copilotBackend`) resolved by 01-04.

---

### Human Verification Required

#### 1. SC-3: Copilot Session Resume by ID

**Test:** Create a Copilot SDK session via `createAgentSession({ backend: "copilot" })`. Note the returned `copilotSessionHandle.sessionId`. Call `createAgentSession({ backend: "copilot" })` again in the same process with a `sessionManager` that returns the same session ID. Confirm the returned handle reconnects to the existing session rather than creating a new one.

**Expected:** The second call resumes the existing Copilot SDK session. If `createSession` with a duplicate sessionId triggers SDK-level resumption, SC-3 is satisfied. If not, a conditional `copilotBackend.resumeSession()` call must be added to sdk.ts.

**Why human:** `copilotBackend.resumeSession()` is implemented but not called from sdk.ts. Whether passing a previous sessionId to `createSession` causes the Copilot SDK to resume the session depends on SDK-internal behavior that cannot be determined by static analysis.

#### 2. Copilot SDK API Surface Compatibility

**Test:** Install `@github/copilot-sdk@0.2.0` in a Node environment and verify: `CopilotClient` accepts `{ autoStart: false, autoRestart: true }` constructor options; `client.start()`, `client.stop()`, `client.forceStop()`, `client.createSession()`, `client.resumeSession()` are callable; session has `.on()`, `.sendAndWait({ prompt })`, `.destroy()`, `.abort()` methods.

**Expected:** All methods exist and match the signatures assumed by `CopilotClientManager` and `CopilotSessionBackend`.

**Why human:** SDK is a technical preview. Method names cannot be verified without running the package.

#### 3. Copilot SDK Event Type String Coverage

**Test:** Initiate a live Copilot SDK session and log all event `.type` strings emitted during a prompt/tool-call round trip. Compare against the `translateCopilotEvent` switch cases: `assistant.turn_start`, `assistant.message`, `assistant.message_delta`, `tool.execution_start`, `tool.execution_complete`, `session.idle`, `session.error`, `assistant.usage`.

**Expected:** All emitted event types are handled (mapped or explicitly null-ed) in the translator.

**Why human:** Cannot determine real SDK event type strings without a live SDK trace.

---

### Gaps Summary

**No automated gaps remain.** The three blocking gaps from the initial verification (SC-1, SC-2, SC-4) are fully resolved by 01-04:

- `void copilotBackend` removed; `copilotBackend.createSession()` called at sdk.ts L208
- `CreateAgentSessionResult.copilotSessionHandle` added and populated on the copilot path
- Routing parity tests (4 new tests) and handle-shape test added to `backends.test.ts`
- Pi `AgentSession` creation path unchanged (L328, L434); `backend: "pi"` behavioral parity preserved

**One item requires human validation:** SC-3 (resume by ID) — `copilotBackend.resumeSession()` exists but is not called from `createAgentSession`. The copilot path always calls `createSession` with a `sessionId` field, which may serve as a resume hint to the SDK. Whether this satisfies the resume contract requires a live SDK test. RUNT-03 is marked PARTIAL until confirmed.

---

_Verified: 2026-03-24T21:00:00Z_
_Verifier: the agent (gsd-verifier)_
_Re-verification: after 01-04 gap closure_
