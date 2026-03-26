import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { AgentTool } from "@gsd/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { CopilotSessionBackend } from "./copilot-backend.js";
import { PiSessionBackend } from "./pi-backend.js";
import { bridgeAllTools, bridgeToolToCopilot } from "./tool-bridge.js";
import { isSessionError, isSessionIdle, translateCopilotEvent } from "./event-translator.js";

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

	it("sdk.ts copilot branch calls copilotBackend.setSettingsManager", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("copilotBackend.setSettingsManager(settingsManager)"),
			"sdk.ts must call copilotBackend.setSettingsManager(settingsManager) — BYOK requires it",
		);
	});

	it("sdk.ts setSettingsManager is called after setAccountingConfig", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		const accountingIdx = sdkSource.indexOf("copilotBackend.setAccountingConfig(");
		const settingsIdx = sdkSource.indexOf("copilotBackend.setSettingsManager(");
		assert.ok(accountingIdx > -1, "setAccountingConfig must exist");
		assert.ok(settingsIdx > -1, "setSettingsManager must exist");
		assert.ok(
			settingsIdx > accountingIdx,
			"setSettingsManager must be called after setAccountingConfig",
		);
	});

	it("sdk.ts cleanup calls copilotBackend.getDowngrades()", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("copilotBackend.getDowngrades()"),
			"sdk.ts must call copilotBackend.getDowngrades() in cleanup — telemetry needs downgrade records",
		);
	});

	it("sdk.ts cleanup calls copilotBackend.getByokActivations()", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("copilotBackend.getByokActivations()"),
			"sdk.ts must call copilotBackend.getByokActivations() in cleanup — telemetry needs BYOK records",
		);
	});

	it("sdk.ts cleanup calls formatPremiumSummary with downgrade and BYOK args", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("formatPremiumSummary("),
			"sdk.ts must call formatPremiumSummary in cleanup to produce structured telemetry report",
		);
	});

	it("sdk.ts cleanup emits telemetry via process.stderr.write", () => {
		const sdkSource = readFileSync("packages/pi-coding-agent/src/core/sdk.ts", "utf8");
		assert.ok(
			sdkSource.includes("[gsd:accounting]"),
			"sdk.ts must emit telemetry with [gsd:accounting] prefix via process.stderr.write",
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

// ── Bridge contract tests ─────────────────────────────────────────────────────
// These tests verify the shape contracts of the two bridge functions.
// They catch breakage from EITHER direction:
//   - GSD side: AgentTool shape changes (tool-bridge.ts)
//   - SDK side: SessionEvent shape changes (event-translator.ts)
// Keep these green after any upstream sync or SDK version bump.

describe("bridgeToolToCopilot contract", () => {
	function makeAgentTool(name: string, overrides: Partial<AgentTool<any>> = {}): AgentTool<any> {
		return {
			name,
			label: "Test Tool",
			description: "A test tool description",
			parameters: Type.Object({}, { additionalProperties: false }),
			execute: async () => ({
				content: [{ type: "text", text: "result" }],
				details: {},
			}),
			...overrides,
		};
	}

	it("bridged tool has required SDK tool shape properties", () => {
		const bridged = bridgeToolToCopilot(makeAgentTool("my_tool"), {});
		assert.ok(bridged, "bridgeToolToCopilot must return a defined value");
		// The SDK Tool shape requires name and description
		assert.equal(typeof (bridged as any).name, "string", "bridged tool must have name");
		assert.equal((bridged as any).name, "my_tool");
	});

	it("overridesBuiltInTool is true for known built-in tool names", () => {
		for (const builtIn of ["bash", "read", "edit", "write", "grep", "find", "ls"]) {
			const bridged = bridgeToolToCopilot(makeAgentTool(builtIn), {}) as any;
			assert.equal(
				bridged.overridesBuiltInTool,
				true,
				`bridged '${builtIn}' must have overridesBuiltInTool=true`,
			);
		}
	});

	it("overridesBuiltInTool is false for custom tool names", () => {
		const bridged = bridgeToolToCopilot(makeAgentTool("my_custom_tool"), {}) as any;
		assert.equal(bridged.overridesBuiltInTool, false, "custom tool must have overridesBuiltInTool=false");
	});

	it("handler calls tool.execute and returns text content", async () => {
		let executeCalled = false;
		const tool = makeAgentTool("capture_tool", {
			execute: async () => {
				executeCalled = true;
				return {
					content: [
						{ type: "text", text: "line one" },
						{ type: "text", text: "line two" },
					],
					details: {},
				};
			},
		});

		const bridged = bridgeToolToCopilot(tool, {}) as any;
		const result = await bridged.handler({});

		assert.ok(executeCalled, "handler must invoke tool.execute");
		assert.ok(typeof result === "string", "handler must return a string");
		assert.ok(result.includes("line one"), "handler result must include first text block");
		assert.ok(result.includes("line two"), "handler result must include second text block");
	});

	it("bridgeAllTools maps every AgentTool to a bridged tool", () => {
		const tools = [makeAgentTool("tool_a"), makeAgentTool("tool_b"), makeAgentTool("bash")];
		const bridged = bridgeAllTools(tools, {});
		assert.equal(bridged.length, 3, "bridgeAllTools must produce one entry per tool");
	});
});

describe("translateCopilotEvent contract", () => {
	it("maps assistant.turn_start to turn_start", () => {
		const result = translateCopilotEvent({ type: "assistant.turn_start" });
		assert.deepEqual(result, { type: "turn_start" });
	});

	it("maps assistant.message to message_end with correct content", () => {
		const result = translateCopilotEvent({
			type: "assistant.message",
			data: { content: "Hello, world!" },
		});
		assert.ok(result, "result must not be null");
		assert.equal(result!.type, "message_end");
		const msg = (result as any).message;
		assert.equal(msg.role, "assistant");
		assert.ok(Array.isArray(msg.content), "message.content must be an array");
		assert.equal(msg.content[0].text, "Hello, world!");
	});

	it("maps assistant.message_delta to message_update with delta", () => {
		const result = translateCopilotEvent({
			type: "assistant.message_delta",
			data: { deltaContent: "chunk" },
		});
		assert.ok(result, "result must not be null");
		assert.equal(result!.type, "message_update");
		const r = result as any;
		assert.equal(r.assistantMessageEvent.delta, "chunk");
		assert.equal(r.assistantMessageEvent.type, "text_delta");
		assert.equal(r.assistantMessageEvent.contentIndex, 0);
	});

	it("maps tool.execution_start with all required fields", () => {
		const result = translateCopilotEvent({
			type: "tool.execution_start",
			data: { toolCallId: "call-1", toolName: "bash", arguments: { cmd: "ls" } },
		}) as any;
		assert.ok(result);
		assert.equal(result.type, "tool_execution_start");
		assert.equal(result.toolCallId, "call-1");
		assert.equal(result.toolName, "bash");
		assert.deepEqual(result.args, { cmd: "ls" });
	});

	it("maps tool.execution_complete success path", () => {
		const result = translateCopilotEvent({
			type: "tool.execution_complete",
			data: { toolCallId: "call-1", toolName: "bash", success: true, result: "ok" },
		}) as any;
		assert.ok(result);
		assert.equal(result.type, "tool_execution_end");
		assert.equal(result.result, "ok");
		assert.equal(result.isError, false);
	});

	it("maps tool.execution_complete error path", () => {
		const result = translateCopilotEvent({
			type: "tool.execution_complete",
			data: { toolCallId: "call-2", toolName: "bash", success: false, error: "permission denied" },
		}) as any;
		assert.ok(result);
		assert.equal(result.type, "tool_execution_end");
		assert.equal(result.result, "permission denied");
		assert.equal(result.isError, true);
	});

	it("returns null for session.error", () => {
		assert.equal(translateCopilotEvent({ type: "session.error" }), null);
	});

	it("reports session error correctly via isSessionError", () => {
		assert.equal(isSessionError({ type: "session.error" }), true);
		assert.equal(isSessionError({ type: "session.idle" }), false);
		assert.equal(isSessionError({ type: "other" }), false);
	});

	it("returns null for assistant.usage (telemetry event, not forwarded)", () => {
		assert.equal(translateCopilotEvent({ type: "assistant.usage" }), null);
	});
});
