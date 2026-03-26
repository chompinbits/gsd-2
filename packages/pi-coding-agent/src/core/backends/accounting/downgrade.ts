import type { AccountingConfig, BudgetState } from "./types.js";
import { MODEL_MULTIPLIER_MAP } from "./multipliers.js";

// ─── Free-Tier Downgrade Suggestion ──────────────────────────────────────────

export interface DowngradeSuggestion {
  /** The model ID to downgrade to. */
  modelId: string;
  /** Human-readable reason for the downgrade suggestion. */
  reason: string;
  /** The budget percentage used at the time of the suggestion. */
  percentUsed: number;
}

/**
 * Deterministic ordered list of known 0× (free-tier) models.
 * Derived from MODEL_MULTIPLIER_MAP — all models with tier "free", sorted alphabetically.
 */
export const FREE_TIER_CANDIDATES: readonly string[] = Object.entries(MODEL_MULTIPLIER_MAP)
  .filter(([, tier]) => tier === "free")
  .map(([id]) => id)
  .sort();

/**
 * Pure function that determines whether a session should downgrade to a free-tier model.
 *
 * Returns a DowngradeSuggestion if budget pressure exceeds the configured threshold
 * and a free-tier candidate is available. Returns null otherwise.
 *
 * D-02: Pure/side-effect-free — safe to call in any context.
 */
export function suggestDowngrade(
  budgetState: BudgetState,
  config: AccountingConfig,
): DowngradeSuggestion | null {
  // Disabled by config
  if (!config.freeTierFallback.enabled) return null;

  // Unlimited budget (budgetLimit === 0) — no pressure
  if (config.budgetLimit === 0) return null;

  // No free-tier candidates available
  if (FREE_TIER_CANDIDATES.length === 0) return null;

  const { percentUsed } = budgetState;
  const threshold =
    config.freeTierFallback.thresholdPolicy === "hard_stop"
      ? 100
      : config.warnThreshold * 100;

  if (percentUsed < threshold) return null;

  const modelId = FREE_TIER_CANDIDATES[0];
  return {
    modelId,
    reason: `Budget at ${percentUsed.toFixed(1)}% (threshold: ${threshold.toFixed(0)}%) — downgrading to free-tier model ${modelId}`,
    percentUsed,
  };
}
