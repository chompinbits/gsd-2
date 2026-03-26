import type { MultiplierTier } from "./types.js";

// ─── Stage → Multiplier Tier Map ─────────────────────────────────────────────
// Hard-coded deterministic mappings from GSD workflow stage to billing tier.
// Conservative default: unknown stages route to "standard".

export const STAGE_TIER_MAP: Record<string, MultiplierTier> = {
  // Free (0×) — lightweight discussion and verification passes
  "discuss-phase": "free",
  "verify-work": "free",

  // Low (0.33×) — planning checks and validation
  "plan-check": "low",
  "validate-phase": "low",

  // Standard (1×) — full planning, research, and execution work
  "plan-phase": "standard",
  "research-phase": "standard",
  "execute-task": "standard",

  // v1.1 stage aliases — auto-dispatch and workflow entry-point names (per D-05)
  "execute-phase": "standard",  // 1× — synonym for execute-task used by auto-dispatch
  "verify-phase": "free",       // 0× — synonym for verify-work used by auto-dispatch
  "run-uat": "free",            // 0× — user acceptance testing
};

/**
 * Returns the MultiplierTier for a given GSD workflow stage.
 * Defaults to "standard" for any unmapped stage (conservative safe default).
 */
export function getStageMultiplierTier(stage: string): MultiplierTier {
  return STAGE_TIER_MAP[stage] ?? "standard";
}

// ─── Complexity Hints ─────────────────────────────────────────────────────────
// Hints may only LOWER the effective tier, never raise it.

export type ComplexityHint = "low" | "medium" | "high";

// Tier ordinals for downgrade comparison (lower index = cheaper)
const TIER_ORDER: MultiplierTier[] = ["free", "low", "standard"];

/**
 * Resolves the effective billing tier after applying an optional complexity hint.
 *
 * Rules (per D-07 — hints can only lower tiers, never raise):
 *   - no hint or "high" → return stageTier unchanged
 *   - "low"             → force to "free" (lowest possible tier)
 *   - "medium"          → downgrade at most one step
 *                         ("standard" → "low", "low" → "low", "free" → "free")
 */
export function resolveEffectiveTier(
  stageTier: MultiplierTier,
  hint?: ComplexityHint,
): MultiplierTier {
  if (!hint || hint === "high") {
    return stageTier;
  }

  if (hint === "low") {
    return "free";
  }

  // hint === "medium": cap at "low" — return the lower of stageTier and "low"
  // ("standard" → "low", "low" stays "low", "free" stays "free")
  const currentIndex = TIER_ORDER.indexOf(stageTier);
  const mediumCapIndex = TIER_ORDER.indexOf("low");
  return TIER_ORDER[Math.min(currentIndex, mediumCapIndex)];
}
