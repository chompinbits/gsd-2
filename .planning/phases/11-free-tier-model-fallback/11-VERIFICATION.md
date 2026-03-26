---
phase: 11-free-tier-model-fallback
verified: 2026-03-26T15:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 11: Free-Tier Model Fallback Verification Report

**Phase Goal:** Implement free-tier model fallback — when budget pressure is detected at session creation time, automatically downgrade the requested model to a 0× cost candidate and surface the substitution to the user
**Verified:** 2026-03-26T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `suggestDowngrade()` returns null when budget is below warn threshold | ✓ VERIFIED | `downgrade.ts:51` — `if (percentUsed < threshold) return null` |
| 2  | `suggestDowngrade()` returns a DowngradeSuggestion with a free-tier model when budget ≥ warn threshold | ✓ VERIFIED | `downgrade.ts:53-58` — builds and returns DowngradeSuggestion |
| 3  | `suggestDowngrade()` returns null when `free_tier_fallback.enabled` is false | ✓ VERIFIED | `downgrade.ts:37` — first guard clause |
| 4  | `suggestDowngrade()` returns null when no 0× candidate is available | ✓ VERIFIED | `downgrade.ts:43` — `if (FREE_TIER_CANDIDATES.length === 0) return null` |
| 5  | `FREE_TIER_CANDIDATES` is deterministic and contains only 0× models from `MODEL_MULTIPLIER_MAP` | ✓ VERIFIED | `downgrade.ts:20-23` — derived via `filter(tier === "free").sort()` at module load |
| 6  | `AccountingConfig` includes `FreeTierFallbackConfig` with `enabled` and `thresholdPolicy` fields | ✓ VERIFIED | `types.ts:19-29` — `FreeTierFallbackConfig` interface, `AccountingConfig.freeTierFallback` field |
| 7  | `loadAccountingConfig` parses `free_tier_fallback` section from config.json | ✓ VERIFIED | `config.ts:44-53` — reads `free_tier_fallback`, maps `enabled` and `threshold_policy` |
| 8  | `CopilotSessionBackend.createSession` routes new sessions to 0× model when budget at warn threshold | ✓ VERIFIED | `copilot-backend.ts:170` — `_applyDowngradeIfNeeded(config)` called before session construction |
| 9  | `CopilotSessionBackend.resumeSession` routes resumed sessions to 0× model when budget at warn threshold | ✓ VERIFIED | `copilot-backend.ts:206` — same pre-flight pattern |
| 10 | A structured notification is emitted when downgrade occurs | ✓ VERIFIED | `copilot-backend.ts:171-175, 208-212` — `process.stderr.write("[gsd:accounting] ⚠ Model downgraded: …")` |
| 11 | Telemetry output includes downgrade events with original and downgraded model IDs | ✓ VERIFIED | `telemetry.ts:67-72` — "Model downgrades:" block with `originalModel → downgradedTo (at X.X% budget)` |
| 12 | No downgrade occurs when `freeTierFallback.enabled` is false | ✓ VERIFIED | Delegated to `suggestDowngrade` (truth #3); confirmed by 3 unit tests |
| 13 | No downgrade occurs mid-session (new/resume sessions only — D-07/D-08) | ✓ VERIFIED | `_applyDowngradeIfNeeded` referenced only at lines 170 and 206; `send()` (lines 43, 84) is never modified |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pi-coding-agent/src/core/backends/accounting/downgrade.ts` | `suggestDowngrade`, `DowngradeSuggestion`, `FREE_TIER_CANDIDATES` | ✓ VERIFIED | 57 lines; all three exports present; pure, no side effects |
| `packages/pi-coding-agent/src/core/backends/accounting/downgrade.test.ts` | Unit tests for downgrade logic (min 80 lines) | ✓ VERIFIED | 263 lines; 20 tests across 5 describe groups; all passing |
| `packages/pi-coding-agent/src/core/backends/accounting/types.ts` | `FreeTierFallbackConfig`, `DEFAULT_FREE_TIER_FALLBACK`, `freeTierFallback` on `AccountingConfig` | ✓ VERIFIED | Interface defined lines 19-28; added to `AccountingConfig` line 35; default constant line 30 |
| `packages/pi-coding-agent/src/core/backends/accounting/config.ts` | Parses `free_tier_fallback` from config.json | ✓ VERIFIED | `free_tier_fallback` section parsed at lines 44-53 |
| `packages/pi-coding-agent/src/core/backends/accounting/index.ts` | Re-exports `FreeTierFallbackConfig`, `DEFAULT_FREE_TIER_FALLBACK`, `suggestDowngrade`, `FREE_TIER_CANDIDATES`, `DowngradeSuggestion` | ✓ VERIFIED | All five exported at lines 4-8, 9, 32-33 |
| `packages/pi-coding-agent/src/core/backends/copilot-backend.ts` | `_applyDowngradeIfNeeded`, `_downgrades`, `getDowngrades`, downgrade call in `createSession`/`resumeSession` | ✓ VERIFIED | All present; lines 117, 131-133, 140, 170, 206 |
| `packages/pi-coding-agent/src/core/backends/accounting/telemetry.ts` | `downgrades?` param on `formatPremiumSummary`, "Model downgrades:" output block | ✓ VERIFIED | Optional param at line 29; block rendered at lines 67-72 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `downgrade.ts` | `types.ts` | `import type { AccountingConfig, BudgetState }` | ✓ WIRED | Line 1 of downgrade.ts |
| `downgrade.ts` | `multipliers.ts` | `import { MODEL_MULTIPLIER_MAP }` | ✓ WIRED | Line 2 of downgrade.ts |
| `copilot-backend.ts` | `downgrade.ts` | `import { suggestDowngrade }` | ✓ WIRED | Line 10 of copilot-backend.ts |
| `copilot-backend.ts` | `request-tracker.ts` | `tracker.getState()` for budget state | ✓ WIRED | Line 147 of copilot-backend.ts |
| `telemetry.ts` | (downgrade shape) | `downgrades?` optional param uses same record shape | ✓ WIRED | `telemetry.ts:29` — structurally typed; same fields as `_downgrades` array |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a pure function library and backend session-routing logic, not UI components that render data. No Level 4 trace required.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 20 downgrade unit tests pass | `node --test dist/core/backends/accounting/downgrade.test.js` | 20 pass, 0 fail | ✓ PASS |
| No regressions in 56 accounting tests | `node --test dist/core/backends/accounting/accounting.test.js` | 56 pass, 0 fail | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| FLOW-02 | 11-01-PLAN, 11-02-PLAN | User can configure free-tier fallback in GSD settings; system can route to 0× models automatically under quota pressure | ✓ SATISFIED | `suggestDowngrade()` implements decision logic; `loadAccountingConfig` parses user config; `CopilotSessionBackend` routes sessions; telemetry surfaces substitution. Marked Complete in REQUIREMENTS.md |

No orphaned requirements — FLOW-02 is the only requirement mapped to Phase 11.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `downgrade.ts` | 37, 40, 43, 51 | `return null` | ℹ️ Info | Intentional guard clauses — not stubs. Each is a documented early-return condition per spec |

No TODO/FIXME/placeholder comments detected. No empty handlers or hardcoded data stubs found.

---

### Human Verification Required

None. All goal behaviors are verifiable programmatically:
- Logic is pure and fully unit-tested
- Integration points are import/grep-traceable
- No visual output or external service behavior requiring human observation

---

### Gaps Summary

No gaps. All 13 must-have truths verified against actual codebase:
- `downgrade.ts` pure function logic matches spec exactly (all guard conditions confirmed by 20 passing tests)
- `types.ts` and `config.ts` correctly extend accounting with `FreeTierFallbackConfig` and `free_tier_fallback` parsing
- `copilot-backend.ts` correctly places pre-flight check in `createSession`/`resumeSession` only — never in `send()` (D-07/D-08 satisfied)
- `telemetry.ts` backward-compatible extension surfaces "Model downgrades:" block when records present
- All 4 claimed commits (5a51c4a2, 85c4b6d3, 63ddff7e, d14e3b5c) verified in git log
- FLOW-02 fully satisfied and marked Complete in REQUIREMENTS.md

---

_Verified: 2026-03-26T15:00:00Z_  
_Verifier: GitHub Copilot (gsd-verifier)_
