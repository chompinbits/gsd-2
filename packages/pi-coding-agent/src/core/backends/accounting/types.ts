// ─── Multiplier Tiers ────────────────────────────────────────────────────────
// Maps to GitHub Copilot premium request billing rates:
//   free     = 0×  (no premium request cost)
//   low      = 0.33× (reduced-cost models)
//   standard = 1×  (full premium request)

export type MultiplierTier = "free" | "low" | "standard";

export const MULTIPLIER_VALUES: Record<MultiplierTier, number> = {
  free: 0,
  low: 0.33,
  standard: 1,
};

// ─── Accounting Configuration ─────────────────────────────────────────────────

export interface FreeTierFallbackConfig {
  /** Whether free-tier fallback is enabled. Default: true. */
  enabled: boolean;
  /** "warn" = trigger at warnThreshold, "hard_stop" = trigger only at 100%. Default: "warn". */
  thresholdPolicy: "warn" | "hard_stop";
}

export const DEFAULT_FREE_TIER_FALLBACK: FreeTierFallbackConfig = {
  enabled: true,
  thresholdPolicy: "warn",
};

export interface AccountingConfig {
  /** Total premium request quota (absolute count) */
  budgetLimit: number;
  /** Fraction of budget at which warnings are emitted (0-1) */
  warnThreshold: number;
  /** If true, block new requests once budgetLimit is reached */
  hardStop: boolean;
  /** Free-tier fallback configuration */
  freeTierFallback: FreeTierFallbackConfig;
}

export const DEFAULT_ACCOUNTING_CONFIG: AccountingConfig = {
  budgetLimit: 300,
  warnThreshold: 0.8,
  hardStop: true,
  freeTierFallback: DEFAULT_FREE_TIER_FALLBACK,
};

// ─── Request Records ──────────────────────────────────────────────────────────

export interface RequestRecord {
  timestamp: number;
  model: string;
  multiplierTier: MultiplierTier;
  /** The fractional premium request cost (MULTIPLIER_VALUES[multiplierTier]) */
  premiumRequestCost: number;
  stage: string;
  sessionId: string;
}

// ─── Budget State ─────────────────────────────────────────────────────────────

export interface BudgetState {
  totalPremiumRequests: number;
  records: RequestRecord[];
  budgetLimit: number;
  percentUsed: number;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface PremiumRequestSummary {
  byStage: Record<string, { count: number; premiumCost: number }>;
  totalRequests: number;
  totalPremiumCost: number;
  budgetPercentUsed: number;
}
