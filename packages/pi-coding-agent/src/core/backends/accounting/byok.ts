import type { AccountingConfig, BudgetState } from "./types.js";
import type { ByokProviderConfig } from "../backend-interface.js";
import type { ByokConfig } from "../../settings-manager.js";

/**
 * Pure function: determines if premium quota is fully exhausted (hard_stop reached).
 * Per D-04: triggers at 100% (hard_stop), NOT at warn threshold.
 * Per D-05: called at session creation boundary only.
 */
export function isQuotaExhausted(
  budgetState: BudgetState,
  config: AccountingConfig,
): boolean {
  if (config.budgetLimit === 0) return false;
  if (!config.hardStop) return false;
  return budgetState.percentUsed >= 100;
}

/**
 * Pure function: converts ByokConfig to ByokProviderConfig for SDK injection.
 * Returns null if BYOK is not configured or not enabled.
 * Per D-09: called at session-creation time — no caching; always reads current config.
 */
export function resolveByokProvider(
  byokConfig: ByokConfig | undefined,
): ByokProviderConfig | null {
  if (!byokConfig || !byokConfig.enabled) return null;
  return {
    type: byokConfig.type,
    baseUrl: byokConfig.baseUrl,
    apiKey: byokConfig.apiKey,
  };
}
