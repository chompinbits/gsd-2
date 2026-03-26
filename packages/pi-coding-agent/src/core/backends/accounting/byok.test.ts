/**
 * Unit tests for BYOK (Bring Your Own Key) fallback logic.
 * Covers: ByokProviderConfig type shape, ByokConfig type shape, Settings.byok field,
 * SettingsManager.getByokConfig/setByokConfig, isQuotaExhausted, resolveByokProvider
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isQuotaExhausted, resolveByokProvider } from "./byok.js";
import type { ByokConfig } from "../../settings-manager.js";
import { SettingsManager } from "../../settings-manager.js";
import type { AccountingConfig, BudgetState } from "./types.js";
import { DEFAULT_ACCOUNTING_CONFIG } from "./types.js";
import { formatPremiumSummary } from "./telemetry.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBudgetState(percentUsed: number, budgetLimit = 300): BudgetState {
  const totalPremiumRequests = (percentUsed / 100) * budgetLimit;
  return {
    totalPremiumRequests,
    records: [],
    budgetLimit,
    percentUsed,
  };
}

function makeConfig(overrides?: Partial<AccountingConfig>): AccountingConfig {
  return { ...DEFAULT_ACCOUNTING_CONFIG, ...overrides };
}

// ─── 1. Source-shape: ByokProviderConfig in backend-interface.ts ──────────────

describe("ByokProviderConfig — source shape in backend-interface.ts", () => {
  const src = readFileSync(
    "packages/pi-coding-agent/src/core/backends/backend-interface.ts",
    "utf-8",
  );

  it("exports ByokProviderConfig interface", () => {
    assert.match(src, /export interface ByokProviderConfig/);
  });

  it("has type field with union of openai | anthropic | azure", () => {
    assert.match(src, /type:\s*"openai"\s*\|\s*"anthropic"\s*\|\s*"azure"/);
  });

  it("has baseUrl: string field", () => {
    assert.match(src, /baseUrl:\s*string/);
  });

  it("has apiKey: string field", () => {
    assert.match(src, /apiKey:\s*string/);
  });

  it("BackendConfig has optional provider field", () => {
    assert.match(src, /provider\?:\s*ByokProviderConfig/);
  });
});

// ─── 2. Source-shape: ByokConfig in settings-manager.ts ──────────────────────

describe("ByokConfig — source shape in settings-manager.ts", () => {
  const settingsSrc = readFileSync(
    "packages/pi-coding-agent/src/core/settings-manager.ts",
    "utf-8",
  );

  it("exports ByokConfig interface", () => {
    assert.match(settingsSrc, /export interface ByokConfig/);
  });

  it("Settings interface has optional byok field", () => {
    assert.match(settingsSrc, /byok\?:\s*ByokConfig/);
  });

  it("SettingsManager has getByokConfig method", () => {
    assert.match(settingsSrc, /getByokConfig/);
  });

  it("SettingsManager has setByokConfig method", () => {
    assert.match(settingsSrc, /setByokConfig/);
  });
});

// ─── 3. SettingsManager BYOK get/set ─────────────────────────────────────────

describe("SettingsManager — getByokConfig / setByokConfig", () => {
  it("returns undefined when byok not set", () => {
    const sm = SettingsManager.inMemory();
    assert.equal(sm.getByokConfig(), undefined);
  });

  it("persists and returns BYOK config after setByokConfig", () => {
    const sm = SettingsManager.inMemory();
    sm.setByokConfig({
      enabled: true,
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o",
    });
    const config = sm.getByokConfig();
    assert.equal(config?.enabled, true);
    assert.equal(config?.type, "openai");
    assert.equal(config?.baseUrl, "https://api.openai.com/v1");
    assert.equal(config?.apiKey, "sk-test");
    assert.equal(config?.model, "gpt-4o");
  });

  it("can update BYOK config with a second setByokConfig call", () => {
    const sm = SettingsManager.inMemory();
    sm.setByokConfig({
      enabled: true,
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-original",
      model: "gpt-4o",
    });
    sm.setByokConfig({
      enabled: true,
      type: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-updated",
      model: "claude-3-5-sonnet",
    });
    const config = sm.getByokConfig();
    assert.equal(config?.type, "anthropic");
    assert.equal(config?.apiKey, "sk-updated");
  });
});

// ─── 4. isQuotaExhausted ─────────────────────────────────────────────────────

describe("isQuotaExhausted", () => {
  it("returns true when percentUsed >= 100 and hardStop is true", () => {
    const state = makeBudgetState(100);
    const config = makeConfig({ hardStop: true });
    assert.equal(isQuotaExhausted(state, config), true);
  });

  it("returns true when percentUsed > 100 (overrun) and hardStop is true", () => {
    const state = makeBudgetState(105);
    const config = makeConfig({ hardStop: true });
    assert.equal(isQuotaExhausted(state, config), true);
  });

  it("returns false when percentUsed < 100", () => {
    const state = makeBudgetState(99);
    const config = makeConfig({ hardStop: true });
    assert.equal(isQuotaExhausted(state, config), false);
  });

  it("returns false when percentUsed is at warn threshold (80%) but not at 100%", () => {
    const state = makeBudgetState(80);
    const config = makeConfig({ hardStop: true });
    assert.equal(isQuotaExhausted(state, config), false);
  });

  it("returns false when budgetLimit === 0 (unlimited)", () => {
    const state = makeBudgetState(100, 0);
    const config = makeConfig({ budgetLimit: 0, hardStop: true });
    assert.equal(isQuotaExhausted(state, config), false);
  });

  it("returns false when hardStop is false (soft limit)", () => {
    const state = makeBudgetState(100);
    const config = makeConfig({ hardStop: false });
    assert.equal(isQuotaExhausted(state, config), false);
  });
});

// ─── 5. resolveByokProvider ───────────────────────────────────────────────────

describe("resolveByokProvider", () => {
  const enabledByok: ByokConfig = {
    enabled: true,
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-4o",
  };

  it("returns ByokProviderConfig when byok is enabled", () => {
    const result = resolveByokProvider(enabledByok);
    assert.deepEqual(result, {
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
    });
  });

  it("does not include model in the returned ByokProviderConfig", () => {
    const result = resolveByokProvider(enabledByok);
    assert.ok(result !== null);
    assert.ok(!("model" in result));
  });

  it("returns null when byok is disabled", () => {
    assert.equal(resolveByokProvider({ ...enabledByok, enabled: false }), null);
  });

  it("returns null when byokConfig is undefined", () => {
    assert.equal(resolveByokProvider(undefined), null);
  });

  it("maps anthropic type correctly", () => {
    const result = resolveByokProvider({
      enabled: true,
      type: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-test",
      model: "claude-3-5-sonnet",
    });
    assert.deepEqual(result, {
      type: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-test",
    });
  });

  it("maps azure type correctly", () => {
    const result = resolveByokProvider({
      enabled: true,
      type: "azure",
      baseUrl: "https://mydeployment.openai.azure.com",
      apiKey: "azure-api-key",
      model: "gpt-4o",
    });
    assert.deepEqual(result, {
      type: "azure",
      baseUrl: "https://mydeployment.openai.azure.com",
      apiKey: "azure-api-key",
    });
  });
});

// ─── 6. CopilotSessionBackend BYOK wiring — source shape ────────────────────

describe("CopilotSessionBackend — BYOK wiring source shape", () => {
  const backendSrc = readFileSync(
    "packages/pi-coding-agent/src/core/backends/copilot-backend.ts",
    "utf-8",
  );

  it("imports isQuotaExhausted and resolveByokProvider from byok.js", () => {
    assert.match(backendSrc, /import.*isQuotaExhausted.*resolveByokProvider.*\.\/accounting\/byok\.js/);
  });

  it("has _applyByokIfExhausted private method", () => {
    assert.match(backendSrc, /_applyByokIfExhausted/);
  });

  it("has _byokActivations field", () => {
    assert.match(backendSrc, /_byokActivations/);
  });

  it("has getByokActivations method", () => {
    assert.match(backendSrc, /getByokActivations/);
  });

  it("has setSettingsManager method", () => {
    assert.match(backendSrc, /setSettingsManager/);
  });

  it("createSession calls _applyByokIfExhausted", () => {
    assert.match(backendSrc, /_applyByokIfExhausted/);
  });

  it("emits BYOK activation notification string", () => {
    assert.match(backendSrc, /\[gsd:accounting\].*BYOK provider active:/);
  });

  it("spreads provider into session config", () => {
    assert.match(backendSrc, /effectiveConfig\.provider.*provider.*effectiveConfig\.provider/s);
  });
});

// ─── 7. formatPremiumSummary — byokActive indicator ─────────────────────────

describe("formatPremiumSummary — byokActive indicator", () => {
  const summary = {
    byStage: { plan: { count: 3, premiumCost: 3.0 } },
    totalRequests: 3,
    totalPremiumCost: 3.0,
    budgetPercentUsed: 100,
  };

  it("does not include BYOK line when byokActive is false", () => {
    const output = formatPremiumSummary(summary, DEFAULT_ACCOUNTING_CONFIG, [], false);
    assert.ok(!output.includes("BYOK fallback"));
  });

  it("does not include BYOK line when byokActive is undefined (backward compat)", () => {
    const output = formatPremiumSummary(summary, DEFAULT_ACCOUNTING_CONFIG);
    assert.ok(!output.includes("BYOK fallback"));
  });

  it("includes BYOK line when byokActive is true", () => {
    const output = formatPremiumSummary(summary, DEFAULT_ACCOUNTING_CONFIG, [], true);
    assert.ok(output.includes("BYOK fallback was active this session"));
  });

  it("includes BYOK line after downgrades section", () => {
    const downgrades = [{ originalModel: "claude-sonnet", downgradedTo: "gpt-4o-mini", percentUsed: 80 }];
    const output = formatPremiumSummary(summary, DEFAULT_ACCOUNTING_CONFIG, downgrades, true);
    const byokIdx = output.indexOf("BYOK fallback");
    const downgradeIdx = output.indexOf("Model downgrades:");
    assert.ok(byokIdx > downgradeIdx);
  });
});
