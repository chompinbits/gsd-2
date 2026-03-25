/**
 * Discuss-phase workflow — backend-agnostic session wrapper.
 *
 * Provides a programmatic interface for running the planning discuss flow
 * through either the Pi SDK backend (default) or the GitHub Copilot SDK
 * backend, while keeping the question flow and output format identical
 * between both paths (D-01, D-03).
 *
 * Used by:
 *  - `gsd discuss-phase` CLI subcommand (backend selection via --backend flag)
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
// Types
// ---------------------------------------------------------------------------

export interface DiscussQuestion {
  id: string
  text: string
  context?: string
  /** Relevance score 0–1; higher = more important to address first */
  relevance: number
}

export interface DiscussOutput {
  questions: DiscussQuestion[]
  summary: string
  timestamp: number
}

export interface DiscussConfig {
  /** Topic or phase description to discuss */
  topic: string
  /** Working directory for session context. Default: process.cwd() */
  cwd?: string
  /** Optional project context injected before the topic prompt */
  projectContext?: string
}

export interface DiscussOptions {
  /** Backend runtime: 'pi' (default) or 'copilot'. D-09: default is Pi. */
  backend?: 'pi' | 'copilot'
}

// ---------------------------------------------------------------------------
// Prompt template — kept as stable contract (D-01)
// ---------------------------------------------------------------------------

const DISCUSS_PROMPT = `You are a planning assistant for a software development project.

Generate a structured list of 5–10 focused scoping questions to guide discussion about the following topic.

TOPIC:
{TOPIC}

{CONTEXT_SECTION}

Requirements for your output:
- Output a numbered list of questions (1., 2., 3., ...).
- For each question include:
    Context: <one sentence explaining why this question matters>
    Priority: <high | medium | low>
- Order questions by descending priority.
- Focus on decisions that most impact implementation approach, scope, and risk.
- Be specific to the topic — no generic boilerplate questions.

Example format:
1. How does X interact with Y under condition Z?
   Context: This determines whether we need to add a migration step.
   Priority: high
`

// ---------------------------------------------------------------------------
// Question extraction — D-01: format and logic are stable across backends
// ---------------------------------------------------------------------------

/**
 * Parse assistant response text into structured DiscussQuestion objects.
 * Handles numbered lists with optional Context/Priority metadata lines.
 * Backend-agnostic — processes the same normalized AgentEvent text output.
 */
export function extractDiscussQuestions(text: string): DiscussQuestion[] {
  const questions: DiscussQuestion[] = []
  const lines = text.split('\n')
  let current: { text: string; context?: string; relevance: number } | null = null
  let index = 0

  const flush = () => {
    if (current) {
      questions.push({
        id: String(index + 1),
        text: current.text,
        context: current.context,
        relevance: current.relevance,
      })
      index++
    }
  }

  for (const line of lines) {
    const numbered = line.match(/^(\d+)\.\s+(.+)$/)
    if (numbered) {
      flush()
      current = { text: numbered[2].trim(), relevance: 0.5 }
      continue
    }

    if (!current) continue

    const contextMatch = line.match(/^\s+Context:\s*(.+)$/i)
    if (contextMatch) {
      current.context = contextMatch[1].trim()
      continue
    }

    const priorityMatch = line.match(/^\s+Priority:\s*(high|medium|low)/i)
    if (priorityMatch) {
      const p = priorityMatch[1].toLowerCase()
      current.relevance = p === 'high' ? 0.9 : p === 'medium' ? 0.6 : 0.3
    }
  }

  flush()

  // Sort by descending relevance (preserves priority ordering from D-01)
  return questions.sort((a, b) => b.relevance - a.relevance)
}

// ---------------------------------------------------------------------------
// Main workflow entry point
// ---------------------------------------------------------------------------

/**
 * Run the discuss-phase workflow.
 *
 * Routes session creation through createAgentSession() with the specified
 * backend (D-07). Event subscription and message collection are identical for
 * both backends — the parity contract is the normalized AgentEvent output
 * (D-03). Backend selection is explicit and defaults to 'pi' (D-09).
 *
 * Telemetry: emits `[discuss] backend=<backend>` to stderr for diagnostic
 * visibility (D-10).
 */
export async function runDiscussWorkflow(
  config: DiscussConfig,
  options: DiscussOptions = {},
): Promise<DiscussOutput> {
  const backend = options.backend ?? 'pi'

  // D-10: telemetry log — backend selection visible for parity regression diagnosis
  process.stderr.write(`[discuss] backend=${backend}\n`)

  const cwd = config.cwd ?? process.cwd()

  // In-memory session manager — discuss-phase runs are stateless and ephemeral
  const sessionManager = SessionManager.inMemory()
  const authStorage = AuthStorage.create(authFilePath)
  const modelRegistry = new ModelRegistry(authStorage)
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const resourceLoader = new DefaultResourceLoader({ agentDir })
  await resourceLoader.reload()

  // Session creation routes to Pi or Copilot backend based on `backend` param.
  // This is the only backend-specific branch — the rest of the flow is identical (D-01).
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
    onError: (err) => process.stderr.write(`[discuss] Extension error (${err.extensionPath}): ${err.error}\n`),
  })

  // Build the discuss prompt — context injection before the topic (D-01)
  const contextSection = config.projectContext
    ? `PROJECT CONTEXT:\n${config.projectContext}\n`
    : ''
  const prompt = DISCUSS_PROMPT
    .replace('{TOPIC}', config.topic)
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

  // D-10: log question count for observability
  const questions = extractDiscussQuestions(responseText)
  process.stderr.write(`[discuss] extracted ${questions.length} questions from ${backend} backend response\n`)

  // Summary: first meaningful paragraph from the response (capped at 500 chars)
  const summaryLines = responseText.split('\n').slice(0, 5).join(' ').replace(/\s+/g, ' ').trim()

  return {
    questions,
    summary: summaryLines.substring(0, 500),
    timestamp: Date.now(),
  }
}
