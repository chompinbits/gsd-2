# Phase 3: Planning Workflow Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 03-planning-workflow-migration
**Areas discussed:** Planning command parity, Streaming/event equivalence, Plan-check validation path, Session continuity/recovery, Rollout safety
**Mode:** auto (`--auto`)

---

## Planning Command Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime-only migration | Keep discuss/plan prompts and flow unchanged; migrate backend transport only | ✓ |
| UX refresh during migration | Refactor question flow and prompt behavior while migrating backend | |
| Hybrid rewrite | Partial behavior redesign plus backend migration | |

**User's choice:** [auto] Runtime-only migration (recommended default)
**Notes:** Selected to minimize migration risk and preserve parity baseline for Phase 3.

---

## Streaming and Event Equivalence

| Option | Description | Selected |
|--------|-------------|----------|
| Contract parity | Preserve normalized `AgentEvent` contract across TUI, RPC/headless, and web bridge | ✓ |
| Surface-specific adapters | Allow divergent event behavior per surface | |
| Provider-native pass-through | Expose Copilot-native events directly to consumers | |

**User's choice:** [auto] Contract parity (recommended default)
**Notes:** Existing RPC/headless/web consumers already rely on normalized events.

---

## Plan-Check Validation Path

| Option | Description | Selected |
|--------|-------------|----------|
| Keep validation logic unchanged | Compare pass/fail and artifact validity across Pi and Copilot paths | ✓ |
| Re-tune scoring in migration phase | Adjust plan-check criteria during backend migration | |
| Replace plan-check contract | Introduce new validation semantics with backend migration | |

**User's choice:** [auto] Keep validation logic unchanged (recommended default)
**Notes:** Isolates backend migration from acceptance criteria drift.

---

## Session Continuity and Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing session manager IDs and resume flow | Keep create/resume semantics aligned with current planning workflows | ✓ |
| New Copilot-only session identity model | Introduce separate IDs and resume semantics for migrated path | |
| Stateless planning sessions | Create fresh session per command and drop resume parity | |

**User's choice:** [auto] Reuse existing session manager IDs and resume flow (recommended default)
**Notes:** Matches previously locked lifecycle parity decisions from Phase 1.

---

## Rollout Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Flag-gated rollout | Keep migration behind explicit backend/config selection in Phase 3 | ✓ |
| Immediate default switch | Make Copilot backend default as soon as discuss/plan paths run | |
| Dual-write behavior | Run both backends by default and merge outputs | |

**User's choice:** [auto] Flag-gated rollout (recommended default)
**Notes:** Defers default-backend switch to Phase 4 parity validation.

---

## the agent's Discretion

- Test fixture naming and grouping for parity suites.
- Internal event buffering/flush implementation details.
- Telemetry formatting details for parity diagnostics.

## Deferred Ideas

None.
