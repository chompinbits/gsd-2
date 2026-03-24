# Pitfalls Research

**Domain:** Coding-agent platform migration to GitHub Copilot SDK under premium-request accounting
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH (SDK docs + community reports + codebase analysis; SDK is technical preview so some behaviors may shift)

## Critical Pitfalls

### Pitfall 1: Request Multiplier Explosion in Auto-Mode Loops

**What goes wrong:**
GSD auto-mode dispatches many units per milestone: discuss → research → plan → execute-task (×N) → complete-slice → reassess → repeat. Under the current Pi SDK model each unit is a direct API call at known token cost. Under Copilot premium-request accounting, each `session.sendAndWait()` call is **one premium request multiplied by the model's multiplier**. A single milestone with 3 slices × 5 tasks each = ~25+ units. At Claude Sonnet 4.5 (1×) that's 25 premium requests. If someone selects Claude Opus 4.5 (3×) for planning, that's 75 premium requests consumed from a 300/month Pro quota — over 25% of the monthly allowance on one milestone.

**Why it happens:**
The existing cost model tracks raw tokens and USD. Premium request accounting is a fundamentally different currency with model-specific multipliers: 0× for GPT-4.1, 0.33× for Haiku/Gemini Flash, 1× for Sonnet/GPT-5.1-Codex, 3× for Opus, **30× for Claude Opus 4.6 fast mode**. GSD's budget engine (`auto-budget.ts`) and complexity router (`auto-model-selection.ts`) optimize for dollar cost, not for premium-request units. A "cheap in dollars" model may be expensive in premium requests, and vice versa.

**How to avoid:**
- Add a premium-request accounting layer alongside the existing USD cost tracker. Map each dispatched unit to estimated premium-request cost based on model multiplier *before* dispatch.
- Implement a premium-request budget ceiling separate from the USD ceiling, with the same enforcement modes (warn/pause/halt).
- Default to 0× multiplier models (GPT-4.1, GPT-4o, GPT-5 mini) for low-complexity units. Reserve 1× models for planning and complex execution. Never default to 3× or 30× models without explicit user opt-in.
- Update the complexity router to factor in multiplier cost, not just model capability tier.

**Warning signs:**
- Monthly premium quota drops by >5% on a single auto-mode run
- `routing-history.json` shows most units routed to 1×+ models
- Users report "quota exhausted" within first week of migration

**Phase to address:**
Early — must be in the first phase that wires up Copilot SDK session dispatch. Retrofit is expensive because every dispatch path would need re-auditing.

---

### Pitfall 2: Hidden Request Inflation from Tool Call Round-Trips

