import type {
  MultiplierTier,
  RequestRecord,
  BudgetState,
  PremiumRequestSummary,
} from "./types.js";
import { getMultiplierValue } from "./multipliers.js";

export class RequestTracker {
  private _records: RequestRecord[] = [];
  private _totalPremiumRequests = 0;
  private readonly _sessionId: string;
  private readonly _budgetLimit: number;

  constructor(sessionId: string, budgetLimit: number) {
    this._sessionId = sessionId;
    this._budgetLimit = budgetLimit;
  }

  /**
   * Records a single completion and accumulates its premium request cost.
   * Free-tier completions (0×) count as records but add zero premium cost.
   */
  record(model: string, stage: string, tier: MultiplierTier): void {
    const cost = getMultiplierValue(tier);
    const record: RequestRecord = {
      timestamp: Date.now(),
      model,
      multiplierTier: tier,
      premiumRequestCost: cost,
      stage,
      sessionId: this._sessionId,
    };
    this._records.push(record);
    this._totalPremiumRequests += cost;
  }

  /** Returns current accumulated budget state. */
  getState(): BudgetState {
    const percentUsed =
      this._budgetLimit === 0
        ? 0
        : (this._totalPremiumRequests / this._budgetLimit) * 100;
    return {
      totalPremiumRequests: this._totalPremiumRequests,
      records: [...this._records],
      budgetLimit: this._budgetLimit,
      percentUsed,
    };
  }

  /** Returns per-stage breakdown of request counts and premium costs. */
  getSummary(): PremiumRequestSummary {
    const byStage: Record<string, { count: number; premiumCost: number }> = {};
    for (const record of this._records) {
      const entry = byStage[record.stage] ?? { count: 0, premiumCost: 0 };
      entry.count += 1;
      entry.premiumCost += record.premiumRequestCost;
      byStage[record.stage] = entry;
    }
    const budgetPercentUsed =
      this._budgetLimit === 0
        ? 0
        : (this._totalPremiumRequests / this._budgetLimit) * 100;
    return {
      byStage,
      totalRequests: this._records.length,
      totalPremiumCost: this._totalPremiumRequests,
      budgetPercentUsed,
    };
  }

  /** Clears all accumulated records and totals. */
  reset(): void {
    this._records = [];
    this._totalPremiumRequests = 0;
  }

  /** Returns a serializable representation for persistence. */
  toJSON(): object {
    return {
      sessionId: this._sessionId,
      budgetLimit: this._budgetLimit,
      totalPremiumRequests: this._totalPremiumRequests,
      records: [...this._records],
    };
  }

  /** Restores a RequestTracker from persisted JSON data. */
  static fromJSON(data: unknown, sessionId: string): RequestTracker {
    const d = data as {
      budgetLimit?: number;
      totalPremiumRequests?: number;
      records?: RequestRecord[];
    };
    const tracker = new RequestTracker(sessionId, d.budgetLimit ?? 300);
    tracker._records = [...(d.records ?? [])];
    tracker._totalPremiumRequests =
      typeof d.totalPremiumRequests === "number"
        ? d.totalPremiumRequests
        : tracker._records.reduce((sum, r) => sum + r.premiumRequestCost, 0);
    return tracker;
  }
}
