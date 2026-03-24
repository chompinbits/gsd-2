import { CopilotClient } from "@github/copilot-sdk";

const STOP_TIMEOUT_MS = 5000;

export class CopilotClientManager {
	private client: CopilotClient | null = null;

	private started = false;

	async start(): Promise<void> {
		if (this.started) {
			return;
		}

		this.client = new CopilotClient({
			autoStart: false,
			autoRestart: true,
		});

		await this.client.start();
		this.started = true;
	}

	getClient(): CopilotClient {
		if (!this.started || !this.client) {
			throw new Error("CopilotClientManager not started");
		}

		return this.client;
	}

	async stop(): Promise<void> {
		if (!this.started || !this.client) {
			return;
		}

		const client = this.client;
		let timeoutId: NodeJS.Timeout | undefined;

		try {
			const stopResult = await Promise.race([
				client.stop().then(() => "stopped" as const),
				new Promise<"timeout">((resolve) => {
					timeoutId = setTimeout(() => resolve("timeout"), STOP_TIMEOUT_MS);
				}),
			]);

			if (stopResult === "timeout") {
				await Promise.resolve(client.forceStop());
			}
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			this.client = null;
			this.started = false;
		}
	}

	isStarted(): boolean {
		return this.started;
	}
}