export type { BackendConfig, BackendSessionHandle, SessionBackend } from "./backend-interface.js";
export { bridgeAllTools, bridgeToolToCopilot } from "./tool-bridge.js";
export { isSessionError, isSessionIdle, translateCopilotEvent } from "./event-translator.js";
export type { CopilotSessionEvent } from "./event-translator.js";
export type { ToolBridgeContext } from "./tool-bridge.js";