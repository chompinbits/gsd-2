# Phase 8: Execute & Verify Backend Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-03-25
**Phase:** 08-execute-verify-backend-routing
**Areas discussed:** Backend routing contract, stage/accounting semantics, tool access profiles, verification evidence
**Mode:** discuss (auto)

---

## Auto Selection Summary

- [auto] Selected all gray areas for discussion: Backend routing contract; stage/accounting semantics; tool access profiles; verification evidence.

## Backend Routing Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Config-driven through `createAgentSession` resolution chain | Uses existing precedence (`options.backend` -> `settings.defaultBackend` -> `"pi"`) for execute/verify, matching discuss/plan migration pattern | ✓ |
| Command-local explicit backend flag per workflow | Each execute/verify command selects backend independently at handler level | |
| Hard-switch execute/verify to Copilot only | Ignores settings and always routes through Copilot backend | |

**Auto choice:** Config-driven through `createAgentSession` resolution chain
**Reasoning:** Matches proven v1.0 routing pattern and satisfies roadmap criterion that backend config controls execute/verify path without code changes.

---

## Stage and Accounting Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit stage aliases mapped in stage router | Preserve existing labels and add execute/verify aliases for accurate telemetry | ✓ |
| Rely on fallback default tier for unknown stages | Depend on `standard` fallback when names differ | |
| Normalize all stage names to a single execute/verify string | Rename upstream dispatch values to avoid aliases | |

**Auto choice:** Explicit stage aliases mapped in stage router
**Reasoning:** Prevents silent telemetry drift and aligns with existing stage-aware accounting contract.

---

## Tool Access Profiles

| Option | Description | Selected |
|--------|-------------|----------|
| Stage-specific allow-lists | Execute keeps full coding tools; verify defaults to read/bash/lsp, no write/edit by default | ✓ |
| Single global toolset for all workflow stages | No execute/verify distinction in available tools | |
| Block-list only | Disable a few dangerous tools while keeping broad default exposure | |

**Auto choice:** Stage-specific allow-lists
**Reasoning:** Reduces premium-request waste from invalid tool usage and matches verify workflow intent as read-first validation.

---

## Verification Evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Automated + live validation bundle | Unit/integration checks plus live execute/verify Copilot runs with telemetry evidence | ✓ |
| Automated tests only | Rely on source-level and integration tests without live run evidence | |
| Manual verification only | Human-run smoke checks without enforced automated assertions | |

**Auto choice:** Automated + live validation bundle
**Reasoning:** Phase success criteria require real workflow outcomes and telemetry observability; live evidence complements regression safety.

---

## the agent's Discretion

- Naming and placement of execute/verify wrapper modules.
- Exact test segmentation and fixture strategy, provided all required evidence gates are covered.

## Deferred Ideas

None.