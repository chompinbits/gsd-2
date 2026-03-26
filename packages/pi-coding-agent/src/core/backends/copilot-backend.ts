import type { AgentEvent } from "@gsd/pi-agent-core";
import { approveAll } from "./copilot-sdk-types.js";
import type { CopilotSession, SessionEvent } from "./copilot-sdk-types.js";
import type { AccountingConfig } from "./accounting/index.js";
import {
	BudgetGuard,
	RequestTracker,
	getMultiplierValue,
	getStageMultiplierTier,
} from "./accounting/index.js";
import { suggestDowngrade } from "./accounting/downgrade.js";
import type { DowngradeSuggestion } from "./accounting/downgrade.js";
import { isQuotaExhausted, resolveByokProvider } from "./accounting/byok.js";
import type { BackendConfig, BackendSessionHandle, SendOptions, SessionBackend } from "./backend-interface.js";
import type { SettingsManager } from "../settings-manager.js";
import { CopilotClientManager } from "./copilot-client-manager.js";
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
	private readonly sdkSession: CopilotSession;

	constructor(sdkSession: CopilotSession) {
		this.sdkSession = sdkSession;
	}

	get sessionId(): string {
		return String(this.sdkSession.sessionId);
	}

	async send(prompt: string, options?: SendOptions): Promise<string> {
		const result = await this.sdkSession.sendAndWait({ prompt, attachments: options?.attachments as never });
		return String(result?.data?.content ?? "");
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		return this.sdkSession.on((event: SessionEvent) => {
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
	private _settingsManager?: SettingsManager;
	private _byokActivations: Array<{ type: string; baseUrl: string; percentUsed: number }> = [];

	constructor(clientManager: CopilotClientManager) {
		this.clientManager = clientManager;
	}

	setAccountingConfig(config: AccountingConfig): void {
		this.accountingConfig = config;
	}

	setSettingsManager(settingsManager: SettingsManager): void {
		this._settingsManager = settingsManager;
	}

	getTracker(): RequestTracker | undefined {
		return this._currentTracker;
	}

	getDowngrades(): Array<{ originalModel: string; downgradedTo: string; percentUsed: number }> {
		return this._downgrades;
	}

	getByokActivations(): Array<{ type: string; baseUrl: string; percentUsed: number }> {
		return this._byokActivations;
	}

	/**
	 * Pre-flight BYOK check. If budget is fully exhausted (hard_stop) and BYOK is configured,
	 * overrides model and injects provider config into BackendConfig.
	 * Per D-09: reads BYOK config fresh from SettingsManager each call (no caching).
	 */
	private _applyByokIfExhausted(config: BackendConfig): {
		config: BackendConfig;
		byokActive: boolean;
	} {
		if (!this.accountingConfig || !this._currentTracker || !this._settingsManager) {
			return { config, byokActive: false };
		}
		const budgetState = this._currentTracker.getState();
		if (!isQuotaExhausted(budgetState, this.accountingConfig)) {
			return { config, byokActive: false };
		}
		// D-09: Read BYOK config from settings at session-creation time
		const byokConfig = this._settingsManager.getByokConfig();
		const providerConfig = resolveByokProvider(byokConfig);
		if (!providerConfig) {
			// D-06: No BYOK configured — let BudgetExceededError propagate naturally
			return { config, byokActive: false };
		}
		// Override model and inject provider (per D-08)
		const byokAppliedConfig: BackendConfig = {
			...config,
			model: byokConfig!.model,
			provider: providerConfig,
		};
		this._byokActivations.push({
			type: providerConfig.type,
			baseUrl: providerConfig.baseUrl,
			percentUsed: budgetState.percentUsed,
		});
		return { config: byokAppliedConfig, byokActive: true };
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
		const { config: downgradedConfig, downgrade } = this._applyDowngradeIfNeeded(config);
		if (downgrade) {
			// D-06: No silent fallback — emit structured notification
			process.stderr.write(
				`[gsd:accounting] ⚠ Model downgraded: ${config.model ?? "default"} → ${downgrade.modelId} (${downgrade.reason})\n`,
			);
		}
		// Phase 12: BYOK fallback at hard_stop (after downgrade at warn)
		const { config: effectiveConfig, byokActive } = this._applyByokIfExhausted(downgradedConfig);
		if (byokActive) {
			// D-11: Emit BYOK activation notification
			process.stderr.write(
				`[gsd:accounting] ⚡ BYOK provider active: ${effectiveConfig.provider!.type}@${effectiveConfig.provider!.baseUrl} (premium quota exhausted)\n`,
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
			...(effectiveConfig.provider ? { provider: effectiveConfig.provider } : {}),
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
		const { config: downgradedConfig, downgrade } = this._applyDowngradeIfNeeded(config);
		if (downgrade) {
			// D-06: No silent fallback — emit structured notification
			process.stderr.write(
				`[gsd:accounting] ⚠ Model downgraded: ${config.model ?? "default"} → ${downgrade.modelId} (${downgrade.reason})\n`,
			);
		}
		// Phase 12: BYOK fallback at hard_stop (after downgrade at warn)
		const { config: effectiveConfig, byokActive } = this._applyByokIfExhausted(downgradedConfig);
		if (byokActive) {
			// D-11: Emit BYOK activation notification
			process.stderr.write(
				`[gsd:accounting] ⚡ BYOK provider active: ${effectiveConfig.provider!.type}@${effectiveConfig.provider!.baseUrl} (premium quota exhausted)\n`,
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
			...(effectiveConfig.provider ? { provider: effectiveConfig.provider } : {}),
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