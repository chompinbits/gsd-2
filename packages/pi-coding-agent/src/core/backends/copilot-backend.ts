import type { AgentEvent } from "@gsd/pi-agent-core";
import { approveAll } from "@github/copilot-sdk";
import type { AccountingConfig } from "./accounting/index.js";
import {
	BudgetGuard,
	RequestTracker,
	getMultiplierValue,
	getStageMultiplierTier,
} from "./accounting/index.js";
import type { BackendConfig, BackendSessionHandle, SendOptions, SessionBackend } from "./backend-interface.js";
import { CopilotClientManager } from "./copilot-client-manager.js";
import type { CopilotSessionEvent } from "./event-translator.js";
import { isSessionError, isSessionIdle, translateCopilotEvent } from "./event-translator.js";
import { bridgeAllTools } from "./tool-bridge.js";

class AccountingSessionHandle implements BackendSessionHandle {
	private readonly inner: BackendSessionHandle;
	private readonly tracker: RequestTracker;
	private readonly guard: BudgetGuard;
	private readonly model: string;
	private readonly defaultStage: string;

	constructor(
		inner: BackendSessionHandle,
		tracker: RequestTracker,
		guard: BudgetGuard,
		model: string,
		defaultStage = "unknown",
	) {
		this.inner = inner;
		this.tracker = tracker;
		this.guard = guard;
		this.model = model;
		this.defaultStage = defaultStage;
	}

	get sessionId(): string {
		return this.inner.sessionId;
	}

	async send(prompt: string, options?: SendOptions): Promise<string> {
		const stage = options?.stage ?? this.defaultStage;
		const tier = getStageMultiplierTier(stage);
		const cost = getMultiplierValue(tier);

		const checkResult = this.guard.check(cost);
		if (checkResult !== "ok") {
			process.stderr.write(`[gsd] Budget warning: ${checkResult.message}\n`);
		}

		const response = await this.inner.send(prompt, options);

		this.tracker.record(this.model, stage, tier);

		return response;
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		return this.inner.subscribe(listener);
	}

	async destroy(): Promise<void> {
		await this.inner.destroy();
	}

	async abort(): Promise<void> {
		await this.inner.abort();
	}
}

class CopilotSessionHandle implements BackendSessionHandle {
	private readonly sdkSession: any;

	constructor(sdkSession: any) {
		this.sdkSession = sdkSession;
	}

	get sessionId(): string {
		return String(this.sdkSession.sessionId);
	}

	async send(prompt: string, options?: SendOptions): Promise<string> {
		const result = await this.sdkSession.sendAndWait({ prompt, attachments: options?.attachments });
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
	private readonly clientManager: CopilotClientManager;

	private accountingConfig?: AccountingConfig;
	private _currentTracker?: RequestTracker;

	constructor(clientManager: CopilotClientManager) {
		this.clientManager = clientManager;
	}

	setAccountingConfig(config: AccountingConfig): void {
		this.accountingConfig = config;
	}

	getTracker(): RequestTracker | undefined {
		return this._currentTracker;
	}

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
		const rawHandle = new CopilotSessionHandle(session);

		if (this.accountingConfig) {
			const sessionId = config.sessionId ?? rawHandle.sessionId;
			const tracker = new RequestTracker(sessionId, this.accountingConfig.budgetLimit);
			const guard = new BudgetGuard(this.accountingConfig, tracker);
			this._currentTracker = tracker;
			return new AccountingSessionHandle(rawHandle, tracker, guard, config.model ?? "unknown", config.stage ?? "unknown");
		}

		return rawHandle;
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
		const rawHandle = new CopilotSessionHandle(session);

		if (this.accountingConfig) {
			const tracker = new RequestTracker(sessionId, this.accountingConfig.budgetLimit);
			const guard = new BudgetGuard(this.accountingConfig, tracker);
			this._currentTracker = tracker;
			return new AccountingSessionHandle(rawHandle, tracker, guard, config.model ?? "unknown", config.stage ?? "unknown");
		}

		return rawHandle;
	}

	async shutdown(): Promise<void> {
		await this.clientManager.stop();
	}
}