# Phase 6: Stage-Aware Accounting Contract Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-03-25
**Phase:** 06-stage-aware-accounting-contract-integration
**Mode:** discuss (`--auto`)
**Areas discussed:** Send contract shape, Stage source ownership, Fallback policy, Verification scope

---

## Send Contract Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit stage metadata on backend send contract | Add structured stage field to send path and forward through wrappers | ✓ |
| Embed stage in prompt text | Parse stage from user-visible prompt payload | |
| Infer stage from runtime heuristics | Guess stage from callsite or model context | |

**User's choice:** [auto] Explicit stage metadata on backend send contract
**Notes:** Recommended default chosen for deterministic attribution and minimal ambiguity.

---

## Stage Source Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow entrypoint supplies stage | Discuss/plan workflows pass canonical stage names when sending | ✓ |
| Backend infers stage globally | Backend determines stage without caller input | |
| Session-level static stage | One stage value set once for entire session | |

**User's choice:** [auto] Workflow entrypoint supplies stage
**Notes:** Recommended default chosen to keep stage identity explicit and testable.

---

## Fallback Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Transitional unknown fallback with diagnostics | Keep compatibility fallback while migrated paths must carry explicit stage | ✓ |
| Fail hard on missing stage immediately | Reject all sends without stage metadata | |
| Keep silent unknown fallback | Continue current behavior with no migration pressure | |

**User's choice:** [auto] Transitional unknown fallback with diagnostics
**Notes:** Recommended default chosen to preserve compatibility while closing phase-6 planning path gap.

---

## Verification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Integration + contract tests | Verify stage propagation end-to-end plus interface/resume contracts | ✓ |
| Unit tests only | Validate accounting helpers without full propagation path | |
| Manual verification only | Rely on ad-hoc runs and logs | |

**User's choice:** [auto] Integration + contract tests
**Notes:** Recommended default chosen to satisfy phase success criteria for propagation and tier correctness.

---

## the agent's Discretion

- Naming of stage-carrying send metadata types and fields.
- Diagnostic verbosity details for unknown fallback warning logs.
- Test fixture composition and helper extraction.

## Deferred Ideas

None.
