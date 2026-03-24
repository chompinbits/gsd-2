import { randomUUID } from "node:crypto";
import type { AgentTool, AgentToolResult } from "@gsd/pi-agent-core";
import { defineTool } from "@github/copilot-sdk";

export interface ToolBridgeContext {
	signal?: AbortSignal;
}

function extractTextFromToolResult(result: AgentToolResult<unknown>): string {
	return result.content
		.filter((block): block is { type: "text"; text: string } => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

export function bridgeToolToCopilot(tool: AgentTool, context: ToolBridgeContext) {
	return defineTool(tool.name, {
		description: tool.description,
		parameters: tool.parameters,
		handler: async (args: unknown) => {
			const toolCallId = randomUUID();
			const result = await tool.execute(toolCallId, args as never, context.signal);
			return extractTextFromToolResult(result);
		},
	});
}

export function bridgeAllTools(tools: AgentTool[], context: ToolBridgeContext) {
	return tools.map((tool) => bridgeToolToCopilot(tool, context));
}