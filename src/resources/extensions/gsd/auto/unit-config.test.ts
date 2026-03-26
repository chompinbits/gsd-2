/**
 * unit-config.test.ts — Tool profile map coverage and UnitSessionConfig threading tests.
 *
 * Verifies:
 *   - UNIT_TYPE_TOOL_PROFILE covers 100% of unit types in DISPATCH_RULES
 *   - resolveToolProfile returns correct tool lists per profile
 *   - Specific unit type → profile mappings
 *   - Source-shape: UnitSessionConfig threaded from runUnit → newSession
 *
 * Run: node --experimental-strip-types src/resources/extensions/gsd/auto/unit-config.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  UNIT_TYPE_TOOL_PROFILE,
  resolveToolProfile,
} from "../auto-dispatch.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all literal unitType values from auto-dispatch.ts DISPATCH_RULES source. */
function extractDispatchUnitTypes(): string[] {
  const src = readFileSync(join(__dirname, "../auto-dispatch.ts"), "utf-8");
  const matches = [...src.matchAll(/unitType:\s*["']([^"']+)["']/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UNIT_TYPE_TOOL_PROFILE map completeness", () => {
  it("covers all unit types that appear in DISPATCH_RULES", () => {
    const unitTypes = extractDispatchUnitTypes();
    assert.ok(
      unitTypes.length > 0,
      "Should extract at least one unit type from auto-dispatch.ts",
    );
    for (const unitType of unitTypes) {
      assert.ok(
        unitType in UNIT_TYPE_TOOL_PROFILE,
        `UNIT_TYPE_TOOL_PROFILE is missing entry for "${unitType}"`,
      );
    }
  });
});

describe("resolveToolProfile — coding profile", () => {
  it('returns array containing "write"', () => {
    const tools = resolveToolProfile("coding");
    assert.ok(
      tools.includes("write"),
      `Expected "write" in coding profile, got: ${tools.join(", ")}`,
    );
  });

  it('returns array containing "edit"', () => {
    const tools = resolveToolProfile("coding");
    assert.ok(
      tools.includes("edit"),
      `Expected "edit" in coding profile, got: ${tools.join(", ")}`,
    );
  });

  it('returns array containing "read", "bash", "lsp"', () => {
    const tools = resolveToolProfile("coding");
    assert.ok(tools.includes("read"), `Expected "read" in coding profile`);
    assert.ok(tools.includes("bash"), `Expected "bash" in coding profile`);
    assert.ok(tools.includes("lsp"), `Expected "lsp" in coding profile`);
  });
});

describe("resolveToolProfile — readonly profile", () => {
  it('does NOT contain "write"', () => {
    const tools = resolveToolProfile("readonly");
    assert.ok(
      !tools.includes("write"),
      `Did not expect "write" in readonly profile, got: ${tools.join(", ")}`,
    );
  });

  it('does NOT contain "edit"', () => {
    const tools = resolveToolProfile("readonly");
    assert.ok(
      !tools.includes("edit"),
      `Did not expect "edit" in readonly profile, got: ${tools.join(", ")}`,
    );
  });

  it('returns array containing "read", "bash", "lsp"', () => {
    const tools = resolveToolProfile("readonly");
    assert.ok(tools.includes("read"), `Expected "read" in readonly profile`);
    assert.ok(tools.includes("bash"), `Expected "bash" in readonly profile`);
    assert.ok(tools.includes("lsp"), `Expected "lsp" in readonly profile`);
  });
});

describe("UNIT_TYPE_TOOL_PROFILE specific mappings", () => {
  it('"execute-task" maps to "coding" profile', () => {
    assert.strictEqual(UNIT_TYPE_TOOL_PROFILE["execute-task"], "coding");
  });

  it('"discuss-milestone" maps to "readonly" profile', () => {
    assert.strictEqual(UNIT_TYPE_TOOL_PROFILE["discuss-milestone"], "readonly");
  });

  it('"verify-phase" maps to "readonly" profile', () => {
    assert.strictEqual(UNIT_TYPE_TOOL_PROFILE["verify-phase"], "readonly");
  });
});

describe("UnitSessionConfig source-shape threading", () => {
  it("UnitSessionConfig interface is defined in types.ts", () => {
    const src = readFileSync(join(__dirname, "types.ts"), "utf-8");
    assert.ok(
      src.includes("UnitSessionConfig"),
      "types.ts should define UnitSessionConfig",
    );
  });

  it("runUnit accepts unitConfig?: UnitSessionConfig parameter", () => {
    const src = readFileSync(join(__dirname, "run-unit.ts"), "utf-8");
    assert.ok(
      src.includes("unitConfig?: UnitSessionConfig"),
      "Expected unitConfig?: UnitSessionConfig parameter in run-unit.ts",
    );
  });

  it("runUnit passes activeToolNames from unitConfig to newSession", () => {
    const src = readFileSync(join(__dirname, "run-unit.ts"), "utf-8");
    assert.ok(
      src.includes("activeToolNames: unitConfig"),
      "Expected activeToolNames: unitConfig in run-unit.ts newSession call",
    );
  });

  it("ExtensionCommandContext.newSession accepts activeToolNames option (source-shape)", () => {
    const typesPath = join(
      __dirname,
      "../../../../../",
      "packages/pi-coding-agent/src/core/extensions/types.ts",
    );
    const src = readFileSync(typesPath, "utf-8");
    assert.ok(
      src.includes("activeToolNames?: string[]"),
      "Expected activeToolNames?: string[] in extensions/types.ts newSession options",
    );
  });

  it("AgentSession.newSession calls setActiveToolsByName when activeToolNames provided (source-shape)", () => {
    const sessionPath = join(
      __dirname,
      "../../../../../",
      "packages/pi-coding-agent/src/core/agent-session.ts",
    );
    const src = readFileSync(sessionPath, "utf-8");
    assert.ok(
      src.includes("setActiveToolsByName"),
      "Expected setActiveToolsByName call in agent-session.ts",
    );
    assert.ok(
      src.includes("options?.activeToolNames"),
      "Expected options?.activeToolNames reference in agent-session.ts",
    );
  });
});
