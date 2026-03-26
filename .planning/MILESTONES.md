# Milestones

## v1.1 Next Steps (Shipped: 2026-03-26)

**Delivered:** Completed the Copilot SDK migration for execute/verify workflows, autonomous orchestration, command coverage, and cost-safety fallbacks (free-tier + BYOK), then closed all audit and Nyquist compliance gaps.

**Phases completed:** 8 phases (8-15), 16 plans total

**Key accomplishments:**

- Execute/verify workflows now run through Copilot backend with settings-driven routing and full dispatch coverage (EXEC-01).
- Autonomous orchestration now threads per-unit stage/tool config through dispatch, runUnit, and session setup (EXEC-02).
- Roadmap and requirements command flows are fully routed through Copilot backend stages (FLOW-01).
- Free-tier downgrade and BYOK fallback are wired into session creation, including user-visible accounting telemetry (FLOW-02, FLOW-03).
- GAP closures delivered in Phases 13-15: fixed `setSettingsManager` wiring, wired telemetry consumers, and brought phases 08-12 to Nyquist-compliant VALIDATION status.

**Stats:**

- 102 files changed
- +12,128 / -96 lines
- 8 phases, 16 plans
- 2 days from start to ship (2026-03-25 -> 2026-03-26)

**Git range:** `feat(08-01)` -> `feat(15-02)`

**What's next:** Define v1.2 scope and requirements with `/gsd-new-milestone`.

---

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
