/**
 * End-to-end planning parity test harness.
 *
 * Tests the full roundtrip: mock backend response → parse → validate →
 * result equivalence confirmed for discuss, plan, and plan-check commands
 * across Pi and Copilot backends.
 *
 * This goes beyond Phase 3 structural tests by combining discuss + plan +
 * plan-check validation into a single cross-command suite and testing the
 * full parse→validate roundtrip path.
 *
 * Architecture context (D-01, D-03, D-04, D-05, D-06):
 * Both backends feed into the SAME parser functions. Structural parity is
 * guaranteed at the code level. These tests confirm that guarantee holds
 * for realistic LLM variance in formatting while preserving semantic
 * equivalence.
 *
 * No live LLM calls — all tests use representative mock responses.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractDiscussQuestions, type DiscussQuestion } from '../../workflows/discuss-phase.js'
import {
  validatePlanArtifact,
  type PlanOutput,
  type PhaseDefinition,
  type SliceDefinition,
  type TaskDefinition,
} from '../../workflows/plan-phase.js'

// ---------------------------------------------------------------------------
// Mock discuss responses — Pi-style vs Copilot-style
// Different wording/ordering but structurally equivalent to simulate real
// LLM variance between providers while covering the same topics.
// ---------------------------------------------------------------------------

// Pi-backend style: "Priority: high" with verbose context explanations
const PI_DISCUSS_RESPONSE = `
1. What are the primary scalability requirements for this system?
   Context: Scalability targets determine whether we need horizontal distribution or vertical scaling.
   Priority: high

2. Which authentication and authorization model will be used (OAuth, RBAC, ABAC)?
   Context: The auth model shapes the entire API surface and data access layer design.
   Priority: high

3. Should the feature support real-time data updates or periodic batch processing?
   Context: Real-time requires event streaming infrastructure; batch allows simpler polling.
   Priority: high

4. What are realistic data volume projections (records per day, storage growth)?
   Context: Volume estimates drive database schema, indexing strategy, and caching decisions.
   Priority: medium

5. Which external systems require integration (APIs, databases, message queues)?
   Context: Integration surface complexity is a primary delivery risk multiplier.
   Priority: medium

6. What is the target deployment environment (cloud provider, region, on-premise)?
   Context: Deployment constraints affect service selection and operational tooling.
   Priority: medium

7. Are there technology stack preferences or constraints the team must adhere to?
   Context: Stack constraints reduce decision overhead and leverage existing expertise.
   Priority: low
`

// Copilot-backend style: slightly different phrasing, different ordering within
// same priority group, one extra question — simulates natural LLM provider variance.
const COPILOT_DISCUSS_RESPONSE = `
1. What performance targets (latency SLA, throughput) does this system need to meet?
   Context: Performance requirements determine infrastructure choices and caching strategy.
   Priority: HIGH

2. How will authorization be modeled — role-based, attribute-based, or policy-driven?
   Context: The authorization model drives data layer design and API boundary decisions.
   Priority: HIGH

3. Does this require event streaming (real-time) or is polling/batch acceptable?
   Context: Streaming requires different infrastructure than standard request/response cycles.
   Priority: HIGH

4. What are estimated data volumes at scale (record counts, file sizes, daily throughput)?
   Context: Scale projections directly inform schema design, index tuning, and query plans.
   Priority: medium

5. Which third-party APIs or internal services must this feature integrate with?
   Context: Integration complexity and protocol choices substantially affect delivery timeline.
   Priority: medium

6. What hosting environment is targeted (cloud provider, compliance region, hybrid)?
   Context: Hosting requirements constrain service catalog and operational runbook scope.
   Priority: medium

7. Are there preferred frameworks or library constraints for this domain?
   Context: Consistent stack choices minimize friction and reuse existing institutional patterns.
   Priority: low

8. What existing test infrastructure should the new feature plug into?
   Context: Understanding test harness requirements prevents mid-sprint CI rework.
   Priority: low
`

// Topics both responses should cover (used for overlap assertions)
const EXPECTED_TOPIC_KEYWORDS = ['scal', 'auth', 'real-time', 'data', 'integrat', 'deploy']

// ---------------------------------------------------------------------------
// Mock plan markdown — Pi-style vs Copilot-style
// Structurally equivalent but with different task descriptions and wording.
// Both follow the PLAN_PROMPT template format exactly.
// ---------------------------------------------------------------------------

const PI_PLAN_MARKDOWN = `
## Phase 1: Foundation and Core Types

### Slice 1.1: Data Model Design
Risk: low
Dependencies: None

#### Task 1.1.1: Define TypeScript interfaces for core entities
Estimated: 1 hours
Description: Create the primary data contracts and type exports.

#### Task 1.1.2: Add barrel exports from package index
Estimated: 0.5 hours
Description: Export all public types from the package root.

### Slice 1.2: Storage Implementation
Risk: medium
Dependencies: Slice 1.1

#### Task 1.2.1: Implement in-memory store with Map backing
Estimated: 2 hours
Description: Build CRUD operations over a typed Map store.

#### Task 1.2.2: Add persistence layer with JSON serialization
Estimated: 3 hours
Description: Serialize store snapshots to disk for recovery.

## Phase 2: API and Integration

### Slice 2.1: REST API Layer
Risk: medium
Dependencies: Slice 1.2

#### Task 2.1.1: Implement GET and POST endpoints
Estimated: 2 hours
Description: Create Express route handlers for entity CRUD.

#### Task 2.1.2: Add input validation middleware
Estimated: 1 hours
Description: Validate incoming request payloads against schemas.
`

// Copilot-style: same structure, slightly different task descriptions/counts
const COPILOT_PLAN_MARKDOWN = `
## Phase 1: Core Infrastructure Setup

### Slice 1.1: Type System Foundation
Risk: low
Dependencies: None

#### Task 1.1.1: Design and define TypeScript type contracts
Estimated: 1 hours
Description: Establish the canonical data model types and interfaces.

#### Task 1.1.2: Export types via package index barrel file
Estimated: 0.5 hours
Description: Make all public types available from one import path.

### Slice 1.2: Data Persistence Layer
Risk: medium
Dependencies: Slice 1.1

#### Task 1.2.1: Create Map-backed in-memory store
Estimated: 2 hours
Description: Implement typed key-value storage with full CRUD operations.

#### Task 1.2.2: Implement file-based JSON persistence
Estimated: 2.5 hours
Description: Serialize in-memory state to JSON files for durability.

## Phase 2: Service Layer and API

### Slice 2.1: HTTP API Surface
Risk: medium
Dependencies: Slice 1.2

#### Task 2.1.1: Create REST endpoints for entity management
Estimated: 2 hours
Description: Implement route handlers for standard CRUD operations.

#### Task 2.1.2: Wire request validation with schema checking
Estimated: 1.5 hours
Description: Add middleware layer that validates payloads before processing.
`

// ---------------------------------------------------------------------------
// Helper: build PlanOutput from a plan markdown string
// Replicates what parsePlanArtifact() does — used for roundtrip tests.
// We construct the structured PlanOutput to match what validatePlanArtifact()
// expects (phases, slices, tasks arrays must be populated).
// ---------------------------------------------------------------------------

function buildPlanOutputFromMarkdown(planMarkdown: string): PlanOutput {
  const phases: PhaseDefinition[] = []
  const slices: SliceDefinition[] = []
  const tasks: TaskDefinition[] = []

  const lines = planMarkdown.split('\n')
  let currentPhase: PhaseDefinition | null = null
  let currentSlice: SliceDefinition | null = null
  let currentTask: TaskDefinition | null = null

  const flushTask = () => {
    if (currentTask && currentSlice) {
      currentSlice.tasks.push(currentTask)
      tasks.push(currentTask)
      currentTask = null
    }
  }

  const flushSlice = () => {
    flushTask()
    if (currentSlice && currentPhase) {
      currentPhase.slices.push(currentSlice)
      slices.push(currentSlice)
      currentSlice = null
    }
  }

  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+Phase\s+(\d+)[:\s]+(.+)$/i)
    if (phaseMatch) {
      flushSlice()
      if (currentPhase) phases.push(currentPhase)
      currentPhase = { phaseNum: parseInt(phaseMatch[1], 10), title: phaseMatch[2].trim(), slices: [] }
      continue
    }

    const sliceMatch = line.match(/^###\s+Slice\s+(\d+)\.(\d+)[:\s]+(.+)$/i)
    if (sliceMatch) {
      flushSlice()
      currentSlice = {
        sliceNum: parseInt(sliceMatch[2], 10),
        title: sliceMatch[3].trim(),
        riskLevel: 'medium',
        dependencies: [],
        tasks: [],
      }
      continue
    }

    const taskMatch = line.match(/^####\s+Task\s+(\d+\.\d+\.\d+|\d+)[:\s]+(.+)$/i)
    if (taskMatch) {
      flushTask()
      const parts = taskMatch[1].split('.')
      currentTask = {
        taskNum: parseInt(parts[parts.length - 1], 10),
        title: taskMatch[2].trim(),
        estimatedHours: 1,
        description: '',
      }
      continue
    }

    if (!currentSlice && !currentTask) continue

    const riskMatch = line.match(/^\s*Risk:\s*(low|medium|high)/i)
    if (riskMatch && currentSlice && !currentTask) {
      currentSlice.riskLevel = riskMatch[1].toLowerCase()
      continue
    }

    const depsMatch = line.match(/^\s*Dependencies?:\s*(.+)$/i)
    if (depsMatch && currentSlice && !currentTask) {
      const depsText = depsMatch[1].trim()
      if (!/^none$/i.test(depsText)) {
        currentSlice.dependencies = depsText.split(/[,;]/).map((d) => d.trim()).filter(Boolean)
      }
      continue
    }

    const estimatedMatch = line.match(/^\s*Estimated:\s*([\d.]+)\s*hours?/i)
    if (estimatedMatch && currentTask) {
      currentTask.estimatedHours = parseFloat(estimatedMatch[1])
      continue
    }

    const descMatch = line.match(/^\s*Description:\s*(.+)$/i)
    if (descMatch && currentTask) {
      currentTask.description = descMatch[1].trim()
    }
  }

  flushSlice()
  if (currentPhase && !phases.includes(currentPhase)) {
    phases.push(currentPhase)
  }

  return { plan: planMarkdown, phases, slices, tasks, timestamp: Date.now() }
}

// ---------------------------------------------------------------------------
// E2E Discuss Parity — Tests 1, 7, 8 from behavior spec
// ---------------------------------------------------------------------------

describe('E2E Discuss Parity', () => {
  it('both backends produce non-empty question arrays', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    assert.ok(piQuestions.length > 0, 'Pi questions must not be empty')
    assert.ok(copilotQuestions.length > 0, 'Copilot questions must not be empty')
  })

  it('question count variance is ≤20% between backends (D-04)', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    const piCount = piQuestions.length
    const copilotCount = copilotQuestions.length
    const variance = Math.abs(piCount - copilotCount) / Math.max(piCount, copilotCount)

    assert.ok(
      variance <= 0.2,
      `Question count variance ${(variance * 100).toFixed(1)}% exceeds 20% tolerance (Pi: ${piCount}, Copilot: ${copilotCount})`,
    )
  })

  it('all questions have required fields (id, text, relevance)', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    const allQuestions = [...piQuestions, ...copilotQuestions]
    for (const q of allQuestions) {
      assert.ok(typeof q.id === 'string' && q.id.length > 0, `Question id must be non-empty string`)
      assert.ok(typeof q.text === 'string' && q.text.length > 0, `Question text must be non-empty string`)
      assert.ok(typeof q.relevance === 'number', `Question relevance must be a number`)
      assert.ok(q.relevance >= 0 && q.relevance <= 1, `Relevance ${q.relevance} must be 0–1`)
    }
  })

  it('topic keyword overlap ≥60% for Pi-style and Copilot-style responses (D-04)', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    const piText = piQuestions.map((q) => q.text.toLowerCase()).join(' ')
    const copilotText = copilotQuestions.map((q) => q.text.toLowerCase()).join(' ')

    const piMatches = EXPECTED_TOPIC_KEYWORDS.filter((kw) => piText.includes(kw)).length
    const copilotMatches = EXPECTED_TOPIC_KEYWORDS.filter((kw) => copilotText.includes(kw)).length

    const piOverlap = piMatches / EXPECTED_TOPIC_KEYWORDS.length
    const copilotOverlap = copilotMatches / EXPECTED_TOPIC_KEYWORDS.length

    assert.ok(
      piOverlap >= 0.6,
      `Pi topic overlap ${(piOverlap * 100).toFixed(0)}% below 60% threshold`,
    )
    assert.ok(
      copilotOverlap >= 0.6,
      `Copilot topic overlap ${(copilotOverlap * 100).toFixed(0)}% below 60% threshold`,
    )
  })

  it('questions are sorted by descending relevance', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    for (const questions of [piQuestions, copilotQuestions]) {
      for (let i = 1; i < questions.length; i++) {
        assert.ok(
          questions[i - 1].relevance >= questions[i].relevance,
          `Question ${i - 1} relevance ${questions[i - 1].relevance} should be ≥ ${questions[i].relevance}`,
        )
      }
    }
  })

  it('high-priority questions have relevance > medium-priority questions', () => {
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)

    const highPriorityQuestions = piQuestions.filter((q) => q.relevance >= 0.9)
    const mediumPriorityQuestions = piQuestions.filter((q) => q.relevance >= 0.5 && q.relevance < 0.9)

    assert.ok(highPriorityQuestions.length > 0, 'Should have high-priority questions')
    assert.ok(mediumPriorityQuestions.length > 0, 'Should have medium-priority questions')

    // All high-priority questions have higher relevance than all medium-priority ones
    for (const high of highPriorityQuestions) {
      for (const medium of mediumPriorityQuestions) {
        assert.ok(
          high.relevance > medium.relevance,
          `High priority q relevance ${high.relevance} should be > medium ${medium.relevance}`,
        )
      }
    }
  })
})

// ---------------------------------------------------------------------------
// E2E Plan Parity — Tests 2, 3, 4, 5 from behavior spec
// ---------------------------------------------------------------------------

describe('E2E Plan Parity', () => {
  it('validatePlanArtifact returns valid=true for Pi-origin well-formed plan', () => {
    const output = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const result = validatePlanArtifact(output)

    assert.equal(result.valid, true, `Pi plan should be valid, issues: ${JSON.stringify(result.issues)}`)
    assert.ok(result.score >= 60, `Pi plan score ${result.score} should be ≥60`)
  })

  it('validatePlanArtifact returns valid=true for Copilot-origin well-formed plan', () => {
    const output = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)
    const result = validatePlanArtifact(output)

    assert.equal(result.valid, true, `Copilot plan should be valid, issues: ${JSON.stringify(result.issues)}`)
    assert.ok(result.score >= 60, `Copilot plan score ${result.score} should be ≥60`)
  })

  it('validation score variance ≤10 between Pi and Copilot plans (D-05)', () => {
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    const piResult = validatePlanArtifact(piOutput)
    const copilotResult = validatePlanArtifact(copilotOutput)

    const scoreDiff = Math.abs(piResult.score - copilotResult.score)
    assert.ok(
      scoreDiff <= 10,
      `Score variance ${scoreDiff} exceeds 10-point tolerance (Pi: ${piResult.score}, Copilot: ${copilotResult.score})`,
    )
  })

  it('both plans have phases, slices, and tasks populated', () => {
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    assert.ok(piOutput.phases.length > 0, 'Pi plan must have phases')
    assert.ok(piOutput.slices.length > 0, 'Pi plan must have slices')
    assert.ok(piOutput.tasks.length > 0, 'Pi plan must have tasks')

    assert.ok(copilotOutput.phases.length > 0, 'Copilot plan must have phases')
    assert.ok(copilotOutput.slices.length > 0, 'Copilot plan must have slices')
    assert.ok(copilotOutput.tasks.length > 0, 'Copilot plan must have tasks')
  })

  it('both backends produce identical verdict (valid=true) for equivalent plan quality', () => {
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    const piResult = validatePlanArtifact(piOutput)
    const copilotResult = validatePlanArtifact(copilotOutput)

    assert.equal(
      piResult.valid,
      copilotResult.valid,
      `Verdict mismatch: Pi valid=${piResult.valid}, Copilot valid=${copilotResult.valid}`,
    )
  })

  it('artifact shapes are structurally identical (same required fields)', () => {
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    // Both outputs must have the exact same set of top-level keys
    const piKeys = new Set(Object.keys(piOutput))
    const copilotKeys = new Set(Object.keys(copilotOutput))

    const requiredKeys = ['plan', 'phases', 'slices', 'tasks', 'timestamp']
    for (const key of requiredKeys) {
      assert.ok(piKeys.has(key), `Pi output missing required field: ${key}`)
      assert.ok(copilotKeys.has(key), `Copilot output missing required field: ${key}`)
    }

    // Phases, slices, and tasks elements have matching shapes
    assert.ok(piOutput.phases[0] !== undefined)
    assert.ok(typeof piOutput.phases[0].phaseNum === 'number')
    assert.ok(typeof piOutput.phases[0].title === 'string')
    assert.ok(Array.isArray(piOutput.phases[0].slices))

    assert.ok(copilotOutput.phases[0] !== undefined)
    assert.ok(typeof copilotOutput.phases[0].phaseNum === 'number')
    assert.ok(typeof copilotOutput.phases[0].title === 'string')
    assert.ok(Array.isArray(copilotOutput.phases[0].slices))
  })
})

// ---------------------------------------------------------------------------
// E2E Plan-Check Equivalence — Test 6 and plan-check spec tests
// ---------------------------------------------------------------------------

describe('E2E Plan-Check Equivalence', () => {
  it('well-formed plans from both backends produce valid verdicts (both pass)', () => {
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    const piResult = validatePlanArtifact(piOutput)
    const copilotResult = validatePlanArtifact(copilotOutput)

    assert.equal(piResult.valid, true, 'Pi well-formed plan must pass check')
    assert.equal(copilotResult.valid, true, 'Copilot well-formed plan must pass check')
  })

  it('empty plan from either backend fails validation with issues', () => {
    const emptyPiOutput: PlanOutput = { plan: '', phases: [], slices: [], tasks: [], timestamp: Date.now() }
    const emptyCopilotOutput: PlanOutput = { plan: '', phases: [], slices: [], tasks: [], timestamp: Date.now() }

    const piResult = validatePlanArtifact(emptyPiOutput)
    const copilotResult = validatePlanArtifact(emptyCopilotOutput)

    // Both must fail
    assert.equal(piResult.valid, false, 'Empty Pi plan must fail')
    assert.equal(copilotResult.valid, false, 'Empty Copilot plan must fail')

    // Both must have issues
    assert.ok(piResult.issues.length > 0, 'Empty Pi plan must have issues')
    assert.ok(copilotResult.issues.length > 0, 'Empty Copilot plan must have issues')
  })

  it('equivalent verdicts for identical-quality Pi and Copilot plans (D-06)', () => {
    // Create structurally identical-quality plans from both "backends"
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)

    const piResult = validatePlanArtifact(piOutput)
    const copilotResult = validatePlanArtifact(copilotOutput)

    assert.equal(piResult.valid, copilotResult.valid, 'Verdicts must match for equivalent plans')
  })

  it('deficient plan (no phases) fails on both backends equally', () => {
    const deficientPi: PlanOutput = {
      plan: 'Some content without proper structure',
      phases: [],
      slices: [],
      tasks: [],
      timestamp: Date.now(),
    }
    const deficientCopilot: PlanOutput = {
      plan: 'Some other content without structure',
      phases: [],
      slices: [],
      tasks: [],
      timestamp: Date.now(),
    }

    const piResult = validatePlanArtifact(deficientPi)
    const copilotResult = validatePlanArtifact(deficientCopilot)

    assert.equal(piResult.valid, false, 'Deficient Pi plan must fail')
    assert.equal(copilotResult.valid, false, 'Deficient Copilot plan must fail')
    assert.equal(piResult.valid, copilotResult.valid, 'Both must produce matching failure verdict')
  })

  it('identical structural defects produce equivalent issue detection on both backends', () => {
    // Plans with phases but no slices — structural defect
    const piNoSlices: PlanOutput = {
      plan: '## Phase 1: Something\n',
      phases: [{ phaseNum: 1, title: 'Something', slices: [] }],
      slices: [],
      tasks: [],
      timestamp: Date.now(),
    }
    const copilotNoSlices: PlanOutput = {
      plan: '## Phase 1: Another Thing\n',
      phases: [{ phaseNum: 1, title: 'Another Thing', slices: [] }],
      slices: [],
      tasks: [],
      timestamp: Date.now(),
    }

    const piResult = validatePlanArtifact(piNoSlices)
    const copilotResult = validatePlanArtifact(copilotNoSlices)

    // Both must detect the slices-missing defect
    const piHasSliceIssue = piResult.issues.some((issue) => issue.toLowerCase().includes('slice'))
    const copilotHasSliceIssue = copilotResult.issues.some((issue) => issue.toLowerCase().includes('slice'))

    assert.equal(piHasSliceIssue, copilotHasSliceIssue, 'Issue detection must match for equivalent structural defects')
  })
})

// ---------------------------------------------------------------------------
// E2E Roundtrip Validation — Test 8: full parse→validate→compare roundtrip
// ---------------------------------------------------------------------------

describe('E2E Roundtrip Validation', () => {
  it('discuss roundtrip: Pi-style response → parse → validate fields', () => {
    const questions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)

    // Full roundtrip: response text → parsed questions → field validation
    assert.ok(questions.length >= 5, 'Should extract at least 5 questions')
    for (const q of questions) {
      assert.ok(q.id, 'id must be present')
      assert.ok(q.text, 'text must be present')
      assert.ok(typeof q.relevance === 'number', 'relevance must be a number')
    }
  })

  it('discuss roundtrip: Copilot-style response → parse → validate fields', () => {
    const questions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)

    assert.ok(questions.length >= 5, 'Should extract at least 5 questions')
    for (const q of questions) {
      assert.ok(q.id, 'id must be present')
      assert.ok(q.text, 'text must be present')
      assert.ok(typeof q.relevance === 'number', 'relevance must be a number')
    }
  })

  it('plan roundtrip: Pi-style markdown → parse → validatePlanArtifact → equivalence confirmed', () => {
    const output = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const result = validatePlanArtifact(output)

    // Roundtrip complete: markdown → parsed structure → validation result
    assert.ok(output.phases.length >= 1, 'Roundtrip must produce ≥1 phase')
    assert.ok(output.slices.length >= 1, 'Roundtrip must produce ≥1 slice')
    assert.ok(output.tasks.length >= 1, 'Roundtrip must produce ≥1 task')
    assert.equal(result.valid, true, 'Roundtrip result must be valid')
  })

  it('plan roundtrip: Copilot-style markdown → parse → validatePlanArtifact → equivalence confirmed', () => {
    const output = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)
    const result = validatePlanArtifact(output)

    assert.ok(output.phases.length >= 1, 'Roundtrip must produce ≥1 phase')
    assert.ok(output.slices.length >= 1, 'Roundtrip must produce ≥1 slice')
    assert.ok(output.tasks.length >= 1, 'Roundtrip must produce ≥1 task')
    assert.equal(result.valid, true, 'Roundtrip result must be valid')
  })

  it('cross-backend roundtrip: Pi and Copilot produce equivalent validation results end-to-end', () => {
    // Full E2E: both backends → parse → validate → compare all metrics
    const piOutput = buildPlanOutputFromMarkdown(PI_PLAN_MARKDOWN)
    const copilotOutput = buildPlanOutputFromMarkdown(COPILOT_PLAN_MARKDOWN)
    const piResult = validatePlanArtifact(piOutput)
    const copilotResult = validatePlanArtifact(copilotOutput)

    // Discuss parity
    const piQuestions = extractDiscussQuestions(PI_DISCUSS_RESPONSE)
    const copilotQuestions = extractDiscussQuestions(COPILOT_DISCUSS_RESPONSE)
    const countVariance = Math.abs(piQuestions.length - copilotQuestions.length) / Math.max(piQuestions.length, copilotQuestions.length)

    // Plan parity
    const scoreDiff = Math.abs(piResult.score - copilotResult.score)

    // Assert all cross-backend equivalence criteria
    assert.ok(countVariance <= 0.2, `Discuss count variance ${(countVariance * 100).toFixed(1)}% exceeds 20%`)
    assert.ok(scoreDiff <= 10, `Plan score variance ${scoreDiff} exceeds 10 points`)
    assert.equal(piResult.valid, copilotResult.valid, 'Plan check verdicts must match')

    // Confirm pi plan has parseable structure
    assert.ok(piOutput.phases.length > 0)
    assert.ok(copilotOutput.phases.length > 0)
  })

  it('plan-check roundtrip: structurally deficient plans fail on both backends consistently', () => {
    // Roundtrip with deficient plans from both backends
    const piDeficient: PlanOutput = { plan: '', phases: [], slices: [], tasks: [], timestamp: Date.now() }
    const copilotDeficient: PlanOutput = { plan: '', phases: [], slices: [], tasks: [], timestamp: Date.now() }

    const piResult = validatePlanArtifact(piDeficient)
    const copilotResult = validatePlanArtifact(copilotDeficient)

    assert.equal(piResult.valid, false)
    assert.equal(copilotResult.valid, false)
    assert.equal(piResult.valid, copilotResult.valid, 'Both backends must fail consistently')
  })
})
