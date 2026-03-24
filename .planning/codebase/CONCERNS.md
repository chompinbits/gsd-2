# Codebase Concerns

**Analysis Date:** 2026-03-24

## Tech Debt

### High-Complexity Core Modules

**Large monolithic files with multiple concerns:**
- `src/web/bridge-service.ts` (2,277 lines) — WebSocket RPC bridge, session management, and session browser all in one file
- `src/resources/extensions/gsd/auto-prompts.ts` (1,633 lines) — Prompt generation and response parsing tightly coupled
- `src/resources/extensions/gsd/gsd-db.ts` (1,546 lines) — Database adapter with provider fallback chain
- `src/resources/extensions/gsd/auto.ts` (1,483 lines) — State machine for auto-mode dispatch
- `src/resources/extensions/gsd/guided-flow.ts` (1,474 lines) — Interactive flow logic

**Impact:** Difficult to test, change, or reason about. Single-file modifications risk side effects across multiple domains.

**Fix approach:** Decompose into focused modules. `bridge-service.ts` should separate RPC protocol handling from session management. `auto.ts` should extract dispatch decision logic from prompt injection.

---

### Silent Exception Handling With Incomplete Diagnostics

**Pattern:** Catch blocks that swallow errors with minimal logging:
- `src/resources/extensions/gsd/session-lock.ts` — Multiple silent `.catch()` blocks for file operations
- `src/resources/extensions/gsd/commands-maintenance.ts` — Silent catches in branch/snapshot cleanup paths
- `src/resources/extensions/gsd/auto-recovery.ts` — Error recovery catches without always logging root cause

