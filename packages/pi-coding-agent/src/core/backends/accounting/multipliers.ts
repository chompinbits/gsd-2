import type { MultiplierTier } from "./types.js";
import { MULTIPLIER_VALUES } from "./types.js";

// ─── Model → Multiplier Tier Map ─────────────────────────────────────────────
// Maps known GitHub Copilot model IDs to their premium request billing tier.
// free (0×)     — included models with no premium request cost
// low (0.33×)   — reduced-cost models
// standard (1×) — full premium request models
//
// Unknown models default to "standard" (conservative/safe default).
// Do NOT include 3× or 30× tiers — no auto-routing to expensive tiers in v1.

export const MODEL_MULTIPLIER_MAP: Record<string, MultiplierTier> = {
  // ── Free tier (0×) — GPT models included in base Copilot plans ─────────────
  "gpt-4.1": "free",
  "gpt-4.1-mini": "free",
  "gpt-4.1-nano": "free",
  "gpt-4o": "free",
  "gpt-4o-mini": "free",
  "gpt-4o-mini-2024-07-18": "free",
  "gpt-4o-2024-11-20": "free",
  "gpt-4o-2024-08-06": "free",
  "gpt-4o-2024-05-13": "free",
  "gpt-5-mini": "free",
  "gpt-5-mini-2025": "free",

  // ── Low tier (0.33×) — Claude Haiku + Gemini Flash ──────────────────────────
  "claude-haiku-4-5": "low",
  "claude-3-5-haiku-latest": "low",
  "claude-3-haiku-20240307": "low",
  "claude-3-5-haiku-20241022": "low",
  "gemini-2.0-flash": "low",
  "gemini-flash-2.0": "low",
  "gemini-2.0-flash-001": "low",
  "gemini-2.0-flash-lite": "low",

  // ── Standard tier (1×) — Claude Sonnet + GPT-5 + Gemini Pro + DeepSeek ──────
  "claude-sonnet-4-6": "standard",
  "claude-sonnet-4-5-20250514": "standard",
  "claude-3-5-sonnet-latest": "standard",
  "claude-3-5-sonnet-20241022": "standard",
  "claude-3-7-sonnet-latest": "standard",
  "gpt-5": "standard",
  "gpt-5.4": "standard",
  "gpt-5.4-2025": "standard",
  "gemini-2.5-pro": "standard",
  "gemini-2.5-pro-preview-05-06": "standard",
  "deepseek-chat": "standard",
  "deepseek-v3": "standard",
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

/**
 * Returns the MultiplierTier for a given model ID.
 * Strips provider prefix (e.g. "openai/gpt-4o" → "gpt-4o") before lookup.
 * Defaults to "standard" for unknown models (conservative safe default).
 */
export function getModelMultiplier(modelId: string): MultiplierTier {
  const normalized = modelId.includes("/")
    ? modelId.slice(modelId.lastIndexOf("/") + 1)
    : modelId;
  return MODEL_MULTIPLIER_MAP[normalized] ?? "standard";
}

/**
 * Returns the numeric multiplier value for a given tier.
 */
export function getMultiplierValue(tier: MultiplierTier): number {
  return MULTIPLIER_VALUES[tier];
}
