/**
 * Source-shape tests for the roadmap workflow wrapper.
 *
 * Uses readFileSync to assert structural contracts without runtime execution
 * (same pattern as execute-phase.test.ts — no live LLM or SDK calls needed).
 *
 * Covers: D-01 (routing), D-04 (stage accounting), workflow wrapper structure,
 *         D-05 telemetry format.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const moduleSource = readFileSync(
  join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, 'roadmap.ts'),
  'utf-8',
)

// ═══════════════════════════════════════════════════════════════════════════
// 1. Export Shape
// ═══════════════════════════════════════════════════════════════════════════

test('exports runRoadmapWorkflow function', () => {
  assert.match(moduleSource, /export async function runRoadmapWorkflow/)
})

test('exports RoadmapConfig interface', () => {
  assert.match(moduleSource, /export interface RoadmapConfig/)
})

test('exports RoadmapOutput interface', () => {
  assert.match(moduleSource, /export interface RoadmapOutput/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Session Creation Contract (D-01, D-07)
// ═══════════════════════════════════════════════════════════════════════════

test('uses roadmap stage for session creation', () => {
  assert.match(moduleSource, /stage:\s*['"]roadmap['"]/)
})

test('calls createAgentSession', () => {
  assert.match(moduleSource, /createAgentSession/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Accounting Tier Contract (D-04)
// ═══════════════════════════════════════════════════════════════════════════

test('declares low accounting tier', () => {
  assert.match(moduleSource, /ROADMAP_ACCOUNTING_TIER\s*=\s*['"]low['"]/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Telemetry Contract (D-05)
// ═══════════════════════════════════════════════════════════════════════════

test('emits D-05 telemetry with stage=roadmap', () => {
  assert.match(moduleSource, /stage=roadmap/)
})