**Current state:** CHANGELOG references document this issue being addressed with debug logging (#1013, #1037, #986), but full audit not yet complete.

**Impact:** Production issues difficult to diagnose — error swallowing happens in critical paths like crash recovery, session lock acquisition, and state reconciliation.

**Fix approach:** Audit all catch blocks. Mark intentional silent catches with inline comments explaining why. Add structured error logging to all recovery paths. Use error references for crash diagnostics.

---

### Synchronous File I/O In Hot Paths

**Files affected:**
- `src/resources/extensions/gsd/session-lock.ts` — Multiple `fsSyncX()` calls in lock acquisition, cleanup, and status checks
- `src/resources/extensions/gsd/captures.ts` — Synchronous reads in capture parsing
- `src/resources/extensions/gsd/state.ts` — Synchronous state file reads and writes

**Pattern examples:**
- `readFileSync()`, `writeFileSync()`, `mkdirSync()`, `readdirSync()`, `statSync()` are spread across state management code
- Atomic write operations use synchronous file operations by design
- Lock file management is inherently synchronous

**Impact:** Blocks event loop during unit dispatch, state derivation, and lock contention. In auto-mode with long-running units, this causes perceptible UI freezing or session lag.

**Fix approach:** Evaluate whether all sync operations are necessary. Batch disk I/O where possible. Consider worker threads for state reconciliation. Document which operations must remain sync for atomicity.

---

## Known Bugs & Limitations

### Worktree Lifecycle Gap

**Problem:** No automatic cleanup of merged or stale worktrees.
- Doctor detects completed-milestone worktrees but doesn't check:
  - Branch merge status (merged into main?)
  - Staleness (14+ days without commits)
  - Dirty state (uncommitted changes)
  - Unpushed commits

**Files:** `src/resources/extensions/gsd/doctor-checks.ts`, tracked in PLAN.md

**Impact:** Users accumulate orphaned worktrees in `.gsd/worktrees/`. Manual `git worktree remove` is required. Disk space accumulation and confusion about which branches are safe to remove.

**Fix approach:** Phase 1 of PLAN.md — add worktree lifecycle checks to doctor. Add `worktree_branch_merged`, `worktree_stale`, `worktree_dirty`, `worktree_unpushed` checks.

---

### Snapshot Bloat Not Detected

**Problem:** `refs/gsd/snapshots/` refs accumulate indefinitely.
- No doctor check for snapshot count
- `/gsd cleanup snapshots` exists but is not discoverable from doctor
- Long-running projects accumulate 100+ snapshot refs

**Files:** `src/resources/extensions/gsd/doctor-checks.ts` (missing check)

**Impact:** Large `.git/refs/gsd/snapshots/` directory. Potential git performance degradation with >500 refs per label.

**Fix approach:** Add `snapshot_ref_bloat` check to doctor (PLAN.md Phase 2b). Prune to newest 5 per label on `--fix`.

---

### Command Duplication in Cleanup Surface

**Problem:** Seven commands overlap in cleanup/diagnosis logic:
- `/gsd cleanup` (branches + snapshots)
- `/gsd cleanup branches` (legacy branch detection, but no worktree lifecycle)
- `/gsd cleanup snapshots` (ref pruning)
- `/gsd cleanup projects` (orphaned state detection)
- `/gsd doctor` (general health)
- `/gsd doctor fix` (auto-repair)
- `/gsd doctor audit` (expanded output)

**Files:** `src/resources/extensions/gsd/commands-maintenance.ts`, `src/resources/extensions/gsd/doctor-checks.ts`

**Impact:** User confusion about which command to run. Duplicated logic across branches vs. doctor. Inconsistent fixability (some issues reported but not fixable).

**Fix approach:** Consolidate into doctor as single health authority (PLAN.md). Make cleanup a permanent alias.

---

## Security Considerations

### Shell Injection Surface — Partially Addressed

**Current status:** CHANGELOG documents fixes for #1022 (browser URL opening), #1025 (config resolution), #1066 (verification gate sanitization).

**Remaining concern areas:**
- `src/resources/extensions/gsd/native-git-bridge.ts` — Shell escaping for paths in git commands
- `src/resources/extensions/gsd/auto-worktree.ts` — Path resolution and worktree creation with user-generated names
- Bash command construction in verification and test execution

**Files:** `src/resources/extensions/gsd/native-git-bridge.ts`, `src/resources/extensions/gsd/auto-worktree.ts`, `src/resources/extensions/gsd/verification-gate.ts`

**Pattern:** Most commands now use `execFileSync()` or `execFile()` with array arguments (no shell), but some legacy paths still construct shell strings.

**Fix approach:** Audit all git and bash command invocations. Use `execFile()` with explicit `shell: false` for all external commands. Template strings for paths should be escaped.

---

### Prompt Injection Scan Exists But Is Pre-Deployment

**Current status:** CHANGELOG #1699 adds prompt injection scan to CI/CD.
- Scan runs on docs and prompt files
- Scope limited to committed artifacts, not runtime prompt generation

**Remaining risk:**
- Runtime-generated prompts in `src/resources/extensions/gsd/auto-prompts.ts` constructed from user state
- State derivation in `src/resources/extensions/gsd/derive-state.ts` builds context blocks from user files and git history
- Captures and artifacts may contain malicious content that influences prompt generation

**Files:** `src/resources/extensions/gsd/auto-prompts.ts`, `src/resources/extensions/gsd/derive-state.ts`, `src/resources/extensions/gsd/captures.ts`

**Fix approach:** Document prompt generation as already-audited surface. Add inline security comments noting that state content is user-controlled. Consider escaping user-provided content in critical prompt sections.

---

## Performance Bottlenecks

### Memory Growth in Long-Running Auto-Mode Sessions

**Historical issue:** CHANGELOG #611 documents heap OOM from four sources:
1. Activity log serialized all entries for SHA1 dedup (now streaming with fingerprint)
2. Uncleaned `activityLogState` Map between sessions
3. Unbounded `completedUnits` array (now capped at 200)
4. `dirEntryCache` / `dirListCache` growing without bounds (now evicted at 200 entries)

**Current files:** `src/resources/extensions/gsd/activity-log.ts`, `src/resources/extensions/gsd/cache.ts`, `src/resources/extensions/gsd/auto.ts`

**Status:** Fixed, but patterns remain that could regress:
- In-memory Maps and arrays without explicit eviction policy
- High-cardinality cache keys that scale with file count
- State serialization in hot loops

**Fix approach:** Establish cache eviction patterns as documented conventions. Add memory profiling to CI for long-running auto-mode tests. Comment all unbounded collections with capacity limits.

---

### Synchronous Lock Contention on State Files

**Problem:** Session lock acquisition uses synchronous file I/O with retries:
- `src/resources/extensions/gsd/session-lock.ts` — `lockSync()` with exponential backoff
- Cloud sync conflicts generate numbered lock variants (e.g., `SESSION_LOCK.json`, `SESSION_LOCK 1.json`)
- Lock cleanup is best-effort, leaving stale locks that cause future conflicts

**Files:** `src/resources/extensions/gsd/session-lock.ts` (#1315 patch partially addresses)

**Impact:** Multi-process GSD invocations (parallel workstreams, concurrent CLI commands) contend on single lock file. Worst case: 15+ second wait times before session acquisition timeout.

**Fix approach:** Implement per-session lock namespacing or switch to directory-based locks (as in atomic-write pattern). Test parallel invocation under cloud sync.

---

### Unbounded Task Execution In Auto-Mode

**Problem:** Auto-mode can spawn execute-task units without inherent resource limits.
- Each unit spawns LLM + tools on arbitrary codebase changes
- No built-in timeout beyond UNIX process timeout (which hangs indefinitely with async bash jobs)
- Verification loops can retry indefinitely on transient failures

**Files:** `src/resources/extensions/gsd/auto.ts`, `src/resources/extensions/gsd/auto-timeout-recovery.ts`, `src/resources/extensions/gsd/verification-gate.ts`

**Status:** CHANGELOG #2214 fixes async bash job timeout hang. CHANGELOG #1769 adds configurable timeout to `await_job`. But overall task execution budget not yet budgeted.

**Fix approach:** Implement task budget per phase (token + time). Reject execute-task units that would exceed budget. Add cost estimation before dispatch. Document auto-mode cost guardrails in preferences.

---

## Fragile Areas

### Worktree Isolation: Symlink vs. Logical Paths

**Problem:** GSD supports both symlinked worktrees (`.gsd/projects/<hash>/worktrees/`) and logical paths (`.gsd/worktrees/`). Path resolution must handle both.

**Files:** `src/resources/extensions/gsd/captures.ts` (path detection), `src/resources/extensions/gsd/paths.ts` (path resolution), `src/resources/extensions/gsd/worktree.ts` (worktree creation)

**Fragility:** Multiple functions attempt to normalize paths across layouts:
- `resolveCapturesPath()` uses regex to detect worktree marker
- `resolveProjectRoot()` walks up directory tree to find `.gsd/` anchor (PR #675 fixed bug where it returned wrong level)
- Worker processes must resolve project root correctly or operate on wrong path

**Fix approach:** Consolidate path layout detection into single source of truth. Add comprehensive tests for both layouts. Document which functions are layout-aware.

---

### State Derivation: Bidirectional Dependencies

**Problem:** `src/resources/extensions/gsd/derive-state.ts` derives GSD state from multiple sources:
- PLAN.md (current phase)
- .gsd/milestones/ (completed work)
- Git history (commits, branches)
- STATE.md (previous run state)
- Preferences (configuration)

**Fragility:** Changes to any input file can invalidate derived state. No invalidation mechanism to detect stale caches. State assumptions are implicit in dispatch logic.

**Files:** `src/resources/extensions/gsd/derive-state.ts`, `src/resources/extensions/gsd/auto.ts` (consumes derived state)

**Impact:** State inconsistencies leak into dispatch decisions. Auto-mode can dispatch wrong unit type if state is stale.

**Fix approach:** Implement explicit cache invalidation on file writes. Add unit tests for state derivation under concurrent file changes. Document state dependency graph.

---

### Test Coverage Gaps in Error Paths

**Pattern:** Exception handling and error recovery are under-tested:
- Silent catch blocks in live code with no corresponding unit test
- Crash recovery paths tested only in integration (slow, flaky)
- Worktree cleanup tested in smoke tests but not unit tests
- Verification gate retry logic tested only end-to-end

**Files:** `src/resources/extensions/gsd/tests/auto-loop.test.ts` (2,114 lines but focuses on happy paths)

**Impact:** Regressions in error handling go undetected until production. Silent failures mask underlying issues.

**Fix approach:** Add unit tests for all catch blocks. Mock file I/O to test error conditions. Add integration tests for verifiable crash scenarios.

---

## Dependencies at Risk

### Legacy Database Provider Chain Complexity

**Problem:** `src/resources/extensions/gsd/gsd-db.ts` attempts to load SQLite from three sources:
1. `node:sqlite` (built-in, experimental)
2. `better-sqlite3` (native module, requires build)
3. Fallback: null (in-memory only)

**Files:** `src/resources/extensions/gsd/gsd-db.ts`, `package.json` (no explicit sqlite3 dependency)

**Fragility:** Provider detection is runtime-dependent. Node 25+ changed module loading. If neither provider available, decisions/requirements storage silently degrades to no-op.

**CHANGELOG:** #1190 switched from better-sqlite3 to sql.js (WASM) for Node 25+ compatibility.

**Fix approach:** Evaluate whether sql.js migration is complete. If better-sqlite3 still in use, document fallback behavior. Add startup diagnostic for DB availability.

---

### OAuth Module Partially Deprecated

**Problem:** `packages/pi-ai/src/utils/oauth/` contains legacy OAuth code marked for removal.
- Google Gemini CLI authentication has both legacy tier system and new tier system
- Multiple authentication paths (OAuth redirect server, CLI code exchange, service account)
- Unclear which paths are still in use vs. deprecated

**Files:** `packages/pi-ai/src/utils/oauth/google-gemini-cli.ts`, CHANGELOG #1228

**Impact:** Code complexity for rarely-used or deprecated OAuth flows. Risk of auth failures if legacy code is removed without full deprecation cycle.

**Fix approach:** Audit OAuth flows by provider. Document which are in use. Mark clearly deprecated paths with removal timeline. Add error message for deprecated tiers.

---

## Scaling Limits

### Auto-Mode State Serialization

**Limit:** STATE.md serializes auto-mode state to disk after each unit.
- State includes activity log metadata, completed units summary, routing history
- FILE-SYSTEM-MAP.md documents that STATE.md grows unbounded without rotation
- Very long-running milestones can produce multi-MB STATE.md files

**Worktop impact:** Reading STATE.md during subsequent dispatch gets expensive.

**Fix approach:** Implement STATE.md rotation. Archive completed units beyond recent N. Keep only last 100 units in active STATE.md.

---

### Project Root Discovery Walk-up on Deep Trees

**Problem:** `gsdRoot()` function walks up directory tree to find `.gsd/` anchor.
- On very deep worktrees under monorepos, this can hit filesystem limits
- No documented worst-case performance

**Files:** `src/resources/extensions/gsd/paths.ts`

**Fix approach:** Cache project root in environment variable or thread-local during unit execution. Document symlink setup for monorepos.

---

## Test Coverage Gaps

### Auto-Mode State Machine: Silent Paths Undocumented

**What's not tested:**
- Dispatch routing when phase has no more slices (transition to next phase)
- Unit timeout recovery with partial progress
- Parallel worktree corruption (two units writing to same milestone file)
- Session lock timeout → new lock acquisition fallback
- Git merge conflicts during state sync

**Files:** `src/resources/extensions/gsd/tests/auto-loop.test.ts` (comprehensive but 2,114 lines focused on orchestration, not edge cases)

**Impact:** Rare edge cases found in production. Fix regressions when state machine refactored.

**Fix approach:** Map out all dispatch decision branches. Add unit test for each branch with mocked file I/O. Use property-based testing for state transitions.

---

### Verification Gate: Command Sanitization Incomplete

**What's not tested:**
- Prose Verify: fields that are shell commands (rejected in #1066, but acceptance tests not thorough)
- Command discovery auto-completion edge cases
- Malformed verification YAML that breaks command extraction

**Files:** `src/resources/extensions/gsd/verification-gate.ts`, `src/resources/extensions/gsd/tests/verification-gate.test.ts` (1,015 lines)

**Fix approach:** Add fuzz tests for malformed verification blocks. Test command sanitization with injection payloads.

---

### Bridge Server: RPC Protocol Robustness

**What's not tested:**
- Malformed RPC messages (truncated JSON, wrong types)
- Out-of-order RPC responses
- Session resumption with missing session files
- Terminal resize events while processing large output

**Files:** `src/web/bridge-service.ts`, `src/tests/integration/web-mode-assembled.test.ts` (1,042 lines, integration-focused)

**Fix approach:** Add unit tests for bridge message parsing. Fuzz RPC message streams. Test session recovery with corrupted STATE.md.

---

## Missing Critical Features

### Auto-Mode: No Budget Enforcement

**Problem:** Auto-mode can cost unlimited tokens and time.
- Preferences allow service tier to be set but no actual token budget enforcement
- Phase execution unbounded by cost
- Verification retries can accumulate large token bills without warning

**Files:** `src/resources/extensions/gsd/auto-budget.ts` (exists but partial), `src/resources/extensions/gsd/preferences.ts` (budget preference defined but not enforced)

**Status:** CHANGELOG tracks budget alerts (#1505, #1848, #1862) but enforcement is informational only (alerts, not stops).

**Fix approach:** Implement hard budget limits per phase. Cache LLM response tokens as unit executes. Reject execute-task if would exceed budget.

---

### Doctor: No Worktree Lifecycle Checks

**Problem:** Doctor doesn't check:
- Whether worktree is merged (safe to remove)
- Whether worktree is stale (14+ days)
- Whether worktree is dirty

**Files:** `src/resources/extensions/gsd/doctor-checks.ts`

**Impact:** Users can't safely clean up old work without manual git investigation.

**Fix approach:** Phase 1 of PLAN.md (tracked, not yet done).

---

## Summary

| Category | Count | Severity |
|---|---|---|
| Tech Debt | 4 | Medium-High |
| Known Bugs | 3 | Medium |
| Security | 2 | Low-Medium |
| Performance | 3 | Medium |
| Fragile Areas | 3 | Medium |
| Dependencies | 2 | Low-Medium |
| Scaling Limits | 2 | Low |
| Test Gaps | 3 | Medium |
| Missing Features | 2 | Medium |

**Highest-impact work:**
1. Decompose `bridge-service.ts` and `auto.ts` (tech debt)
2. Implement worktree lifecycle checks in doctor (missing feature)
3. Implement task budget enforcement (missing feature)
4. Audit error handling paths for silent catches (tech debt)

---

*Concerns audit: [2026-03-24]*
