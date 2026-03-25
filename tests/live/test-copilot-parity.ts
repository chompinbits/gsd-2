if (process.env.GSD_LIVE_TESTS !== "1") {
  console.log("SKIPPED: GSD_LIVE_TESTS not set");
  process.exit(1);
}

let manager: any;
let backend: any;

try {
  const { CopilotClientManager } = await import(
    "../../packages/pi-coding-agent/src/core/backends/copilot-client-manager.ts"
  );
  const { CopilotSessionBackend } = await import(
    "../../packages/pi-coding-agent/src/core/backends/copilot-backend.ts"
  );

  manager = new CopilotClientManager();

  try {
    await manager.start();
  } catch {
    console.log("SKIPPED: Copilot SDK not available");
    process.exit(1);
  }

  backend = new CopilotSessionBackend(manager);
  await backend.initialize();

  const handle = await backend.createSession({
    tools: [],
    cwd: process.cwd(),
    systemMessage: "You are a test assistant. Reply concisely.",
    stage: "live-test",
  });

  const copilotDiscussResponse = await handle.send(
    "List 3 key considerations for a TypeScript migration project. Be brief.",
  );
  const copilotPlanResponse = await handle.send(
    "Create a 2-task plan for adding a health check endpoint to a Node.js server. Use markdown format.",
  );

  if (typeof copilotDiscussResponse !== "string" || copilotDiscussResponse.trim().length <= 20) {
    throw new Error("Discuss response was empty or too short");
  }

  if (typeof copilotPlanResponse !== "string" || copilotPlanResponse.trim().length <= 20) {
    throw new Error("Plan response was empty or too short");
  }

  if (!/[#\-*]/.test(copilotPlanResponse)) {
    throw new Error("Plan response did not contain expected markdown indicators");
  }

  console.log("CHECK: discuss response length > 20 ✓");
  console.log("CHECK: plan response length > 20 ✓");
  console.log("CHECK: plan response includes markdown indicators ✓");
  console.log(
    `Evidence: discuss_length=${copilotDiscussResponse.length}, plan_length=${copilotPlanResponse.length}`,
  );

  await handle.destroy();
  console.log("PASS: Copilot backend produced valid discuss and plan responses");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}`);
  process.exit(1);
} finally {
  if (backend) {
    await backend.shutdown().catch(() => undefined);
  }
}