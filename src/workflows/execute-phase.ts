/**
 * Execute-phase workflow — backend-agnostic session wrapper.
 *
 * Runs an execution prompt (plan implementation) through either the Pi SDK
 * backend (default) or the GitHub Copilot SDK backend. The execution output
 * format is identical between both paths (D-01, D-03).
 *
 * Accounting: execute-task → "standard" tier (1×) per Phase 2 stage routing.
 * Tool profile: codingTools (read, bash, edit, write) per D-07.
 *
 * Used by:
 *  - `gsd execute-phase` CLI subcommand
 *  - Parity tests
 */

import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  codingTools,
  createAgentSession,
} from '@gsd/pi-coding-agent'
import { agentDir, authFilePath } from '../app-paths.js'

// ---------------------------------------------------------------------------
// Accounting constant — execute-task stage maps to "standard" tier (1×).
// Derived from STAGE_TIER_MAP in packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts.
// ---------------------------------------------------------------------------
const EXECUTE_PHASE_ACCOUNTING_TIER = 'standard' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecuteConfig {
  /** Plan objective or task description to execute */
  objective: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional project context injected before the objective prompt */
  projectContext?: string
}

export interface ExecuteOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. */
  backend?: 'pi' | 'copilot'
}

export interface ExecuteOutput {
  /** Full response text from the execution session */
  response: string
  /** Number of tool calls observed (0 if not tracked) */
  toolCallCount: number
  timestamp: number
}

// ---------------------------------------------------------------------------
// Prompt template — stable contract (D-01); transport only is migrated
// ---------------------------------------------------------------------------

const EXECUTE_PROMPT = `You are a coding assistant executing a software development task.

Implement the following objective by reading relevant files, making code changes, and verifying your work.

OBJECTIVE:
{OBJECTIVE}

{CONTEXT_SECTION}

Requirements:
- Read existing code before making changes.
- Make precise, minimal changes to accomplish the objective.
- Verify your changes compile and pass relevant tests.
- Report what files you modified and what changes you made.
`

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the execute-phase workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Tool set is codingTools (read, bash, edit, write) per D-07.
 * Backend defaults to 'pi' (D-09).
 *
 * Accounting: execute-task → standard tier (1×). Logged to stderr for D-10 telemetry.
 */
export async function runExecuteWorkflow(
  config: ExecuteConfig,
  options: ExecuteOptions = {},
): Promise<ExecuteOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend and accounting tier visible for parity regression diagnosis
  process.stderr.write(`[execute-phase] backend=${backend} tier=${EXECUTE_PHASE_ACCOUNTING_TIER} stage=execute-task\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — execute-phase runs are stateless and ephemeral
  const sessionManager = SessionManager.inMemory()
  const authStorage = AuthStorage.create(authFilePath)
  const modelRegistry = new ModelRegistry(authStorage)
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({ agentDir })
  await resourceLoader.reload()

  // Session creation routes to Pi or Copilot backend based on `backend` param.
  // codingTools (read, bash, edit, write) provide full execution capability (D-07).
  const sessionOptions = {
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    resourceLoader,
    backend,
    cwd,
    stage: 'execute-task',
    tools: codingTools,
  }
  const { session } = await createAgentSession(sessionOptions as Parameters<typeof createAgentSession>[0])

  // Bind extensions minimally — no UI context needed for programmatic execution
  await session.bindExtensions({
    onError: (err) => process.stderr.write(`[execute-phase] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the execute prompt — context injection before the objective (D-01)
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = EXECUTE_PROMPT
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

  // Count tool calls from messages (messages with role 'tool')
  const toolCallCount = messages.filter(
    (msg) => (msg as { role: string }).role === 'tool',
  ).length

  return {
    response: responseText,
    toolCallCount,
    timestamp: Date.now(),
  }
}
