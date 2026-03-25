# Milestones

## v1.0 Copilot SDK Migration (Shipped: 2026-03-25)

**Phases completed:** 7 phases, 17 plans, 20 tasks

**Key accomplishments:**

- Backend interface seam plus stateless tool and event translators that isolate Copilot SDK details from core runtime contracts.
- Copilot runtime backend now supports managed client lifecycle plus create/resume session handling behind the common adapter interface.
- 37-test suite proving discuss/plan/plan-check parity across Pi and Copilot backends via full roundtrip validation, plus 14 session resume/interruption tests confirming CopilotSessionBackend can resume sessions, detect interruptions via tool_use analysis, and abort safely.
- Config-driven default backend selection wired in sdk.ts via settings (options.backend → settingsManager.getDefaultBackend() → "pi" fallback), with 10-test switchover safety suite confirming precedence chain, Settings field, and SettingsManager getter/setter behavioral correctness.
- Wired 46 parity tests into default npm test path and created explicit requirement-ID verification evidence for the three orphaned requirements (TOOL-02, PLAN-01, PLAN-02) identified by the v1.0 milestone audit.
- Two new live Copilot validation scripts now prove discuss/plan response quality and switchover/resume mechanics with structured CHECK and Evidence output.
- Phase 7 verification is now evidence-backed with live PASS outputs for switchover/rollback, session create-resume continuity, and discuss/plan parity checks.

**Known gaps accepted at closeout:**

- Milestone audit status file remained stale (`gaps_found` from pre-Phase-05). Completion proceeded based on explicit Phase 05-07 gap-closure evidence and passing live validation output.

---
