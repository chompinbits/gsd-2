/**
 * Requirements workflow — backend-agnostic session wrapper.
 *
 * Provides a programmatic interface for running requirements management
 * commands through either the Pi SDK backend (default) or the GitHub Copilot
 * SDK backend (D-01, D-03).
 *
 * Accounting: requirements → low tier (0.33×) per Phase 10 D-04.
 *
 * Used by:
 *  - `gsd progress` CLI subcommand (backend selection via /settings defaultBackend)
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
// Types
// ---------------------------------------------------------------------------

export interface RequirementsConfig {
  /** The requirements management command to execute (e.g. 'progress') */
  command: string
  /** Additional arguments for the command */
  args: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional project context injected before the command prompt */
  projectContext?: string
}

export interface RequirementsOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. D-09: default is Pi. */
  backend?: 'pi' | 'copilot'
}

export interface RequirementsOutput {
  command: string
  result: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Accounting tier constant (Phase 10 D-04)
// ---------------------------------------------------------------------------

const REQUIREMENTS_ACCOUNTING_TIER = 'low' as const

// ---------------------------------------------------------------------------
// Prompt template — kept as stable contract (D-01)
// ---------------------------------------------------------------------------

const REQUIREMENTS_PROMPT = `You are a requirements management assistant.

Execute the following requirements management command.

COMMAND: {COMMAND}
ARGUMENTS: {ARGS}

{CONTEXT_SECTION}

Requirements:
- Read the project's .planning/ directory for current state.
- Execute the command precisely as specified.
- Report what changes were made to requirements and planning files.
`

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the requirements workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Accounting tier: ${REQUIREMENTS_ACCOUNTING_TIER} (0.33×) per D-04.
 * Backend selection is explicit and defaults to 'pi' (D-09).
 *
 * Telemetry: emits `[requirements] backend=<backend>` to stderr for diagnostic
 * visibility (D-10).
 */
export async function runRequirementsWorkflow(
  config: RequirementsConfig,
  options: RequirementsOptions = {},
): Promise<RequirementsOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend selection visible for parity regression diagnosis
  process.stderr.write(`[requirements] backend=${backend} stage=requirements tier=${REQUIREMENTS_ACCOUNTING_TIER}\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — requirements runs are stateless and ephemeral
  const sessionManager = SessionManager.inMemory()
  const authStorage = AuthStorage.create(authFilePath)
  const modelRegistry = new ModelRegistry(authStorage)
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({ agentDir })
  await resourceLoader.reload()

  // Session creation routes to Pi or Copilot backend based on `backend` param.
  // This is the only backend-specific branch — the rest of the flow is identical (D-01).
  const sessionOptions = {
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    resourceLoader,
    backend,
    cwd,
    stage: 'requirements',
  }
  const { session } = await createAgentSession(sessionOptions as Parameters<typeof createAgentSession>[0])

  // Bind extensions minimally — no UI context needed for programmatic execution
  await session.bindExtensions({
    onError: (err) => process.stderr.write(`[requirements] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the prompt — context injection before the command (D-01)
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = REQUIREMENTS_PROMPT
    .replace('{COMMAND}', config.command)
    .replace('{ARGS}', config.args)
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

  // D-10: log result length for observability
  process.stderr.write(`[requirements] command=${config.command} result_length=${responseText.length} backend=${backend}\n`)

  return {
    command: config.command,
    result: responseText,
    timestamp: Date.now(),
  }
}
