---
status: partial
phase: 04-parity-validation-safe-switchover
source: [04-VERIFICATION.md]
started: 2026-03-24T12:00:00Z
updated: 2026-03-24T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live discuss parity
expected: Run /gsd-discuss-phase with --backend copilot and compare output to Pi backend in a live GSD session — same number of questions, similar topics, same workflow UX
result: [pending]

### 2. Real process interruption + resume
expected: Kill a GSD workflow mid-execution (Ctrl+C) and then resume via session ID with Copilot backend — session resumes from the interruption point without restarting from scratch
result: [pending]

### 3. Config-driven switchover end-to-end
expected: Set defaultBackend to 'copilot' in settings and run a full /gsd-plan-phase workflow — plan is produced using Copilot SDK; if reverted to 'pi', subsequent runs use Pi backend
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
