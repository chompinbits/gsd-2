import { readFileSync } from "node:fs";
import type { AccountingConfig } from "./types.js";
import { DEFAULT_ACCOUNTING_CONFIG } from "./types.js";

/**
 * Loads AccountingConfig from an optional config.json file.
 *
 * Expected config.json shape (D-17):
 *   { "premium_request": { "budget_limit": number, "warn_threshold": number, "hard_stop": boolean } }
 *
 * Missing file, missing section, or invalid values all fall back to DEFAULT_ACCOUNTING_CONFIG.
 */
export function loadAccountingConfig(configPath?: string): AccountingConfig {
  if (!configPath) {
    return { ...DEFAULT_ACCOUNTING_CONFIG };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return { ...DEFAULT_ACCOUNTING_CONFIG };
  }

  const section = (raw as Record<string, unknown>).premium_request;
  if (!section || typeof section !== "object") {
    return { ...DEFAULT_ACCOUNTING_CONFIG };
  }

  const s = section as Record<string, unknown>;

  const budgetLimit =
    typeof s.budget_limit === "number" && s.budget_limit >= 0
      ? s.budget_limit
      : DEFAULT_ACCOUNTING_CONFIG.budgetLimit;

  const warnThreshold =
    typeof s.warn_threshold === "number" &&
    s.warn_threshold >= 0 &&
    s.warn_threshold <= 1
      ? s.warn_threshold
      : DEFAULT_ACCOUNTING_CONFIG.warnThreshold;

  const hardStop =
    typeof s.hard_stop === "boolean"
      ? s.hard_stop
      : DEFAULT_ACCOUNTING_CONFIG.hardStop;

  return { budgetLimit, warnThreshold, hardStop };
}

/**
 * Merges CLI flag overrides onto a config object (D-18).
 * Only defined (non-undefined) override fields are applied.
 * Returns a new config object — the input is not mutated.
 */
export function mergeWithCliOverrides(
  config: AccountingConfig,
  overrides: Partial<AccountingConfig>,
): AccountingConfig {
  const result = { ...config };
  if (overrides.budgetLimit !== undefined) result.budgetLimit = overrides.budgetLimit;
  if (overrides.warnThreshold !== undefined) result.warnThreshold = overrides.warnThreshold;
  if (overrides.hardStop !== undefined) result.hardStop = overrides.hardStop;
  return result;
}

/** Returns a fresh copy of DEFAULT_ACCOUNTING_CONFIG (D-19). */
export function resetConfig(): AccountingConfig {
  return { ...DEFAULT_ACCOUNTING_CONFIG };
}
