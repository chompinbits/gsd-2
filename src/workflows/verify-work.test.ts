/**
 * Tests for the verify-work workflow wrapper.
 *
 * Source-shape tests assert structural contracts (routing, tool profile, etc.)
 * without runtime execution. Runtime tests exercise the extractVerifyChecks
 * parser with concrete inputs.
 *
 * Covers: D-01 (routing), D-04 (stage accounting), D-08 (read-only tools),
 *         D-10 (telemetry format), extractVerifyChecks parser correctness.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const moduleSource = readFileSync(
  join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, 'verify-work.ts'),
  'utf-8',
)

// Dynamic import for runtime parser tests (pure function, no side-effects)
const { extractVerifyChecks } = await import('./verify-work.js')

// ═══════════════════════════════════════════════════════════════════════════
// 1. Export Shape
// ═══════════════════════════════════════════════════════════════════════════

test('exports runVerifyWorkflow function', () => {
  assert.match(moduleSource, /export async function runVerifyWorkflow/)
})

test('exports VerifyConfig interface', () => {
  assert.match(moduleSource, /export interface VerifyConfig/)
})

test('exports VerifyOptions interface', () => {
  assert.match(moduleSource, /export interface VerifyOptions/)
})

test('exports VerifyOutput interface', () => {
  assert.match(moduleSource, /export interface VerifyOutput/)
})

test('exports extractVerifyChecks function', () => {
  assert.match(moduleSource, /export function extractVerifyChecks/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Backend Routing Contract (D-01)
// ═══════════════════════════════════════════════════════════════════════════

test('uses createAgentSession for backend routing', () => {
  assert.match(moduleSource, /createAgentSession/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Tool Profile (D-08 — read-only, no write/edit)
// ═══════════════════════════════════════════════════════════════════════════

test('imports readOnlyTools for verification', () => {
  assert.match(moduleSource, /readOnlyTools/)
})

test('does NOT import codingTools', () => {
  assert.doesNotMatch(moduleSource, /codingTools/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Stage Accounting (D-04)
// ═══════════════════════════════════════════════════════════════════════════

test('passes verify-work stage to session options', () => {
  assert.match(moduleSource, /stage:\s*['"]verify-work['"]/)
})

test('telemetry logs tier=free', () => {
  // Accounting constant is 'free' — interpolated as tier=${VERIFY_WORK_ACCOUNTING_TIER}
  assert.match(moduleSource, /VERIFY_WORK_ACCOUNTING_TIER\s*=\s*'free'/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. extractVerifyChecks Parser (runtime)
// ═══════════════════════════════════════════════════════════════════════════

test('extractVerifyChecks parses single passing check', () => {
  const text = `CHECK: Build compiles\nSTATUS: PASS\nDETAILS: tsc exits 0`
  const checks = extractVerifyChecks(text)
  assert.equal(checks.length, 1)
  assert.equal(checks[0].name, 'Build compiles')
  assert.equal(checks[0].passed, true)
  assert.equal(checks[0].details, 'tsc exits 0')
})

test('extractVerifyChecks parses mixed pass/fail', () => {
  const text = [
    'CHECK: Unit tests',
    'STATUS: PASS',
    'DETAILS: All 42 tests pass',
    'CHECK: Lint',
    'STATUS: FAIL',
    'DETAILS: 3 warnings found',
  ].join('\n')
  const checks = extractVerifyChecks(text)
  assert.equal(checks.length, 2)
  assert.equal(checks[0].passed, true)
  assert.equal(checks[1].passed, false)
  assert.equal(checks[1].name, 'Lint')
})

test('extractVerifyChecks returns empty for no checks', () => {
  const checks = extractVerifyChecks('Just some random text with no check blocks')
  assert.equal(checks.length, 0)
})

test('extractVerifyChecks handles check without details', () => {
  const text = `CHECK: Quick check\nSTATUS: PASS`
  const checks = extractVerifyChecks(text)
  assert.equal(checks.length, 1)
  assert.equal(checks[0].passed, true)
  assert.equal(checks[0].details, undefined)
})
