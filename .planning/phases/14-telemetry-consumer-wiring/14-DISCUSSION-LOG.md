# Phase 14: Telemetry Consumer Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Mode:** `--auto` (all selections made by agent)

---

## Area 1: Call Site Location

**Question:** Where should `formatPremiumSummary` be called with real backend data?

**Options considered:**
- A) `sdk.ts` session cleanup hook — `copilotBackend` accessible as closure variable, no interface changes
- B) New method on `BackendSessionHandle` — requires interface update, more coupling
- C) Inside `CopilotSessionBackend.destroy()` — tighter coupling, harder to pass `accountingConfig`

**[auto] Selected:** A — `sdk.ts` cleanup hook via `withCopilotSessionCleanup` callback
**Rationale:** `copilotBackend` and `accountingConfig` are both in scope as closures; requires no interface changes and is consistent with how the client manager cleanup already works there.

---

## Area 2: Output Channel

**Question:** How should the formatted summary be emitted?

**Options considered:**
- A) `process.stderr.write` (established `[gsd:accounting]` pattern from Phases 11/12)
- B) Callback/event emitter (flexible but adds indirection)
- C) Session teardown event on session manager (would need new event type)

**[auto] Selected:** A — `process.stderr.write` with `[gsd:accounting]` prefix
**Rationale:** Direct reuse of the pattern established in Phases 11 and 12; no new mechanism needed.

---

## Area 3: Emit Conditionality

**Question:** When should the telemetry summary be emitted?

**Options considered:**
- A) Always when tracker has recorded requests (`totalRequests > 0`)
- B) Only when downgrade or BYOK events actually occurred
- C) Always, even if tracker is empty

**[auto] Selected:** A — emit when tracker exists and has recorded requests; always pass full downgrade/byok data
**Rationale:** Ensures telemetry is reachable in the production path regardless of whether fallback events occurred; a session with Copilot backend activity should always produce a summary.

---

## Area 4: Test Approach

**Question:** How to verify the wiring is correct?

**Options considered:**
- A) Source-shape test (grep for call site presence) + functional test (mock backend, assert stderr output)
- B) Unit test only (mock formatPremiumSummary)
- C) Integration test against live session

**[auto] Selected:** A — two-layer: source-shape + functional mock test
**Rationale:** Consistent with test patterns used in Phases 11 and 12; source-shape catches regressions, functional test confirms end-to-end data flow.

---

*All selections made automatically by agent in `--auto` mode. Human review recommended before execution.*
