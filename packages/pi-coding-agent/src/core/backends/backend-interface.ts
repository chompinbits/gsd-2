import type { AgentEvent, AgentTool } from "@gsd/pi-agent-core";

export interface BackendConfig {
	model?: string;
	tools: AgentTool[];
	systemMessage?: string;
	cwd: string;
	configDir?: string;
	sessionId?: string;
	streaming?: boolean;
}

export interface BackendSessionHandle {
	readonly sessionId: string;
	send(prompt: string, attachments?: unknown[]): Promise<string>;
	subscribe(listener: (event: AgentEvent) => void): () => void;
	destroy(): Promise<void>;
	abort(): Promise<void>;
}

export interface SessionBackend {
	readonly name: string;
	initialize(): Promise<void>;
	createSession(config: BackendConfig): Promise<BackendSessionHandle>;
	resumeSession(sessionId: string, config: BackendConfig): Promise<BackendSessionHandle>;
	shutdown(): Promise<void>;
}