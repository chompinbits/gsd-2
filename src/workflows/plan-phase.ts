/**
 * Plan-phase workflow — backend-agnostic session wrapper.
 *
 * Produces a structured PLAN.md artifact by running the plan-phase prompt
 * through either the Pi SDK backend (default) or the GitHub Copilot SDK
 * backend. The plan output format (PlanOutput) and PLAN.md Markdown structure
 * are identical between both paths (D-01, D-03).
 *
 * Accounting: plan-phase → "standard" tier (1×) per Phase 2 stage routing.
 * Source: packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts
 *
 * Used by:
 *  - `gsd plan-phase` CLI subcommand (backend selection via --backend flag)
 *  - Parity tests in plan 03-03
 */

import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from '@gsd/pi-coding-agent'
import { agentDir, authFilePath } from '../app-paths.js'

// ---------------------------------------------------------------------------
// Accounting constant — plan-phase stage maps to "standard" tier (1×).
// Derived from STAGE_TIER_MAP in packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts.
// Kept as a local constant to avoid cross-package internal imports.
// ---------------------------------------------------------------------------
const PLAN_PHASE_ACCOUNTING_TIER = 'standard' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseDefinition {
  phaseNum: number
  title: string
  slices: SliceDefinition[]
}

export interface SliceDefinition {
  sliceNum: number
  title: string
  riskLevel: string
  dependencies: string[]
  tasks: TaskDefinition[]
}

export interface TaskDefinition {
  taskNum: number
  title: string
  estimatedHours: number
  description: string
}

export interface PlanOutput {
  /** Full PLAN.md Markdown content as produced by the backend */
  plan: string
  phases: PhaseDefinition[]
  slices: SliceDefinition[]
  tasks: TaskDefinition[]
  timestamp: number
}

export interface PlanConfig {
  /** Objective or scope description for the plan */
  objective: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional project context injected before the objective prompt */
  projectContext?: string
}

export interface PlanOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. D-09: default is Pi. */
  backend?: 'pi' | 'copilot'
}

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export interface PlanValidationResult {
  valid: boolean
  /** Normalized score 0–100. Higher is better-formed plan. */
  score: number
  issues: string[]
}

// ---------------------------------------------------------------------------
// Prompt template — stable contract (D-01); transport only is migrated
// ---------------------------------------------------------------------------

const PLAN_PROMPT = `You are a planning assistant for a software development project.

Generate a structured implementation plan in Markdown format for the following objective.

OBJECTIVE:
{OBJECTIVE}

{CONTEXT_SECTION}

Requirements for your output:
- Output a Markdown document that can serve as a PLAN.md file.
- Organize the plan into numbered Phases (## Phase N: Title).
- Within each Phase, include numbered Slices (### Slice N.M: Title).
  - For each Slice include a Risk level line: "Risk: low | medium | high"
  - List any Dependencies on earlier slices (or "None").
- Within each Slice, list numbered Tasks (#### Task N.M.P: Title).
  - For each Task include an Estimated Hours line: "Estimated: X hours"
  - For each Task include a one-sentence Description.
- Be specific and actionable — no vague placeholders.
- Use consistent heading levels and formatting throughout.

Example format (follow this structure exactly):

## Phase 1: Foundation

### Slice 1.1: Core Data Types
Risk: low
Dependencies: None

#### Task 1.1.1: Define TypeScript interfaces
Estimated: 1 hours
Description: Create the type contract for the core data models.

#### Task 1.1.2: Add index exports
Estimated: 0.5 hours
Description: Export all types from the package index.

### Slice 1.2: Storage Layer
Risk: medium
Dependencies: Slice 1.1

#### Task 1.2.1: Implement in-memory store
Estimated: 2 hours
Description: Build a Map-backed store with CRUD operations.
`

// ---------------------------------------------------------------------------
// Plan artifact parser — D-01: format and extraction logic are stable across backends
// ---------------------------------------------------------------------------

/**
 * Parse assistant response into structured PhaseDefinition[], SliceDefinition[], TaskDefinition[].
 * Backend-agnostic — processes the same normalized text output from both Pi and Copilot sessions.
 */
