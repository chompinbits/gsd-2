import type { AgentEvent } from "@gsd/pi-agent-core";
import { approveAll } from "@github/copilot-sdk";
import type { AccountingConfig } from "./accounting/index.js";
import {
	BudgetGuard,
	RequestTracker,
	getMultiplierValue,
	getStageMultiplierTier,
} from "./accounting/index.js";
import { suggestDowngrade } from "./accounting/downgrade.js";
import type { DowngradeSuggestion } from "./accounting/downgrade.js";
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
	private _downgrades: Array<{ originalModel: string; downgradedTo: string; percentUsed: number }> = [];

	constructor(clientManager: CopilotClientManager) {
		this.clientManager = clientManager;
	}

	setAccountingConfig(config: AccountingConfig): void {
		this.accountingConfig = config;
	}

	getTracker(): RequestTracker | undefined {
		return this._currentTracker;
	}

	getDowngrades(): Array<{ originalModel: string; downgradedTo: string; percentUsed: number }> {
		return this._downgrades;
	}

	/**
	 * Pre-flight downgrade check (D-03). Evaluates budget state and
	 * substitutes the requested model with a 0× model if under pressure.
	 * Returns the (possibly modified) config and the suggestion, or null if no downgrade.
	 */
	private _applyDowngradeIfNeeded(config: BackendConfig): {
		config: BackendConfig;
		downgrade: DowngradeSuggestion | null;
	} {
		if (!this.accountingConfig || !this._currentTracker) {
			return { config, downgrade: null };
		}
		const budgetState = this._currentTracker.getState();
		const suggestion = suggestDowngrade(budgetState, this.accountingConfig);
		if (!suggestion) {
			return { config, downgrade: null };
		}
		// Override model in config (D-07: new sessions only, not mid-send)
		const downgradedConfig: BackendConfig = {
			...config,
			model: suggestion.modelId,
		};
		this._downgrades.push({
			originalModel: config.model ?? "default",
			downgradedTo: suggestion.modelId,
			percentUsed: suggestion.percentUsed,
		});
		return { config: downgradedConfig, downgrade: suggestion };
	}

	async initialize(): Promise<void> {
		await this.clientManager.start();
	}

	async createSession(config: BackendConfig): Promise<BackendSessionHandle> {
		const { config: effectiveConfig, downgrade } = this._applyDowngradeIfNeeded(config);
		if (downgrade) {
			// D-06: No silent fallback — emit structured notification
			process.stderr.write(
				`[gsd:accounting] ⚠ Model downgraded: ${config.model ?? "default"} → ${downgrade.modelId} (${downgrade.reason})\n`,
			);
		}
		const client = this.clientManager.getClient();
		const sdkTools = bridgeAllTools(effectiveConfig.tools, {});
		const sessionConfig = {
			model: effectiveConfig.model,
			streaming: effectiveConfig.streaming ?? true,
			tools: sdkTools,
			onPermissionRequest: approveAll,
			sessionId: effectiveConfig.sessionId,
			workingDirectory: effectiveConfig.cwd,
			configDir: effectiveConfig.configDir,
			infiniteSessions: { enabled: true },
			...(effectiveConfig.systemMessage ? { systemMessage: { content: effectiveConfig.systemMessage } } : {}),
		};

		const session = await client.createSession(sessionConfig);
		const rawHandle = new CopilotSessionHandle(session);

		if (this.accountingConfig) {
			const sessionId = effectiveConfig.sessionId ?? rawHandle.sessionId;
			const tracker = new RequestTracker(sessionId, this.accountingConfig.budgetLimit);
			const guard = new BudgetGuard(this.accountingConfig, tracker);
			this._currentTracker = tracker;
			return new AccountingSessionHandle(rawHandle, tracker, guard, effectiveConfig.model ?? "unknown", effectiveConfig.stage ?? "unknown");
		}

		return rawHandle;
	}

	async resumeSession(sessionId: string, config: BackendConfig): Promise<BackendSessionHandle> {
		const { config: effectiveConfig, downgrade } = this._applyDowngradeIfNeeded(config);
		if (downgrade) {
			// D-06: No silent fallback — emit structured notification
			process.stderr.write(
				`[gsd:accounting] ⚠ Model downgraded: ${config.model ?? "default"} → ${downgrade.modelId} (${downgrade.reason})\n`,
			);
		}
		const client = this.clientManager.getClient();
		const sdkTools = bridgeAllTools(effectiveConfig.tools, {});
		const session = await client.resumeSession(sessionId, {
			tools: sdkTools,
			onPermissionRequest: approveAll,
			workingDirectory: effectiveConfig.cwd,
			configDir: effectiveConfig.configDir,
			infiniteSessions: { enabled: true },
		});
		const rawHandle = new CopilotSessionHandle(session);

		if (this.accountingConfig) {
			const tracker = new RequestTracker(sessionId, this.accountingConfig.budgetLimit);
			const guard = new BudgetGuard(this.accountingConfig, tracker);
			this._currentTracker = tracker;
			return new AccountingSessionHandle(rawHandle, tracker, guard, effectiveConfig.model ?? "unknown", effectiveConfig.stage ?? "unknown");
		}

		return rawHandle;
	}

	async shutdown(): Promise<void> {
		await this.clientManager.stop();
	}
}