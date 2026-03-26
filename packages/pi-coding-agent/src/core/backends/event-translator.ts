import type { AgentEvent } from "@gsd/pi-agent-core";
import type { AssistantMessageEvent } from "@gsd/pi-ai";
import type { SessionEvent } from "./copilot-sdk-types.js";

/**
 * Minimal structural interface describing the subset of SDK SessionEvent
 * that the translator actually inspects. This acts as the internal contract
 * so changes to the SDK's full SessionEvent union surface here first.
 *
 * Any SDK SessionEvent satisfies this interface (structural compatibility).
 */
export interface CopilotSessionEvent {
	type: string;
	data?: Record<string, unknown>;
}

// Verify structural compatibility: SessionEvent must be assignable to CopilotSessionEvent.
// If the SDK changes the shape of its events in a breaking way, this line will error.
type _SessionEventCompatibilityCheck = SessionEvent extends CopilotSessionEvent ? true : never;

function toAssistantMessage(text: string) {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	} as any;
}

export function translateCopilotEvent(event: CopilotSessionEvent): AgentEvent | null {
	const data = event.data ?? {};

	switch (event.type) {
		case "assistant.turn_start":
			return { type: "turn_start" };

		case "assistant.message": {
			const message = toAssistantMessage(String(data.content ?? ""));
			return { type: "message_end", message } as AgentEvent;
		}

		case "assistant.message_delta": {
			const deltaContent = String(data.deltaContent ?? "");
			const message = toAssistantMessage(deltaContent);
			const assistantMessageEvent: AssistantMessageEvent = {
				type: "text_delta",
				contentIndex: 0,
				delta: deltaContent,
				partial: message,
			};
			return {
				type: "message_update",
				message,
				assistantMessageEvent,
			} as AgentEvent;
		}

		case "tool.execution_start":
			return {
				type: "tool_execution_start",
				toolCallId: String(data.toolCallId ?? ""),
				toolName: String(data.toolName ?? ""),
				args: data.arguments ?? {},
			};

		case "tool.execution_complete":
			return {
				type: "tool_execution_end",
				toolCallId: String(data.toolCallId ?? ""),
				toolName: String(data.toolName ?? ""),
				result: data.success ? data.result : data.error,
				isError: !Boolean(data.success),
			};

		case "session.idle":
		case "session.error":
		case "assistant.usage":
		default:
			return null;
	}
}

export function isSessionIdle(event: CopilotSessionEvent): boolean {
	return event.type === "session.idle";
}

export function isSessionError(event: CopilotSessionEvent): boolean {
	return event.type === "session.error";
}