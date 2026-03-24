import type { AccountingConfig } from "./types.js";
import type { RequestTracker } from "./request-tracker.js";

export interface BudgetWarning {
  type: "warning";
  message: string;
  percentUsed: number;
}

export class BudgetExceededError extends Error {
  readonly used: number;
  readonly limit: number;
  readonly percentUsed: number;

  constructor(used: number, limit: number, percentUsed: number) {
    super(
      `Premium request budget exceeded: ${used}/${limit} requests used (${percentUsed.toFixed(1)}%). ` +
        "Adjust thresholds with `gsd settings` or use `/gsd-set-profile budget` to reduce model tier.",
    );
    this.name = "BudgetExceededError";
    this.used = used;
    this.limit = limit;
    this.percentUsed = percentUsed;
  }
}

export class BudgetGuard {
  private readonly _config: AccountingConfig;
  private readonly _tracker: RequestTracker;

  constructor(config: AccountingConfig, tracker: RequestTracker) {
    this._config = config;
    this._tracker = tracker;
  }

  /**
   * Pre-send budget check. Projects the new total after adding estimatedCost.
   *
   * Returns "ok" when below warn threshold.
   * Returns BudgetWarning when at/above warn threshold but below hard stop.
   * Throws BudgetExceededError when at/above hard stop and hardStop=true.
   * Returns BudgetWarning when at/above hard stop and hardStop=false (soft limit).
   * Always returns "ok" when budgetLimit=0 (unlimited / disabled).
   */
  check(estimatedCost: number): "ok" | BudgetWarning {
    const { budgetLimit, warnThreshold, hardStop } = this._config;

    // budgetLimit=0 means unlimited — budget enforcement disabled
    if (budgetLimit === 0) {
      return "ok";
    }

    const currentTotal = this._tracker.getState().totalPremiumRequests;
    const projected = currentTotal + estimatedCost;
    const percentUsed = (projected / budgetLimit) * 100;

    if (percentUsed >= 100) {
      if (hardStop) {
        throw new BudgetExceededError(
          Math.round(projected * 100) / 100,
          budgetLimit,
          Math.round(percentUsed * 10) / 10,
        );
      }
      // Soft limit — warn but don't block
      return {
        type: "warning",
        message:
          `Premium request budget reached: ${projected.toFixed(2)}/${budgetLimit} requests used ` +
          `(${percentUsed.toFixed(1)}%). Budget limit exceeded but soft mode is enabled.`,
        percentUsed,
      };
    }

    if (percentUsed >= warnThreshold * 100) {
      return {
        type: "warning",
        message:
          `Premium request budget at ${percentUsed.toFixed(1)}% (${projected.toFixed(2)}/${budgetLimit}). ` +
          "Consider using /gsd-set-profile budget.",
        percentUsed,
      };
    }

    return "ok";
  }
}
