/**
 * Unit tests for all accounting modules.
 * Covers: multipliers, stage-router, request-tracker, budget-guard, config
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MULTIPLIER_VALUES, DEFAULT_ACCOUNTING_CONFIG } from "./types.js";
import {
  getModelMultiplier,
  getMultiplierValue,
} from "./multipliers.js";
import {
  getStageMultiplierTier,
  resolveEffectiveTier,
} from "./stage-router.js";
import { RequestTracker } from "./request-tracker.js";
import { BudgetGuard, BudgetExceededError } from "./budget-guard.js";
import { loadAccountingConfig, mergeWithCliOverrides, resetConfig } from "./config.js";

// ─── 1. multipliers.ts ────────────────────────────────────────────────────────

describe("getModelMultiplier", () => {
  it("returns 'free' for gpt-4o", () => {
    assert.equal(getModelMultiplier("gpt-4o"), "free");
  });

  it("returns 'low' for claude-haiku-4-5", () => {
    assert.equal(getModelMultiplier("claude-haiku-4-5"), "low");
  });

  it("returns 'standard' for claude-sonnet-4-6", () => {
    assert.equal(getModelMultiplier("claude-sonnet-4-6"), "standard");
  });

  it("defaults to 'standard' for unknown models", () => {
    assert.equal(getModelMultiplier("unknown-fancy-model"), "standard");
  });

  it("strips provider prefix before lookup", () => {
    assert.equal(getModelMultiplier("openai/gpt-4o"), "free");
    assert.equal(getModelMultiplier("anthropic/claude-haiku-4-5"), "low");
  });
});

describe("getMultiplierValue", () => {
  it("returns 0 for free tier", () => {
    assert.equal(getMultiplierValue("free"), 0);
  });

  it("returns 0.33 for low tier", () => {
    assert.equal(getMultiplierValue("low"), MULTIPLIER_VALUES.low);
    assert.equal(getMultiplierValue("low"), 0.33);
  });

  it("returns 1 for standard tier", () => {
    assert.equal(getMultiplierValue("standard"), 1);
  });
});

// ─── 2. stage-router.ts ───────────────────────────────────────────────────────

describe("getStageMultiplierTier", () => {
  it("returns 'free' for discuss-phase", () => {
    assert.equal(getStageMultiplierTier("discuss-phase"), "free");
  });

  it("returns 'free' for verify-work", () => {
    assert.equal(getStageMultiplierTier("verify-work"), "free");
  });

  it("returns 'low' for plan-check", () => {
    assert.equal(getStageMultiplierTier("plan-check"), "low");
  });

  it("returns 'low' for validate-phase", () => {
    assert.equal(getStageMultiplierTier("validate-phase"), "low");
  });

  it("returns 'standard' for plan-phase", () => {
    assert.equal(getStageMultiplierTier("plan-phase"), "standard");
  });

  it("returns 'standard' for research-phase", () => {
    assert.equal(getStageMultiplierTier("research-phase"), "standard");
  });

  it("returns 'standard' for execute-task", () => {
    assert.equal(getStageMultiplierTier("execute-task"), "standard");
  });

  it("defaults to 'standard' for unknown stages", () => {
    assert.equal(getStageMultiplierTier("unknown-stage"), "standard");
  });
});

describe("resolveEffectiveTier", () => {
  it("returns stageTier unchanged when no hint", () => {
    assert.equal(resolveEffectiveTier("standard"), "standard");
    assert.equal(resolveEffectiveTier("low"), "low");
    assert.equal(resolveEffectiveTier("free"), "free");
  });

  it("returns stageTier unchanged for 'high' hint", () => {
    assert.equal(resolveEffectiveTier("standard", "high"), "standard");
  });

  it("forces 'free' for 'low' hint regardless of stage tier", () => {
    assert.equal(resolveEffectiveTier("standard", "low"), "free");
    assert.equal(resolveEffectiveTier("low", "low"), "free");
    assert.equal(resolveEffectiveTier("free", "low"), "free");
  });

  it("caps at 'low' for 'medium' hint — standard → low", () => {
    assert.equal(resolveEffectiveTier("standard", "medium"), "low");
  });

  it("stays 'low' for 'medium' hint — not over-downgraded", () => {
    assert.equal(resolveEffectiveTier("low", "medium"), "low");
  });

  it("stays 'free' for 'medium' hint — already at minimum", () => {
    assert.equal(resolveEffectiveTier("free", "medium"), "free");
  });
});

// ─── 3. request-tracker.ts ────────────────────────────────────────────────────

describe("RequestTracker", () => {
  it("starts with zero totalPremiumRequests", () => {
    const tracker = new RequestTracker("sess-1", 300);
    const state = tracker.getState();
    assert.equal(state.totalPremiumRequests, 0);
    assert.equal(state.records.length, 0);
  });

  it("record() increments totalPremiumRequests by multiplier value", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    assert.equal(tracker.getState().totalPremiumRequests, 1);
  });

  it("record() with free tier adds count (record) but zero premium cost", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("gpt-4o", "discuss-phase", "free");
    const state = tracker.getState();
    assert.equal(state.totalPremiumRequests, 0);
    assert.equal(state.records.length, 1);
    assert.equal(state.records[0].premiumRequestCost, 0);
  });

  it("record() with low tier adds 0.33 premium cost", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-haiku-4-5", "plan-check", "low");
    assert.equal(tracker.getState().totalPremiumRequests, 0.33);
  });

  it("accumulates costs across multiple records", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard"); // +1
    tracker.record("claude-haiku-4-5", "plan-check", "low");          // +0.33
    tracker.record("gpt-4o", "discuss-phase", "free");                 // +0
    const state = tracker.getState();
    assert.equal(state.records.length, 3);
    // 1 + 0.33 = 1.33 (floating point safe for these values)
    assert.ok(Math.abs(state.totalPremiumRequests - 1.33) < 0.0001);
  });

  it("getState() returns correct percentUsed", () => {
    const tracker = new RequestTracker("sess-1", 100);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard"); // 1 of 100
    const state = tracker.getState();
    assert.equal(state.percentUsed, 1); // 1%
    assert.equal(state.budgetLimit, 100);
  });

  it("getState() handles budgetLimit=0 as 0% (unlimited)", () => {
    const tracker = new RequestTracker("sess-1", 0);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    assert.equal(tracker.getState().percentUsed, 0);
  });

  it("getSummary() groups records by stage", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    tracker.record("claude-haiku-4-5", "plan-check", "low");
    const summary = tracker.getSummary();
    assert.equal(summary.totalRequests, 3);
    assert.equal(summary.byStage["execute-task"].count, 2);
    assert.equal(summary.byStage["execute-task"].premiumCost, 2);
    assert.equal(summary.byStage["plan-check"].count, 1);
    assert.ok(Math.abs(summary.byStage["plan-check"].premiumCost - 0.33) < 0.0001);
  });

  it("reset() clears all accumulated data", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    tracker.reset();
    const state = tracker.getState();
    assert.equal(state.totalPremiumRequests, 0);
    assert.equal(state.records.length, 0);
  });

  it("toJSON() / fromJSON() round-trips preserve state", () => {
    const tracker = new RequestTracker("sess-1", 300);
    tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    tracker.record("gpt-4o", "discuss-phase", "free");
    const json = tracker.toJSON();
    const restored = RequestTracker.fromJSON(json, "sess-1");
    const origState = tracker.getState();
    const restoredState = restored.getState();
    assert.equal(restoredState.totalPremiumRequests, origState.totalPremiumRequests);
    assert.equal(restoredState.records.length, origState.records.length);
    assert.equal(restoredState.budgetLimit, origState.budgetLimit);
  });
});

// ─── 4. budget-guard.ts ───────────────────────────────────────────────────────

describe("BudgetGuard", () => {
  function makeGuard(
    budgetLimit: number,
    warnThreshold: number,
    hardStop: boolean,
    existingCost = 0,
  ) {
    const tracker = new RequestTracker("sess-guard", budgetLimit);
    // Inject existing cost via standard records
    for (let i = 0; i < existingCost; i++) {
      tracker.record("claude-sonnet-4-6", "execute-task", "standard");
    }
    const config = { budgetLimit, warnThreshold, hardStop };
    return new BudgetGuard(config, tracker);
  }

  it("returns 'ok' when well under warn threshold", () => {
    const guard = makeGuard(300, 0.8, true, 0);
    assert.equal(guard.check(1), "ok");
  });

  it("returns warning when projected cost crosses warn threshold", () => {
    // 80% of 10 = 8. If existing=0 and estimatedCost=9, projected=9 → 90% → warning
    const guard = makeGuard(10, 0.8, true, 0);
    const result = guard.check(9);
    assert.notEqual(result, "ok");
    assert.equal((result as { type: string }).type, "warning");
  });

  it("throws BudgetExceededError when at hardStop limit with hardStop=true", () => {
    // budgetLimit=10, existing=0, estimated=10 → 100%
    const guard = makeGuard(10, 0.8, true, 0);
    assert.throws(
      () => guard.check(10),
      (err: unknown) => err instanceof BudgetExceededError,
    );
  });

  it("BudgetExceededError includes used count, limit, and actionable guidance", () => {
    const guard = makeGuard(10, 0.8, true, 0);
    let caught: BudgetExceededError | undefined;
    try {
      guard.check(10);
    } catch (e) {
      caught = e as BudgetExceededError;
    }
    assert.ok(caught instanceof BudgetExceededError);
    assert.ok(caught.message.includes("10"));  // limit
    assert.ok(caught.message.includes("gsd settings") || caught.message.includes("gsd-set-profile"));
    assert.equal(caught.limit, 10);
  });

  it("returns warning (not throws) at hard stop when hardStop=false (soft limit)", () => {
    const guard = makeGuard(10, 0.8, false, 0);
    const result = guard.check(10);
    assert.notEqual(result, "ok");
    assert.equal((result as { type: string }).type, "warning");
  });

  it("handles budgetLimit=0 as unlimited — always returns 'ok'", () => {
    const guard = makeGuard(0, 0.8, true, 0);
    assert.equal(guard.check(9999), "ok");
  });
});

describe("BudgetExceededError", () => {
  it("is an instance of Error", () => {
    const err = new BudgetExceededError(10, 10, 100);
    assert.ok(err instanceof Error);
    assert.equal(err.name, "BudgetExceededError");
  });

  it("carries used, limit, percentUsed properties", () => {
    const err = new BudgetExceededError(8, 10, 80);
    assert.equal(err.used, 8);
    assert.equal(err.limit, 10);
    assert.equal(err.percentUsed, 80);
  });
});

// ─── 5. config.ts ─────────────────────────────────────────────────────────────

describe("loadAccountingConfig", () => {
  it("returns DEFAULT_ACCOUNTING_CONFIG when no path provided", () => {
    const config = loadAccountingConfig();
    assert.deepEqual(config, DEFAULT_ACCOUNTING_CONFIG);
  });

  it("returns defaults when config file does not exist", () => {
    const config = loadAccountingConfig("/nonexistent/path/config.json");
    assert.deepEqual(config, DEFAULT_ACCOUNTING_CONFIG);
  });

  it("returns defaults when file has no premium_request section", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-test-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify({ other_section: { foo: 1 } }));
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.deepEqual(config, DEFAULT_ACCOUNTING_CONFIG);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("merges premium_request section over defaults", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({
        premium_request: {
          budget_limit: 500,
          warn_threshold: 0.7,
          hard_stop: false,
        },
      }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.equal(config.budgetLimit, 500);
      assert.equal(config.warnThreshold, 0.7);
      assert.equal(config.hardStop, false);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("falls back to defaults for invalid field values", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({
        premium_request: {
          budget_limit: -1,       // invalid: negative
          warn_threshold: 1.5,    // invalid: > 1
          hard_stop: "yes",       // invalid: not boolean
        },
      }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.equal(config.budgetLimit, DEFAULT_ACCOUNTING_CONFIG.budgetLimit);
      assert.equal(config.warnThreshold, DEFAULT_ACCOUNTING_CONFIG.warnThreshold);
      assert.equal(config.hardStop, DEFAULT_ACCOUNTING_CONFIG.hardStop);
    } finally {
      unlinkSync(tmpFile);
    }
  });
});

describe("mergeWithCliOverrides", () => {
  it("applies defined overrides over config", () => {
    const base = { budgetLimit: 300, warnThreshold: 0.8, hardStop: true };
    const result = mergeWithCliOverrides(base, { budgetLimit: 500 });
    assert.equal(result.budgetLimit, 500);
    assert.equal(result.warnThreshold, 0.8); // unchanged
    assert.equal(result.hardStop, true);     // unchanged
  });

  it("ignores undefined override values (does not clobber config)", () => {
    const base = { budgetLimit: 300, warnThreshold: 0.8, hardStop: true };
    const result = mergeWithCliOverrides(base, { budgetLimit: undefined });
    assert.equal(result.budgetLimit, 300); // not overridden
  });

  it("returns a new object (immutable merge)", () => {
    const base = { budgetLimit: 300, warnThreshold: 0.8, hardStop: true };
    const result = mergeWithCliOverrides(base, { budgetLimit: 100 });
    assert.notEqual(result, base);
    assert.equal(base.budgetLimit, 300); // original unchanged
  });

  it("applies all three overrides together", () => {
    const base = { budgetLimit: 300, warnThreshold: 0.8, hardStop: true };
    const result = mergeWithCliOverrides(base, {
      budgetLimit: 100,
      warnThreshold: 0.5,
      hardStop: false,
    });
    assert.equal(result.budgetLimit, 100);
    assert.equal(result.warnThreshold, 0.5);
    assert.equal(result.hardStop, false);
  });
});

describe("resetConfig", () => {
  it("returns DEFAULT_ACCOUNTING_CONFIG values", () => {
    const config = resetConfig();
    assert.deepEqual(config, DEFAULT_ACCOUNTING_CONFIG);
  });

  it("returns a new object each call (not the same reference)", () => {
    const a = resetConfig();
    const b = resetConfig();
    assert.notEqual(a, b);
  });
});
