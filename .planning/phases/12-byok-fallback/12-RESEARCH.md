# Phase 12: BYOK Fallback — Research

**Domain:** BYOK provider injection when Copilot premium quota is fully exhausted
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

Phase 12 extends the existing cost-safety architecture with a BYOK (Bring Your Own Key) fallback as the final safety layer. When premium quota hits hard_stop (100% exhausted), sessions route to a user-configured external provider (OpenAI, Anthropic, or Azure) via the Copilot SDK's native `provider` config block. No new npm dependencies required — `@github/copilot-sdk` 0.2.0 already supports BYOK via provider config in `createSession()`.

The implementation follows the exact pre-flight pattern established in Phase 11 (`_applyDowngradeIfNeeded`), adds a parallel `_applyByokIfExhausted` method, and injects the `provider` field into the SDK session config. The `FallbackResolver.toByokConfig()` bridge method converts settings into the SDK's provider shape.

## Key Findings

### 1. Copilot SDK `provider` Config

The SDK's `createSession()` accepts an optional `provider` field:
```typescript
{
  provider: {
    type: "openai" | "anthropic" | "azure",
    baseUrl: string,
    apiKey: string,
  }
}
```
When present, the SDK routes requests directly to the specified provider instead of through Copilot premium infrastructure. No premium requests are consumed. This is the exact mechanism for BYOK.

### 2. Exhaustion Detection

`BudgetGuard.check()` already handles hard_stop at 100%:
- Throws `BudgetExceededError` when `hardStop=true` and `percentUsed >= 100`
- Returns `BudgetWarning` when `hardStop=false` and `percentUsed >= 100`

For BYOK, we need a pre-flight exhaustion check (not in `send()`). The `RequestTracker.getState()` returns `BudgetState` with `percentUsed`. A simple `percentUsed >= 100 && config.hardStop` check at session creation is sufficient.

### 3. Integration Seams

**`BackendConfig` extension:**
- Add `provider?: ByokProviderConfig` — per-session, never cached
- SDK session config already accepts this shape

**`CopilotSessionBackend.createSession()` / `resumeSession()`:**
- After existing `_applyDowngradeIfNeeded()` call
- If budget exhausted + BYOK enabled → override model + inject provider
- Follows identical pre-flight pattern from Phase 11

**`SettingsManager`:**
- Add `byok?: ByokConfig` to `Settings` interface
- Add `getByokConfig()` / `setByokConfig()` methods
- Pattern matches existing `getDefaultBackend()` / `setDefaultBackend()`

**`FallbackResolver`:**
- Add `toByokConfig(settings: ByokConfig): ByokProviderConfig` — pure conversion
- Called at session creation time, not cached

### 4. Type Definitions

```typescript
// In backend-interface.ts
export interface ByokProviderConfig {
  type: "openai" | "anthropic" | "azure";
  baseUrl: string;
  apiKey: string;
}

// In settings-manager.ts
export interface ByokConfig {
  enabled: boolean;
  type: "openai" | "anthropic" | "azure";
  baseUrl: string;
  apiKey: string;
  model: string;
}
```

### 5. Notification and Telemetry

Phase 11 pattern to mirror:
```typescript
// Notification (stderr)
process.stderr.write(`[gsd:accounting] ⚡ BYOK provider active: ${type}@${baseUrl} (premium quota exhausted)\n`);

// Telemetry (formatPremiumSummary extension)
// Add optional `byokActive?: boolean` parameter
```

## Architecture

### Session Creation Flow (with BYOK)

```
CopilotSessionBackend.createSession(config)
  │
  ├─ Step 1: _applyDowngradeIfNeeded(config)     [Phase 11]
  │   └─ If warn threshold → substitute 0× model
  │
  ├─ Step 2: _applyByokIfExhausted(config)       [Phase 12 — NEW]
  │   ├─ Check: percentUsed >= 100 && hardStop?
  │   ├─ Check: byokConfig?.enabled?
  │   ├─ If both: override model + set provider config
  │   └─ Emit stderr notification
  │
  ├─ Step 3: Build SDK sessionConfig
  │   ├─ ...(existing fields)
  │   └─ provider: config.provider (if set)       [NEW]
  │
  └─ Step 4: client.createSession(sessionConfig)
```

### Pitfall Guards

| Pitfall | Guard | Implementation |
|---------|-------|----------------|
| Provider config leaks between sessions | Per-session config, never cached | `_applyByokIfExhausted` returns new config object; original config unchanged |
| BYOK model without provider block | Always include provider for BYOK | `toByokConfig()` always returns full provider block |
| Silent fallback to Pi | Explicit error when BYOK not configured | If exhausted and no BYOK → let BudgetExceededError propagate |
| Mid-send provider swap | Pre-flight only | Check at createSession/resumeSession boundary only |

## Validation Architecture

### Verification Dimensions

1. **BYOK trigger correctness**: Activates at hard_stop (100%), NOT at warn threshold
2. **Config conversion**: `toByokConfig()` produces valid SDK provider shape
3. **No-leak guarantee**: BYOK provider config doesn't persist to subsequent sessions
4. **No-silent-fallback**: Exhaustion without BYOK config produces actionable error
5. **Telemetry accuracy**: `byok_active` field reflects actual BYOK usage

### Test Strategy

| Test | Type | What it proves |
|------|------|----------------|
| BYOK trigger at 100% (not at warn) | Unit | D-04 correctness |
| toByokConfig() conversion | Unit | D-07 correctness |
| No provider leak between sessions | Unit | Pitfall 2 guard |
| No BYOK when disabled | Unit | D-06 contract |
| Settings get/set round-trip | Unit | D-02/D-10 |
| Session creation with BYOK provider | Source-shape | D-08 integration |
| formatPremiumSummary with byokActive | Unit | D-12 telemetry |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| SDK provider config | HIGH | Documented in SDK, confirmed by research STACK.md |
| Integration seams | HIGH | Phase 11 pattern is exact template |
| Type definitions | HIGH | Simple additive types |
| Pitfall guards | HIGH | All identified and have test strategies |
| Telemetry | HIGH | Direct extension of existing formatPremiumSummary |

## Gaps

None significant. SDK `provider` error handling (auth failure from BYOK provider mid-session) is handled by existing `RetryHandler` — no special BYOK error path needed.

---
*Research for: Phase 12 BYOK Fallback (FLOW-03)*
*Researched: 2026-03-26*
