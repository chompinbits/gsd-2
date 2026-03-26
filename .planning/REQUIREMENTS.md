# Requirements: GSD 2 Copilot SDK Migration

**Milestone:** v1.1 Next Steps
**Defined:** 2026-03-25
**Core Value:** Deliver the same reliable GSD workflow outcomes while using fewer, higher-value premium requests per completed unit of work.

## v1.1 Requirements

Requirements for this milestone only. Each maps to exactly one roadmap phase.

### Execution and Verification

- [x] **EXEC-01**: User can run execute and verify workflows entirely on Copilot SDK backend.
- [x] **EXEC-02**: User can run full autonomous orchestration with Copilot SDK as default backend.

### Command Coverage

- [x] **FLOW-01**: User can run roadmap and requirements management commands fully through Copilot SDK backend.

### Cost Safety and Fallbacks

- [x] **FLOW-02**: User can configure free-tier fallback behavior in GSD settings, and the system can route to 0x models automatically under quota pressure.
- [ ] **FLOW-03**: User can use BYOK fallback when premium quota is exhausted.

## Future Requirements

None currently deferred from v1.1 scope.

## Out of Scope

Explicitly excluded in this milestone to prevent scope creep.

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
| EXEC-01 | Phase 8 | Complete |
| EXEC-02 | Phase 9 | Complete |
| FLOW-01 | Phase 10, 15 | Complete / Pending |
| FLOW-02 | Phase 11, 14 | Complete / Pending |
| FLOW-03 | Phase 12, 13, 14 | Pending |

**Coverage:**
- v1.1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓
- Gap closure phases added: 13, 14, 15

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 — Phase 8 re-verification 2 confirms all ROADMAP SCs pass; EXEC-01 Complete*
