/**
 * Source-shape tests for the execute-phase workflow wrapper.
 *
 * Uses readFileSync to assert structural contracts without runtime execution
 * (same pattern as v1.0 parity tests — no live LLM or SDK calls needed).
 *
 * Covers: D-01 (routing), D-04 (stage accounting), D-07 (tool profile),
 *         D-10 (telemetry format), prompt template placeholders.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const moduleSource = readFileSync(
  join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, 'execute-phase.ts'),
  'utf-8',
)

// ═══════════════════════════════════════════════════════════════════════════
// 1. Export Shape
// ═══════════════════════════════════════════════════════════════════════════

test('exports runExecuteWorkflow function', () => {
  assert.match(moduleSource, /export async function runExecuteWorkflow/)
})

test('exports ExecuteConfig interface', () => {
  assert.match(moduleSource, /export interface ExecuteConfig/)
})

test('exports ExecuteOptions interface', () => {
  assert.match(moduleSource, /export interface ExecuteOptions/)
})

test('exports ExecuteOutput interface', () => {
  assert.match(moduleSource, /export interface ExecuteOutput/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Backend Routing Contract (D-01)
// ═══════════════════════════════════════════════════════════════════════════

test('uses createAgentSession for backend routing', () => {
  assert.match(moduleSource, /createAgentSession/)
})

test('passes backend parameter to session options', () => {
  assert.match(moduleSource, /backend/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Tool Profile (D-07)
// ═══════════════════════════════════════════════════════════════════════════

test('imports codingTools for full execute capability', () => {
  assert.match(moduleSource, /codingTools/)
})

test('does NOT use readOnlyTools', () => {
  assert.doesNotMatch(moduleSource, /readOnlyTools/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Stage Accounting (D-04)
// ═══════════════════════════════════════════════════════════════════════════

test('passes execute-task stage to session options', () => {
  assert.match(moduleSource, /stage:\s*['"]execute-task['"]/)
})

test('telemetry logs tier=standard', () => {
  // Accounting constant is 'standard' — interpolated as tier=${EXECUTE_PHASE_ACCOUNTING_TIER}
  assert.match(moduleSource, /EXECUTE_PHASE_ACCOUNTING_TIER\s*=\s*'standard'/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Prompt Contract (D-01)
// ═══════════════════════════════════════════════════════════════════════════

test('prompt template includes OBJECTIVE placeholder', () => {
  assert.match(moduleSource, /\{OBJECTIVE\}/)
})

test('prompt template includes CONTEXT_SECTION placeholder', () => {
  assert.match(moduleSource, /\{CONTEXT_SECTION\}/)
})
