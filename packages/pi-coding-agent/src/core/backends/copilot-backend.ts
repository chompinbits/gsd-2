import type { AgentEvent } from "@gsd/pi-agent-core";
import { approveAll } from "@github/copilot-sdk";
import type { BackendConfig, BackendSessionHandle, SessionBackend } from "./backend-interface.js";
import { CopilotClientManager } from "./copilot-client-manager.js";
import type { CopilotSessionEvent } from "./event-translator.js";
import { isSessionError, isSessionIdle, translateCopilotEvent } from "./event-translator.js";
import { bridgeAllTools } from "./tool-bridge.js";

class CopilotSessionHandle implements BackendSessionHandle {
	constructor(private readonly sdkSession: any) {}

	get sessionId(): string {
		return String(this.sdkSession.sessionId);
	}

	async send(prompt: string, attachments?: unknown[]): Promise<string> {
		const result = await this.sdkSession.sendAndWait({ prompt, attachments });
		return String(result?.data?.content ?? "");
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		return this.sdkSession.on((event: CopilotSessionEvent) => {
			if (isSessionIdle(event) || isSessionError(event)) {
				return;
			}

			const translated = translateCopilotEvent(event);
			if (translated) {
				listener(translated);
			}
		});
	}

	async destroy(): Promise<void> {
		await this.sdkSession.destroy();
	}

	async abort(): Promise<void> {
		await this.sdkSession.abort();
	}
}

export class CopilotSessionBackend implements SessionBackend {
	readonly name = "copilot";

	constructor(private readonly clientManager: CopilotClientManager) {}

	async initialize(): Promise<void> {
		await this.clientManager.start();
	}

	async createSession(config: BackendConfig): Promise<BackendSessionHandle> {
		const client = this.clientManager.getClient();
		const sdkTools = bridgeAllTools(config.tools, {});
		const sessionConfig = {
			model: config.model,
			streaming: config.streaming ?? true,
			tools: sdkTools,
			onPermissionRequest: approveAll,
			sessionId: config.sessionId,
			workingDirectory: config.cwd,
			configDir: config.configDir,
			infiniteSessions: { enabled: true },
			...(config.systemMessage ? { systemMessage: { content: config.systemMessage } } : {}),
		};

		const session = await client.createSession(sessionConfig);
		return new CopilotSessionHandle(session);
	}

	async resumeSession(sessionId: string, config: BackendConfig): Promise<BackendSessionHandle> {
		const client = this.clientManager.getClient();
		const sdkTools = bridgeAllTools(config.tools, {});
		const session = await client.resumeSession(sessionId, {
			tools: sdkTools,
			onPermissionRequest: approveAll,
			workingDirectory: config.cwd,
			configDir: config.configDir,
			infiniteSessions: { enabled: true },
		});
		return new CopilotSessionHandle(session);
	}

	async shutdown(): Promise<void> {
		await this.clientManager.stop();
	}
}