## Strategy: Managing Copilot Integration Against Two Upstream Change Vectors

You have two independent sources of breaking changes flowing into your integration layer:

1. **`@github/copilot-sdk`** — currently pinned at 0.2.0, in "technical preview" (breaking changes expected)
2. **Canonical GSD-2** (gsd-build/gsd-2) — the upstream project that keeps shipping new versions (v2.43.0), adding features, refactoring internals

Your copilot integration touches both sides: it wraps the SDK's `CopilotClient`/session APIs, and it plugs into GSD-2's internal abstractions (`AgentTool`, `AgentEvent`, `BackendConfig`, `createAgentSession`, etc.).

---

### Current Architecture Assessment

Your existing layering is **already well-structured for this**. The key isolation points:

| Layer | Files | Absorbs changes from |
|---|---|---|
| **Backend interface** | backend-interface.ts | GSD-2 internals (tool/event types) |
| **SDK client wrapper** | copilot-client-manager.ts | Copilot SDK lifecycle API |
| **Tool bridge** | tool-bridge.ts | Both (GSD tool shape ↔ SDK `defineTool`) |
| **Event translator** | event-translator.ts | Both (SDK events ↔ GSD `AgentEvent`) |
| **Session backend** | copilot-backend.ts | Both (orchestrates all above) |
| **Copilot headers** | github-copilot-headers.ts | GSD message types + Copilot API conventions |
| **OAuth flow** | github-copilot.ts | Copilot auth API |

### Do You Need to Refactor?

**Short answer: No major refactor needed.** The existing adapter/bridge/translator pattern is exactly the right architecture for absorbing changes from both sides. But there are **targeted improvements** that would make ongoing maintenance significantly easier:

---

### Strategy 1: SDK Version Absorption

**Problem:** When `@github/copilot-sdk` goes from 0.2.0 → 0.3.0 → 1.0.0, the session API, event types, and tool definition API may all change.

**Current state:** Your `CopilotSessionHandle` in copilot-backend.ts uses `any` for the SDK session type. This is both a strength (won't break on type changes) and a weakness (no compile-time catch for API drift).

**Recommendations:**
- **Pin + gate SDK upgrades to their own phase.** Don't bump the SDK version as part of feature work. Treat each SDK version bump as a discrete task with its own parity validation.
- **Add a thin SDK type facade** — a single file (e.g., `copilot-sdk-types.ts`) that re-exports/aliases the SDK types you actually use (`CopilotClient`, `SessionConfig`, `SessionEvent`, `Tool`). When the SDK changes shapes, you update one file instead of grep-replacing across the codebase.
- **Add a "SDK compatibility" test** — a fast unit test that exercises `CopilotClient` construction, `createSession`, `send`, `resume`, `destroy` against the installed SDK version. Run it as a gating check before any feature work after an SDK bump. Your live tests already partially do this, but a fast mock-based version would catch type-level breaks without requiring a running Copilot environment.

---

### Strategy 2: Upstream GSD-2 Sync

**Problem:** The canonical GSD-2 project ships new features, refactors internals, and changes tool/event shapes. Your copilot integration code lives in the same repo, so you're both the consumer and modifier of `@gsd/pi-agent-core`, `@gsd/pi-ai`, etc.

**Current state:** Your integration is well-isolated in backends. The bridges (tool-bridge.ts, event-translator.ts) are the seams where upstream GSD changes hit the copilot path.

**Recommendations:**
- **Keep the bridge files as explicit translation layers.** Don't let GSD-internal types leak into copilot-specific code (and vice versa). The `bridgeToolToCopilot()` and `translateCopilotEvent()` functions are exactly right — they're the only places that need updating when either side changes.
- **Add interface-level regression tests for the bridge contracts.** For example: "given this `AgentTool` shape, `bridgeToolToCopilot` produces a valid SDK tool" and "given this SDK event shape, `translateCopilotEvent` produces a valid `AgentEvent`". These catch breakage from *either* direction.
- **Use `BackendConfig` as the formal contract boundary.** Any new GSD feature (new tool types, new event shapes, new session options) should flow through `BackendConfig` changes. The fact that backend-interface.ts is small and focused is a feature — keep it that way. Your v1.1 plan to add `availableToolNames` and `provider` to `BackendConfig` follows this principle correctly.

---

### Strategy 3: Dual-Source Change Workflow

When you need to absorb changes from both sides simultaneously (e.g., a GSD-2 upstream update that also requires an SDK version bump):

1. **Update GSD-2 upstream first** (pull new features/refactors into your repo)
2. **Run existing copilot parity tests** — they should still pass since the `BackendConfig` interface is your contract
3. **If parity breaks:** fix the bridge files (tool-bridge.ts, event-translator.ts) to accommodate the new GSD shapes
4. **Then bump SDK version** if needed, updating `copilot-client-manager.ts` and `copilot-backend.ts`
5. **Run SDK compatibility tests** to validate the new version works
6. **Run full parity suite** to confirm end-to-end

The key principle: **never change both sides in the same commit/phase**. This makes bisecting regressions trivial.

---

### Targeted Refactoring Opportunities (Small, High-Value)

| Change | Why | Effort |
|--------|-----|--------|
| Extract SDK types to `copilot-sdk-types.ts` | Single file to update on SDK version bumps instead of scattered `any` casts | Small |
| Add bridge contract tests | Catch breaks from either GSD or SDK changes at compile/test time | Small |
| Type the `sdkSession: any` in `CopilotSessionHandle` | Currently untyped — silent breakage on SDK API changes | Small |
| Keep copilot-instructions.md auto-generated from PROJECT.md (current pattern) | Ensures copilot context stays in sync with project state | Already done |
| Version-gate the copilot-sdk-nodejs.instructions.md | This file describes SDK 0.2.0 patterns — when you upgrade, update it to match | Small |

---

### What NOT to Refactor

- **Don't merge the bridge/translator into the backend.** The separation between tool-bridge.ts, event-translator.ts, and `copilot-backend.ts` is the right granularity.
- **Don't create a generic "SDK adapter" abstraction.** You only have one external SDK (`@github/copilot-sdk`). An abstraction layer over one implementation is premature.
- **Don't move copilot code out of pi-coding-agent.** It belongs next to the other backend implementations.

---

### Summary

Your architecture is already set up to handle both change vectors. The recommended improvements are **incremental hardening** rather than a refactor:

1. **SDK facade file** — absorb SDK type changes in one place
2. **Bridge contract tests** — catch breaks from either direction  
3. **Phase-gate SDK bumps** — never mix SDK version changes with feature work
4. **Sequential sync order** — upstream GSD first, then SDK, never both at once
5. **Update instructions file** — keep copilot-sdk-nodejs.instructions.md version-accurate