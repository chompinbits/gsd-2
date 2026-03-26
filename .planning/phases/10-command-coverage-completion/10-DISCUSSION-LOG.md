# Phase 10: Command Coverage Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Mode:** Auto (--auto flag — all gray areas selected, recommended defaults accepted)

---

## Gray Areas Identified

1. **Command Scope** — Exactly which commands need wrappers vs updated dispatch threading
2. **Routing Implementation** — New workflow wrappers + CLI dispatch vs threading into guided-flow
3. **Stage/Tier Mapping** — Stage keys and tier assignments for management commands
4. **Tool Access Profiles** — Read/write restrictions for roadmap/requirements sessions
5. **Verification Evidence** — Test coverage scope for FLOW-01

---

## Auto-Selected Decisions

### Command Scope
**Q:** Which commands are in scope for Phase 10 backend routing?
**[auto] A:** Roadmap commands (new-project, new-milestone, add-phase, remove-phase) and requirements commands (plan-phase requirements parsing, progress status). Maps to "roadmap" and "requirements" stage categories. (recommended default — matches FLOW-01 success criteria exactly)

### Routing Implementation
**Q:** Should management commands use new CLI dispatch blocks (like discuss/plan) or threading into guided-flow `dispatchWorkflow()`?
**[auto] A:** Both — primary path is standalone CLI dispatch blocks in `src/cli.ts` for headless/programmatic invocations; guided-flow `dispatchWorkflow()` also receives backend config for interactive paths. (recommended default — "fully through Copilot backend" in FLOW-01 implies both paths covered)

### Stage/Tier Mapping
**Q:** What tier should roadmap/requirements commands bill at?
**[auto] A:** "low" tier (0.33×) for both "roadmap" and "requirements" stage categories, per STACK.md research specification. Add to `stage-router.ts`. (recommended default — research explicitly specifies this)

### Tool Access Profiles
**Q:** What tool profile should management command sessions use?
**[auto] A:** Read + write access; bash and edit blocked. Consistent with STACK.md D-4 table for roadmap/requirements sessions (write planning files, no code execution). Pitfall 6 guard: pass through extension-registered tools. (recommended default)

### Error Handling
**Q:** What happens when Copilot backend fails to init for a management command?
**[auto] A:** Visible actionable error, no silent fallback to Pi. Consistent with Phase 8 D-03 and Phase 9 D-10. (recommended default — migration parity requirement)

### Verification Evidence
**Q:** What tests cover FLOW-01?
**[auto] A:** Routing dispatch tests, stage-tier attribution (0.33× confirmed), tool profile enforcement (no bash/edit), plus live-path validation with at least one roadmap command completing on Copilot backend. Matches Phase 8 D-10/D-11/D-12 scope. Pitfall 4 guard: stage name normalization test. (recommended default)

---

## Prior Decisions Applied

From Phase 8 (`08-CONTEXT.md`):
- D-01: Backend selection chain (`options.backend` → `settings.defaultBackend` → `"pi"`) carried forward
- D-02: `defaultBackend: "copilot"` as single switch carried forward
- D-03: Visible actionable error on Copilot init failure carried forward
- D-09: Tool filtering at runtime rebuild boundary carried forward
- D-10/D-11/D-12: Verification evidence scope pattern carried forward

From Phase 9 (`09-CONTEXT.md`):
- D-04: Stage-to-tier map entries carried forward (Phase 10 adds new keys alongside, not replacing)
- D-10/D-11/D-12: Verification pattern carried forward

---

## Deferred Ideas

None.
