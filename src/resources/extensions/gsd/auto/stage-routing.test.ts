/**
 * stage-routing.test.ts — Stage derivation map completeness and dispatch-to-config flow tests.
 *
 * Verifies:
 *   - UNIT_TYPE_TO_STAGE covers 100% of unit types in DISPATCH_RULES
 *   - All UNIT_TYPE_TO_STAGE values resolve to valid STAGE_TIER_MAP keys
 *   - Specific unit type → stage mappings (accounting tier check)
 *   - Source-shape: stage propagates dispatch → iterData → unitConfig
 *
 * Run: node --experimental-strip-types src/resources/extensions/gsd/auto/stage-routing.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { UNIT_TYPE_TO_STAGE } from "../auto-dispatch.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all literal unitType values from auto-dispatch.ts DISPATCH_RULES source. */
function extractDispatchUnitTypes(): string[] {
  const src = readFileSync(join(__dirname, "../auto-dispatch.ts"), "utf-8");
  const matches = [...src.matchAll(/unitType:\s*["']([^"']+)["']/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

/** Extract all stage keys from stage-router.ts STAGE_TIER_MAP source. */
function extractStageTierMapKeys(): string[] {
  const routerPath = join(
    __dirname,
    "../../../../../",
    "packages/pi-coding-agent/src/core/backends/accounting/stage-router.ts",
  );
  const src = readFileSync(routerPath, "utf-8");
  const matches = [
    ...src.matchAll(/["']([^"']+)["']:\s*["'](free|low|standard)["']/g),
  ];
  return matches.map((m) => m[1]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UNIT_TYPE_TO_STAGE map completeness", () => {
  it("covers all unit types that appear in DISPATCH_RULES", () => {
    const unitTypes = extractDispatchUnitTypes();
    assert.ok(
      unitTypes.length > 0,
      "Should extract at least one unit type from auto-dispatch.ts",
    );
    for (const unitType of unitTypes) {
      assert.ok(
        unitType in UNIT_TYPE_TO_STAGE,
        `UNIT_TYPE_TO_STAGE is missing entry for "${unitType}"`,
      );
    }
  });

  it("every mapped stage value exists as a key in STAGE_TIER_MAP", () => {
    const stageTierKeys = extractStageTierMapKeys();
    assert.ok(
      stageTierKeys.length > 0,
      "Should extract at least one stage tier key from stage-router.ts",
    );
    for (const [unitType, stage] of Object.entries(UNIT_TYPE_TO_STAGE)) {
      assert.ok(
        stageTierKeys.includes(stage),
        `Stage "${stage}" (from unit type "${unitType}") is not a key in STAGE_TIER_MAP`,
      );
    }
  });
});

describe("UNIT_TYPE_TO_STAGE specific mappings", () => {
  it('"execute-task" maps to stage "execute-task" (standard tier)', () => {
    assert.strictEqual(UNIT_TYPE_TO_STAGE["execute-task"], "execute-task");
  });

  it('"discuss-milestone" maps to stage "discuss-phase" (free tier)', () => {
    assert.strictEqual(
      UNIT_TYPE_TO_STAGE["discuss-milestone"],
      "discuss-phase",
    );
  });

  it('"verify-phase" maps to stage "verify-phase" (free tier)', () => {
    assert.strictEqual(UNIT_TYPE_TO_STAGE["verify-phase"], "verify-phase");
  });

  it('"research-slice" maps to stage "research-phase" (standard tier)', () => {
    assert.strictEqual(UNIT_TYPE_TO_STAGE["research-slice"], "research-phase");
  });

  it('"plan-milestone" maps to stage "plan-phase" (standard tier)', () => {
    assert.strictEqual(UNIT_TYPE_TO_STAGE["plan-milestone"], "plan-phase");
  });
});

describe("Stage propagation source-shape", () => {
  it("DispatchAction type in auto-dispatch.ts has stage?: string field", () => {
    const src = readFileSync(
      join(__dirname, "../auto-dispatch.ts"),
      "utf-8",
    );
    assert.ok(
      src.includes("stage?: string"),
      "DispatchAction should have stage?: string field in auto-dispatch.ts",
    );
  });

  it("resolveDispatch annotates result.stage from UNIT_TYPE_TO_STAGE", () => {
    const src = readFileSync(
      join(__dirname, "../auto-dispatch.ts"),
      "utf-8",
    );
    assert.ok(
      src.includes("result.stage =") || src.includes("result.stage="),
      "resolveDispatch should assign result.stage in auto-dispatch.ts",
    );
  });

  it("IterationData has stage?: field in types.ts", () => {
    const src = readFileSync(join(__dirname, "types.ts"), "utf-8");
    assert.ok(
      src.includes("stage?:"),
      "IterationData should have stage?: field in types.ts",
    );
  });

  it("phases.ts propagates stage from dispatchResult to iterData", () => {
    const src = readFileSync(join(__dirname, "phases.ts"), "utf-8");
    assert.ok(
      src.includes("stage: dispatchResult.stage"),
      "phases.ts should contain `stage: dispatchResult.stage` assignment",
    );
  });

  it("phases.ts references UNIT_TYPE_TO_STAGE when building unitConfig", () => {
    const src = readFileSync(join(__dirname, "phases.ts"), "utf-8");
    assert.ok(
      src.includes("UNIT_TYPE_TO_STAGE"),
      "phases.ts should import and use UNIT_TYPE_TO_STAGE for unitConfig construction",
    );
  });
});