**What goes wrong:**
Community reports (GitHub Discussion #187486) confirm that Copilot's internal orchestration counts **each tool call interaction** against premium quota, not just the initial prompt. When GSD dispatches an execute-task unit, the agent typically: reads files (tool call), edits files (tool call), runs verification (tool call), reads results (tool call). Each of these is an internal LLM turn that consumes a premium request. A single "execute-task" unit that the current system treats as 1 API call could become 5-15 premium requests under Copilot SDK orchestration.

**Why it happens:**
The Copilot SDK wraps the Copilot CLI runtime, which manages its own tool-calling loop internally. GSD's `sendAndWait()` call triggers an agentic loop where the LLM autonomously invokes tools — each tool invocation is a model turn counted as a premium request. GSD's existing prompt strategy optimizes for "one big prompt → one response" but the SDK's agentic runtime encourages iterative tool use.

**How to avoid:**
- Audit which SDK tools are enabled per session. Use `availableTools` / `excludedTools` in `SessionConfig` to restrict tool access to only what each unit type needs.
- For units that don't need agentic tool use (complete-slice, run-uat, reassess-roadmap), consider using `sendAndWait()` with all tools excluded — forcing a single-turn response.
- Pre-load file content into the prompt (GSD's existing `buildExecuteTaskPrompt` pattern) rather than letting the agent read files via tool calls. This burns context window space but saves premium requests.
- Measure actual premium requests consumed per unit type and log the ratio vs. expected. Alert on unit types that consistently consume >3× expected requests.

**Warning signs:**
- Premium request count per unit is 5-10× higher than expected single-request count
- Tool execution events (`tool.executionStart` / `tool.executionComplete`) fire many times per unit
- Session duration increases without corresponding work output improvement

**Phase to address:**
Immediately after initial SDK integration — this determines whether the "one session per unit" pattern is even viable as-is.

---

### Pitfall 3: SDK Technical Preview Instability

**What goes wrong:**
The Copilot SDK entered technical preview in January 2026. Per the project's own `.github/instructions/copilot-sdk-nodejs.instructions.md`: "The SDK is in technical preview and may have breaking changes." Building core orchestration on preview APIs risks mid-migration breakage when GitHub ships updates. Event types, session config properties, tool definition schemas, or the `CopilotClient` lifecycle could change.

**Why it happens:**
The SDK wraps the Copilot CLI as a subprocess — client → CLI server communication uses stdio/TCP. The CLI itself receives frequent updates. Breaking changes can arrive through `npm update @github/copilot-sdk` or through the underlying Copilot CLI binary updating independently.

**How to avoid:**
- Pin `@github/copilot-sdk` to an exact version in `package.json` (no `^` or `~`).
- Define an **adapter interface** between GSD orchestration and the SDK. All SDK calls go through a thin wrapper (`copilot-adapter.ts`) so that SDK API changes are isolated to one file, not scattered across dispatch, recovery, and verification modules.
- Keep the Pi SDK code path functional during the entire migration. The hybrid transition path in PROJECT.md is correct — but enforce it with a runtime feature flag, not just dead code.
- Add an integration test that creates a session, sends a prompt, and verifies the response shape. Run it on every CI build so SDK breakage is detected immediately.

**Warning signs:**
- `session.on()` event types stop firing or change shape after SDK update
- `createSession()` rejects configs that previously worked
- `CopilotClient` state transitions (`getState()`) don't match documented lifecycle
- TypeScript compilation errors after `npm update`

**Phase to address:**
Phase 1 (adapter layer). The adapter should be the first thing built, before any orchestration is wired through the SDK.

---

### Pitfall 4: Session-Per-Unit Pattern vs. SDK Session Lifecycle

**What goes wrong:**
GSD's auto-mode creates a fresh agent session per unit (`ctx.newSession()` pattern in `auto.ts`). Each unit gets a clean context with a focused prompt. The Copilot SDK's `client.createSession()` + `session.destroy()` maps to this, but with overhead: the CLI spawns a server process, session creation involves auth negotiation, and the client manages internal state. Creating 25+ sessions per milestone could mean 25+ session bootstraps, each adding seconds of latency and potentially triggering rate limits.

**Why it happens:**
GSD's fresh-session pattern exists to prevent context contamination between units and to control the exact prompt sent for each phase. The SDK sessions are heavier than GSD's current lightweight session resets — they involve process-level IPC, not just in-memory state clearing.

**How to avoid:**
- Test whether `session.send()` with a context-clearing prefix prompt can substitute for full `session.destroy()` + `client.createSession()` cycles. This would reuse a single session across units.
- If session reuse isn't viable, use a **single CopilotClient** with a connection pool pattern: create the client once at auto-mode start, create/destroy sessions per unit, only stop the client at auto-mode end.
- Measure session creation latency. If it exceeds 2 seconds, batch lightweight units (complete-slice, run-uat) into the same session.
- Use `session.abort()` + fresh `send()` rather than full teardown for recovery scenarios.

**Warning signs:**
- Auto-mode runs take 2-3× longer than before migration at the same task count
- Rate limit errors appear during rapid session creation/destruction
- Session creation failures under concurrent dispatch (parallel workstreams)

**Phase to address:**
Early integration phase — the session lifecycle pattern determines all downstream dispatch design.

---

### Pitfall 5: Auto-Compaction Triggering Uncontrolled Premium Requests

**What goes wrong:**
The Copilot CLI auto-compacts conversation history at 95% context window utilization. GSD's prompts are already large: `MAX_PREAMBLE_CHARS = 30_000` in `auto-prompts.ts`, plus template content, inline plans, prior summaries, and decisions. If a session accumulates tool call results (file contents, verification output), it can hit the compaction threshold. Each compaction is a model call — another premium request. Compaction can cascade: compact → new space fills → compact again.

**Why it happens:**
GSD's existing `context-budget.ts` and `prompt-cache-optimizer.ts` were built to control what goes into a prompt for Anthropic/OpenAI APIs where GSD manages context directly. The Copilot SDK manages its own context window, and GSD's prompt content is just the initial user message — the SDK's internal tool results, system prompt, and conversation history all consume additional space outside GSD's control.

**How to avoid:**
- Use GSD's existing inline-level compression (`minimal`/`standard`/`full` from token profiles) more aggressively when dispatching through the SDK. Default to `minimal` for execution tasks.
- Monitor context utilization via Copilot CLI's `/context` equivalent if accessible programmatically, or by counting tokens before dispatch.
- For multi-tool-call sessions, set `excludedTools` to prevent unnecessary file reads that bloat context.
- Consider using `systemMessage.mode: "replace"` with a compact system prompt rather than appending to Copilot's default system prompt.

**Warning signs:**
- Session events show `assistant.message` events that look like compaction summaries (short, meta-level responses between user prompts)
- Premium request count per unit is consistently 2-3× higher than expected
- Session duration spikes without corresponding code output

**Phase to address:**
During prompt migration — when adapting `auto-prompts.ts` builders to work with SDK sessions.

---

### Pitfall 6: Prompt Cache Optimization Invalidation

**What goes wrong:**
GSD has a sophisticated prompt-ordering system (`prompt-ordering.ts`, `prompt-cache-optimizer.ts`) designed for Anthropic's prefix caching (up to 4 breakpoints, 90% savings) and OpenAI's auto-caching (1024+ stable prefix tokens, 50% savings). These optimizations place static content first and dynamic content last. Under the Copilot SDK, the prompt is sent as a user message within the SDK's own conversation structure — GSD has no control over the system prompt prefix, tool definitions, or conversation history that precede the user message. All existing cache optimization becomes irrelevant or counterproductive.

**Why it happens:**
The caching layer was designed for direct API calls where GSD controls the entire message array. The SDK inserts its own system prompt, tool schemas, and internal context before GSD's content reaches the model API. The "stable prefix" that the optimizer creates is no longer at position 0 in the actual API payload.

**How to avoid:**
- Don't port `prompt-cache-optimizer.ts` and `prompt-ordering.ts` to the SDK path. They're dead code under the new runtime.
- Instead, focus on **prompt size reduction** — smaller prompts mean fewer tokens regardless of caching. This is purely about reducing input size, not ordering.
- Test whether the Copilot SDK's auto model selection (10% multiplier discount in VS Code) provides equivalent cost savings to justify dropping manual cache optimization.
- If BYOK (`provider` config) is used as a fallback path, the existing cache optimization can stay active for that code path only.

**Warning signs:**
- Cache efficiency metrics from the existing system show 0% hit rates under the SDK
- Per-request token costs are higher than equivalent direct API calls
- Prompt ordering logic runs but has no measurable effect on billing

**Phase to address:**
Mid-migration — when optimizing the SDK dispatch path for cost efficiency. Don't invest time porting cache logic early.

---

### Pitfall 7: Verification Gate Retry Spiral Burning Premium Requests

**What goes wrong:**
GSD's post-unit verification gate (`auto-verification.ts`) runs typecheck/lint/test commands, and if they fail, retries the unit up to N times. Each retry is a full new session dispatch — another premium request (or multiple, if tool calls are involved). The timeout recovery system (`auto-timeout-recovery.ts`) compounds this: idle recovery allows 2 attempts, hard timeout 1, with exponential backoff. A single failing task can consume 3-6× the expected premium requests before finally being skipped or paused.

**Why it happens:**
Under the current Pi SDK model, retries cost tokens (USD) which is granular. Under premium-request accounting, each retry is a discrete integer premium request (or more, with multipliers). The existing retry logic was tuned for "tokens are cheap, retries are worth the accuracy gain." Under quota-constrained premium requests, the calculus flips.

**How to avoid:**
- Add a premium-request budget per unit. Before dispatching a retry, check if the unit has already consumed more than 2× its expected budget.
- Reduce verification retry count from 2 to 1 for non-critical units (complete-slice, run-uat).
- For execute-task retries, require the verification failure to contain a fixable error before retrying. Infrastructure errors (ENOENT, ECONNRESET — already detected by `isInfraVerificationFailure()`) should immediately skip, not retry.
- Log retry premium-request cost separately in metrics so waste is visible.

**Warning signs:**
- `routing-history.json` shows repeated entries for the same unit ID
- Single units consuming >5 premium requests
- Verification gate "passed after retry" rate exceeds 50% (indicating retries are speculative, not targeted)

**Phase to address:**
Must ship alongside or immediately after the verification gate migration to the SDK path.

---

### Pitfall 8: Model Selection Control Loss Under SDK Routing

**What goes wrong:**
GSD has a mature complexity-based model router (`auto-model-selection.ts`, `complexity-classifier.ts`, `model-router.ts`) that classifies units and selects models accordingly. The Copilot SDK also has model selection: `SessionConfig.model` sets the model, but the SDK's "Auto" model selection can override this based on availability and rate-limit avoidance. If the SDK silently switches models (as community reports confirm happens), GSD's routing metrics become inaccurate and cost projections break.

**Why it happens:**
The SDK's model parameter is a request, not a guarantee. Rate limits on premium models (especially preview models) cause fallback to different models. The "Auto" selection at the Copilot platform level optimizes for platform throughput and rate-limit avoidance, not for GSD's per-unit cost optimization.

**How to avoid:**
- Always explicitly set `model` in `SessionConfig` — never use "Auto" for auto-mode dispatch.
- Listen to session events to detect what model actually served the response (if this metadata is available). Log and compare requested vs. actual model.
- Build a "model confirmed" test: after session creation, verify the active model before dispatching critical prompts.
- If the SDK doesn't expose actual model info, track premium request consumption per unit and flag anomalies that indicate model switching.
- Define a model fallback chain in GSD's config that stays within the same multiplier tier (e.g., Sonnet 4 → Sonnet 4.5 → GPT-5.1-Codex, all at 1×).

**Warning signs:**
- Actual premium request consumption doesn't match expected multiplier for configured model
- Session quality drops inconsistently (some units excellent, some poor — suggesting model switching)
- Rate limit errors followed by silently different model behavior

**Phase to address:**
During model selection integration — when adapting `selectAndApplyModel()` for SD sessions.

---

### Pitfall 9: Hybrid Transition Double-Counting Quota

**What goes wrong:**
PROJECT.md mandates a hybrid transition: Pi SDK and Copilot SDK running side-by-side. If the routing between old and new paths isn't airtight, a unit could accidentally dispatch through both paths — consuming premium requests on the Copilot side and API tokens on the Pi SDK side. Worse, if the feature flag logic has bugs, all units might route through the SDK prematurely before cost controls are in place.

**Why it happens:**
The dispatch table (`auto-dispatch.ts`) routes state → unit type → prompt builder. Adding a second dispatch target (SDK session vs. Pi session) creates a branch point. Feature flags that are per-unit-type, per-milestone, or per-environment create combinatorial routing complexity.

**How to avoid:**
- Use a **single routing gate** at the dispatch level: in `DISPATCH_RULES`, each rule checks a runtime flag and routes to either SDK or Pi path. No dual dispatch.
- Make the gate observable: log which runtime path each unit took. Dashboard should show "SDK dispatches this session: N / Pi dispatches: M."
- Start with a single low-risk unit type (complete-slice, 0.33× Light tier) on the SDK path. Validate premium-request consumption matches expectations before migrating higher-cost unit types.
- Add a circuit breaker: if SDK dispatch fails 3× consecutively, fall back to Pi path automatically.

**Warning signs:**
- Total cost (USD + premium requests) exceeds historical baseline by >20% during transition
- Same unit ID appears in both SDK and Pi metrics logs
- Feature flag changes cause immediate premium-request spikes

**Phase to address:**
Phase 1 — the very first phase that introduces any SDK dispatch. The gate must exist before any SDK code is reachable from auto-mode.

---

### Pitfall 10: Rate Limiting Stalling Auto-Mode Pipeline

**What goes wrong:**
Copilot has both per-model and service-level rate limits. GSD's auto-mode dispatches units rapidly — the loop in `auto/loop.ts` immediately dispatches the next unit after the previous one completes. Under Copilot SDK, this rapid-fire pattern can trigger rate limits, especially on premium/preview models. A rate limit error would not be caught by GSD's current error handling (which expects Pi SDK error shapes), potentially crashing the auto-mode loop or causing infinite retry.

**Why it happens:**
GSD's auto-mode was designed for direct API calls with token-based rate limits (which are rarely hit in practice). Copilot's rate limits are request-based and model-specific. Preview models have stricter limits. The SDK may return errors that don't match GSD's existing `INFRA_ERROR_CODES` or `isInfrastructureError()` checks.

**How to avoid:**
- Add rate-limit detection to the SDK adapter layer. Map SDK/CLI error codes to GSD's existing infrastructure error taxonomy.
- Implement inter-unit delay: add a configurable pause (default 1-2 seconds) between unit dispatches to avoid burst patterns.
- Use the SDK's session event system (`session.error`) to detect rate limiting before it appears as an unhandled error.
- Prefer 0× multiplier models for high-frequency dispatch (complete-slice, light tasks). They have higher rate limits because of lower resource cost.
- Add backoff: if a rate limit is detected, pause auto-mode for the duration indicated by the retry-after header (if available) or a default 30 seconds.

**Warning signs:**
- Auto-mode pauses unexpectedly with "infrastructure error" or unknown error type
- Session creation starts failing after a burst of rapid dispatches
- Units complete normally but the next unit dispatch fails repeatedly

**Phase to address:**
In the SDK adapter layer (Phase 1) and the auto-mode loop integration phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip premium-request tracking, rely on GitHub's dashboard | Faster initial integration | No per-unit cost attribution, no budget enforcement, no cost projection | Never — GSD's value proposition includes cost awareness |
| Use `systemMessage.mode: "replace"` everywhere | Full control over system prompt | Loses Copilot's safety guardrails; future SDK updates may change behavior of replaced prompts | Only for execution tasks with verified prompt templates |
| Hard-code model names in dispatch rules | Quick migration, no router changes | Model deprecation/renaming by GitHub breaks all dispatch | Never — always go through the model router abstraction |
| Keep Pi SDK as permanent fallback instead of completing migration | Safety net forever | Maintaining two runtime paths doubles testing surface and creates confusion about which path is authoritative | Acceptable during transition (6-8 weeks max), then sunset |
| Let SDK manage all tool permissions with `approveAll` | No permission UI work | Security surface: agents can execute arbitrary tools without guardrails | Only during development; production must use scoped permission handlers |
| Ignore prompt size when SDK manages context | Less prompt engineering work | Uncontrolled compaction requests, premium request waste | Never — prompt size discipline saves real quota |

## Integration Gotchas

Common mistakes when connecting to the Copilot SDK.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `CopilotClient` lifecycle | Creating a new client per unit (spawns new CLI process each time) | Create one client at auto-mode start, reuse across all units, stop at auto-mode end |
| Session cleanup | Forgetting `session.destroy()` in error paths, leaking server resources | Always use try-finally or the `withSession()` wrapper pattern from SDK docs |
| Event listener cleanup | Subscribing to events without storing the unsubscribe function | Store every `session.on()` return value, call it in cleanup |
| Streaming vs. sync | Defaulting to streaming for all units, processing delta events incorrectly | Use `sendAndWait()` for units that don't need streaming; streaming adds complexity for no benefit on non-interactive paths |
| BYOK provider config | Assuming BYOK bypasses premium request accounting | BYOK uses separate billing — need separate cost tracking path for BYOK vs. GitHub-managed models |
| Permission handler | Using `approveAll` in production auto-mode | Implement scoped handler that approves expected tools, denies unexpected ones, logs all decisions |
| MCP server config | Passing MCP servers to every session | Only configure MCP servers for unit types that need external context; each MCP tool call may generate premium requests |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One session per unit at rapid cadence | Works for 5-unit test runs | Implement inter-unit delay, session reuse where possible | >15 units per auto-mode run; rate limits hit around rapid 20+ session creates |
| All units use 1× multiplier models | Premium budget looks fine in testing | Route light/completion units to 0× models (GPT-4.1, GPT-4o) | Teams on Pro (300/month) — 300 requests runs out in 2 milestones |
| No premium-request projection | Budget dashboard shows only USD cost | Add premium-request projection alongside USD: "N premium requests remaining at current pace" | Users hit quota mid-milestone with no warning |
| Verification retries without cost check | Pass rate improves by 15% with retries | Add per-unit premium-request cap; skip retry if cap exceeded | A single failing slice consumes 30+ premium requests through retry spiral |
| Context window stuffing for quality | Bigger prompts → better results | Use compact prompts for SDK path; size increases compaction frequency | Per-unit premium request count doubles from compaction overhead |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SDK adapter layer | Building too thin an adapter that leaks SDK types everywhere | Define GSD-native interfaces; adapter translates at the boundary |
| Session dispatch migration | Migrating all unit types at once | Start with lowest-risk unit type (complete-slice), validate metrics, then expand |
| Model selection integration | Losing dynamic routing capability | Verify SDK `model` config is respected; build detection for silent model switches |
| Prompt migration | Porting prompts 1:1 without size optimization | Take the opportunity to compress prompts for SDK path; old cache ordering is irrelevant |
| Verification gate migration | Retries consuming unbounded premium requests | Add premium-request cap per unit before migration |
| Cost telemetry | Building USD-only metrics for the new path | Track both USD (for BYOK) and premium requests (for Copilot-managed) from day one |
| Hybrid transition | Feature flag logic errors causing dual dispatch | Single routing gate with observability; circuit breaker on SDK failures |
| Pi SDK sunset | Removing fallback before SDK path is proven stable | Keep fallback until 2 full milestones complete successfully on SDK path |

## Sources

- GitHub Copilot Docs: [Premium request multipliers](https://docs.github.com/en/copilot/concepts/billing/copilot-requests) — HIGH confidence
- GitHub Copilot Docs: [Rate limits](https://docs.github.com/en/copilot/concepts/rate-limits) — HIGH confidence
- GitHub Copilot Docs: [SDK getting started](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started) — HIGH confidence
- GitHub Copilot Docs: [Copilot CLI auto-compaction](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) — HIGH confidence
- GitHub Community Discussion #187486: Tool call request inflation reports — MEDIUM confidence (community reports, consistent pattern)
- GitHub Community Discussion #186012: Premium quota exhaustion at 22.4%/day — MEDIUM confidence
- Visual Studio Magazine: [Copilot Premium SKU Quotas](https://visualstudiomagazine.com/articles/2026/02/19/beware-project-wrecking-github-copilot-premium-sku-quotas.aspx) — MEDIUM confidence
- GitHub January 2026 Copilot Roundup: SDK technical preview announcement — HIGH confidence
- Project `.github/instructions/copilot-sdk-nodejs.instructions.md` — HIGH confidence (local reference)
- Codebase analysis: `auto-dispatch.ts`, `auto-prompts.ts`, `auto-model-selection.ts`, `auto-verification.ts`, `prompt-cache-optimizer.ts` — HIGH confidence (direct code inspection)
- `.planning/codebase/CONCERNS.md` — HIGH confidence (existing tech debt documentation)
