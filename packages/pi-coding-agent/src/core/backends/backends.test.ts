import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { AgentTool } from "@gsd/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { CopilotSessionBackend } from "./copilot-backend.js";
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
		const mockTool: AgentTool<any> = {
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

describe("copilot session routing", () => {
	it("sdk.ts copilot branch calls copilotBackend.createSession", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("copilotBackend.createSession("),
			"sdk.ts must call copilotBackend.createSession — not discard with void",
		);
	});

	it("sdk.ts copilot branch does not discard backend", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(!sdkSource.includes("void copilotBackend"), "sdk.ts must not discard copilotBackend with void");
	});

	it("CreateAgentSessionResult exposes copilotSessionHandle field", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("copilotSessionHandle"),
			"CreateAgentSessionResult must expose copilotSessionHandle",
		);
	});

	it("CopilotSessionBackend.createSession returns BackendSessionHandle-shaped object", async () => {
		const mockSession = {
			sessionId: "test-session-123",
			sendAndWait: async () => ({ data: { content: "response" } }),
			on: () => () => {},
			destroy: async () => {},
			abort: async () => {},
		};

		const mockClient = {
			createSession: async () => mockSession,
			resumeSession: async () => mockSession,
		};

		const mockManager = {
			start: async () => {},
			getClient: () => mockClient,
			stop: async () => {},
			isStarted: () => true,
		};

		const backend = new CopilotSessionBackend(mockManager as any);
		const handle = await backend.createSession({
			tools: [],
			cwd: "/tmp",
			streaming: true,
		});

		assert.equal(handle.sessionId, "test-session-123");
		assert.equal(typeof handle.send, "function");
		assert.equal(typeof handle.subscribe, "function");
		assert.equal(typeof handle.destroy, "function");
		assert.equal(typeof handle.abort, "function");
	});
});
