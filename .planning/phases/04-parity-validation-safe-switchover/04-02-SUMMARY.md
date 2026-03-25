---
phase: "04"
plan: "02"
subsystem: "parity-validation-safe-switchover"
tags: ["config-driven-backend", "settings-manager", "switchover", "tdd", "backend-selection"]
dependency_graph:
  requires:
    - phase: "04-01"
      provides: "E2E parity tests and session resume tests for CopilotSessionBackend"
  provides:
    - "defaultBackend field in Settings interface (settings-manager.ts)"
    - "getDefaultBackend() / setDefaultBackend() methods on SettingsManager"
    - "sdk.ts createAgentSession config-driven backend selection chain"
    - "switchover.test.ts — 10 tests confirming backend selection precedence and settings persistence"
  affects:
    - packages/pi-coding-agent/src/core/settings-manager.ts
    - packages/pi-coding-agent/src/core/sdk.ts
    - packages/pi-coding-agent/src/core/backends/switchover.test.ts
tech_stack:
  added: []
  patterns:
    - "Config-driven backend selection: options.backend ?? settingsManager.getDefaultBackend() ?? 'pi'"
    - "SettingsManager.inMemory() for isolated behavioral tests (no file I/O)"
    - "Source-shape assertions via readFileSync for SDK behavior verification"
key_files:
  created:
    - packages/pi-coding-agent/src/core/backends/switchover.test.ts
  modified:
    - packages/pi-coding-agent/src/core/settings-manager.ts
    - packages/pi-coding-agent/src/core/sdk.ts
key-decisions:
  - "ts-resolver.mjs ESM hook required to run switchover.test.ts with --experimental-strip-types (same pattern as Phase 2)"
  - "SettingsManager.inMemory() used for behavioral tests — no temp directory, no file I/O, clean isolation"
  - "backends.test.ts verified via compiled dist/ (pre-existing TS parameter properties constraint from Phase 4-01)"
  - "Pi remains hardcoded fallback: options.backend ?? settingsManager.getDefaultBackend() ?? 'pi' — backward compatible"

requirements-completed:
  - TOOL-03
  - SAFE-02
  - SAFE-03

duration: 5min
completed: "2026-03-25"
---

# Phase 04 Plan 02: Config-Driven Backend Selection + Switchover Safety Tests Summary

**Config-driven default backend selection wired in sdk.ts via settings (options.backend → settingsManager.getDefaultBackend() → "pi" fallback), with 10-test switchover safety suite confirming precedence chain, Settings field, and SettingsManager getter/setter behavioral correctness.**

---

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T03:59:07Z
- **Completed:** 2026-03-25T04:04:45Z
- **Tasks:** 2 completed
- **Files modified:** 2 modified, 1 created

---

## Accomplishments

- Added `defaultBackend?: "pi" | "copilot"` to the `Settings` interface in settings-manager.ts
- Added `getDefaultBackend()` and `setDefaultBackend()` methods to `SettingsManager` class
- Wired `sdk.ts` `createAgentSession` to read settings for backend selection: `options.backend ?? settingsManager.getDefaultBackend() ?? "pi"` — Pi remains the safe fallback
- Created `switchover.test.ts` with 10 tests confirming: backend precedence chain correctness, Settings field presence, and SettingsManager getter/setter behavioral correctness

---

## What Was Built

### Task 1: `packages/pi-coding-agent/src/core/settings-manager.ts` (MODIFIED)

**Settings interface** — new field:
```typescript
defaultBackend?: "pi" | "copilot"; // Session backend runtime. Default: "pi". Set to "copilot" to enable GitHub Copilot SDK.
```

**SettingsManager class** — new methods (after `setDefaultThinkingLevel`):
```typescript
getDefaultBackend(): "pi" | "copilot" | undefined {
    return this.settings.defaultBackend;
}

setDefaultBackend(backend: "pi" | "copilot"): void {
    this.setGlobalSetting("defaultBackend", backend);
}
```

### Task 1: `packages/pi-coding-agent/src/core/sdk.ts` (MODIFIED)

Backend selection line changed from:
```typescript
const backend = options.backend ?? "pi";
```
to:
```typescript
const backend = options.backend ?? settingsManager.getDefaultBackend() ?? "pi";
```

This implements the full precedence chain:
1. **Explicit API option** (`options.backend`) — always wins
2. **Settings-based default** (`settingsManager.getDefaultBackend()`) — config-driven migration
3. **Hardcoded "pi" fallback** — backward-compatible safe default

### Task 2: `packages/pi-coding-agent/src/core/backends/switchover.test.ts` (NEW) — 10 tests

Three describe blocks:

- **Config-driven backend selection — source shape (4 tests):** Validates sdk.ts contains `settingsManager.getDefaultBackend()`, `options.backend ??` precedence, `?? "pi"` fallback, and the complete chain `options.backend ?? settingsManager.getDefaultBackend() ?? "pi"`.

- **Settings defaultBackend field (3 tests):** Validates settings-manager.ts contains `defaultBackend?: "pi" | "copilot"` in the Settings interface, `getDefaultBackend()` method, and `setDefaultBackend(` method.

- **SettingsManager backend getter/setter (3 tests):** Behavioral tests using `SettingsManager.inMemory()` — `getDefaultBackend()` returns undefined initially; `setDefaultBackend("copilot")` persists correctly; `setDefaultBackend("pi")` reverts after being set to copilot.

---

## Verification Results

```
✔ TypeScript: npx tsc --noEmit → 0 errors
✔ Switchover tests: 10/10 pass
✔ backends.test.ts (via dist/): 12/12 pass — no regressions
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing closing `}` brace on Settings interface**
- **Found during:** Task 1
- **Issue:** The `replace_string_in_file` tool dropped the closing `}` brace of the Settings interface when adding the `defaultBackend` field (newline handling artifact)
- **Fix:** Used Python script to precisely locate and repair the exact text, restoring the `}` and correcting indentation from spaces to tab
- **Files modified:** `packages/pi-coding-agent/src/core/settings-manager.ts`
- **Commit:** ed8aa61d (included in Task 1 commit)

**2. [Rule 1 - Bug] Applied ts-resolver.mjs ESM hook for switchover.test.ts**
- **Found during:** Task 2 TDD GREEN
- **Issue:** `node --experimental-strip-types` alone cannot remap `.js` imports to `.ts` — `settings-manager.js` not found
- **Fix:** Added `--import ./packages/pi-coding-agent/src/core/backends/accounting/ts-resolver.mjs` flag (same approach as Phase 2)
- **Impact:** Documented correct test run command in plan verification

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | ed8aa61d | feat(04-02): add defaultBackend to Settings and wire config-driven backend selection |
| Task 2 | 1206f2fa | test(04-02): add switchover safety tests for config-driven backend selection |

---

## Known Stubs

None — all data flows are wired. The `defaultBackend` field is read by `createAgentSession` and persisted via `setDefaultBackend`. No placeholder values.

## Self-Check: PASSED

- [x] `packages/pi-coding-agent/src/core/settings-manager.ts` — exists and contains `defaultBackend`
- [x] `packages/pi-coding-agent/src/core/sdk.ts` — exists and contains `settingsManager.getDefaultBackend()`
- [x] `packages/pi-coding-agent/src/core/backends/switchover.test.ts` — exists, 107 lines
- [x] Commit ed8aa61d — exists
- [x] Commit 1206f2fa — exists
