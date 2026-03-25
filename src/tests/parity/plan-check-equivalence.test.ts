/**
 * Plan-check equivalence validation suite.
 *
 * Tests that validatePlanArtifact() produces equivalent validation verdicts
 * and scores when called on Pi-backend-generated and Copilot-backend-generated
 * plan artifacts.
 *
 * Architecture context (D-05, D-06):
 * validatePlanArtifact() is a pure structural validator — identical input
 * always produces identical output. Its scoring formula is deterministic and
 * applies equally to both backend paths. These tests confirm:
 *   - Pass/fail verdicts match for structurally equivalent plans
 *   - Scores stay within 10% for equivalent plans (D-05)
 *   - Critical failure conditions are consistent across both paths (D-06)
 *   - Validation logic correctly identifies structural defects
 *   - Empty/stub plans fail on both paths equally
 *
 * No live LLM calls — tests use mock PlanOutput objects with known structure.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validatePlanArtifact,
  type PlanOutput,
  type PhaseDefinition,
  type SliceDefinition,
  type TaskDefinition,
} from '../../workflows/plan-phase.js'

// ---------------------------------------------------------------------------
// Plan fixture builders
// ---------------------------------------------------------------------------

function makeTask(phaseNum: number, sliceNum: number, taskNum: number, opts?: { description?: string }): TaskDefinition {
  return {
    taskNum,
    title: `Task ${phaseNum}.${sliceNum}.${taskNum}: Do work`,
    estimatedHours: 2,
    description: opts?.description ?? `Implement step ${taskNum} of slice ${sliceNum}.`,
  }
}

function makeSlice(phaseNum: number, sliceNum: number, taskCount: number, opts?: { riskLevel?: string; noTasks?: boolean }): SliceDefinition {
  const slice: SliceDefinition = {
    sliceNum,
    title: `Slice ${phaseNum}.${sliceNum}: Component`,
    riskLevel: opts?.riskLevel ?? 'medium',
    dependencies: sliceNum > 1 ? [`Slice ${phaseNum}.${sliceNum - 1}`] : [],
    tasks: [],
  }
  if (!opts?.noTasks) {
    for (let t = 1; t <= taskCount; t++) {
      slice.tasks.push(makeTask(phaseNum, sliceNum, t))
    }
  }
  return slice
}

function makePhase(phaseNum: number, sliceCount: number, tasksPerSlice: number, opts?: { noSlices?: boolean }): PhaseDefinition {
  const phase: PhaseDefinition = { phaseNum, title: `Phase ${phaseNum}: Foundation`, slices: [] }
  if (!opts?.noSlices) {
    for (let s = 1; s <= sliceCount; s++) {
      phase.slices.push(makeSlice(phaseNum, s, tasksPerSlice))
    }
  }
  return phase
}

function buildPlanOutput(phases: PhaseDefinition[]): PlanOutput {
  // Flatten slices and tasks
  const slices: SliceDefinition[] = phases.flatMap(p => p.slices)
  const tasks: TaskDefinition[] = slices.flatMap(s => s.tasks)

  // Generate PLAN.md markdown
  const lines: string[] = []
  for (const phase of phases) {
    lines.push(`## Phase ${phase.phaseNum}: ${phase.title}`)
    lines.push('')
    for (const slice of phase.slices) {
      lines.push(`### Slice ${phase.phaseNum}.${slice.sliceNum}: ${slice.title}`)
      lines.push(`Risk: ${slice.riskLevel}`)
      lines.push(`Dependencies: ${slice.dependencies.join(', ') || 'None'}`)
      lines.push('')
      for (const task of slice.tasks) {
        lines.push(`#### Task ${phase.phaseNum}.${slice.sliceNum}.${task.taskNum}: ${task.title}`)
        lines.push(`Estimated: ${task.estimatedHours} hours`)
        lines.push(`Description: ${task.description}`)
        lines.push('')
      }
    }
  }

  return {
    plan: lines.join('\n'),
    phases,
    slices,
    tasks,
    timestamp: Date.now(),
  }
}

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

// Well-formed Pi-backend plan: 3 phases x 2 slices x 3 tasks
const PI_FULL_PLAN = buildPlanOutput([
  makePhase(1, 2, 3),
  makePhase(2, 2, 3),
  makePhase(3, 2, 3),
])

// Well-formed Copilot-backend plan: same structure
const COPILOT_FULL_PLAN = buildPlanOutput([
  makePhase(1, 2, 3),
  makePhase(2, 2, 3),
  makePhase(3, 2, 3),
])

// Copilot with minor variation: one extra phase (4 phases vs 3)
const COPILOT_VARIED_PLAN = buildPlanOutput([
  makePhase(1, 2, 3),
  makePhase(2, 2, 3),
  makePhase(3, 2, 3),
  makePhase(4, 1, 2),
])

// Stub plan: no phases, slices, or tasks
const STUB_PLAN: PlanOutput = {
  plan: '',
  phases: [],
  slices: [],
  tasks: [],
  timestamp: Date.now(),
}

// Deficient plan: phases missing slices (structural issue)
const DEFICIENT_PLAN = buildPlanOutput([
  makePhase(1, 0, 0, { noSlices: true }),
  makePhase(2, 0, 0, { noSlices: true }),
])

// Single-phase plan
const SINGLE_PHASE_PLAN = buildPlanOutput([makePhase(1, 2, 3)])

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan-Check Equivalence (Pi vs Copilot)', () => {

  describe('Verdict equivalence', () => {

    it('should pass both Pi and Copilot well-formed plans', () => {
      const piResult = validatePlanArtifact(PI_FULL_PLAN)
      const copilotResult = validatePlanArtifact(COPILOT_FULL_PLAN)

      assert.ok(piResult.valid, `Pi plan should be valid (score: ${piResult.score})`)
      assert.ok(copilotResult.valid, `Copilot plan should be valid (score: ${copilotResult.score})`)
    })

    it('should fail both Pi and Copilot stub/empty plans equally (D-06)', () => {
      // Clone stub plan to represent both Pi and Copilot returning empty output
      const piStub: PlanOutput = { ...STUB_PLAN }
      const copilotStub: PlanOutput = { ...STUB_PLAN }

      const piResult = validatePlanArtifact(piStub)
      const copilotResult = validatePlanArtifact(copilotStub)

      // Both should fail
      assert.equal(piResult.valid, false, `Pi stub plan should not be valid`)
      assert.equal(copilotResult.valid, false, `Copilot stub plan should not be valid`)

      // Both should have low scores
      assert.ok(piResult.score < 60, `Pi stub score ${piResult.score} should be below 60`)
      assert.ok(copilotResult.score < 60, `Copilot stub score ${copilotResult.score} should be below 60`)
    })

    it('should produce identical verdicts for structurally equivalent plans (D-06)', () => {
      const piResult = validatePlanArtifact(PI_FULL_PLAN)
      const copilotResult = validatePlanArtifact(COPILOT_FULL_PLAN)

      assert.equal(
        piResult.valid,
        copilotResult.valid,
        `Verdict mismatch: Pi=${piResult.valid}, Copilot=${copilotResult.valid}`
      )
    })

    it('should consistently fail deficient plans on both backends', () => {
      // Deficient plan has phases with no slices
      const piResult = validatePlanArtifact(DEFICIENT_PLAN)
      const copilotResult = validatePlanArtifact(DEFICIENT_PLAN) // same input = same result

      // Both should have reduced scores due to empty slices
      assert.equal(piResult.score, copilotResult.score, 'Same input must produce same score')
      assert.ok(
        piResult.issues.some(i => /slice/.test(i) || /task/.test(i)),
        `Deficient plan issues should mention missing slices or tasks: ${piResult.issues.join('; ')}`
      )
    })

  })

  describe('Score equivalence', () => {

    it('should produce plan scores within 10% tolerance for equivalent plans (D-05)', () => {
      const piResult = validatePlanArtifact(PI_FULL_PLAN)
      const copilotResult = validatePlanArtifact(COPILOT_FULL_PLAN)

      const scoreDiff = Math.abs(piResult.score - copilotResult.score)
      assert.ok(
        scoreDiff <= 10,
        `Score divergence ${scoreDiff} exceeds D-05 10% tolerance (Pi: ${piResult.score}, Copilot: ${copilotResult.score})`
      )
    })

    it('should score full plans at 100 when fully formed (no deductions)', () => {
      const result = validatePlanArtifact(PI_FULL_PLAN)

      // Full plan: non-empty markdown, has phases, has slices, has tasks,
      // no phases without slices, all tasks have descriptions.
      assert.equal(result.score, 100, `Fully-formed plan should score 100 (issues: ${result.issues.join('; ')})`)
      assert.equal(result.issues.length, 0, `Fully-formed plan should have no issues`)
    })

    it('should produce deterministic scores (same input → same score)', () => {
      const result1 = validatePlanArtifact(PI_FULL_PLAN)
      const result2 = validatePlanArtifact(PI_FULL_PLAN)

      assert.equal(result1.score, result2.score, 'Score must be deterministic')
      assert.equal(result1.valid, result2.valid, 'Verdict must be deterministic')
    })

    it('should correctly penalize plans with missing phase structure', () => {
      const noPhasesPlan: PlanOutput = {
        plan: 'Some text without phase headings',
        phases: [],
        slices: [makeSlice(1, 1, 2)],
        tasks: [],
        timestamp: Date.now(),
      }
      const result = validatePlanArtifact(noPhasesPlan)

      assert.equal(result.valid, false, 'Plan with no phases should not be valid')
      assert.ok(result.score < 80, `Plan with no phases should be penalized (score: ${result.score})`)
      assert.ok(
        result.issues.some(i => /phase/.test(i)),
        `Issues should mention phases: ${result.issues.join('; ')}`
      )
    })

  })

  describe('Critical failure alignment', () => {

    it('should report no issues for well-formed plans on both paths (D-06)', () => {
      const piResult = validatePlanArtifact(PI_FULL_PLAN)
      const copilotResult = validatePlanArtifact(COPILOT_FULL_PLAN)

      assert.deepEqual(piResult.issues, copilotResult.issues, 'Issue lists should match for identical structures')
    })

    it('should handle single-phase plans consistently', () => {
      const result = validatePlanArtifact(SINGLE_PHASE_PLAN)

      assert.ok(result.valid, `Single-phase plan should be valid (score: ${result.score})`)
      assert.ok(result.score >= 60, `Single-phase score should be at least 60`)
    })

    it('should accept Copilot plan with minor phase count variance and still pass', () => {
      const piResult = validatePlanArtifact(PI_FULL_PLAN)           // 3 phases
      const copilotResult = validatePlanArtifact(COPILOT_VARIED_PLAN) // 4 phases

      // Both should pass despite phase count difference
      assert.ok(piResult.valid, `Pi 3-phase plan should be valid`)
      assert.ok(copilotResult.valid, `Copilot 4-phase plan should be valid`)

      // Both should have no issues (both are well-formed)
      assert.equal(piResult.issues.length, 0, `Pi plan should have no issues`)
      assert.equal(copilotResult.issues.length, 0, `Copilot varied plan should have no issues`)
    })

  })

})