function parsePlanArtifact(text: string): {
  phases: PhaseDefinition[]
  slices: SliceDefinition[]
  tasks: TaskDefinition[]
} {
  const phases: PhaseDefinition[] = []
  const slices: SliceDefinition[] = []
  const tasks: TaskDefinition[] = []

  const lines = text.split('\n')
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
    // ## Phase N: Title
    const phaseMatch = line.match(/^##\s+Phase\s+(\d+)[:\s]+(.+)$/i)
    if (phaseMatch) {
      flushSlice()
      currentPhase = {
        phaseNum: parseInt(phaseMatch[1], 10),
        title: phaseMatch[2].trim(),
        slices: [],
      }
      phases.push(currentPhase)
      continue
    }

    // ### Slice N.M: Title
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

    // #### Task N.M.P: Title
    const taskMatch = line.match(/^####\s+Task\s+(\d+\.\d+\.\d+|\d+)[:\s]+(.+)$/i)
    if (taskMatch) {
      flushTask()
      const taskNumStr = taskMatch[1]
      const parts = taskNumStr.split('.')
      const taskNum = parseInt(parts[parts.length - 1], 10)
      currentTask = {
        taskNum,
        title: taskMatch[2].trim(),
        estimatedHours: 1,
        description: '',
      }
      continue
    }

    if (!currentSlice && !currentTask) continue

    // Risk: low | medium | high  (inside a Slice)
    const riskMatch = line.match(/^\s*Risk:\s*(low|medium|high)/i)
    if (riskMatch && currentSlice && !currentTask) {
      currentSlice.riskLevel = riskMatch[1].toLowerCase()
      continue
    }

    // Dependencies: ...  (inside a Slice)
    const depsMatch = line.match(/^\s*Dependencies?:\s*(.+)$/i)
    if (depsMatch && currentSlice && !currentTask) {
      const depsText = depsMatch[1].trim()
      if (!/^none$/i.test(depsText)) {
        currentSlice.dependencies = depsText.split(/[,;]/).map((d) => d.trim()).filter(Boolean)
      }
      continue
    }

    // Estimated: X hours  (inside a Task)
    const estimatedMatch = line.match(/^\s*Estimated:\s*([\d.]+)\s*hours?/i)
    if (estimatedMatch && currentTask) {
      currentTask.estimatedHours = parseFloat(estimatedMatch[1])
      continue
    }

    // Description: ...  (inside a Task)
    const descMatch = line.match(/^\s*Description:\s*(.+)$/i)
    if (descMatch && currentTask) {
      currentTask.description = descMatch[1].trim()
    }
  }

  flushSlice()

  return { phases, slices, tasks }
}

// ---------------------------------------------------------------------------
// Artifact validation — D-05: plan-check scoring contracts are unchanged
// ---------------------------------------------------------------------------

/**
 * Validate a PlanOutput artifact for structural completeness.
 * Returns a score 0–100 and a list of issues.
 * Used for parity comparison between Pi and Copilot backends (D-06).
 */
export function validatePlanArtifact(output: PlanOutput): PlanValidationResult {
  const issues: string[] = []
  let score = 100

  if (!output.plan || output.plan.trim().length === 0) {
    issues.push('plan markdown is empty')
    score -= 40
  }

  if (output.phases.length === 0) {
    issues.push('no phases found in plan')
    score -= 25
  }

  if (output.slices.length === 0) {
    issues.push('no slices found in plan')
    score -= 20
  }

  if (output.tasks.length === 0) {
    issues.push('no tasks found in plan')
    score -= 15
  }

  // Check for phases without slices
  const emptyPhases = output.phases.filter((p) => p.slices.length === 0)
  if (emptyPhases.length > 0) {
    issues.push(`${emptyPhases.length} phase(s) have no slices: ${emptyPhases.map((p) => `Phase ${p.phaseNum}`).join(', ')}`)
    score -= emptyPhases.length * 5
  }

  // Check for tasks without descriptions
  const undescribed = output.tasks.filter((t) => !t.description || t.description.trim().length === 0)
  if (undescribed.length > 0) {
    issues.push(`${undescribed.length} task(s) missing description`)
    score -= Math.min(undescribed.length * 2, 10)
  }

  const finalScore = Math.max(0, score)
  return {
    valid: finalScore >= 60 && output.phases.length > 0,
    score: finalScore,
    issues,
  }
}

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the plan-phase workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Plan parsing is identical for both backends — the parity
 * contract is the normalized text output (D-03). Backend defaults to 'pi' (D-09).
 *
 * Accounting: plan-phase → standard tier (1×). Logged to stderr for D-10 telemetry.
 */
export async function runPlanWorkflow(
  config: PlanConfig,
  options: PlanOptions = {},
): Promise<PlanOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend and accounting tier visible for parity regression diagnosis
  process.stderr.write(`[plan-phase] backend=${backend} tier=${PLAN_PHASE_ACCOUNTING_TIER}\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — plan-phase runs are stateless and ephemeral
  const sessionManager = SessionManager.inMemory()
  const authStorage = AuthStorage.create(authFilePath)
  const modelRegistry = new ModelRegistry(authStorage)
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({ agentDir })
  await resourceLoader.reload()

  // Session creation routes to Pi or Copilot backend based on `backend` param.
  // This is the only backend-specific branch — plan parsing is identical (D-01).
  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    resourceLoader,
    backend,
    cwd,
  })

  // Bind extensions minimally — no UI context needed for programmatic execution
  await session.bindExtensions({
    onError: (err) => process.stderr.write(`[plan-phase] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the plan prompt — context injection before the objective (D-01)
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = PLAN_PROMPT
    .replace('{OBJECTIVE}', config.objective)
    .replace('{CONTEXT_SECTION}', contextSection)

  // Send prompt with template expansion disabled (raw text, not a GSD command)
  await session.prompt(prompt, { expandPromptTemplates: false })

  // Collect response text from the last assistant message.
  // Identical across backends — both produce normalized AgentEvent message_end events (D-03).
  const messages = session.state.messages
  let responseText = ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant') {
      const content = (msg as { role: string; content: Array<{ type: string; text?: string }> }).content
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          responseText = block.text
          break
        }
      }
      break
    }
  }

  // Parse structured data from the plan markdown
  const { phases, slices, tasks } = parsePlanArtifact(responseText)

  // D-10: log extraction counts for observability
  process.stderr.write(
    `[plan-phase] extracted ${phases.length} phases, ${slices.length} slices, ${tasks.length} tasks from ${backend} backend response\n`,
  )

  return {
    plan: responseText,
    phases,
    slices,
    tasks,
    timestamp: Date.now(),
  }
}
