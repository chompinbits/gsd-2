import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CopilotSessionBackend } from "../copilot-backend.js";

type MockSdkSession = {
  sessionId: string;
  sentPayloads: Array<{ prompt: string; attachments?: unknown[] }>;
  sendAndWait: (payload: { prompt: string; attachments?: unknown[] }) => Promise<{ data: { content: string } }>;
  on: (_handler: (event: unknown) => void) => () => void;
  destroy: () => Promise<void>;
  abort: () => Promise<void>;
};

function makeMockSession(sessionId: string): MockSdkSession {
  const sentPayloads: Array<{ prompt: string; attachments?: unknown[] }> = [];

  return {
    sessionId,
    sentPayloads,
    sendAndWait: async (payload: { prompt: string; attachments?: unknown[] }) => {
      sentPayloads.push(payload);
      return { data: { content: `ok:${payload.prompt}` } };
    },
    on: () => () => {},
    destroy: async () => {},
    abort: async () => {},
  };
}

function makeBackendHarness() {
  const createdSessions: MockSdkSession[] = [];
  const resumedSessions: MockSdkSession[] = [];

  const client = {
    createSession: async (_config: unknown) => {
      const session = makeMockSession(`create-${createdSessions.length + 1}`);
      createdSessions.push(session);
      return session;
    },
    resumeSession: async (sessionId: string, _config: unknown) => {
      const session = makeMockSession(sessionId);
      resumedSessions.push(session);
      return session;
    },
  };

  const manager = {
    start: async () => {},
    getClient: () => client,
    stop: async () => {},
    isStarted: () => true,
  };

  return {
    manager,
    createdSessions,
    resumedSessions,
  };
}

function makeAccountingBackend() {
  const harness = makeBackendHarness();
  const backend = new CopilotSessionBackend(harness.manager as any);
  backend.setAccountingConfig({ budgetLimit: 300, warnThreshold: 0.8, hardStop: true, freeTierFallback: { enabled: false, thresholdPolicy: "warn" } });
  return { backend, harness };
}

describe("stage propagation through accounting backend", () => {
  it("uses configured stage from createSession and records plan-phase as standard tier", async () => {
    const { backend, harness } = makeAccountingBackend();
    await backend.initialize();

    const handle = await backend.createSession({
      tools: [],
      cwd: "/tmp",
      model: "claude-sonnet-4-6",
      stage: "plan-phase",
    });

    const response = await handle.send("plan run", { attachments: [{ type: "file", path: "doc.md" }] });
    assert.equal(response, "ok:plan run");

    const tracker = backend.getTracker();
    assert.ok(tracker, "tracker should be available when accounting is configured");
    const summary = tracker.getSummary();

    assert.equal(summary.byStage["plan-phase"].count, 1);
    assert.equal(summary.byStage["plan-phase"].premiumCost, 1);

    assert.equal(harness.createdSessions.length, 1);
    assert.deepEqual(harness.createdSessions[0].sentPayloads[0].attachments, [{ type: "file", path: "doc.md" }]);
  });

  it("maps discuss-phase to free tier (0x premium cost)", async () => {
    const { backend } = makeAccountingBackend();

    const handle = await backend.createSession({
      tools: [],
      cwd: "/tmp",
      model: "gpt-4o",
      stage: "discuss-phase",
    });

    await handle.send("discussion prompt");

    const tracker = backend.getTracker();
    assert.ok(tracker);
    const summary = tracker.getSummary();

    assert.equal(summary.byStage["discuss-phase"].count, 1);
    assert.equal(summary.byStage["discuss-phase"].premiumCost, 0);
    assert.equal(summary.totalPremiumCost, 0);
  });

  it("supports per-send stage override over configured default", async () => {
    const { backend } = makeAccountingBackend();

    const handle = await backend.createSession({
      tools: [],
      cwd: "/tmp",
      model: "claude-sonnet-4-6",
      stage: "plan-phase",
    });

    await handle.send("override test", { stage: "discuss-phase" });

    const tracker = backend.getTracker();
    assert.ok(tracker);
    const summary = tracker.getSummary();

    assert.equal(summary.byStage["discuss-phase"].count, 1);
    assert.equal(summary.byStage["discuss-phase"].premiumCost, 0);
    assert.equal(summary.byStage["plan-phase"], undefined);
  });

  it("falls back to unknown stage when stage is omitted", async () => {
    const { backend } = makeAccountingBackend();

    const handle = await backend.createSession({
      tools: [],
      cwd: "/tmp",
      model: "claude-sonnet-4-6",
    });

    await handle.send("legacy caller");

    const tracker = backend.getTracker();
    assert.ok(tracker);
    const summary = tracker.getSummary();

    assert.equal(summary.byStage.unknown.count, 1);
    assert.equal(summary.byStage.unknown.premiumCost, 1);
  });

  it("preserves stage through resumeSession path", async () => {
    const { backend, harness } = makeAccountingBackend();

    const handle = await backend.resumeSession("resume-123", {
      tools: [],
      cwd: "/tmp",
      model: "gpt-4o",
      stage: "discuss-phase",
    });

    await handle.send("resume path call");

    const tracker = backend.getTracker();
    assert.ok(tracker);
    const summary = tracker.getSummary();

    assert.equal(summary.byStage["discuss-phase"].count, 1);
    assert.equal(summary.byStage["discuss-phase"].premiumCost, 0);
    assert.equal(harness.resumedSessions.length, 1);
    assert.equal(harness.resumedSessions[0].sessionId, "resume-123");
  });
});

describe("sdk passthrough contract for SendOptions", () => {
  it("withCopilotSessionCleanup forwards send options to underlying handle", () => {
    const source = readFileSync(new URL("../../sdk.ts", import.meta.url), "utf8");

    assert.ok(
      source.includes("send(prompt: string, options?: SendOptions)"),
      "wrapper send signature should accept SendOptions",
    );
    assert.ok(
      source.includes("return handle.send(prompt, options);"),
      "wrapper should pass SendOptions through unchanged",
    );
  });
});
