/**
 * Verify-work workflow — backend-agnostic session wrapper.
 *
 * Runs a verification prompt (UAT / acceptance checking) through either the
 * Pi SDK backend (default) or the GitHub Copilot SDK backend. The verification
 * output format is identical between both paths (D-01, D-03).
 *
 * Accounting: verify-work → "free" tier (0×) per Phase 2 stage routing.
 * Tool profile: readOnlyTools (read, bash) per D-08 — no write/edit.
 *
 * Used by:
 *  - `gsd verify-work` CLI subcommand
 *  - Parity tests
 */

import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  readOnlyTools,
  createAgentSession,
} from '@gsd/pi-coding-agent'
import { agentDir, authFilePath } from '../app-paths.js'

// ---------------------------------------------------------------------------
// Accounting constant — verify-work stage maps to "free" tier (0×).
// Derived from STAGE_TIER_MAP in packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts.
// ---------------------------------------------------------------------------
const VERIFY_WORK_ACCOUNTING_TIER = 'free' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifyConfig {
  /** Scope or criteria for verification */
  scope: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional UAT criteria or acceptance tests to check */
  criteria?: string
  /** Optional project context */
  projectContext?: string
}

export interface VerifyOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. */
  backend?: 'pi' | 'copilot'
}

export interface VerifyCheck {
  name: string
  passed: boolean
  details?: string
}

export interface VerifyOutput {
  /** Full response text from the verification session */
  response: string
  /** Whether verification passed based on response analysis */
  passed: boolean
  /** Individual check results extracted from response */
  checks: VerifyCheck[]
  timestamp: number
}

// ---------------------------------------------------------------------------
// Prompt template — stable contract (D-01); transport only is migrated
// ---------------------------------------------------------------------------

const VERIFY_PROMPT = `You are a verification assistant checking software implementation quality.

Verify the following scope against the provided criteria by reading code, running tests, and inspecting outputs.

SCOPE:
{SCOPE}

{CRITERIA_SECTION}

{CONTEXT_SECTION}

Requirements:
- Read the relevant source files and test files.
- Run any available automated tests.
- For each criterion, report PASS or FAIL with a brief explanation.
- Summarize overall verification status at the end.
- Do NOT modify any source files — this is a read-only verification.

Output format:
For each check:
CHECK: [criterion name]
STATUS: PASS | FAIL
DETAILS: [brief explanation]

Final line:
OVERALL: PASS | FAIL
`

// ---------------------------------------------------------------------------
// Check parser — D-01: format and extraction logic are stable across backends
// ---------------------------------------------------------------------------

/**
 * Parse CHECK/STATUS/DETAILS blocks from verify-work response text.
 * Backend-agnostic — processes the same normalized text output from both Pi and Copilot sessions.
 */
export function extractVerifyChecks(text: string): VerifyCheck[] {
  const checks: VerifyCheck[] = []
  const lines = text.split('\n')
  let current: { name: string; passed?: boolean; details?: string } | null = null

  const flush = () => {
    if (current && current.passed !== undefined) {
      checks.push({
        name: current.name,
        passed: current.passed,
        details: current.details,
      })
    }
    current = null
  }

  for (const line of lines) {
    const checkMatch = line.match(/^\s*CHECK:\s*(.+)$/i)
    if (checkMatch) {
      flush()
      current = { name: checkMatch[1].trim() }
      continue
    }

    const statusMatch = line.match(/^\s*STATUS:\s*(PASS|FAIL)/i)
    if (statusMatch && current) {
      current.passed = statusMatch[1].toUpperCase() === 'PASS'
      continue
    }

    const detailsMatch = line.match(/^\s*DETAILS:\s*(.+)$/i)
    if (detailsMatch && current) {
      current.details = detailsMatch[1].trim()
    }
  }

  flush()
  return checks
}

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the verify-work workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Tool set is readOnlyTools (read, bash) per D-08 — no write/edit.
 * Backend defaults to 'pi' (D-09).
 *
 * Accounting: verify-work → free tier (0×). Logged to stderr for D-10 telemetry.
 */
export async function runVerifyWorkflow(
  config: VerifyConfig,
  options: VerifyOptions = {},
): Promise<VerifyOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend and accounting tier visible for parity regression diagnosis
  process.stderr.write(`[verify-work] backend=${backend} tier=${VERIFY_WORK_ACCOUNTING_TIER} stage=verify-work\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — verify-work runs are stateless and ephemeral
  const sessionManager = SessionManager.inMemory()
  const authStorage = AuthStorage.create(authFilePath)
  const modelRegistry = new ModelRegistry(authStorage)
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({ agentDir })
  await resourceLoader.reload()

  // Session creation routes to Pi or Copilot backend based on `backend` param.
  // readOnlyTools (read, bash) enforce no-write contract for verification (D-08).
  const sessionOptions = {
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    resourceLoader,
    backend,
    cwd,
    stage: 'verify-work',
    tools: readOnlyTools,
  }
  const { session } = await createAgentSession(sessionOptions as Parameters<typeof createAgentSession>[0])

  // Bind extensions minimally — no UI context needed for programmatic execution
  await session.bindExtensions({
    onError: (err) => process.stderr.write(`[verify-work] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the verify prompt — criteria and context injection before the scope (D-01)
  const criteriaSection = config.criteria
    ? `ACCEPTANCE CRITERIA:\n${config.criteria}\n`
    : ''
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = VERIFY_PROMPT
    .replace('{SCOPE}', config.scope)
    .replace('{CRITERIA_SECTION}', criteriaSection)
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

  // Parse check results from structured response
  const checks = extractVerifyChecks(responseText)

  // Overall pass = all checks pass (empty checks → false to be conservative)
  const passed = checks.length > 0 && checks.every((c) => c.passed)

  // D-10: log check summary for observability
  const passCount = checks.filter((c) => c.passed).length
  process.stderr.write(
    `[verify-work] extracted ${checks.length} checks (${passCount} pass) from ${backend} backend response\n`,
  )

  return {
    response: responseText,
    passed,
    checks,
    timestamp: Date.now(),
  }
}
