/**
 * Roadmap workflow — backend-agnostic session wrapper.
 *
 * Provides a programmatic interface for running roadmap management commands
 * through either the Pi SDK backend (default) or the GitHub Copilot SDK
 * backend (D-01, D-03).
 *
 * Accounting: roadmap → low tier (0.33×) per Phase 10 D-04.
 *
 * Used by:
 *  - `gsd new-project` CLI subcommand (backend selection via /settings defaultBackend)
 *  - `gsd new-milestone` CLI subcommand
 *  - `gsd add-phase` CLI subcommand
 *  - `gsd remove-phase` CLI subcommand
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

export interface RoadmapConfig {
  /** The roadmap management command to execute (e.g. 'new-project', 'add-phase') */
  command: string
  /** Additional arguments for the command */
  args: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional project context injected before the command prompt */
  projectContext?: string
}

export interface RoadmapOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. D-09: default is Pi. */
  backend?: 'pi' | 'copilot'
}

export interface RoadmapOutput {
  command: string
  result: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Accounting tier constant (Phase 10 D-04)
// ---------------------------------------------------------------------------

const ROADMAP_ACCOUNTING_TIER = 'low' as const

// ---------------------------------------------------------------------------
// Prompt template — kept as stable contract (D-01)
// ---------------------------------------------------------------------------

const ROADMAP_PROMPT = `You are a project management assistant.

Execute the following roadmap management command.

COMMAND: {COMMAND}
ARGUMENTS: {ARGS}

{CONTEXT_SECTION}

Requirements:
- Read the project's .planning/ directory for current state.
- Execute the command precisely as specified.
- Report what changes were made to planning files.
`

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the roadmap workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Accounting tier: ${ROADMAP_ACCOUNTING_TIER} (0.33×) per D-04.
 * Backend selection is explicit and defaults to 'pi' (D-09).
 *
 * Telemetry: emits `[roadmap] backend=<backend>` to stderr for diagnostic
 * visibility (D-10).
 */
export async function runRoadmapWorkflow(
  config: RoadmapConfig,
  options: RoadmapOptions = {},
): Promise<RoadmapOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend selection visible for parity regression diagnosis
  process.stderr.write(`[roadmap] backend=${backend} stage=roadmap tier=${ROADMAP_ACCOUNTING_TIER}\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — roadmap runs are stateless and ephemeral
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
    stage: 'roadmap',
  }
  const { session } = await createAgentSession(sessionOptions as Parameters<typeof createAgentSession>[0])

  // Bind extensions minimally — no UI context needed for programmatic execution
  await session.bindExtensions({
    onError: (err) => process.stderr.write(`[roadmap] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the prompt — context injection before the command (D-01)
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = ROADMAP_PROMPT
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
  process.stderr.write(`[roadmap] command=${config.command} result_length=${responseText.length} backend=${backend}\n`)

  return {
    command: config.command,
    result: responseText,
    timestamp: Date.now(),
  }
}
