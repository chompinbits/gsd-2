import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { AgentTool } from "@gsd/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { PiSessionBackend } from "./pi-backend.js";
import { bridgeToolToCopilot } from "./tool-bridge.js";
import { isSessionIdle, translateCopilotEvent } from "./event-translator.js";

describe("PiSessionBackend", () => {
	it("implements required SessionBackend shape", async () => {
		const backend = new PiSessionBackend();

		assert.equal(backend.name, "pi");
		assert.equal(typeof backend.initialize, "function");
		assert.equal(typeof backend.createSession, "function");
		assert.equal(typeof backend.resumeSession, "function");
		assert.equal(typeof backend.shutdown, "function");

		await backend.initialize();
		await backend.shutdown();
	});
});

describe("event translator", () => {
	it("maps tool.execution_start to tool_execution_start", () => {
		const translated = translateCopilotEvent({
			type: "tool.execution_start",
			data: { toolCallId: "tc1", toolName: "read", arguments: { path: "/tmp" } },
		});

		assert.deepEqual(translated, {
			type: "tool_execution_start",
			toolCallId: "tc1",
			toolName: "read",
			args: { path: "/tmp" },
		});
	});

	it("maps tool.execution_complete to tool_execution_end", () => {
		const translated = translateCopilotEvent({
			type: "tool.execution_complete",
			data: { toolCallId: "tc1", toolName: "read", success: true, result: "content" },
		});

		assert.deepEqual(translated, {
			type: "tool_execution_end",
			toolCallId: "tc1",
			toolName: "read",
			result: "content",
			isError: false,
		});
	});

	it("returns null for session.idle", () => {
		assert.equal(translateCopilotEvent({ type: "session.idle" }), null);
	});

	it("returns null for unknown events", () => {
		assert.equal(translateCopilotEvent({ type: "unknown.event" }), null);
	});

	it("reports session idle correctly", () => {
		assert.equal(isSessionIdle({ type: "session.idle" }), true);
		assert.equal(isSessionIdle({ type: "other" }), false);
	});
});

describe("dependency pinning", () => {
	it("pins @github/copilot-sdk to an exact version", () => {
		const packageJsonPath = new URL("../../../package.json", import.meta.url);
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
			dependencies?: Record<string, string>;
		};
		const version = packageJson.dependencies?.["@github/copilot-sdk"];

		assert.ok(version, "@github/copilot-sdk dependency must be present");
		assert.equal(version?.startsWith("^") ?? false, false);
		assert.equal(version?.startsWith("~") ?? false, false);
	});
});

describe("tool bridge", () => {
	it("returns a defined tool from AgentTool input", () => {
		const parameters = Type.Object({}, { additionalProperties: false });
		const mockTool: AgentTool<typeof parameters> = {
			name: "test_tool",
			label: "Test Tool",
			description: "A test tool",
			parameters,
			execute: async () => ({
				content: [{ type: "text", text: "result" }],
				details: {},
			}),
		};

		const bridged = bridgeToolToCopilot(mockTool, {});
		assert.ok(bridged);
	});
});
