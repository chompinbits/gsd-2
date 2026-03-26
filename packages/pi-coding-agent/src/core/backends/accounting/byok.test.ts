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
