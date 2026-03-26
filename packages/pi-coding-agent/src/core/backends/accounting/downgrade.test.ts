/**
 * Unit tests for downgrade logic (downgrade.ts, free_tier_fallback config).
 * Covers: suggestDowngrade, FREE_TIER_CANDIDATES, loadAccountingConfig (free_tier_fallback)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  suggestDowngrade,
  FREE_TIER_CANDIDATES,
  type DowngradeSuggestion,
} from "./downgrade.js";
import {
  DEFAULT_ACCOUNTING_CONFIG,
  type AccountingConfig,
  type BudgetState,
  type FreeTierFallbackConfig,
  DEFAULT_FREE_TIER_FALLBACK,
} from "./types.js";
import { MODEL_MULTIPLIER_MAP } from "./multipliers.js";
import { loadAccountingConfig } from "./config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBudgetState(totalPremiumRequests: number, budgetLimit: number): BudgetState {
  return {
    totalPremiumRequests,
    records: [],
    budgetLimit,
    percentUsed: budgetLimit > 0 ? (totalPremiumRequests / budgetLimit) * 100 : 0,
  };
}

function makeConfig(overrides?: Partial<AccountingConfig>): AccountingConfig {
  return { ...DEFAULT_ACCOUNTING_CONFIG, ...overrides };
}

// ─── 1. suggestDowngrade — threshold behavior ─────────────────────────────────

describe("suggestDowngrade — threshold behavior", () => {
  it("returns null when budget is below warn threshold (50% used, 80% threshold)", () => {
    const budget = makeBudgetState(150, 300); // 50% used
    const config = makeConfig(); // warnThreshold: 0.8
    assert.equal(suggestDowngrade(budget, config), null);
  });

  it("returns DowngradeSuggestion when budget is at warn threshold (80% used, 80% threshold)", () => {
    const budget = makeBudgetState(240, 300); // 80% used
    const config = makeConfig();
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.ok(result!.modelId.length > 0);
    assert.ok(result!.reason.length > 0);
    assert.equal(result!.percentUsed, 80);
  });

  it("returns DowngradeSuggestion when budget is above warn threshold (90% used, 80% threshold)", () => {
    const budget = makeBudgetState(270, 300); // 90% used
    const config = makeConfig();
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.ok(FREE_TIER_CANDIDATES.includes(result!.modelId));
  });

  it("returns null for hard_stop policy when budget is at warn threshold (80%)", () => {
    const budget = makeBudgetState(240, 300); // 80% used
    const config = makeConfig({
      freeTierFallback: { enabled: true, thresholdPolicy: "hard_stop" },
    });
    assert.equal(suggestDowngrade(budget, config), null);
  });

  it("returns DowngradeSuggestion for hard_stop policy at 100%", () => {
    const budget = makeBudgetState(300, 300); // 100% used
    const config = makeConfig({
      freeTierFallback: { enabled: true, thresholdPolicy: "hard_stop" },
    });
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.ok(FREE_TIER_CANDIDATES.includes(result!.modelId));
  });

  it("returns null for hard_stop policy at 99%", () => {
    const budget = makeBudgetState(297, 300); // 99% used
    const config = makeConfig({
      freeTierFallback: { enabled: true, thresholdPolicy: "hard_stop" },
    });
    assert.equal(suggestDowngrade(budget, config), null);
  });
});

// ─── 2. suggestDowngrade — config respect ─────────────────────────────────────

describe("suggestDowngrade — config respect", () => {
  it("returns null when enabled is false, even at 100% budget", () => {
    const budget = makeBudgetState(300, 300); // 100% used
    const config = makeConfig({
      freeTierFallback: { enabled: false, thresholdPolicy: "warn" },
    });
    assert.equal(suggestDowngrade(budget, config), null);
  });

  it("returns null when budgetLimit is 0 (unlimited)", () => {
    const budget = makeBudgetState(999, 0);
    const config = makeConfig({ budgetLimit: 0 });
    assert.equal(suggestDowngrade(budget, config), null);
  });
});

// ─── 3. suggestDowngrade — candidate selection ────────────────────────────────

describe("suggestDowngrade — candidate selection", () => {
  it("returned modelId is from FREE_TIER_CANDIDATES", () => {
    const budget = makeBudgetState(270, 300); // 90% used
    const config = makeConfig();
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.ok(FREE_TIER_CANDIDATES.includes(result!.modelId));
  });

  it("result includes percentUsed matching budget state", () => {
    const budget = makeBudgetState(270, 300); // exactly 90%
    const config = makeConfig();
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.equal(result!.percentUsed, 90);
  });

  it("result reason string contains percentUsed", () => {
    const budget = makeBudgetState(270, 300); // 90%
    const config = makeConfig();
    const result = suggestDowngrade(budget, config);
    assert.notEqual(result, null);
    assert.ok(result!.reason.includes("90"));
  });
});

// ─── 4. FREE_TIER_CANDIDATES ─────────────────────────────────────────────────

describe("FREE_TIER_CANDIDATES", () => {
  it("is non-empty", () => {
    assert.ok(FREE_TIER_CANDIDATES.length > 0);
  });

  it("contains only models with tier 'free' from MODEL_MULTIPLIER_MAP", () => {
    for (const modelId of FREE_TIER_CANDIDATES) {
      assert.equal(
        MODEL_MULTIPLIER_MAP[modelId],
        "free",
        `Expected ${modelId} to be 'free' in MODEL_MULTIPLIER_MAP`,
      );
    }
  });

  it("contains all 'free' tier models from MODEL_MULTIPLIER_MAP", () => {
    const expectedFreeModels = Object.entries(MODEL_MULTIPLIER_MAP)
      .filter(([, tier]) => tier === "free")
      .map(([id]) => id);
    assert.equal(FREE_TIER_CANDIDATES.length, expectedFreeModels.length);
    for (const modelId of expectedFreeModels) {
      assert.ok(
        FREE_TIER_CANDIDATES.includes(modelId),
        `Expected ${modelId} to be in FREE_TIER_CANDIDATES`,
      );
    }
  });

  it("is sorted alphabetically (deterministic order)", () => {
    const sorted = [...FREE_TIER_CANDIDATES].sort();
    assert.deepEqual([...FREE_TIER_CANDIDATES], sorted);
  });
});

// ─── 5. loadAccountingConfig — free_tier_fallback parsing ─────────────────────

describe("loadAccountingConfig — free_tier_fallback parsing", () => {
  it("defaults freeTierFallback to enabled:true, thresholdPolicy:'warn'", () => {
    const config = loadAccountingConfig();
    assert.deepEqual(config.freeTierFallback, DEFAULT_FREE_TIER_FALLBACK);
  });

  it("defaults freeTierFallback when config file has no free_tier_fallback section", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-downgrade-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({ premium_request: { budget_limit: 100, warn_threshold: 0.9 } }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.deepEqual(config.freeTierFallback, DEFAULT_FREE_TIER_FALLBACK);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("parses enabled:false correctly", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-downgrade-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({
        premium_request: {
          free_tier_fallback: { enabled: false, threshold_policy: "warn" },
        },
      }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.equal(config.freeTierFallback.enabled, false);
      assert.equal(config.freeTierFallback.thresholdPolicy, "warn");
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("parses threshold_policy:'hard_stop' correctly", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-downgrade-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({
        premium_request: {
          free_tier_fallback: { enabled: true, threshold_policy: "hard_stop" },
        },
      }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.equal(config.freeTierFallback.enabled, true);
      assert.equal(config.freeTierFallback.thresholdPolicy, "hard_stop");
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("ignores invalid threshold_policy value and defaults to 'warn'", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmpFile = join(tmpdir(), `gsd-downgrade-test-${Date.now()}.json`);
    writeFileSync(
      tmpFile,
      JSON.stringify({
        premium_request: {
          free_tier_fallback: { enabled: true, threshold_policy: "invalid_value" },
        },
      }),
    );
    try {
      const config = loadAccountingConfig(tmpFile);
      assert.equal(config.freeTierFallback.thresholdPolicy, "warn");
    } finally {
      unlinkSync(tmpFile);
    }
  });
});
