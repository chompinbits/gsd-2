# Requirements: GSD 2 Copilot SDK Migration

**Defined:** 2026-03-24
**Core Value:** Deliver the same reliable GSD workflow outcomes while using fewer, higher-value premium requests per completed unit of work.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Runtime Foundation

- [x] **RUNT-01**: User can run GSD workflows through a Copilot SDK backend selected via configuration or feature flag.
- [x] **RUNT-02**: User can keep using the existing runtime path in parallel with Copilot SDK during migration.
- [x] **RUNT-03**: User can create, resume, and destroy Copilot SDK sessions reliably for workflow units.

### Tools and Events

- [x] **TOOL-01**: User can run existing extension and skill tools through Copilot SDK without rewriting tool business logic.
- [x] **TOOL-02**: User receives streaming output and completion events with behavior parity across TUI, headless, and web surfaces.
- [x] **TOOL-03**: User sees command outcomes equivalent to current behavior for key planning commands.

### Premium Request Efficiency

- [x] **COST-01**: User benefits from multiplier-aware model routing by workflow stage (0x, 0.33x, 1x tiers).
- [x] **COST-02**: User can view premium-request usage metrics per workflow stage and per run.
- [x] **COST-03**: User is protected by retry budget guardrails that stop or downgrade model usage when request budget is at risk.

### Planning Workflow Migration

- [x] **PLAN-01**: User can run discuss/plan flows on Copilot SDK with parity to current command UX.
- [x] **PLAN-02**: User can run plan-check style validation in the migrated planning path.

### Operational Safety

- [x] **SAFE-01**: User benefits from SDK version pinning and adapter isolation that contain preview-breakage risk.
- [x] **SAFE-02**: User has parity tests for critical planning commands before backend defaults are changed.
- [x] **SAFE-03**: User can recover planning sessions across process interruptions with validated resume behavior.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Execution and Verification

- **EXEC-01**: User can run execute and verify workflows entirely on Copilot SDK backend.
- **EXEC-02**: User can run full autonomous orchestration with Copilot SDK as default backend.

### Coverage Expansion

- **FLOW-01**: User can run roadmap and requirements management commands fully through Copilot SDK backend.
- **FLOW-02**: User receives free-tier fallback to 0x models automatically under quota pressure.
- **FLOW-03**: User can use BYOK fallback when premium quota is exhausted.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Big-bang full rewrite in one release | Violates parity-first and rollback-safe migration strategy |
| Immediate removal of legacy runtime | Hybrid transition is required to reduce migration risk |
| Breaking slash-command UX changes | Existing users and teams require behavior continuity |
| Automatic use of 3x/30x models in autonomous paths | High risk of rapid premium-request quota exhaustion |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUNT-01 | Phase 1 | Complete |
| RUNT-02 | Phase 1 | Complete |
| RUNT-03 | Phase 7 | Pending |
| TOOL-01 | Phase 1 | Complete |
| TOOL-02 | Phase 5 | Complete |
| TOOL-03 | Phase 7 | Pending |
| COST-01 | Phase 6 | Pending |
| COST-02 | Phase 6 | Pending |
| COST-03 | Phase 2 | Complete |
| PLAN-01 | Phase 5 | Complete |
| PLAN-02 | Phase 5 | Complete |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 7 | Pending |
| SAFE-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14 ✓
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-25 after milestone audit gap planning*
