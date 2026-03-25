/**
 * Switchover safety tests for config-driven backend selection.
 *
 * Validates that:
 * - sdk.ts reads settingsManager.getDefaultBackend() when options.backend is not set
 * - sdk.ts uses options.backend when explicitly provided, ignoring settings
 * - sdk.ts falls back to "pi" when neither options.backend nor settings.defaultBackend is set
 * - Settings interface includes defaultBackend field
 * - SettingsManager.getDefaultBackend/setDefaultBackend correctly manage the setting
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SettingsManager } from "../settings-manager.js";

const sdkSource = readFileSync(new URL("../sdk.ts", import.meta.url), "utf8");
const settingsSource = readFileSync(
	new URL("../settings-manager.ts", import.meta.url),
	"utf8",
);
const settingsSelectorSource = readFileSync(
	new URL("../../modes/interactive/components/settings-selector.ts", import.meta.url),
	"utf8",
);
const interactiveModeSource = readFileSync(
	new URL("../../modes/interactive/interactive-mode.ts", import.meta.url),
	"utf8",
);

describe("Config-driven backend selection — source shape", () => {
	it("sdk.ts reads settingsManager.getDefaultBackend() when options.backend is not set", () => {
		assert.ok(
			sdkSource.includes("settingsManager.getDefaultBackend()"),
			"sdk.ts must call settingsManager.getDefaultBackend() for config-driven backend selection",
		);
	});

	it("sdk.ts uses options.backend before consulting settings (explicit wins)", () => {
		assert.ok(
			sdkSource.includes("options.backend ??"),
			"sdk.ts must use options.backend ?? ... so explicit backend overrides settings",
		);
	});

	it('sdk.ts falls back to "pi" as the ultimate default', () => {
		assert.ok(
			sdkSource.includes('?? "pi"'),
			'sdk.ts must include ?? "pi" as the hardcoded fallback after settings',
		);
	});

	it("sdk.ts backend selection chain is options.backend ?? settingsManager.getDefaultBackend() ?? pi", () => {
		assert.ok(
			sdkSource.includes(
				'options.backend ?? settingsManager.getDefaultBackend() ?? "pi"',
			),
			"sdk.ts must implement full precedence chain: options.backend ?? settingsManager.getDefaultBackend() ?? \"pi\"",
		);
	});
});

describe("Settings defaultBackend field", () => {
	it('settings-manager.ts Settings interface contains defaultBackend?: "pi" | "copilot"', () => {
		assert.ok(
			settingsSource.includes('defaultBackend?: "pi" | "copilot"'),
			'Settings interface must contain defaultBackend?: "pi" | "copilot"',
		);
	});

	it("settings-manager.ts SettingsManager has getDefaultBackend() method", () => {
		assert.ok(
			settingsSource.includes("getDefaultBackend()"),
			"SettingsManager must have getDefaultBackend() method",
		);
	});

	it("settings-manager.ts SettingsManager has setDefaultBackend() method", () => {
		assert.ok(
			settingsSource.includes("setDefaultBackend("),
			"SettingsManager must have setDefaultBackend() method",
		);
	});

	it("/settings selector includes a default backend option", () => {
		assert.ok(
			settingsSelectorSource.includes('id: "default-backend"'),
			"settings selector must include a default-backend setting row",
		);
		assert.ok(
			settingsSelectorSource.includes('values: ["pi", "copilot"]'),
			"default-backend setting must allow pi and copilot values",
		);
	});

	it("interactive mode wires /settings default backend to SettingsManager", () => {
		assert.ok(
			interactiveModeSource.includes('defaultBackend: this.settingsManager.getDefaultBackend() ?? "pi"'),
			"interactive mode must pass defaultBackend into settings selector config",
		);
		assert.ok(
			interactiveModeSource.includes("this.settingsManager.setDefaultBackend(backend);"),
			"interactive mode must persist default backend changes",
		);
	});
});

describe("SettingsManager backend getter/setter", () => {
	it("getDefaultBackend() returns undefined when not configured", () => {
		const mgr = SettingsManager.inMemory();
		assert.equal(
			mgr.getDefaultBackend(),
			undefined,
			"getDefaultBackend() should return undefined when defaultBackend is not set",
		);
	});

	it('setDefaultBackend("copilot") persists and getDefaultBackend() returns "copilot"', () => {
		const mgr = SettingsManager.inMemory();
		mgr.setDefaultBackend("copilot");
		assert.equal(
			mgr.getDefaultBackend(),
			"copilot",
			'after setDefaultBackend("copilot"), getDefaultBackend() must return "copilot"',
		);
	});

	it('setDefaultBackend("pi") reverts to pi after being set to copilot', () => {
		const mgr = SettingsManager.inMemory();
		mgr.setDefaultBackend("copilot");
		mgr.setDefaultBackend("pi");
		assert.equal(
			mgr.getDefaultBackend(),
			"pi",
			'after reverting to setDefaultBackend("pi"), getDefaultBackend() must return "pi"',
		);
	});
});
