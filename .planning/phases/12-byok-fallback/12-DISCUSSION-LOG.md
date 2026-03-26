# Phase 12: BYOK Fallback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Mode:** auto (--auto flag — all areas resolved without interactive prompts)

---

## Gray Areas Selected

[auto] Selected all gray areas: provider config shape, fallback trigger threshold, implementation seam, settings schema, observability/indication.

---

## Area: BYOK Provider Config Shape

**Q:** Which external provider interface for BYOK? Generic OpenAI-compatible or provider-specific types?

**Options presented:**
- Copilot SDK native `provider` block `{type: "openai"|"anthropic"|"azure", baseUrl, apiKey}` — no new LLM SDKs required *(recommended)*
- New dedicated provider-specific backends (OpenAI SDK, Anthropic SDK) — more control, more code
- Generic HTTP client with user-specified endpoint — maximum flexibility, extra complexity

**[auto] Selected:** Copilot SDK native `provider` block (recommended) — STACK.md confirms SDK already handles BYOK via provider config in `createSession()`; no separate SDK dependencies needed.

---

## Area: Fallback Trigger Threshold

**Q:** When should BYOK activate — at warn_threshold or hard_stop?

**Options presented:**
- Hard_stop (100% quota exhaustion) — BYOK is last resort, after free-tier downgrade has already run *(recommended)*
- Warn_threshold (same as Phase 11 free-tier downgrade) — earlier activation
- User-configurable threshold — flexible, but adds config surface

**[auto] Selected:** Hard_stop (recommended) — BYOK is the fallback of last resort. Phase 11 already handles warn_threshold with free-tier model downgrade. Having two distinct thresholds keeps the layers clean and matches success criteria ("when premium quota is fully exhausted").

---

## Area: Implementation Seam

**Q:** How is BYOK wired in — new backend class or inject into existing CopilotSessionBackend?

**Options presented:**
- `FallbackResolver.toByokConfig()` + `BackendConfig.provider?` field + inject in `CopilotSessionBackend.createSession()` *(recommended by STACK.md)*
- New `ByokSessionBackend` class implementing `SessionBackend` — separate code path, more isolation
- Extend Pi backend with BYOK routing — inconsistent with Copilot-first migration direction

**[auto] Selected:** STACK.md recommended approach — add `toByokConfig()` to `FallbackResolver`, add optional `provider?` to `BackendConfig`, inject into `CopilotSessionBackend.createSession()`. Per-session, no caching (Pitfall 2 guard). Always include provider block for non-Copilot models (Pitfall 5 guard).

---

## Area: Settings Schema

**Q:** Where does BYOK config live in settings?

**Options presented:**
- New `byok?` key at top-level `Settings` interface with `{enabled, type, baseUrl, apiKey, model}` *(recommended)*
- Extend existing `FallbackSettings` chains to include BYOK-typed entries
- Separate config file / env vars only

**[auto] Selected:** New `byok?` key at top-level `Settings` (recommended) — mirrors `defaultBackend` and `budget_ceiling` placement. Clear, discoverable, accessible via `getByokConfig()` / `setByokConfig()` on `SettingsManager`.

---

## Area: Observability / BYOK Indication (SC-4)

**Q:** How does the user know they're running on BYOK vs Copilot premium?

**Options presented:**
- stderr notification + telemetry field (mirrors Phase 11 downgrade pattern) *(recommended)*
- TUI status bar indicator (requires UI changes beyond scope)
- Log file only (insufficient user visibility)

**[auto] Selected:** stderr notification `[gsd:accounting] ⚡ BYOK provider active: <type>@<baseUrl> (premium quota exhausted)` + `byok_active` telemetry field. Reuses Phase 11 notification pattern. No new UI components needed.

---

## Summary

All 5 gray areas resolved. No scope creep. No deferred ideas.
CONTEXT.md written to `.planning/phases/12-byok-fallback/12-CONTEXT.md`.
