---
phase: "07"
status: pending
requirements_verified: [TOOL-03, RUNT-03, SAFE-02, SAFE-03]
date: "2026-03-25"
---

# Phase 7 Verification: Live Operational Validation (Parity, Resume, Switchover)

## 1. Overview

Phase 7 closes live operational validation gaps for parity, session resume, and default-backend switchover/rollback evidence.

## 2. Requirement Evidence Table

| Requirement | Description | Evidence Source | Status |
|-------------|-------------|----------------|--------|
| TOOL-03 | Command outcomes equivalent across backends | `tests/live/test-copilot-parity.ts` - discuss + plan response validation | Pending live run |
| RUNT-03 | Create, resume, destroy Copilot sessions | `tests/live/test-copilot-switchover-resume.ts` - session create/resume/destroy flow | Pending live run |
| SAFE-02 | Parity tests before backend default change | `tests/live/test-copilot-parity.ts` + Phase 4/5 unit parity suites (46 tests in `npm test`) | Pending live run |
| SAFE-03 | Session recovery across interruptions | `tests/live/test-copilot-switchover-resume.ts` - resume-by-id after destroy | Pending live run |

## 3. Success Criteria Mapping

- SC-1 (live parity run): `tests/live/test-copilot-parity.ts`
- SC-2 (interrupt + resume): `tests/live/test-copilot-switchover-resume.ts` Section 2
- SC-3 (switchover + rollback): `tests/live/test-copilot-switchover-resume.ts` Section 1
- SC-4 (verification artifacts updated): this document (`07-VERIFICATION.md`)

## 4. Live Test Run Instructions

```bash
# Run all live tests (requires Copilot SDK environment)
GSD_LIVE_TESTS=1 node --experimental-strip-types tests/live/run.ts

# Or run individually:
GSD_LIVE_TESTS=1 node --experimental-strip-types tests/live/test-copilot-parity.ts
GSD_LIVE_TESTS=1 node --experimental-strip-types tests/live/test-copilot-switchover-resume.ts
```

## 5. Captured Evidence

### Live Run Output

[Paste output from live test execution here]

Date: [date of live run]
Environment: [Copilot SDK version, Node version]
Result: [PASS/FAIL/PARTIAL]

## 6. Prior Phase Evidence Cross-References

- Phase 4: 37 E2E parity tests + 14 session resume tests (mock-based)
- Phase 5: 46 parity tests wired into `npm test` regression gate
- Phase 6: 57 accounting tests including stage propagation