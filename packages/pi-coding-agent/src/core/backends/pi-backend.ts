import type { BackendConfig, BackendSessionHandle, SessionBackend } from "./backend-interface.js";

export class PiSessionBackend implements SessionBackend {
	readonly name = "pi";

	async initialize(): Promise<void> {
		// No-op: Pi runtime path does not require a standalone client lifecycle.
	}

	createSession(_config: BackendConfig): Promise<BackendSessionHandle> {
		throw new Error(
			"PiSessionBackend.createSession not used directly - Pi sessions are created via createAgentSession legacy path",
		);
	}

	resumeSession(_sessionId: string, _config: BackendConfig): Promise<BackendSessionHandle> {
		throw new Error(
			"PiSessionBackend.resumeSession not used directly - Pi sessions are created via createAgentSession legacy path",
		);
	}

	async shutdown(): Promise<void> {
		// No-op: Pi runtime path does not require teardown.
	}
}