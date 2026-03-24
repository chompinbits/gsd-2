import type { AgentEvent } from "@gsd/pi-agent-core";

export interface CopilotSessionEvent {
	type: string;
	data?: Record<string, any>;
}

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
			return {
				type: "message_update",
				message,
				assistantMessageEvent: { deltaContent },
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