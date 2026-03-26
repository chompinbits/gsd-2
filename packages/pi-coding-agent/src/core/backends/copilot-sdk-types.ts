/**
 * SDK type facade for @github/copilot-sdk.
 *
 * Re-exports only the types and values that the copilot integration layer
 * actually uses. When the SDK version changes and types shift, this is the
 * ONE file to update — not scattered imports across copilot-backend.ts,
 * copilot-client-manager.ts, tool-bridge.ts, and event-translator.ts.
 *
 * Verified against: @github/copilot-sdk 0.2.0
 * When upgrading the SDK: update the version annotation above and reconcile
 * any type changes here before touching other files.
 */

// Client lifecycle
export { CopilotClient } from "@github/copilot-sdk";
export type { CopilotClientOptions } from "@github/copilot-sdk";

// Session class (concrete type — replaces `any` in CopilotSessionHandle)
export { CopilotSession } from "@github/copilot-sdk";

// Session configuration and events
export type { SessionConfig, SessionEvent } from "@github/copilot-sdk";

// Tool definition API
export { defineTool, approveAll } from "@github/copilot-sdk";
export type { Tool } from "@github/copilot-sdk";
